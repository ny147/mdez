create table public.key_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  key_digest bytea not null unique,
  schema_version integer not null default 1 check (schema_version > 0),
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  purge_after timestamptz,
  check ((deleted_at is null and purge_after is null) or
         (deleted_at is not null and purge_after >= deleted_at))
);

create table public.group_folders (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.key_groups(id) on delete cascade,
  parent_id uuid,
  name text not null check (char_length(name) between 1 and 300),
  sort_order integer not null check (sort_order >= 0),
  version integer not null default 1 check (version > 0),
  group_revision bigint not null check (group_revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, id),
  foreign key (group_id, parent_id) references public.group_folders(group_id, id) on delete restrict
);

create table public.group_documents (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.key_groups(id) on delete cascade,
  folder_id uuid,
  title text not null check (char_length(title) between 1 and 300),
  markdown text not null check (octet_length(markdown) <= 5242880),
  sort_order integer not null check (sort_order >= 0),
  version integer not null default 1 check (version > 0),
  group_revision bigint not null check (group_revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, id),
  foreign key (group_id, folder_id) references public.group_folders(group_id, id) on delete restrict
);

create table public.group_change_log (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.key_groups(id) on delete cascade,
  revision bigint not null check (revision > 0),
  entity_type text not null check (entity_type in ('group', 'folder', 'document')),
  entity_id uuid not null,
  operation text not null check (operation in ('create', 'update', 'delete')),
  changed_at timestamptz not null default now(),
  unique (group_id, revision)
);

create index group_folders_group_idx on public.group_folders (group_id, sort_order);
create index group_documents_group_idx on public.group_documents (group_id, sort_order);
create index group_change_log_cursor_idx on public.group_change_log (group_id, revision);
create index key_groups_purge_idx on public.key_groups (purge_after) where purge_after is not null;

create function public.reject_deleted_group_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.key_groups where id = new.group_id and deleted_at is not null) then
    raise exception 'group is deleted' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger group_folders_active_guard before insert or update on public.group_folders
for each row execute function public.reject_deleted_group_mutation();
create trigger group_documents_active_guard before insert or update on public.group_documents
for each row execute function public.reject_deleted_group_mutation();

alter table public.key_groups enable row level security;
alter table public.group_folders enable row level security;
alter table public.group_documents enable row level security;
alter table public.group_change_log enable row level security;
revoke all on public.key_groups, public.group_folders, public.group_documents, public.group_change_log from anon, authenticated;
