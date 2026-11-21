-- M6: save all board changes in one transaction (FR-09, docs/requirements.md section 7).
--
-- p_changes = { "tasks": [ {
--   "op": "create" | "update" | "delete",
--   "id": uuid, "version": int (update/delete),
--   "owner_id", "title", "description", "status", "category_id", "priority", "year",
--   "due_date", "progress", "position", "started_at", "completed_at"   (create/update),
--   "moves": [ { "from": status|null, "to": status, "moved_at": timestamptz } ]
-- } ] }
--
-- Returns { "ok": true, "tasks": [rows] }  or  { "ok": false, "conflicts": [ {id, title} ] }.
-- SECURITY INVOKER: every read/write goes through RLS, so a user can only save their
-- own tasks and an admin can save anyone's (task_history.changed_by = auth.uid(), FR-11).

create function public.save_board_changes(p_changes jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_item jsonb;
  v_move jsonb;
  v_op text;
  v_id uuid;
  v_row public.tasks;
  v_conflicts jsonb := '[]'::jsonb;
  v_saved_ids uuid[] := '{}';
  v_status text;
  v_started timestamptz;
  v_completed timestamptz;
  v_moved_at timestamptz;
  v_first_in_progress timestamptz;
  v_last_done timestamptz;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if jsonb_typeof(p_changes -> 'tasks') is distinct from 'array' then
    raise exception 'invalid payload' using errcode = '22023';
  end if;

  -- Phase 1: optimistic concurrency check for every task, before any write.
  -- Rows are locked so nobody can change them between the check and the write.
  for v_item in select * from jsonb_array_elements(p_changes -> 'tasks') loop
    v_op := v_item ->> 'op';
    v_id := (v_item ->> 'id')::uuid;

    if v_op = 'create' then
      -- Already exists (e.g. a retried save that actually succeeded).
      if exists (select 1 from public.tasks t where t.id = v_id) then
        v_conflicts := v_conflicts || jsonb_build_object('id', v_id, 'title', v_item ->> 'title');
      end if;
    elsif v_op in ('update', 'delete') then
      select * into v_row from public.tasks t where t.id = v_id for update;
      if not found or v_row.is_deleted or v_row.version <> (v_item ->> 'version')::integer then
        v_conflicts := v_conflicts || jsonb_build_object(
          'id', v_id,
          'title', coalesce(v_row.title, v_item ->> 'title')
        );
      end if;
    else
      raise exception 'invalid op: %', v_op using errcode = '22023';
    end if;
  end loop;

  if jsonb_array_length(v_conflicts) > 0 then
    -- FR-09: nothing is written when any task was changed elsewhere.
    return jsonb_build_object('ok', false, 'conflicts', v_conflicts);
  end if;

  -- Phase 2: writes.
  for v_item in select * from jsonb_array_elements(p_changes -> 'tasks') loop
    v_op := v_item ->> 'op';
    v_id := (v_item ->> 'id')::uuid;

    if v_op = 'delete' then
      -- BR-12 soft delete.
      update public.tasks set is_deleted = true, version = version + 1 where id = v_id;
      v_saved_ids := v_saved_ids || v_id;
      continue;
    end if;

    -- moved_at from the client; never in the future (clock skew).
    v_first_in_progress := null;
    v_last_done := null;
    for v_move in select * from jsonb_array_elements(coalesce(v_item -> 'moves', '[]'::jsonb)) loop
      v_moved_at := least(coalesce((v_move ->> 'moved_at')::timestamptz, v_now), v_now);
      if v_move ->> 'to' = 'in_progress' and v_first_in_progress is null then
        v_first_in_progress := v_moved_at;
      end if;
      if v_move ->> 'to' = 'done' then
        v_last_done := v_moved_at;
      end if;
    end loop;

    -- Client dates (may be backdated, BR-01), then enforce BR-03 / BR-04.
    v_status := v_item ->> 'status';
    v_started := nullif(v_item ->> 'started_at', '')::timestamptz;
    v_completed := nullif(v_item ->> 'completed_at', '')::timestamptz;
    if v_started is null and v_first_in_progress is not null then
      v_started := v_first_in_progress; -- BR-03
    end if;
    if v_status = 'done' then
      v_completed := coalesce(v_completed, v_last_done, v_now); -- BR-04 into done
    else
      v_completed := null; -- BR-04 out of done
    end if;

    if v_op = 'create' then
      insert into public.tasks (
        id, owner_id, title, description, status, category_id, priority, year,
        due_date, progress, position, started_at, completed_at
      ) values (
        v_id,
        (v_item ->> 'owner_id')::uuid,
        v_item ->> 'title',
        nullif(v_item ->> 'description', ''),
        v_status,
        (v_item ->> 'category_id')::uuid,
        (v_item ->> 'priority')::smallint,
        (v_item ->> 'year')::smallint,
        nullif(v_item ->> 'due_date', '')::date,
        nullif(v_item ->> 'progress', '')::smallint,
        (v_item ->> 'position')::numeric,
        v_started,
        v_completed
      );
    else
      update public.tasks set
        title = v_item ->> 'title',
        description = nullif(v_item ->> 'description', ''),
        status = v_status,
        category_id = (v_item ->> 'category_id')::uuid,
        priority = (v_item ->> 'priority')::smallint,
        year = (v_item ->> 'year')::smallint,
        due_date = nullif(v_item ->> 'due_date', '')::date,
        progress = nullif(v_item ->> 'progress', '')::smallint,
        position = (v_item ->> 'position')::numeric,
        started_at = v_started,
        completed_at = v_completed,
        version = version + 1
      where id = v_id;
    end if;

    -- One history row per column change, timed with the client's moved_at.
    insert into public.task_history (task_id, from_status, to_status, changed_by, changed_at)
    select
      v_id,
      m ->> 'from',
      m ->> 'to',
      v_uid,
      least(coalesce((m ->> 'moved_at')::timestamptz, v_now), v_now)
    from jsonb_array_elements(coalesce(v_item -> 'moves', '[]'::jsonb)) as m;

    v_saved_ids := v_saved_ids || v_id;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'tasks', coalesce(
      (select jsonb_agg(to_jsonb(t)) from public.tasks t where t.id = any (v_saved_ids)),
      '[]'::jsonb
    )
  );
end;
$$;

revoke execute on function public.save_board_changes(jsonb) from public, anon;
grant execute on function public.save_board_changes(jsonb) to authenticated;
