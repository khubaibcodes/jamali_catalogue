-- Two corrections found by testing 0002 against a real database.

-- 1. Customers could read no photos at all.
--
-- The customer photo policy checks its parent article with a subquery on
-- public.products. That subquery runs as `anon`, so anon needs SELECT on every
-- column it touches — including `published`, which 0002's column allow-list
-- omitted. The result was a blanket "permission denied for table products" and
-- an image-less catalogue.
--
-- Granting `published` leaks nothing: it is true for every row a customer is
-- allowed to see in the first place.
grant select (published) on public.products to anon;

-- 2. SECURITY DEFINER functions were reachable as REST endpoints.
--
-- Postgres grants EXECUTE to PUBLIC by default, so each of these was callable
-- via /rest/v1/rpc/<name> without signing in.

-- A trigger function. Triggers fire irrespective of EXECUTE, so nothing is lost
-- by making it uncallable.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- The role helpers stay callable by signed-in users on purpose: RLS policy
-- expressions are evaluated with the invoking role's privileges, so revoking
-- EXECUTE from `authenticated` would break every staff and owner policy.
-- Customers never need them — no anon policy references a role.
--
-- Supabase's linter still flags current_staff_role() as callable by signed-in
-- users. That is accepted: it takes no arguments and returns only the caller's
-- own role, which they already know.
revoke execute on function public.current_staff_role() from public, anon;
revoke execute on function public.is_owner() from public, anon;
revoke execute on function public.is_staff() from public, anon;

grant execute on function public.current_staff_role() to authenticated;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.is_staff() to authenticated;
