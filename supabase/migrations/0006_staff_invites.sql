-- Jamaali catalogue — staff invitations
--
-- Two things happen in this migration, and the first one is a fix rather than
-- a feature.
--
-- 1. THE HOLE
--
--    public.handle_new_user() gave a profiles row to every new auth user. A
--    profiles row is not a formality — is_staff() is defined as "has a profile",
--    so that row *is* staff access: every article including the internal
--    `notes` column, plus insert and update on the catalogue and its photos.
--
--    Sign-ups are open on this project (they are by default). So anyone who
--    could POST to /auth/v1/signup with the publishable key — which ships in
--    the page, as it is designed to — was handed a staff account. Email
--    confirmation slowed that down but did not stop it: any address the
--    attacker owns will do.
--
--    From here a profile is created only for someone who was actually invited.
--    An uninvited sign-up still creates an auth user, but it gets no profile,
--    so is_staff() is false, every RLS policy denies it, and lib/session.ts
--    reports no session at all — which sends it back out of /admin.
--
-- 2. THE FEATURE
--
--    staff_invites lets an owner hand out access without touching the Supabase
--    dashboard. The owner creates an invite for an email address and passes on
--    the link; the invitee sets their own password on /join/<token>.
--
--    The token proves the invitation exists and is what lets the join page show
--    who it is for. It is not what grants access — the address does. Redemption
--    only ever fires for a sign-up whose email matches the invited one, so a
--    forwarded or leaked link is useless to anyone who cannot receive mail at
--    that address. That is also why the token is stored in the clear: it is a
--    lookup key, not a credential.

-- ---------------------------------------------------------------- invites ----

create table public.staff_invites (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  role        public.staff_role not null default 'staff',
  full_name   text not null default '',
  -- Two UUIDs of randomness, hex only so it survives being pasted into a URL,
  -- a chat message or a note. gen_random_uuid() is built in; this deliberately
  -- avoids depending on the pgcrypto extension being installed.
  token       text not null unique
                default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  invited_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at  timestamptz
);

comment on table public.staff_invites is
  'Pending and historical invitations to staff accounts. Owner-visible only.';

-- One live invitation per address. Re-inviting someone means revoking first,
-- which keeps the audit trail honest instead of quietly stacking duplicates.
create unique index staff_invites_one_pending_per_email
  on public.staff_invites (lower(email))
  where accepted_at is null and revoked_at is null;

create index staff_invites_token on public.staff_invites (token);

alter table public.staff_invites enable row level security;

-- Only owners. Staff read zero rows here, exactly as they do for trade rates.
create policy "owner manages invites"
  on public.staff_invites for all
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- Customers have no business here at all, so anon holds no grant either.
revoke all on public.staff_invites from anon, authenticated;
grant select, insert, update, delete on public.staff_invites to authenticated;

-- ------------------------------------------------------------- join page ----

-- What the /join page may show before anyone has signed in: who the invite is
-- for, and nothing else. Returns no rows for a token that is unknown, expired,
-- revoked or already used, so a bad link simply reads as "not valid".
create or replace function public.invite_preview(p_token text)
returns table (email text, role public.staff_role, full_name text, expires_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select i.email, i.role, i.full_name, i.expires_at
  from public.staff_invites i
  where i.token = p_token
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now();
$$;

-- ------------------------------------------------------ sign-up handling ----

-- Replaces the version that gave everyone a profile. Now a profile is created
-- only when the new account's email matches a live invitation.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.staff_invites%rowtype;
begin
  if new.email is null then
    return new;
  end if;

  select * into invite
  from public.staff_invites
  where lower(email) = lower(new.email)
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  order by created_at desc
  limit 1;

  -- Not invited: no profile, and therefore no access to anything.
  if not found then
    return new;
  end if;

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(
      nullif(invite.full_name, ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      ''
    ),
    invite.role
  )
  on conflict (id) do update
    set role = excluded.role,
        full_name = excluded.full_name;

  update public.staff_invites
     set accepted_at = now(),
         accepted_by = new.id
   where id = invite.id;

  return new;
end;
$$;

-- ------------------------------------------------------------ redemption ----

-- The other way in: someone who already had an account before being invited.
-- The trigger above never fires for them, so the join page calls this once they
-- are signed in. The invited address must match their own — the token alone is
-- not enough.
create or replace function public.redeem_staff_invite(p_token text)
returns public.staff_role
language plpgsql
security definer
set search_path = public
as $$
declare
  invite       public.staff_invites%rowtype;
  caller_email text;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;

  select email into caller_email from auth.users where id = auth.uid();

  select * into invite
  from public.staff_invites
  where token = p_token
    and accepted_at is null
    and revoked_at is null
    and expires_at > now();

  if not found then
    raise exception 'This invitation is no longer valid.' using errcode = '22023';
  end if;

  if lower(invite.email) is distinct from lower(caller_email) then
    raise exception 'This invitation was issued to a different email address.'
      using errcode = '42501';
  end if;

  insert into public.profiles (id, full_name, role)
  values (auth.uid(), coalesce(nullif(invite.full_name, ''), ''), invite.role)
  on conflict (id) do update
    set role = excluded.role,
        full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name);

  update public.staff_invites
     set accepted_at = now(),
         accepted_by = auth.uid()
   where id = invite.id;

  return invite.role;
end;
$$;

-- ----------------------------------------------------------------- grants ----

-- Postgres grants EXECUTE to PUBLIC by default, and every function in this
-- schema is reachable over PostgREST. Each one is revoked and then handed back
-- to exactly the audience that needs it.

revoke execute on function public.invite_preview(text) from public;
grant  execute on function public.invite_preview(text) to anon, authenticated;

revoke execute on function public.redeem_staff_invite(text) from public, anon;
grant  execute on function public.redeem_staff_invite(text) to authenticated;

-- A trigger function. Triggers fire regardless of EXECUTE, so nothing is lost
-- by making it uncallable over the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
