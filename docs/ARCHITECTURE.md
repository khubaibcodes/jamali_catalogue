# How this app works

Written for someone who knows React but hasn't used Supabase, row level
security, or the Next.js App Router in anger. It explains the parts that are
easy to get wrong, and *why* they're built the way they are.

The single idea the whole design turns on:

> **Wholesale and reseller rates must never reach a customer's browser — and
> the database, not the interface, is what stops them.**

---

## The two audiences

```
/                     public shopfront      anyone
/article/[code]       one article           anyone
/admin                the manager           signed in
/login                sign in               anyone
```

One database. Two doors. What separates them is not which components render —
it's which rows and columns Postgres will hand out.

---

## Request flow

```
   Browser
      │
      │  cookie: sb-<ref>-auth-token
      ▼
┌───────────────┐   no session + /admin
│   proxy.ts    │ ─────────────────────────►  redirect /login
│               │
│ refreshes the │   session ok
│ access token  │ ──────────────┐
└───────────────┘               │
                                ▼
                    ┌──────────────────────┐
                    │  Route (server)      │
                    │                      │
                    │  /        anonClient │──┐  no cookie at all
                    │  /admin   serverClient│──┤  cookie → user → role
                    └──────────────────────┘  │
                                              ▼
                              ┌──────────────────────────────┐
                              │          Supabase            │
                              │                              │
                              │  1. Auth: is this JWT valid? │
                              │  2. RLS:  which ROWS?        │
                              │  3. GRANT: which COLUMNS?    │
                              │  4. Storage policies         │
                              └──────────────────────────────┘
```

Steps 2 and 3 are separate mechanisms and you need both. More on that below.

---

## 1. Where the session actually lives

`@supabase/ssr` stores the session in a **cookie**, not `localStorage`.

That matters because the server has to read it. A server component cannot see
`localStorage` — it only ever receives headers. So the session has to travel as
a cookie or the server could never know who you are.

```
sb-ngnlmlrevtyqdbkalvjn-auth-token = base64-<json>
```

The value may be **chunked** across `...auth-token.0`, `...auth-token.1` when
it exceeds the ~4 KB cookie limit, and is prefixed `base64-`.

**Practical consequence:** a debugging script that pokes at `localStorage`
looking for the token will find nothing and look like a bug. To read the token
by hand you must parse `document.cookie`, join the chunks in order, strip the
`base64-` prefix, then `atob` it. This caught us during testing — the first
attempt returned "Expected 3 parts in JWT; got 1" purely because it read an
empty string from the wrong place.

Three clients exist, and picking the wrong one is a real bug:

| Client | Used by | Reads cookies? |
| --- | --- | --- |
| `browserClient()` | client components in `/admin` | yes |
| `serverClient()` | server components, needs the user | yes |
| `anonClient()` | **the public shopfront** | **no** |

`anonClient` ignoring cookies is deliberate. See §5.

---

## 2. `proxy.ts`, not `middleware.ts`

**Next.js 16 renamed the middleware convention to `proxy`.** A file called
`middleware.ts` is silently ignored — no error, no warning, the auth gate just
wouldn't exist. This is the single easiest way to lose the whole gate.

It does two jobs:

```ts
// 1. Refresh. Access tokens are short-lived; without this the session dies
//    mid-use and the manager starts throwing permission errors that look
//    like application bugs.
const { data: { user } } = await supabase.auth.getUser();

// 2. Gate.
if (!user && path.startsWith("/admin")) return redirect("/login?next=" + path);
```

Note `getUser()`, **not** `getSession()`. `getSession()` only decodes the
cookie, which the client controls and could have edited. `getUser()`
revalidates against Supabase. Trusting `getSession()` for an authorisation
decision is the classic Supabase mistake.

The proxy is also the only place cookies are *written*. Server components are
forbidden from setting cookies, which is why `serverClient()`'s `setAll` has a
swallowed try/catch — it's a no-op there by design.

---

## 3. RLS is the lock; the UI is decoration

The manager hides reseller and wholesale inputs from staff. **That is not the
security.** Anyone can open devtools and issue their own query.

The real protection: `product_trade_rates` is a **separate table** with **no
policy for anon and none for staff**. With RLS enabled, a table with no
applicable policy denies everything.

```sql
alter table public.product_trade_rates enable row level security;

create policy "owner reads trade rates"
  on public.product_trade_rates for select
  to authenticated
  using (public.is_owner());     -- and nothing else, for anyone else
```

Why a separate table rather than columns on `products`? Because then safety
would depend on every `select` ever written being correct. Splitting it makes
the protection structural: **there is no row in `products` that carries a
wholesale rate**, so no query against `products` can leak one.

Verified by impersonating a staff member and calling the REST API directly,
bypassing the UI entirely:

```
GET /rest/v1/product_trade_rates   → 200 []      ← staff, own valid token
GET /rest/v1/products              → 200 [...]   ← same token, works fine
```

