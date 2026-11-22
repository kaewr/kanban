-- BR-47: a user clears all of their own tasks of one board year (for trying the app out).
-- Soft delete (BR-12): rows stay, is_deleted = true, version + 1 so any other open copy
-- of the board gets a conflict instead of writing over it.
-- security invoker + owner_id = auth.uid(): only the caller's own tasks, never anyone else's,
-- even for admins (RLS would allow them more, the function does not).

create or replace function public.clear_my_tasks(p_year smallint)
returns integer
language sql
volatile
security invoker
set search_path = ''
as $$
  with cleared as (
    update public.tasks
       set is_deleted = true,
           version = version + 1
     where owner_id = (select auth.uid())
       and year = p_year
       and not is_deleted
    returning 1
  )
  select count(*)::integer from cleared;
$$;

revoke all on function public.clear_my_tasks(smallint) from public, anon;
grant execute on function public.clear_my_tasks(smallint) to authenticated;
