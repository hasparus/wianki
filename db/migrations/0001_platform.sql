-- Wianki platform schema for Cloudflare D1 (SQLite).
--
-- One database serves every wedding. Every row that belongs to a wedding
-- carries site_id, and every query in lib/ filters on it. Timestamps are
-- ISO 8601 UTC text with millisecond precision so they sort as strings.
--
-- Status vocabularies are enforced with check constraints rather than
-- enums; the values are the locked contract from docs/data-contracts.md.

create table accounts (
  id text primary key,
  email text not null unique,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_login_at text
);

-- Magic-link logins. Only a SHA-256 of the token is stored; the token itself
-- travels once, in the e-mail.
create table login_tokens (
  token_hash text primary key,
  email text not null,
  expires_at text not null,
  used_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index login_tokens_email_idx on login_tokens (email, created_at desc);

create table sites (
  id text primary key,
  account_id text not null references accounts(id) on delete cascade,
  -- Subdomain under the platform host: <slug>.wianki.app
  slug text not null unique
    check (length(slug) between 3 and 40 and slug glob '[a-z0-9]*' and slug not glob '*[^a-z0-9-]*'),
  custom_domain text unique,
  title text not null check (length(title) between 1 and 80),
  event_date text,
  -- Shared secrets. Passphrases are PBKDF2 hashes (guests type them);
  -- entry tokens are stored as issued because the owner prints them as QR.
  guest_passphrase_hash text,
  admin_passphrase_hash text,
  guest_entry_token text not null,
  admin_entry_token text not null,
  guest_join_code text,
  guest_open_until text,
  -- Bumping this invalidates every guest and admin cookie of the site.
  session_key_version integer not null default 1,
  moderation_enabled integer not null default 0 check (moderation_enabled in (0, 1)),
  deletion_contact_email text,
  consent_version text not null default '2026-07-23',
  theme_json text not null default '{}',
  -- Billing. trial: created, not paid; active: paid; past_due; canceled.
  plan_status text not null default 'trial'
    check (plan_status in ('trial', 'active', 'past_due', 'canceled')),
  stripe_customer_id text,
  stripe_subscription_id text unique,
  current_period_end text,
  included_archive_bytes integer not null default 10737418240,
  overage_blocks_reported integer not null default 0,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index sites_account_idx on sites (account_id, created_at);

create table upload_batches (
  id text primary key,
  site_id text not null references sites(id) on delete cascade,
  guest_id text not null,
  item_count integer not null check (item_count between 1 and 10),
  consent_version text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table photos (
  id text primary key,
  site_id text not null references sites(id) on delete cascade,
  batch_id text not null references upload_batches(id) on delete cascade,
  guest_id text not null,
  original_filename text not null,
  original_content_type text not null,
  original_size integer not null check (original_size > 0 and original_size <= 26214400),
  derivative_content_type text,
  derivative_size integer check (derivative_size is null or derivative_size <= 512000),
  width integer,
  height integer,
  storage_path text not null unique,
  archive_key text unique,
  hot_status text not null default 'pending'
    check (hot_status in ('pending', 'uploaded', 'failed', 'deleted')),
  archive_status text not null default 'pending'
    check (archive_status in ('pending', 'uploaded', 'failed', 'trashed', 'deletion_error')),
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'approved', 'flagged', 'review_required', 'rejected')),
  moderation_scores text,
  blur_data_url text check (blur_data_url is null or length(blur_data_url) <= 4096),
  last_error text,
  decided_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index photos_gallery_idx
  on photos (site_id, created_at desc, id desc)
  where hot_status = 'uploaded' and moderation_status = 'approved';
create index photos_site_created_idx on photos (site_id, created_at desc, id desc);
create index photos_guest_idx on photos (site_id, guest_id);
create index photos_batch_idx on photos (batch_id);

create trigger photos_set_updated_at
after update on photos
for each row
begin
  update photos set updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = new.id;
end;

create table moderation_events (
  id integer primary key autoincrement,
  photo_id text not null references photos(id) on delete cascade,
  actor text not null check (actor in ('vision', 'admin', 'system')),
  action text not null,
  details text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index moderation_events_photo_idx on moderation_events (photo_id, created_at desc);

create table slideshow_slides (
  id text primary key,
  site_id text not null references sites(id) on delete cascade,
  position integer not null,
  kind text not null check (kind in ('photo', 'text')),
  photo_id text references photos(id) on delete cascade,
  title text check (title is null or length(title) <= 120),
  subtitle text check (subtitle is null or length(subtitle) <= 200),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  check (
    (kind = 'photo' and photo_id is not null)
    or (kind = 'text' and photo_id is null and title is not null)
  )
);

create index slideshow_slides_position_idx on slideshow_slides (site_id, position, created_at);
create unique index slideshow_slides_photo_idx on slideshow_slides (photo_id) where photo_id is not null;

-- One settings row per site; the site id is the key, so a second row is impossible.
create table slideshow_settings (
  site_id text primary key references sites(id) on delete cascade,
  slide_seconds integer not null default 8 check (slide_seconds between 2 and 10),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Stripe events already applied, so a redelivered webhook is a no-op.
create table billing_events (
  id text primary key,
  type text not null,
  received_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
