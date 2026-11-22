-- BR-29 units (สังกัดงาน), BR-30 position (ตำแหน่ง), BR-31 year type per user.
-- The unit list is fixed (changed only through migrations); admins assign people to units.

-- ---------------------------------------------------------------------------
-- units
-- ---------------------------------------------------------------------------
create table public.units (
  id text primary key
    constraint units_id_format check (id ~ '^[a-z_]{2,30}$'),
  name text not null unique,
  sort_order smallint not null default 0
);

insert into public.units (id, name, sort_order) values
  ('academic',       'งานวิชาการ',             1),
  ('administration', 'งานบริหาร',              2),
  ('planning',       'งานแผนงาน',              3),
  ('digital_skills', 'งานพัฒนาทักษะดิจิทัล',   4);

revoke all on public.units from anon, authenticated;
grant all on public.units to service_role;
grant select on public.units to authenticated;
alter table public.units enable row level security;

create policy "units_select_active_users"
  on public.units for select to authenticated
  using ((select public.is_active_user()));

-- ---------------------------------------------------------------------------
-- profiles: unit, position (admin only), year type (user's own choice)
-- Users still have no UPDATE grant on profiles: their own name and year type are
-- changed by a server action with the service role (fields whitelisted there).
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column unit_id text references public.units (id) on delete restrict,
  add column position text
    constraint profiles_position_length check (position is null or length(position) between 1 and 100),
  add column year_type text not null default 'fiscal'
    constraint profiles_year_type_check check (year_type in ('calendar', 'fiscal'));

create index profiles_unit_id_idx on public.profiles (unit_id);

-- The year type is now chosen per user (BR-31); app_settings keeps only the
-- fiscal start month shared by everyone.
alter table public.app_settings drop column year_type;
