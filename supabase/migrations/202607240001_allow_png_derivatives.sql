update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/webp', 'image/png']
where id = 'gallery';
