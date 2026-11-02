import { first } from "@/lib/db";

export type SiteUsage = {
	/** Bytes of originals currently held in the archive. */
	archiveBytes: number;
	/** Bytes of derivatives currently in the gallery bucket. */
	derivativeBytes: number;
	/** Photos counted against the plan: anything not fully deleted. */
	photoCount: number;
};

/**
 * Computed from the photos table every time rather than kept as counters,
 * so a half-failed deletion or a reconciled archive can never leave the
 * number the owner is billed on out of step with what is actually stored.
 */
export async function getSiteUsage(siteId: string): Promise<SiteUsage> {
	const row = await first<{
		archive_bytes: number | null;
		derivative_bytes: number | null;
		photo_count: number | null;
	}>(
		`select
		   sum(case when archive_status = 'uploaded' then original_size else 0 end) as archive_bytes,
		   sum(case when hot_status = 'uploaded' then coalesce(derivative_size, 0) else 0 end) as derivative_bytes,
		   sum(case when hot_status <> 'deleted' then 1 else 0 end) as photo_count
		 from photos where site_id = ?`,
		[siteId],
	);
	return {
		archiveBytes: row?.archive_bytes ?? 0,
		derivativeBytes: row?.derivative_bytes ?? 0,
		photoCount: row?.photo_count ?? 0,
	};
}
