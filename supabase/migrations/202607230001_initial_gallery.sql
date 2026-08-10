create extension if not exists pgcrypto;

create type public.hot_status as enum ('pending', 'uploaded', 'failed', 'deleted');
create type public.archive_status as enum (
  'pending',
  'uploaded',
  'failed',
  'trashed',
  'deletion_error'
);
create type public.moderation_status as enum (
  'pending',
  'approved',
  'flagged',
  'review_required',
  'rejected'
);

create table public.upload_batches (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null,
  item_count integer not null check (item_count between 1 and 10),
  consent_version text not null,
  created_at timestamptz not null default now()
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.upload_batches(id) on delete cascade,
  guest_id uuid not null,
  original_filename text not null,
  original_content_type text not null,
  original_size bigint not null check (original_size > 0 and original_size <= 26214400),
  derivative_content_type text,
  derivative_size bigint check (derivative_size is null or derivative_size <= 512000),
  width integer,
  height integer,
  storage_path text not null unique,
  archive_key text unique,
  hot_status public.hot_status not null default 'pending',
  archive_status public.archive_status not null default 'pending',
  moderation_status public.moderation_status not null default 'pending',
  moderation_scores jsonb,
  last_error text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.moderation_events (
  id bigint generated always as identity primary key,
  photo_id uuid not null references public.photos(id) on delete cascade,
  actor text not null check (actor in ('vision', 'admin', 'system')),
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

create index photos_gallery_idx
  on public.photos (created_at desc)
  where hot_status = 'uploaded' and moderation_status = 'approved';
create index photos_guest_idx on public.photos (guest_id);
create index photos_admin_queue_idx
  on public.photos (moderation_status, archive_status, created_at desc);
create index moderation_events_photo_idx
  on public.moderation_events (photo_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger photos_set_updated_at
before update on public.photos
for each row execute procedure public.set_updated_at();

alter table public.upload_batches enable row level security;
alter table public.photos enable row level security;
alter table public.moderation_events enable row level security;

revoke all on public.upload_batches from anon, authenticated;
revoke all on public.photos from anon, authenticated;
revoke all on public.moderation_events from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gallery',
  'gallery',
  false,
  512000,
  array['image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

revoke all on storage.objects from anon, authenticated;
