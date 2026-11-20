-- M2: core schema (docs/requirements.md section 8)
-- Years are stored in the Buddhist Era (พ.ศ.), e.g. 2569. Fiscal year is named by
-- the year it ends in (Oct 2569 -> fiscal 2570).

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    constraint profiles_username_format check (username ~ '^[a-z0-9._]{3,30}$'), -- BR-22
  display_name text not null,
  role text not null default 'user'
    constraint profiles_role_check check (role in ('user', 'admin')),
  must_change_password boolean not null default true, -- BR-24
  is_active boolean not null default true,            -- BR-26
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
    constraint categories_name_not_blank check (length(btrim(name)) > 0),
  sort_order smallint not null default 0,
  is_active boolean not null default true
);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  title text not null
    constraint tasks_title_length check (length(btrim(title)) between 1 and 200),
  description text,
  status text not null
    constraint tasks_status_check
    check (status in ('long_term', 'short_term', 'in_progress', 'review', 'done')),
  category_id uuid not null references public.categories (id) on delete restrict,
  priority smallint not null default 2
    constraint tasks_priority_check check (priority between 1 and 3),
  year smallint not null
    constraint tasks_year_check check (year between 2543 and 2643),
  due_date date,
  progress smallint
    constraint tasks_progress_check check (progress between 0 and 100),
  position numeric not null default 0,
  carried_from_year smallint
    constraint tasks_carried_from_year_check check (carried_from_year between 2543 and 2643),
  started_at timestamptz,
  completed_at timestamptz,
  version integer not null default 1
    constraint tasks_version_check check (version >= 1),
  is_deleted boolean not null default false, -- BR-12 soft delete
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Board load: one owner, one year, grouped by status, ordered by position.
create index tasks_owner_year_status_idx
  on public.tasks (owner_id, year, status, position)
  where is_deleted = false;

create index tasks_category_id_idx on public.tasks (category_id);

-- ---------------------------------------------------------------------------
-- task_history (append-only)
-- ---------------------------------------------------------------------------
create table public.task_history (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks (id) on delete restrict,
  from_status text
    constraint task_history_from_status_check
    check (from_status in ('long_term', 'short_term', 'in_progress', 'review', 'done')),
  to_status text not null
    constraint task_history_to_status_check
    check (to_status in ('long_term', 'short_term', 'in_progress', 'review', 'done')),
  changed_by uuid not null references public.profiles (id) on delete restrict,
  changed_at timestamptz not null default now() -- client moved_at
);

create index task_history_task_id_changed_at_idx
  on public.task_history (task_id, changed_at);

create index task_history_changed_by_idx on public.task_history (changed_by);

-- ---------------------------------------------------------------------------
-- app_settings (single row)
-- ---------------------------------------------------------------------------
create table public.app_settings (
  id boolean primary key default true
    constraint app_settings_single_row check (id),
  year_type text not null default 'calendar'
    constraint app_settings_year_type_check check (year_type in ('calendar', 'fiscal')),
  fiscal_start_month smallint not null default 10
    constraint app_settings_fiscal_start_month_check check (fiscal_start_month between 1 and 12),
  updated_by uuid references public.profiles (id) on delete restrict,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- BR-27: always keep at least one active admin
-- ---------------------------------------------------------------------------
create function public.ensure_active_admin_remains()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only relevant when an active admin stops being an active admin.
  if old.role = 'admin' and old.is_active
     and (tg_op = 'DELETE' or new.role <> 'admin' or not new.is_active) then
    if not exists (
      select 1
      from public.profiles p
      where p.id <> old.id
        and p.role = 'admin'
        and p.is_active
    ) then
      raise exception 'ต้องมีผู้ดูแลระบบที่ใช้งานได้อย่างน้อย 1 คน'
        using errcode = 'P0001', hint = 'BR-27';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger profiles_ensure_active_admin
  before update of role, is_active or delete on public.profiles
  for each row execute function public.ensure_active_admin_remains();

-- Trigger functions are not meant to be called directly.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.ensure_active_admin_remains() from public, anon, authenticated;
