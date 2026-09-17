-- Single-row settings for the slideshow. The boolean primary key with a
-- `check (id)` constraint makes a second row impossible, so readers can select
-- without ordering and writers never have to decide which row wins.
create table public.slideshow_settings (
  id boolean primary key default true check (id),
  slide_seconds integer not null default 8
    check (slide_seconds between 2 and 10),
  updated_at timestamptz not null default now()
);

create trigger slideshow_settings_set_updated_at
before update on public.slideshow_settings
for each row execute procedure public.set_updated_at();

alter table public.slideshow_settings enable row level security;

revoke all on public.slideshow_settings from anon, authenticated;

insert into public.slideshow_settings (id) values (true)
on conflict (id) do nothing;
