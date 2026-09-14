alter table public.grocery_items
add column if not exists position integer;

-- Keep the order people currently see when the column is first added.
with ranked as (
  select id,
    row_number() over (
      partition by list_id
      order by is_checked asc, created_at asc
    ) - 1 as new_position
  from public.grocery_items
)
update public.grocery_items
set position = ranked.new_position
from ranked
where public.grocery_items.id = ranked.id
  and public.grocery_items.position is null;

create or replace function public.set_new_grocery_position()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.position is null then
    select coalesce(max(position), -1) + 1
      into new.position
      from public.grocery_items
      where list_id = new.list_id;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_new_grocery_position'
      and tgrelid = 'public.grocery_items'::regclass
  ) then
    create trigger set_new_grocery_position
    before insert on public.grocery_items
    for each row execute function public.set_new_grocery_position();
  end if;
end;
$$;

alter table public.grocery_items
alter column position set not null;

create index if not exists grocery_items_list_id_position_idx
on public.grocery_items (list_id, position);
