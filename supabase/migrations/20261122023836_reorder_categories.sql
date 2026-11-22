-- FR-18: admin reorders categories. Writes every sort_order in one transaction.
-- security invoker: the categories_update_admin policy still guards the write.

create or replace function public.reorder_categories(p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total integer;
begin
  -- RLS would silently update nothing for a non-admin; fail loudly instead.
  if not (select public.is_admin()) then
    raise exception 'only admins can reorder categories' using errcode = '42501';
  end if;

  select count(*) into v_total from public.categories;

  -- The list must name every category exactly once.
  if p_ids is null
     or cardinality(p_ids) <> v_total
     or (select count(distinct id) from unnest(p_ids) as t(id)) <> v_total
     or exists (
       select 1 from unnest(p_ids) as t(id)
       where not exists (select 1 from public.categories c where c.id = t.id)
     )
  then
    raise exception 'category list does not match' using errcode = '22023';
  end if;

  update public.categories c
     set sort_order = o.ord
    from unnest(p_ids) with ordinality as o(id, ord)
   where c.id = o.id
     and c.sort_order is distinct from o.ord::smallint;
end;
$$;

revoke all on function public.reorder_categories(uuid[]) from public, anon;
grant execute on function public.reorder_categories(uuid[]) to authenticated;
