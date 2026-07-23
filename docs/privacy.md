# Privacy Decisions

- The couple controls the uploaded photos.
- Supabase stores private derivatives; personal Google Drive stores originals.
- Google Vision receives derivative bytes for SafeSearch.
- Gallery derivatives strip EXIF; originals retain camera metadata.
- The application creates a random browser UUID but collects no guest name,
  email, or IP address.
- Consent is required for every batch and stores the published notice version.
- Retention lasts until manual deletion.
- The configured contact email handles deletion requests.
- Admin deletion removes the derivative and trashes the original, allowing
  Drive recovery until its trash is emptied.

The production copy must be reviewed by the couple. This document records the
implemented behavior and is not legal advice.
