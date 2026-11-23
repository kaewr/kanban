-- BR-45/46 + BR-49, BR-51: admin_restore now also restores holidays (a holiday whose
-- date already exists is skipped) and task title presets (same name, ignoring case,
-- is skipped). Older backup files without them still restore.
--
-- Restore from an admin backup file. Inserts only what is missing:
-- a row whose key already exists is skipped (current data is kept, never overwritten).
-- One transaction; a row that fails is skipped and reported, the rest continue.
-- Called only by the server (service role) after the admin check in /api/admin/restore.

create or replace function public.admin_restore(p_backup jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_data jsonb := p_backup -> 'data';
  r jsonb;
  v_map jsonb := '{}'::jsonb;       -- backup category id -> category id used here
  v_errors text[] := '{}';
  v_cat_ins int := 0; v_cat_skip int := 0; v_cat_fail int := 0;
  v_pro_ins int := 0; v_pro_skip int := 0; v_pro_fail int := 0;
  v_tsk_ins int := 0; v_tsk_skip int := 0; v_tsk_fail int := 0;
  v_his_ins int := 0; v_his_skip int := 0; v_his_fail int := 0;
  v_lv_ins int := 0;  v_lv_skip int := 0;  v_lv_fail int := 0;
  v_hol_ins int := 0; v_hol_skip int := 0; v_hol_fail int := 0;
  v_tp_ins int := 0;  v_tp_skip int := 0;  v_tp_fail int := 0;
  v_existing uuid;
  v_current_month smallint;
  v_backup_month smallint;
  v_who text;
begin
  if p_backup ->> 'format' is distinct from 'kanban-backup' or (p_backup ->> 'version')::int <> 1 then
    raise exception 'unsupported backup format' using errcode = '22023';
  end if;

  -- categories: same id -> skip; same name with another id -> reuse the existing one
  for r in select * from jsonb_array_elements(coalesce(v_data -> 'categories', '[]'::jsonb)) loop
    begin
      if exists (select 1 from public.categories c where c.id = (r ->> 'id')::uuid) then
        v_cat_skip := v_cat_skip + 1;
        v_map := v_map || jsonb_build_object(r ->> 'id', r ->> 'id');
      else
        select c.id into v_existing from public.categories c where lower(c.name) = lower(r ->> 'name');
        if v_existing is not null then
          v_cat_skip := v_cat_skip + 1;
          v_map := v_map || jsonb_build_object(r ->> 'id', v_existing::text);
        else
          insert into public.categories (id, name, sort_order, is_active)
          values ((r ->> 'id')::uuid, r ->> 'name', coalesce((r ->> 'sort_order')::smallint, 0),
                  coalesce((r ->> 'is_active')::boolean, true));
          v_cat_ins := v_cat_ins + 1;
          v_map := v_map || jsonb_build_object(r ->> 'id', r ->> 'id');
        end if;
      end if;
    exception when others then
      v_cat_fail := v_cat_fail + 1;
      v_errors := v_errors || format('หมวดหมู่ "%s": %s', r ->> 'name', sqlerrm);
    end;
  end loop;

  -- profiles: the auth account must already exist (the API creates missing ones first)
  for r in select * from jsonb_array_elements(coalesce(v_data -> 'profiles', '[]'::jsonb)) loop
    begin
      if exists (select 1 from public.profiles p where p.id = (r ->> 'id')::uuid) then
        v_pro_skip := v_pro_skip + 1;
      else
        -- profiles.id references auth.users: a missing account fails here and is reported
        insert into public.profiles (id, username, display_name, role, unit_id, position, year_type,
                                     must_change_password, is_active, created_at)
        values ((r ->> 'id')::uuid, r ->> 'username', r ->> 'display_name', coalesce(r ->> 'role', 'user'),
                (select u.id from public.units u where u.id = r ->> 'unit_id'),
                nullif(r ->> 'position', ''), coalesce(r ->> 'year_type', 'fiscal'),
                true, coalesce((r ->> 'is_active')::boolean, true),
                coalesce((r ->> 'created_at')::timestamptz, now()));
        v_pro_ins := v_pro_ins + 1;
      end if;
    exception
      when foreign_key_violation then
        v_pro_fail := v_pro_fail + 1;
        v_errors := v_errors || format('ผู้ใช้ "%s": ไม่มีบัญชีเข้าสู่ระบบ', r ->> 'display_name');
      when others then
        v_pro_fail := v_pro_fail + 1;
        v_errors := v_errors || format('ผู้ใช้ "%s": %s', r ->> 'display_name', sqlerrm);
    end;
  end loop;

  -- tasks
  for r in select * from jsonb_array_elements(coalesce(v_data -> 'tasks', '[]'::jsonb)) loop
    begin
      if exists (select 1 from public.tasks t where t.id = (r ->> 'id')::uuid) then
        v_tsk_skip := v_tsk_skip + 1;
      else
        insert into public.tasks (id, owner_id, title, description, status, category_id, priority, year,
                                  due_date, progress, position, carried_from_year, started_at, completed_at,
                                  version, is_deleted, created_at, updated_at)
        values ((r ->> 'id')::uuid, (r ->> 'owner_id')::uuid, r ->> 'title', r ->> 'description', r ->> 'status',
                coalesce(v_map ->> (r ->> 'category_id'), r ->> 'category_id')::uuid,
                (r ->> 'priority')::smallint, (r ->> 'year')::smallint, (r ->> 'due_date')::date,
                (r ->> 'progress')::smallint, coalesce((r ->> 'position')::numeric, 0),
                (r ->> 'carried_from_year')::smallint, (r ->> 'started_at')::timestamptz,
                (r ->> 'completed_at')::timestamptz, coalesce((r ->> 'version')::int, 1),
                coalesce((r ->> 'is_deleted')::boolean, false),
                coalesce((r ->> 'created_at')::timestamptz, now()), coalesce((r ->> 'updated_at')::timestamptz, now()));
        v_tsk_ins := v_tsk_ins + 1;
      end if;
    exception when others then
      v_tsk_fail := v_tsk_fail + 1;
      v_errors := v_errors || format('งาน "%s": %s', r ->> 'title', sqlerrm);
    end;
  end loop;

  -- task_history has no stable id across databases: a row is a duplicate when task,
  -- from, to, time and actor all match
  for r in select * from jsonb_array_elements(coalesce(v_data -> 'task_history', '[]'::jsonb)) loop
    begin
      if exists (
        select 1 from public.task_history h
        where h.task_id = (r ->> 'task_id')::uuid
          and h.from_status is not distinct from (r ->> 'from_status')
          and h.to_status = r ->> 'to_status'
          and h.changed_at = (r ->> 'changed_at')::timestamptz
          and h.changed_by = (r ->> 'changed_by')::uuid
      ) then
        v_his_skip := v_his_skip + 1;
      else
        insert into public.task_history (task_id, from_status, to_status, changed_by, changed_at)
        values ((r ->> 'task_id')::uuid, r ->> 'from_status', r ->> 'to_status',
                (r ->> 'changed_by')::uuid, (r ->> 'changed_at')::timestamptz);
        v_his_ins := v_his_ins + 1;
      end if;
    exception when others then
      v_his_fail := v_his_fail + 1;
      if v_his_fail <= 5 then
        v_errors := v_errors || format('ประวัติการย้ายงาน: %s', sqlerrm);
      end if;
    end;
  end loop;

  -- leaves (the overlap trigger still applies)
  for r in select * from jsonb_array_elements(coalesce(v_data -> 'leaves', '[]'::jsonb)) loop
    begin
      if exists (select 1 from public.leaves l where l.id = (r ->> 'id')::uuid) then
        v_lv_skip := v_lv_skip + 1;
      else
        insert into public.leaves (id, owner_id, leave_type, start_date, end_date, note, created_by,
                                   is_deleted, created_at, updated_at)
        values ((r ->> 'id')::uuid, (r ->> 'owner_id')::uuid, r ->> 'leave_type', (r ->> 'start_date')::date,
                (r ->> 'end_date')::date, nullif(r ->> 'note', ''), (r ->> 'created_by')::uuid,
                coalesce((r ->> 'is_deleted')::boolean, false),
                coalesce((r ->> 'created_at')::timestamptz, now()), coalesce((r ->> 'updated_at')::timestamptz, now()));
        v_lv_ins := v_lv_ins + 1;
      end if;
    exception when others then
      v_lv_fail := v_lv_fail + 1;
      select p.display_name into v_who from public.profiles p where p.id = (r ->> 'owner_id')::uuid;
      v_errors := v_errors || format('วันลาของ %s %s ถึง %s: %s',
        coalesce(v_who, 'ผู้ใช้ที่ไม่พบ'), r ->> 'start_date', r ->> 'end_date', sqlerrm);
    end;
  end loop;

  -- holidays: the date is the key (the id may differ between databases)
  for r in select * from jsonb_array_elements(coalesce(v_data -> 'holidays', '[]'::jsonb)) loop
    begin
      if exists (select 1 from public.holidays h where h.holiday_date = (r ->> 'holiday_date')::date) then
        v_hol_skip := v_hol_skip + 1;
      else
        insert into public.holidays (holiday_date, name, created_at)
        values ((r ->> 'holiday_date')::date, r ->> 'name', coalesce((r ->> 'created_at')::timestamptz, now()));
        v_hol_ins := v_hol_ins + 1;
      end if;
    exception when others then
      v_hol_fail := v_hol_fail + 1;
      v_errors := v_errors || format('วันหยุด %s "%s": %s', r ->> 'holiday_date', r ->> 'name', sqlerrm);
    end;
  end loop;

  -- task title presets: the name is the key
  for r in select * from jsonb_array_elements(coalesce(v_data -> 'task_title_presets', '[]'::jsonb)) loop
    begin
      if exists (select 1 from public.task_title_presets t where lower(t.name) = lower(r ->> 'name')) then
        v_tp_skip := v_tp_skip + 1;
      else
        insert into public.task_title_presets (name, sort_order, created_at)
        values (r ->> 'name', coalesce((r ->> 'sort_order')::smallint, 0),
                coalesce((r ->> 'created_at')::timestamptz, now()));
        v_tp_ins := v_tp_ins + 1;
      end if;
    exception when others then
      v_tp_fail := v_tp_fail + 1;
      v_errors := v_errors || format('หัวข้องาน "%s": %s', r ->> 'name', sqlerrm);
    end;
  end loop;

  -- settings are never overwritten; only report whether they differ
  select s.fiscal_start_month into v_current_month from public.app_settings s where s.id;
  v_backup_month := (v_data -> 'app_settings' ->> 'fiscal_start_month')::smallint;

  return jsonb_build_object(
    'categories', jsonb_build_object('inserted', v_cat_ins, 'skipped', v_cat_skip, 'failed', v_cat_fail),
    'profiles', jsonb_build_object('inserted', v_pro_ins, 'skipped', v_pro_skip, 'failed', v_pro_fail),
    'tasks', jsonb_build_object('inserted', v_tsk_ins, 'skipped', v_tsk_skip, 'failed', v_tsk_fail),
    'task_history', jsonb_build_object('inserted', v_his_ins, 'skipped', v_his_skip, 'failed', v_his_fail),
    'leaves', jsonb_build_object('inserted', v_lv_ins, 'skipped', v_lv_skip, 'failed', v_lv_fail),
    'holidays', jsonb_build_object('inserted', v_hol_ins, 'skipped', v_hol_skip, 'failed', v_hol_fail),
    'task_title_presets', jsonb_build_object('inserted', v_tp_ins, 'skipped', v_tp_skip, 'failed', v_tp_fail),
    'settings', jsonb_build_object('current_fiscal_start_month', v_current_month,
                                   'backup_fiscal_start_month', v_backup_month,
                                   'same', v_backup_month is null or v_backup_month = v_current_month),
    'errors', to_jsonb(v_errors[1:50])
  );
end;
$$;

revoke all on function public.admin_restore(jsonb) from public, anon, authenticated;
grant execute on function public.admin_restore(jsonb) to service_role;
