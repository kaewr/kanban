-- v1.4.0 security hardening (security review 24 Nov 2026). Functions, grants and
-- policies only: no table structure or data changes.

-- ---------------------------------------------------------------------------
-- BR-59: an admin still on the default password has no admin rights until they
-- change it. Enforced here so it holds even for direct API calls; the app also
-- sends such admins to /profile. Users are unaffected (they keep their own rows).
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_active -- RLS item 5: inactive admins lose admin rights too
      and not p.must_change_password -- BR-59
  );
$$;

-- ---------------------------------------------------------------------------
-- BR-55 tightened: the owner (or an admin) may only open a clean request and later
-- withdraw it. Decisions and comments belong to the reviewer (review_decide()).
-- Before: the owner could write status 'approved' / a comment in the reviewer's name.
-- ---------------------------------------------------------------------------
drop policy "task_reviews_insert_owner_or_admin" on public.task_reviews;
create policy "task_reviews_insert_owner_or_admin"
  on public.task_reviews for insert to authenticated
  with check (
    (select public.is_active_user())
    and requested_by = (select auth.uid())
    and status = 'open'
    and comment is null and commented_at is null
    and decided_by is null and decided_at is null
    and (owner_id = (select auth.uid()) or (select public.is_admin()))
  );

drop policy "task_reviews_update_owner_or_admin" on public.task_reviews;
create policy "task_reviews_withdraw_owner_or_admin"
  on public.task_reviews for update to authenticated
  using (
    (select public.is_active_user())
    and status = 'open'
    and (owner_id = (select auth.uid()) or (select public.is_admin()))
  )
  with check (
    status = 'withdrawn'
    and decided_by = (select auth.uid())
  );

-- Only the columns a withdrawal writes (save_board_changes) can be updated directly.
revoke update on public.task_reviews from authenticated;
grant update (status, decided_by, decided_at) on public.task_reviews to authenticated;
