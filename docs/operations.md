# Event Operations

## One month before

- Upgrade Supabase for the event month.
- Confirm OAuth consent is Production and refresh token works.
- Review Polish privacy copy and deletion address.
- Print a fresh guest QR and securely print/store the admin QR.
- Upload, approve, view, reconcile, and delete disposable test images.

## 48 hours before

- Run `npm run check`.
- Test Safari on a current iPhone and Chrome on a current Android phone.
- Test weak-network interruption and retry.
- Confirm Vercel, Supabase, Vision, Drive, and Worker dashboards are healthy.
- Verify Drive and Supabase available capacity and Cloudflare request errors.

## During the event

- Keep the admin QR with the couple or a trusted helper.
- Watch the moderation/archive-error queues, not raw logs containing metadata.
- If Vision fails, approve safe images manually; do not make the bucket public.
- With `MODERATION_ENABLED=false`, photos publish instantly; use the admin
  panel to hide anything unwanted after the fact.
- If Drive fails, keep the hot gallery running and reconcile later.

## Recovery and rotation

- Guest entry leak: rotate guest entry token and reprint.
- Admin entry leak: rotate admin entry and session secrets, redeploy, regenerate.
- Archive token leak: rotate the shared archive secret in Vercel and Cloudflare.
- OAuth revocation: rerun bootstrap and replace Worker refresh token.
- Never solve a failure by copying service credentials into the browser.
