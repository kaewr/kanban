-- FR-16 Dashboard: every metric of spec section 6 in one call, computed in SQL.
-- security invoker: RLS decides what is counted (a user sees only their own tasks,
-- an admin sees everyone). Scope = tasks of one board year (tasks.year), not deleted.
-- Dates are Bangkok calendar dates.

create or replace function public.dashboard_summary(
  p_year smallint,
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
  today as (
    select (now() at time zone 'Asia/Bangkok')::date as d
  ),
  people as (
    select p.id, p.display_name, p.is_active, p.unit_id, u.name as unit_name
    from public.profiles p
    left join public.units u on u.id = p.unit_id
    where (p_unit_id is null or p.unit_id = p_unit_id)
      and (p_owner_id is null or p.id = p_owner_id)
  ),
  scoped as (
    select t.*,
           (t.status <> 'done' and t.due_date is not null and t.due_date < (select d from today)) as is_overdue,
           case when t.status = 'done' and t.started_at is not null and t.completed_at is not null
                then extract(epoch from (t.completed_at - t.started_at)) / 86400.0 end as cycle_days
    from public.tasks t
    join people p on p.id = t.owner_id
    where t.year = p_year and not t.is_deleted
  ),
  -- Time spent in review: each move into review until the next move of the same task.
  review_spells as (
    select h.task_id,
           h.to_status,
           h.changed_at,
           lead(h.changed_at) over (partition by h.task_id order by h.changed_at, h.id) as left_at,
           lead(h.to_status) over (partition by h.task_id order by h.changed_at, h.id) as next_status
    from public.task_history h
    where h.task_id in (select id from scoped)
  ),
  review_stats as (
    select
      count(distinct task_id) filter (where to_status = 'review') as entered,
      count(*) filter (where to_status = 'review' and next_status = 'in_progress') as reworks,
      avg(extract(epoch from (left_at - changed_at)) / 86400.0)
        filter (where to_status = 'review' and left_at is not null) as avg_wait_days
    from review_spells
  ),
  monthly as (
    select to_char(date_trunc('month', completed_at at time zone 'Asia/Bangkok'), 'YYYY-MM') as month,
           count(*) as done
    from scoped
    where status = 'done' and completed_at is not null
    group by 1
  ),
  by_category as (
    select c.id, c.name, c.sort_order, count(*) as done
    from scoped s
    join public.categories c on c.id = s.category_id
    where s.status = 'done'
    group by c.id, c.name, c.sort_order
  ),
  per_person as (
    select p.id, p.display_name, p.unit_name, p.is_active,
           count(s.id) filter (where s.status = 'long_term') as long_term,
           count(s.id) filter (where s.status = 'short_term') as short_term,
           count(s.id) filter (where s.status = 'in_progress') as in_progress,
           count(s.id) filter (where s.status = 'review') as review,
           count(s.id) filter (where s.status = 'done') as done,
           count(s.id) filter (where s.is_overdue) as overdue,
           round(avg(s.cycle_days)::numeric, 1) as cycle_days_avg
    from people p
    left join scoped s on s.owner_id = p.id
    group by p.id, p.display_name, p.unit_name, p.is_active
    -- inactive accounts only when they still have tasks this year
    having p.is_active or count(s.id) > 0
  )
  select jsonb_build_object(
    'today', (select d from today),
    'totals', jsonb_build_object(
      'open', (select count(*) from scoped where status <> 'done'),
      'overdue', (select count(*) from scoped where is_overdue),
      'done', (select count(*) from scoped where status = 'done'),
      'done_this_month', (
        select count(*) from scoped
        where status = 'done' and completed_at is not null
          and date_trunc('month', completed_at at time zone 'Asia/Bangkok')
              = date_trunc('month', (select d from today)::timestamp)
      ),
      'cycle_days_avg', (select round(avg(cycle_days)::numeric, 1) from scoped)
    ),
    'by_status', jsonb_build_object(
      'long_term', (select count(*) from scoped where status = 'long_term'),
      'short_term', (select count(*) from scoped where status = 'short_term'),
      'in_progress', (select count(*) from scoped where status = 'in_progress'),
      'review', (select count(*) from scoped where status = 'review'),
      'done', (select count(*) from scoped where status = 'done')
    ),
    'monthly', coalesce((select jsonb_agg(jsonb_build_object('month', month, 'done', done) order by month) from monthly), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'done', done) order by sort_order, name) from by_category), '[]'::jsonb),
    'review', (
      select jsonb_build_object(
        'entered', entered,
        'reworks', reworks,
        'rework_rate', case when entered > 0 then round(reworks::numeric / entered, 3) end,
        'avg_wait_days', round(avg_wait_days::numeric, 1)
      ) from review_stats
    ),
    'long_term', (
      select jsonb_build_object(
        'total', count(*),
        'done', count(*) filter (where status = 'done'),
        'avg_progress', round((avg(progress) filter (where status = 'long_term'))::numeric, 0)
      )
      from scoped
      -- long-term work of the year: still long_term, or started as long_term and moved on
      where status = 'long_term'
         or id in (select task_id from public.task_history where from_status = 'long_term' or (from_status is null and to_status = 'long_term'))
    ),
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'display_name', display_name, 'unit_name', unit_name, 'is_active', is_active,
        'long_term', long_term, 'short_term', short_term, 'in_progress', in_progress,
        'review', review, 'done', done, 'overdue', overdue, 'cycle_days_avg', cycle_days_avg
      ) order by display_name)
      from per_person
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.dashboard_summary(smallint, text, uuid) from public, anon;
grant execute on function public.dashboard_summary(smallint, text, uuid) to authenticated;
