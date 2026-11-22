-- BR-40..44 Leave records (วันลา): one day or a date range, counted in working days
-- (Mon–Fri). No approval step. Users manage their own; admins manage everyone's.

create table public.leaves (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  leave_type text not null
    constraint leaves_type_check check (leave_type in ('sick', 'personal', 'vacation', 'official', 'maternity', 'other')),
  start_date date not null,
  end_date date not null,
  note text
    constraint leaves_note_length check (note is null or length(note) between 1 and 200),
  created_by uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leaves_range_check check (end_date >= start_date and end_date - start_date <= 365)
);

create index leaves_owner_dates_idx on public.leaves (owner_id, start_date, end_date) where not is_deleted;

create trigger leaves_set_updated_at
  before update on public.leaves
  for each row execute function public.set_updated_at();

-- BR-42: no overlapping leave for the same person. Runs as the caller: a user sees
-- their own leaves, an admin sees everyone's, which is exactly the set to compare.
create or replace function public.leaves_prevent_overlap()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not new.is_deleted and exists (
    select 1 from public.leaves l
    where l.owner_id = new.owner_id
      and l.id <> new.id
      and not l.is_deleted
      and l.start_date <= new.end_date
      and l.end_date >= new.start_date
  ) then
    raise exception 'มีวันลาที่ซ้อนกับช่วงวันที่นี้อยู่แล้ว' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger leaves_prevent_overlap
  before insert or update on public.leaves
  for each row execute function public.leaves_prevent_overlap();

revoke execute on function public.leaves_prevent_overlap() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS: same shape as tasks. No DELETE (cancel = is_deleted).
-- ---------------------------------------------------------------------------
revoke all on public.leaves from anon, authenticated;
grant all on public.leaves to service_role;
grant select, insert, update on public.leaves to authenticated;
alter table public.leaves enable row level security;

create policy "leaves_select_own_or_admin"
  on public.leaves for select to authenticated
  using ((select public.is_active_user()) and (owner_id = (select auth.uid()) or (select public.is_admin())));

create policy "leaves_insert_own_or_admin"
  on public.leaves for insert to authenticated
  with check (
    (select public.is_active_user())
    and (owner_id = (select auth.uid()) or (select public.is_admin()))
    and created_by = (select auth.uid())
  );

create policy "leaves_update_own_or_admin"
  on public.leaves for update to authenticated
  using ((select public.is_active_user()) and (owner_id = (select auth.uid()) or (select public.is_admin())))
  with check ((select public.is_active_user()) and (owner_id = (select auth.uid()) or (select public.is_admin())));

-- ---------------------------------------------------------------------------
-- BR-43 / dashboard: working days of leave per person and month within a date range.
-- security invoker: RLS decides whose leaves are counted.
-- ---------------------------------------------------------------------------
create or replace function public.leave_summary(
  p_from date,
  p_to date,
  p_unit_id text default null,
  p_owner_id uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with
  people as (
    select p.id, p.display_name, p.is_active, u.name as unit_name
    from public.profiles p
    left join public.units u on u.id = p.unit_id
    where (p_unit_id is null or p.unit_id = p_unit_id)
      and (p_owner_id is null or p.id = p_owner_id)
  ),
  days as (
    select l.owner_id, l.leave_type, d::date as day
    from public.leaves l
    join people p on p.id = l.owner_id
    cross join lateral generate_series(greatest(l.start_date, p_from), least(l.end_date, p_to), interval '1 day') as d
    where not l.is_deleted
      and l.start_date <= p_to
      and l.end_date >= p_from
      and extract(isodow from d) < 6 -- Mon–Fri only (BR-41)
  ),
  per_month as (
    select owner_id, to_char(day, 'YYYY-MM') as month, count(*) as n
    from days group by owner_id, to_char(day, 'YYYY-MM')
  ),
  per_type as (
    select owner_id, leave_type, count(*) as n
    from days group by owner_id, leave_type
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'unit_name', p.unit_name,
    'is_active', p.is_active,
    'total', (select count(*) from days d where d.owner_id = p.id),
    'months', coalesce((select jsonb_object_agg(m.month, m.n) from per_month m where m.owner_id = p.id), '{}'::jsonb),
    'types', coalesce((select jsonb_object_agg(t.leave_type, t.n) from per_type t where t.owner_id = p.id), '{}'::jsonb)
  ) order by p.display_name), '[]'::jsonb)
  from people p
  where p.is_active or exists (select 1 from days d where d.owner_id = p.id);
$$;

revoke all on function public.leave_summary(date, date, text, uuid) from public, anon;
grant execute on function public.leave_summary(date, date, text, uuid) to authenticated;
