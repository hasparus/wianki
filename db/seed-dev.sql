-- Development and end-to-end seed for the local D1 database.
--
--   npm run db:reset:local        apply migrations, then this file
--
-- One account and one site whose custom domain is `localhost`, so a browser
-- at http://localhost:3000 lands on the wedding while PLATFORM_HOST points
-- elsewhere (Playwright uses `platform.localhost`). Every value below is a
-- test fixture; none of it is a real credential.

insert or replace into accounts (id, email, created_at)
values ('acc_dev', 'dev@example.com', '2026-01-01T00:00:00.000Z');

insert or replace into sites (
  id,
  account_id,
  slug,
  custom_domain,
  title,
  event_date,
  -- PBKDF2-SHA256 of "e2e invitation passphrase", lib/auth/secrets.ts format.
  guest_passphrase_hash,
  -- PBKDF2-SHA256 of "e2e admin passphrase long", lib/auth/secrets.ts format.
  admin_passphrase_hash,
  guest_entry_token,
  admin_entry_token,
  guest_join_code,
  guest_open_until,
  session_key_version,
  moderation_enabled,
  deletion_contact_email,
  consent_version,
  theme_json,
  plan_status,
  included_archive_bytes,
  created_at,
  updated_at
) values (
  'site_demo',
  'acc_dev',
  'demo',
  'localhost',
  'Rosia & Piotrek',
  '2026-09-19',
  'pbkdf2$100000$2VwfyovzBlQcM8Vr_jXtpg$mwXSGMcGIkmypW77c4LeP3svwkMi1pAv2Aavat6VpI4',
  'pbkdf2$100000$_tTPDawII6QzHwoZCnVDXQ$NC-kCjtwVLCVohoBdufXPIXahs7HawVB5nloKzOjZLE',
  'e2e_guest_entry_token_value_32_bytes',
  'e2e_admin_entry_token_value_32_bytes',
  'e2e-join-code',
  null,
  1,
  0,
  'couple@example.com',
  'e2e',
  '{}',
  'active',
  10737418240,
  '2026-01-01T00:00:00.000Z',
  '2026-01-01T00:00:00.000Z'
);

insert or replace into slideshow_settings (site_id, slide_seconds)
values ('site_demo', 8);
