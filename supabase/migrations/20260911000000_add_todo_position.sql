alter table public.todos
add column if not exists position integer;

-- Preserve the order users currently see before making position required.
with ranked as (
  select
    id,
    row_number() over (
      partition by list_id
      order by due_date asc nulls last, created_at desc
    ) - 1 as new_position
  from public.todos
)
update public.todos
set position = ranked.new_position
from ranked
where public.todos.id = ranked.id
  and public.todos.position is null;

create or replace function public.set_new_todo_position()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.position is null then
    select coalesce(max(position), -1) + 1
      into new.position
      from public.todos
      where list_id = new.list_id;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_new_todo_position'
      and tgrelid = 'public.todos'::regclass
  ) then
    create trigger set_new_todo_position
    before insert on public.todos
    for each row execute function public.set_new_todo_position();
  end if;
end;
$$;

alter table public.todos
alter column position set not null;

create index if not exists todos_list_id_position_idx
on public.todos (list_id, position);
