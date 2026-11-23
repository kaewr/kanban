-- BR-49 Public holidays: a symbolic label shown on the board and the leave calendar.
-- They change nothing else (task due dates, leave counting stay as before).
-- Everyone active can read them; only admins add or remove them. Removing is a real
-- DELETE: holidays are reference labels with nothing pointing at them.

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null
    constraint holidays_date_key unique,
  name text not null
    constraint holidays_name_length check (length(btrim(name)) between 1 and 100),
  created_at timestamptz not null default now()
);

revoke all on public.holidays from anon, authenticated;
grant all on public.holidays to service_role;
grant select, insert, update, delete on public.holidays to authenticated;
alter table public.holidays enable row level security;

create policy "holidays_select_active"
  on public.holidays for select to authenticated
  using ((select public.is_active_user()));

create policy "holidays_insert_admin"
  on public.holidays for insert to authenticated
  with check ((select public.is_active_user()) and (select public.is_admin()));

create policy "holidays_update_admin"
  on public.holidays for update to authenticated
  using ((select public.is_active_user()) and (select public.is_admin()))
  with check ((select public.is_active_user()) and (select public.is_admin()));

create policy "holidays_delete_admin"
  on public.holidays for delete to authenticated
  using ((select public.is_active_user()) and (select public.is_admin()));

-- Starting list for fiscal year 2570 (Oct 2026 – Sep 2027). Admins should check it
-- against the cabinet announcement and add Royal Ploughing Day once announced.
insert into public.holidays (holiday_date, name) values
  ('2026-10-13', 'วันคล้ายวันสวรรคต ร.9'),
  ('2026-10-23', 'วันปิยมหาราช'),
  ('2026-12-05', 'วันพ่อแห่งชาติ'),
  ('2026-12-07', 'ชดเชยวันพ่อแห่งชาติ'),
  ('2026-12-10', 'วันรัฐธรรมนูญ'),
  ('2026-12-31', 'วันสิ้นปี'),
  ('2027-01-01', 'วันขึ้นปีใหม่'),
  ('2027-02-21', 'วันมาฆบูชา'),
  ('2027-02-22', 'ชดเชยวันมาฆบูชา'),
  ('2027-04-06', 'วันจักรี'),
  ('2027-04-13', 'วันสงกรานต์'),
  ('2027-04-14', 'วันสงกรานต์'),
  ('2027-04-15', 'วันสงกรานต์'),
  ('2027-05-01', 'วันแรงงานแห่งชาติ'),
  ('2027-05-03', 'ชดเชยวันแรงงานแห่งชาติ'),
  ('2027-05-04', 'วันฉัตรมงคล'),
  ('2027-05-20', 'วันวิสาขบูชา'),
  ('2027-06-03', 'วันเฉลิมพระชนมพรรษาพระราชินี'),
  ('2027-07-18', 'วันอาสาฬหบูชา'),
  ('2027-07-19', 'วันเข้าพรรษา'),
  ('2027-07-20', 'ชดเชยวันอาสาฬหบูชา'),
  ('2027-07-28', 'วันเฉลิมพระชนมพรรษา ร.10'),
  ('2027-08-12', 'วันแม่แห่งชาติ')
on conflict (holiday_date) do nothing;