Empty array, not an error. **Callers must read "no rows" as "not permitted",
not as "not set".**

Staff also cannot promote themselves — only an owner may write
`profiles.role`, so the update matches zero rows and silently does nothing.

---

## 4. RLS picks rows; GRANTs pick columns

This is the part that bites, twice so far.

RLS answers *which rows may I see*. It cannot hide a **column** from someone
entitled to the row. `products.notes` is internal and often says things like
"min 5 pcs wholesale" — a customer may read published products, so RLS alone
would hand them the notes too.

So the customer's access is also a **column allow-list**:

```sql
revoke all on public.products from anon;
grant select (id, code, name, fabric, ..., retail_price, published) 
  on public.products to anon;      -- notes deliberately absent
```

Being an allow-list, **a column added later is private until someone grants
it**. That's the safe default, and why migration 0004 has to grant `colors`
and `design_notes` explicitly.

### The trap

> **Never use `select("*")` on a table with column grants.**

`*` asks for *every* column, including ungranted ones, so Postgres refuses the
**whole query**. And it surfaces as an empty result, not an error — so it
reads as "there's no data" rather than "you were denied".

Both bugs we hit were this:

1. The photo policy checks its parent via a subquery on `products`, which needs
   `select` on `published` — not in the original grant. Customers saw **zero
   photos**, catalogue-wide.
2. `select("*")` on `product_photos` demanded `created_at`, never granted. Same
   symptom again.

`lib/shop.ts` now names every column and carries a comment saying why.

---

## 5. Why the shopfront ignores cookies

`anonClient()` deliberately drops session cookies. Two reasons, both learned
from real breakage:

**A stale token emptied the entire shop.** A deleted account, an expired
session, a staff member who signed out — any invalid token makes Postgrest
reject the request, and the catalogue renders blank for that visitor.

**Caching.** Reading cookies makes a response vary per visitor, which is at
odds with caching a page identical for everyone. The shopfront is
`revalidate = 60`.

`published` is *also* filtered in the query, not just by policy, so an owner
browsing `/` sees exactly what a customer sees rather than a preview salted
with their own drafts.

---

## 6. Storage

Photos live in the `product-photos` bucket. It is **public for reads** — the
images *are* the shopfront — with writes restricted to staff:

```sql
create policy "anyone views product photos"
  on storage.objects for select using (bucket_id = 'product-photos');

create policy "staff upload product photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-photos' and public.is_staff());
```

Database rows and storage objects are **separate**. Deleting a product cascades
its `product_photos` rows but **not** the files, so `useProducts.remove()`
deletes the objects explicitly. Supabase also blocks `delete from
storage.objects` in SQL — you must go through the Storage API.

---

## 7. CORS, canvas tainting, and PDFs

Once photos moved to Storage they became **cross-origin**.

Drawing a cross-origin image onto a `<canvas>` **taints** it, and a tainted
canvas throws `SecurityError` from `toBlob()` and `getImageData()`. Card export
would have broken completely — and only at the final step, after everything
looked fine.

The fix, in `lib/image.ts`:

```ts
if (/^https?:/i.test(src)) img.crossOrigin = "anonymous";
```

Set **before** `src`, or it has no effect. Supabase Storage serves permissive
CORS headers, so the image loads and the canvas stays clean. Verified by
exporting a 2.88 MB PNG built from a Storage-hosted photo.

`@react-pdf/renderer` embeds the same URLs and relies on the same CORS headers.
It's imported dynamically at click time (~350 KB) so browsing customers never
pay for it, and PDFs are built entirely in the browser — no server function.

---

## 8. Where things live

```
lib/            pure logic, never imports React
  brand.ts        every brand fact + the palette as literals
  shop.ts         PUBLIC read path — named columns, anon client
  repository.ts   admin read/write — stitches the 3 tables into one Product
  photos.ts       Storage upload/delete
  session.ts      resolves role from profiles, never from the client
  card/           canvas primitives + card composition
  pdf/            react-pdf layouts

components/
  shop/           customer-facing
  (root)          the manager

app/
  page.tsx              shopfront
  article/[code]/       article detail
  admin/                manager (server component, reads session)
  login/
proxy.ts          session refresh + the /admin gate
supabase/migrations/    every schema change, in order
```

Rule: `lib/` never imports React; `components/` never talks to storage
directly.

---

## Checklist when adding a customer-facing field

1. Migration adds the column.
2. **Grant it to `anon`** — otherwise it's invisible and nothing errors.
3. Add it to `PUBLIC_COLUMNS` in `lib/shop.ts` (never `*`).
4. Update `database.types.ts` — keep `__InternalSupabase`, or every `Row` type
   collapses to `never` and query typing is silently lost.
5. Ask whether it belongs on the *internal* side instead. `notes` and
   `design_notes` exist separately for exactly this reason.
