create table public.quick_shares (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique check (char_length(public_id) between 22 and 64),
  management_token_digest bytea not null,
  title text not null check (char_length(title) between 1 and 300),
  markdown text not null,
  size_bytes integer not null check (size_bytes between 0 and 5242880),
  created_at timestamptz not null default now(),
  expires_at timestamptz null
);

create index quick_shares_expires_at_idx
  on public.quick_shares (expires_at)
  where expires_at is not null;

create table public.rate_limit_buckets (
  bucket_key bytea primary key,
  request_count integer not null check (request_count > 0),
  window_started_at timestamptz not null,
  expires_at timestamptz not null
);

create index rate_limit_buckets_expires_at_idx on public.rate_limit_buckets (expires_at);

alter table public.quick_shares enable row level security;
alter table public.rate_limit_buckets enable row level security;
revoke all on public.quick_shares from anon, authenticated;
revoke all on public.rate_limit_buckets from anon, authenticated;
