-- BR-51 Task title presets: names offered in the task dialog. Picking one copies the
-- text into tasks.title, so renaming or removing a preset never changes existing tasks.
-- Everyone active can read them; only admins add, rename, reorder or remove them.

create table public.task_title_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null
    constraint task_title_presets_name_length check (length(btrim(name)) between 1 and 100),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

-- Same name only once, ignoring case.
create unique index task_title_presets_name_key on public.task_title_presets (lower(name));

revoke all on public.task_title_presets from anon, authenticated;
grant all on public.task_title_presets to service_role;
grant select, insert, update, delete on public.task_title_presets to authenticated;
alter table public.task_title_presets enable row level security;

create policy "task_title_presets_select_active"
  on public.task_title_presets for select to authenticated
  using ((select public.is_active_user()));

create policy "task_title_presets_insert_admin"
  on public.task_title_presets for insert to authenticated
  with check ((select public.is_active_user()) and (select public.is_admin()));

create policy "task_title_presets_update_admin"
  on public.task_title_presets for update to authenticated
  using ((select public.is_active_user()) and (select public.is_admin()))
  with check ((select public.is_active_user()) and (select public.is_admin()));

create policy "task_title_presets_delete_admin"
  on public.task_title_presets for delete to authenticated
  using ((select public.is_active_user()) and (select public.is_admin()));

insert into public.task_title_presets (name, sort_order) values
  ('บันทึกข้อความ', 1),
  ('จัดทำรายงาน', 2),
  ('เผยแพร่ผลงาน', 3),
  ('งานติดต่อสอบถามและประสานงาน', 4)
on conflict do nothing;
