-- Blur-up placeholder for the gallery: a tiny JPEG data URL the browser
-- builds next to the derivative, checked and stored by finalize. Older rows
-- stay null and render without a blur.
alter table public.photos
  add column blur_data_url text
  check (blur_data_url is null or length(blur_data_url) <= 4096);
