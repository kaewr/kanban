-- M2: Row Level Security (docs/requirements.md section 8 "RLS" items 1-6)
--
-- Helper functions are SECURITY DEFINER on purpose: policies on profiles cannot
-- query profiles under the caller's RLS without infinite recursion. They only
-- read the caller's own row and return a boolean.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_active from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create function public.is_admin()
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
  );
$$;

revoke execute on function public.is_active_user() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Table privileges: anon gets nothing; authenticated gets only what policies use.
-- Hard DELETE is never granted (soft delete / deactivate only).
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.categories, public.tasks,
  public.task_history, public.app_settings from anon, authenticated;

grant all on public.profiles, public.categories, public.tasks,
  public.task_history, public.app_settings to service_role;

grant select                 on public.profiles     to authenticated;
grant select, insert, update on public.categories   to authenticated;
grant select, insert, update on public.tasks        to authenticated;
grant select, insert         on public.task_history to authenticated;
grant select, update         on public.app_settings to authenticated;

alter table public.profiles     enable row level security;
alter table public.categories   enable row level security;
alter table public.tasks        enable row level security;
alter table public.task_history enable row level security;
alter table public.app_settings enable row level security;

-- ---------------------------------------------------------------------------
-- profiles (item 3): read own row / admin reads all.
-- No INSERT/UPDATE/DELETE policies: changes go through server routes with the
-- service role (admin API, change-password flow).
-- ---------------------------------------------------------------------------
create policy "profiles_select_own_or_admin"
  on public.profiles for select to authenticated
  using (
    (id = (select auth.uid()) and (select public.is_active_user()))
    or (select public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- tasks (items 1, 2, 5)
-- ---------------------------------------------------------------------------
create policy "tasks_select_own_or_admin"
  on public.tasks for select to authenticated
  using (
    (owner_id = (select auth.uid()) and (select public.is_active_user()))
    or (select public.is_admin())
  );

create policy "tasks_insert_own_or_admin"
  on public.tasks for insert to authenticated
  with check (
    (owner_id = (select auth.uid()) and (select public.is_active_user()))
    or (select public.is_admin())
  );

create policy "tasks_update_own_or_admin"
  on public.tasks for update to authenticated
  using (
    (owner_id = (select auth.uid()) and (select public.is_active_user()))
    or (select public.is_admin())
  )
  with check (
    (owner_id = (select auth.uid()) and (select public.is_active_user()))
    or (select public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- task_history (item 2 + append-only): read/insert for own tasks, admin for all.
-- changed_by must always be the caller (BR-28 / FR-11).
-- ---------------------------------------------------------------------------
create policy "task_history_select_own_or_admin"
  on public.task_history for select to authenticated
  using (
    (select public.is_admin())
    or (
      (select public.is_active_user())
      and exists (
        select 1 from public.tasks t
        where t.id = task_history.task_id
          and t.owner_id = (select auth.uid())
      )
    )
  );

create policy "task_history_insert_own_or_admin"
  on public.task_history for insert to authenticated
  with check (
    changed_by = (select auth.uid())
    and (
      (select public.is_admin())
      or (
        (select public.is_active_user())
        and exists (
          select 1 from public.tasks t
          where t.id = task_history.task_id
            and t.owner_id = (select auth.uid())
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- categories, app_settings (item 4): active users read, admins write.
-- ---------------------------------------------------------------------------
create policy "categories_select_active_users"
  on public.categories for select to authenticated
  using ((select public.is_active_user()));

create policy "categories_insert_admin"
  on public.categories for insert to authenticated
  with check ((select public.is_admin()));

create policy "categories_update_admin"
  on public.categories for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "app_settings_select_active_users"
  on public.app_settings for select to authenticated
  using ((select public.is_active_user()));

create policy "app_settings_update_admin"
  on public.app_settings for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
