-- BR-53..56 Review tags: a task in "review" can name one reviewer (anyone with an
-- account). The reviewer gets an in-app notification, sees the task in /reviews, and
-- can approve (-> done), return (-> in_progress) or only comment. The owner is notified
-- back. Additive only: one nullable column on tasks, new tables, new functions.

-- ---------------------------------------------------------------------------
-- Helper for policies/checks: is this an active account? (definer: users cannot
-- read other profiles under RLS)
-- ---------------------------------------------------------------------------
create function public.is_active_profile(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_active from public.profiles p where p.id = p_id), false);
$$;

revoke execute on function public.is_active_profile(uuid) from public, anon;
grant execute on function public.is_active_profile(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- tasks.reviewer_id: who is asked to review; only meaningful while status = 'review'
-- ---------------------------------------------------------------------------
alter table public.tasks
  add column reviewer_id uuid references public.profiles (id) on delete restrict;

-- ---------------------------------------------------------------------------
-- task_reviews: one row per review request (history; feeds future review-time stats)
-- ---------------------------------------------------------------------------
create table public.task_reviews (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete restrict,
  owner_id uuid not null references public.profiles (id) on delete restrict,
  reviewer_id uuid not null references public.profiles (id) on delete restrict,
  requested_by uuid not null references public.profiles (id) on delete restrict,
  requested_at timestamptz not null default now(),
  -- open -> approved | returned (by the reviewer) | withdrawn (owner moved it / changed reviewer)
  status text not null default 'open'
    constraint task_reviews_status_check check (status in ('open', 'approved', 'returned', 'withdrawn')),
  comment text
    constraint task_reviews_comment_length check (comment is null or length(comment) between 1 and 500),
  commented_at timestamptz,
  decided_by uuid references public.profiles (id) on delete restrict,
  decided_at timestamptz,
  constraint task_reviews_not_self check (reviewer_id <> owner_id)
);

create unique index task_reviews_one_open_per_task on public.task_reviews (task_id) where status = 'open';
create index task_reviews_reviewer_open_idx on public.task_reviews (reviewer_id) where status = 'open';

revoke all on public.task_reviews from anon, authenticated;
grant all on public.task_reviews to service_role;
grant select, insert, update on public.task_reviews to authenticated;
alter table public.task_reviews enable row level security;

create policy "task_reviews_select_party_or_admin"
  on public.task_reviews for select to authenticated
  using (
    (select public.is_active_user())
    and (owner_id = (select auth.uid()) or reviewer_id = (select auth.uid()) or (select public.is_admin()))
  );

-- Written by save_board_changes (security invoker) as the owner or an admin.
create policy "task_reviews_insert_owner_or_admin"
  on public.task_reviews for insert to authenticated
  with check (
    (select public.is_active_user())
    and requested_by = (select auth.uid())
    and status = 'open'
    and (owner_id = (select auth.uid()) or (select public.is_admin()))
  );

-- The owner/admin can only withdraw; reviewer decisions go through review_decide().
create policy "task_reviews_update_owner_or_admin"
  on public.task_reviews for update to authenticated
  using ((select public.is_active_user()) and (owner_id = (select auth.uid()) or (select public.is_admin())))
  with check ((select public.is_active_user()) and (owner_id = (select auth.uid()) or (select public.is_admin())));

-- A reviewer may read tasks they were asked to review (open or past, for their review
-- history). task_reviews RLS lets them see their own requests, and that policy does not
-- look at tasks, so there is no recursion. Writing still needs review_decide().
create policy "tasks_select_reviewer"
  on public.tasks for select to authenticated
  using (
    (select public.is_active_user())
    and exists (
      select 1 from public.task_reviews r
      where r.task_id = tasks.id and r.reviewer_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- notifications: in-app only for now (BR-56); other channels can read this table later
-- ---------------------------------------------------------------------------
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete restrict,
  kind text not null
    constraint notifications_kind_check
    check (kind in ('review_requested', 'review_withdrawn', 'review_commented', 'review_approved', 'review_returned')),
  task_id uuid references public.tasks (id) on delete restrict,
  review_id uuid references public.task_reviews (id) on delete restrict,
  actor_id uuid references public.profiles (id) on delete restrict,
  -- Snapshots: the recipient may lose access to the task once the review closes.
  task_title text not null,
  message text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;
create index notifications_user_idx on public.notifications (user_id, created_at desc);

revoke all on public.notifications from anon, authenticated;
grant all on public.notifications to service_role;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated; -- mark as read only
alter table public.notifications enable row level security;

create policy "notifications_select_own"
  on public.notifications for select to authenticated
  using ((select public.is_active_user()) and user_id = (select auth.uid()));

create policy "notifications_update_own"
  on public.notifications for update to authenticated
  using ((select public.is_active_user()) and user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Notifications are created only here, from review changes. Definer: the recipient is
-- another person, and users have no INSERT on notifications.
create function public.task_reviews_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_actor uuid := coalesce(auth.uid(), new.decided_by, new.requested_by);
begin
  -- admin_restore inserts old requests: no notifications for those.
  if coalesce(current_setting('app.restoring', true), '') = 'on' then
    return new;
  end if;
  select t.title into v_title from public.tasks t where t.id = new.task_id;
  v_title := coalesce(v_title, '');

  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, kind, task_id, review_id, actor_id, task_title)
    values (new.reviewer_id, 'review_requested', new.task_id, new.id, new.requested_by, v_title);
    return new;
  end if;

  if old.status = 'open' and new.status = 'withdrawn' then
    insert into public.notifications (user_id, kind, task_id, review_id, actor_id, task_title)
    values (new.reviewer_id, 'review_withdrawn', new.task_id, new.id, v_actor, v_title);
  elsif old.status = 'open' and new.status in ('approved', 'returned') then
    insert into public.notifications (user_id, kind, task_id, review_id, actor_id, task_title, message)
    values (new.owner_id, 'review_' || new.status, new.task_id, new.id, new.reviewer_id, v_title, new.comment);
  elsif new.status = 'open' and new.comment is distinct from old.comment and new.comment is not null then
    insert into public.notifications (user_id, kind, task_id, review_id, actor_id, task_title, message)
    values (new.owner_id, 'review_commented', new.task_id, new.id, new.reviewer_id, v_title, new.comment);
  end if;
  return new;
end;
$$;

revoke execute on function public.task_reviews_notify() from public, anon, authenticated;

create trigger task_reviews_notify
  after insert or update on public.task_reviews
  for each row execute function public.task_reviews_notify();

-- ---------------------------------------------------------------------------
-- review_decide: the reviewer approves, returns or comments (BR-54, BR-06 changed).
-- SECURITY DEFINER (exception to the invoker rule): the reviewer is not the owner, so
-- RLS would not let them move the task. It only ever acts on an open request whose
-- reviewer is the caller, and writes task_history as the caller.
-- ---------------------------------------------------------------------------
create function public.review_decide(p_review_id uuid, p_action text, p_comment text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_review public.task_reviews;
  v_task public.tasks;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_to text;
  v_position numeric;
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_action not in ('approve', 'return', 'comment') then
    raise exception 'invalid action' using errcode = '22023';
  end if;
  if v_comment is not null and length(v_comment) > 500 then
    raise exception 'ความเห็นยาวได้ไม่เกิน 500 ตัวอักษร' using errcode = 'P0001';
  end if;
  if p_action = 'comment' and v_comment is null then
    raise exception 'กรุณาเขียนความเห็น' using errcode = 'P0001';
  end if;

  select * into v_review from public.task_reviews r
  where r.id = p_review_id and r.status = 'open' and r.reviewer_id = v_uid
  for update;
  if not found then
    raise exception 'ไม่พบคำขอตรวจนี้ อาจถูกยกเลิกหรือตรวจไปแล้ว' using errcode = 'P0002';
  end if;

  select * into v_task from public.tasks t where t.id = v_review.task_id for update;
  if not found or v_task.is_deleted or v_task.status <> 'review' then
    raise exception 'งานนี้ไม่ได้อยู่ในสถานะรอตรวจสอบแล้ว' using errcode = 'P0002';
  end if;

  if p_action = 'comment' then
    update public.task_reviews set comment = v_comment, commented_at = v_now where id = v_review.id;
    return jsonb_build_object('ok', true, 'status', 'open');
  end if;

  v_to := case p_action when 'approve' then 'done' else 'in_progress' end;
  select coalesce(max(t.position), 0) + 1 into v_position
  from public.tasks t
  where t.owner_id = v_task.owner_id and t.year = v_task.year and t.status = v_to and not t.is_deleted;

  update public.tasks set
    status = v_to,
    position = v_position,
    reviewer_id = null,
    completed_at = case when v_to = 'done' then v_now else null end, -- BR-04
    version = version + 1
  where id = v_task.id;

  insert into public.task_history (task_id, from_status, to_status, changed_by, changed_at)
  values (v_task.id, 'review', v_to, v_uid, v_now);

  update public.task_reviews set
    status = case p_action when 'approve' then 'approved' else 'returned' end,
    comment = coalesce(v_comment, comment),
    commented_at = case when v_comment is not null then v_now else commented_at end,
    decided_by = v_uid,
    decided_at = v_now
  where id = v_review.id;

  return jsonb_build_object('ok', true, 'status', v_to);
end;
$$;

revoke execute on function public.review_decide(uuid, text, text) from public, anon;
grant execute on function public.review_decide(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- save_board_changes: same as before, plus reviewer_id and review requests.
-- ---------------------------------------------------------------------------
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
        due_date, progress, position, started_at, completed_at, reviewer_id
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
        v_reviewer
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
