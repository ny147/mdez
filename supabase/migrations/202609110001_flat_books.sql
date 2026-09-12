-- Deleted groups are retained for seven days and their mutation guard would
-- otherwise reject this shape-only migration. The transaction restores it.
alter table public.group_folders disable trigger group_folders_active_guard;

create temporary table mdez_flat_book_names on commit drop as
with recursive book_paths as (
  select id, group_id, name::text as path
  from public.group_folders
  where parent_id is null
  union all
  select child.id, child.group_id, parent.path || ' / ' || child.name
  from public.group_folders child
  join book_paths parent on parent.id = child.parent_id and parent.group_id = child.group_id
)
select folder.id, folder.group_id, folder.parent_id, coalesce(book_paths.path, folder.name)::text as base_name
from public.group_folders folder
left join book_paths on book_paths.id = folder.id and book_paths.group_id = folder.group_id;

-- Allocate names from a per-group reserved set. This also handles collisions
-- with pre-existing suffixes such as both "A / B" and "A / B (2)".
create temporary table mdez_reserved_book_names (
  group_id uuid not null,
  normalized_name text not null,
  primary key (group_id, normalized_name)
) on commit drop;

do $$
declare
  folder_row record;
  candidate text;
  suffix_number integer;
  suffix text;
begin
  for folder_row in
    select * from mdez_flat_book_names
    order by group_id, (parent_id is not null), lower(base_name), id
  loop
    suffix_number := 1;
    candidate := left(folder_row.base_name, 300);
    while exists (
      select 1 from mdez_reserved_book_names
      where group_id = folder_row.group_id and normalized_name = lower(candidate)
    ) loop
      suffix_number := suffix_number + 1;
      suffix := ' (' || suffix_number || ')';
      candidate := left(folder_row.base_name, 300 - char_length(suffix)) || suffix;
    end loop;

    insert into mdez_reserved_book_names (group_id, normalized_name)
    values (folder_row.group_id, lower(candidate));
    update public.group_folders
    set name = candidate,
        parent_id = null,
        version = version + 1,
        updated_at = now()
    where group_id = folder_row.group_id and id = folder_row.id;
  end loop;
end $$;

-- Give every migrated folder its own cursor revision so cached group clients
-- converge through the normal incremental-change protocol after deployment.
do $$
declare
  group_row record;
  folder_row record;
  next_revision bigint;
begin
  for group_row in select id, revision from public.key_groups order by id for update loop
    next_revision := group_row.revision;
    for folder_row in select id from public.group_folders where group_id = group_row.id order by id loop
      next_revision := next_revision + 1;
      update public.group_folders
      set group_revision = next_revision
      where group_id = group_row.id and id = folder_row.id;
      insert into public.group_change_log (group_id, revision, entity_type, entity_id, operation)
      values (group_row.id, next_revision, 'folder', folder_row.id, 'update');
    end loop;
    update public.key_groups
    set revision = next_revision, updated_at = now()
    where id = group_row.id;
  end loop;
end $$;

alter table public.group_folders
  add constraint group_folders_are_top_level check (parent_id is null) not valid;
alter table public.group_folders validate constraint group_folders_are_top_level;

alter table public.group_folders enable trigger group_folders_active_guard;
