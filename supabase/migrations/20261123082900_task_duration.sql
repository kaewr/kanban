-- BR-57 Minutes worked on a done task. Entered by the user (required when a task is
-- created straight in "done", optional for other done tasks) and cleared when a task
-- leaves done, like completed_at (BR-04). Review-time stats prefer this value over
-- completed_at - started_at. Additive: one nullable column + create or replace.

alter table public.tasks
  add column duration_minutes integer
    constraint tasks_duration_minutes_range check (duration_minutes is null or duration_minutes between 1 and 525600);

-- review_decide() moves a task out of review; done tasks it creates have no duration yet,
-- so nothing changes there. save_board_changes: same as 20261123074724 plus duration.
create or replace function public.save_board_changes(p_changes jsonb)
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
  v_last_review timestamptz;
  v_owner uuid;
  v_reviewer uuid;
  v_open public.task_reviews;
  v_duration integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if jsonb_typeof(p_changes -> 'tasks') is distinct from 'array' then
    raise exception 'invalid payload' using errcode = '22023';
  end if;

  -- Phase 1: optimistic concurrency check for every task, before any write.
  for v_item in select * from jsonb_array_elements(p_changes -> 'tasks') loop
    v_op := v_item ->> 'op';
    v_id := (v_item ->> 'id')::uuid;

    if v_op = 'create' then
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
    return jsonb_build_object('ok', false, 'conflicts', v_conflicts);
  end if;

  -- Phase 2: writes.
  for v_item in select * from jsonb_array_elements(p_changes -> 'tasks') loop
    v_op := v_item ->> 'op';
    v_id := (v_item ->> 'id')::uuid;

    if v_op = 'delete' then
      update public.tasks set is_deleted = true, reviewer_id = null, version = version + 1 where id = v_id;
      update public.task_reviews set status = 'withdrawn', decided_by = v_uid, decided_at = v_now
      where task_id = v_id and status = 'open';
      v_saved_ids := v_saved_ids || v_id;
      continue;
    end if;

    v_first_in_progress := null;
    v_last_done := null;
    v_last_review := null;
    for v_move in select * from jsonb_array_elements(coalesce(v_item -> 'moves', '[]'::jsonb)) loop
      v_moved_at := least(coalesce((v_move ->> 'moved_at')::timestamptz, v_now), v_now);
      if v_move ->> 'to' = 'in_progress' and v_first_in_progress is null then
        v_first_in_progress := v_moved_at;
      end if;
      if v_move ->> 'to' = 'done' then
        v_last_done := v_moved_at;
      end if;
      if v_move ->> 'to' = 'review' then
        v_last_review := v_moved_at;
      end if;
    end loop;

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

    -- BR-57: minutes worked, only while done; required when a task is created in done.
    v_duration := case when v_status = 'done' then nullif(v_item ->> 'duration_minutes', '')::integer end;
    if v_op = 'create' and v_status = 'done' and v_duration is null then
      raise exception 'กรุณากรอกเวลาที่ใช้ (นาที)' using errcode = 'P0001';
    end if;

    -- BR-53: a reviewer only while in review; never the owner; must be an active account.
    v_reviewer := case when v_status = 'review' then nullif(v_item ->> 'reviewer_id', '')::uuid end;
    v_owner := case when v_op = 'create' then (v_item ->> 'owner_id')::uuid
                    else (select t.owner_id from public.tasks t where t.id = v_id) end;
    if v_reviewer is not null and (v_reviewer = v_owner or not public.is_active_profile(v_reviewer)) then
      raise exception 'ผู้ตรวจไม่ถูกต้อง' using errcode = 'P0001';
    end if;

    if v_op = 'create' then
      insert into public.tasks (
        id, owner_id, title, description, status, category_id, priority, year,
        due_date, progress, position, started_at, completed_at, reviewer_id, duration_minutes
      ) values (
        v_id,
        v_owner,
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
        v_completed,
        v_reviewer,
        v_duration
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
        reviewer_id = v_reviewer,
        duration_minutes = v_duration,
        version = version + 1
      where id = v_id;
    end if;

    insert into public.task_history (task_id, from_status, to_status, changed_by, changed_at)
    select
      v_id,
      m ->> 'from',
      m ->> 'to',
      v_uid,
      least(coalesce((m ->> 'moved_at')::timestamptz, v_now), v_now)
    from jsonb_array_elements(coalesce(v_item -> 'moves', '[]'::jsonb)) as m;

    -- Review requests follow the saved state: keep an open request for the same
    -- reviewer, otherwise withdraw it and open a new one when a reviewer is named.
    select * into v_open from public.task_reviews r where r.task_id = v_id and r.status = 'open';
    if found and (v_reviewer is null or v_open.reviewer_id <> v_reviewer) then
      update public.task_reviews set status = 'withdrawn', decided_by = v_uid, decided_at = v_now
      where id = v_open.id;
      v_open := null;
    end if;
    if v_reviewer is not null and v_open.id is null then
      insert into public.task_reviews (task_id, owner_id, reviewer_id, requested_by, requested_at)
      values (v_id, v_owner, v_reviewer, v_uid, coalesce(v_last_review, v_now));
    end if;

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
