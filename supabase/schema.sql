-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid,
  kind text not null check (kind in ('video', 'image', 'headshot')),
  model text not null,
  provider text not null,
  prompt text not null,
  params jsonb not null default '{}',
  status text not null default 'queued'
    check (status in ('queued', 'submitting', 'running', 'saving', 'done', 'failed')),
  provider_job_id text,
  error text,
  warning text,
  output_path text,
  mime text,
  remote_url text,
  polled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jobs_status_idx on jobs (status);
create index if not exists jobs_created_idx on jobs (created_at desc);

create table if not exists headshots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  storage_path text not null,
  source text not null default 'upload' check (source in ('upload', 'generated')),
  created_at timestamptz not null default now()
);
create unique index if not exists headshots_name_idx on headshots (lower(name));

-- The app talks to the database only from the server with the service role key,
-- so lock both tables down for everyone else.
alter table jobs enable row level security;
alter table headshots enable row level security;

-- Private storage bucket for inputs and generated files.
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;
