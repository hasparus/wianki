create table public.slideshow_slides (
  id uuid primary key default gen_random_uuid(),
  position integer not null,
  kind text not null check (kind in ('photo', 'text')),
  photo_id uuid references public.photos(id) on delete cascade,
  title text check (title is null or char_length(title) <= 120),
  subtitle text check (subtitle is null or char_length(subtitle) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint slideshow_slides_kind_shape check (
    (kind = 'photo' and photo_id is not null)
    or (kind = 'text' and photo_id is null and title is not null)
  )
);

create index slideshow_slides_position_idx
  on public.slideshow_slides (position asc, created_at asc);
create unique index slideshow_slides_photo_idx
  on public.slideshow_slides (photo_id)
  where photo_id is not null;

create trigger slideshow_slides_set_updated_at
before update on public.slideshow_slides
for each row execute procedure public.set_updated_at();

alter table public.slideshow_slides enable row level security;

revoke all on public.slideshow_slides from anon, authenticated;
