import { after } from "next/server";
import { z } from "zod";
import { createArchiveToken, verifyArchiveReceipt } from "@/lib/archive-token";
import { readGuestSession } from "@/lib/auth/session";
import { syncStorageUsage } from "@/lib/billing";
import { first, run } from "@/lib/db";
import { assertSameOrigin, jsonError, noStoreJson } from "@/lib/http";
import { siteFromRequest } from "@/lib/sites";

const requestSchema = z.discriminatedUnion("action", [
	z.object({ action: z.literal("token") }),
	z.object({ action: z.literal("complete"), receipt: z.string().min(1) }),
]);

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ photoId: string }> },
) {
	const site = await siteFromRequest(request);
	if (!site) return jsonError("Nie znaleziono strony.", 404);
	const session = await readGuestSession(site);
	if (!session) return jsonError("Sesja gościa wygasła.", 401);
	try {
		assertSameOrigin(request, site.origin);
	} catch (response) {
		return response as Response;
	}
	const parsed = requestSchema.safeParse(
		await request.json().catch(() => null),
	);
	if (!parsed.success) return jsonError("Nieprawidłowa akcja archiwum.", 400);
	const { photoId } = await params;
	const photo = await first<{
		id: string;
		original_filename: string;
		original_content_type: string;
		original_size: number;
		archive_status: string;
	}>(
		"select id, original_filename, original_content_type, original_size, archive_status from photos where id = ? and site_id = ? and guest_id = ?",
		[photoId, site.id, session.guestId],
	);
	if (!photo) return jsonError("Nie znaleziono zdjęcia.", 404);
	if (photo.archive_status === "uploaded") {
		return noStoreJson({ ok: true, alreadyComplete: true });
	}

	if (parsed.data.action === "token") {
		return noStoreJson({
			archiveToken: await createArchiveToken({
				photoId,
				siteId: site.id,
				origin: site.origin,
				operation: "upload",
				filename: photo.original_filename,
				contentType: photo.original_content_type,
				size: Number(photo.original_size),
			}),
		});
	}

	try {
		const receipt = await verifyArchiveReceipt(parsed.data.receipt);
		if (
			receipt.photoId !== photoId ||
			receipt.size !== Number(photo.original_size)
		) {
			return jsonError("Potwierdzenie archiwum nie pasuje do zdjęcia.", 400);
		}
		await run(
			"update photos set archive_status = 'uploaded', archive_key = ?, last_error = null where id = ?",
			[receipt.archiveKey, photoId],
		);
		after(() => syncStorageUsage(site.id));
		return noStoreJson({ ok: true });
	} catch {
		return jsonError("Nieprawidłowe potwierdzenie archiwum.", 400);
	}
}
