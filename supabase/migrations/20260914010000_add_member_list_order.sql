-- List order belongs to a member, not to the shared list itself.
alter table public.list_members
add column if not exists position integer;

create index if not exists list_members_user_position_idx
on public.list_members (user_id, position);

-- Keep writes to this field separate from general list membership updates.
-- The function can only reorder memberships belonging to the caller.
create or replace function public.reorder_my_lists(ordered_list_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if ordered_list_ids is null
    or (select count(distinct id) from unnest(ordered_list_ids) as ids(id))
       <> cardinality(ordered_list_ids)
    or exists (select 1 from unnest(ordered_list_ids) as ids(id) where id is null)
  then
    raise exception 'Invalid list order';
  end if;

  if exists (
    select 1
    from unnest(ordered_list_ids) as ids(id)
    where not exists (
      select 1 from public.list_members
      where user_id = auth.uid() and list_id = ids.id
    )
  ) then
    raise exception 'List order contains a list you do not belong to';
  end if;

  update public.list_members as member
  set position = requested.ordinality - 1
  from unnest(ordered_list_ids) with ordinality as requested(list_id, ordinality)
  where member.user_id = auth.uid()
    and member.list_id = requested.list_id;
end;
$$;

revoke all on function public.reorder_my_lists(uuid[]) from public, anon;
grant execute on function public.reorder_my_lists(uuid[]) to authenticated;
