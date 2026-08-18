# Jamaali — Catalogue

A public lookbook and the staff tool behind it.

Customers browse published articles at `/`, open any one for its full spec, and
download it as a PDF. Staff sign in at `/admin` to manage articles, photos and
rates, and to export cards for social.

Retail prices are public. **Reseller and wholesale rates are not, and the
database is what enforces that** — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Local setup

```bash
npm install
cp .env.example .env.local     # then fill it in
npm run dev
```

Open http://localhost:3000.

### Environment

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | same page, the `sb_publishable_…` key |

Both are safe in the browser. The publishable key only ever grants what row
level security allows, which for a signed-out visitor is the published
catalogue and nothing else.

### Commands

```bash
npm run dev        # dev server
npm run build      # production build
npm run lint
npm run typecheck
```

---

## Creating the first owner

There is **no public sign-up**, and everyone who signs up becomes `staff` by
default — deliberately, so a new account can never grant itself rate access.
The first owner therefore has to be seeded.

1. Supabase dashboard → **Authentication → Users → Add user**, tick
   *auto-confirm*.
2. Promote them, in the SQL editor:

```sql
update public.profiles set role = 'owner'
where id = (select id from auth.users where email = 'you@example.com');
```

Check it worked:

```sql
select u.email, p.role from public.profiles p
join auth.users u on u.id = p.id;
```

### owner vs staff

| | staff | owner |
| --- | --- | --- |
| Add / edit articles and photos | yes | yes |
| Retail price | yes | yes |
| **Reseller & wholesale rates** | **no** | yes |
| Delete an article | no | yes |
| Change anyone's role | no | yes |

Staff aren't merely shown less — the database returns them zero rows from
`product_trade_rates`.

---

## Importing an existing catalogue

The **Import** button in the admin header (⭱) reads a JSON backup from the old
browser-based version, recreating articles and uploading their photos.

- Codes that already exist are **skipped, never overwritten**, so re-running an
  import can't clobber later edits.
- Everything arrives as a **draft**. Nothing reaches customers until you tick
  *Show this article in the public catalogue*.

**CSV export** (⌸) produces a rate sheet for accountants and printers. It
includes trade rates only when an owner exports it. It is an export, not an
import format — there is no CSV import.

---

## Publishing an article

1. `/admin` → **Add**, fill in code, fabric, pieces, colours, retail price.
2. Save — the form stays open and the photo panel unlocks. (Photos need a saved
   article to attach to.)
3. Add photos. The first is the cover and is what appears on cards and tiles.
4. Tick **Show this article in the public catalogue**.

The shopfront caches for 60 seconds, so a change appears within a minute.

---

## Schema changes

Every change goes through a migration in `supabase/migrations/`, applied in
order. Never ad-hoc SQL against production.

After a migration, update `lib/supabase/database.types.ts`:

```bash
npx supabase gen types typescript --project-id <ref>
```

Keep the `__InternalSupabase` block. Without it supabase-js resolves every
`Row` and `Insert` type to `never` and **all query typing is silently lost** —
no error, the compiler just stops checking.

If a new column should be visible to customers, it also needs an explicit
grant. The anon grant is an allow-list; new columns are private by default.

---

## Deploying

Hosted on Vercel.

```bash
npx vercel deploy --prod
```

Set both environment variables in the Vercel project first (Settings →
Environment Variables) or the build ships without a database connection.

The app is server-rendered — sessions and server-side filtering of private data
both need a server, so there is no static export.

---

## Constraints worth knowing before you change anything

- **No phone numbers, WhatsApp links or `tel:` anywhere customer-facing**,
  including PDFs. The admin's "copy reply" buttons build clipboard text only
  and contain no number.
- **Never `select("*")`** on `products` or `product_photos` in the public path.
  Column grants make `*` fail as an empty result rather than an error.
- **`notes` is internal; `design_notes` is public.** They are separate columns
  on purpose — `notes` routinely carries trade terms.
- The auth gate lives in **`proxy.ts`**. Next 16 renamed `middleware`; a file
  named `middleware.ts` is ignored without warning.

Full reasoning in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
