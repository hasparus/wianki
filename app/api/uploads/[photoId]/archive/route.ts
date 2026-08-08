import { z } from "zod";
import { createArchiveToken, verifyArchiveReceipt } from "@/lib/archive-token";
import { readGuestSession } from "@/lib/auth/session";
import { assertSameOrigin, jsonError, noStoreJson } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/server";

const requestSchema = z.discriminatedUnion("action", [
	z.object({ action: z.literal("token") }),
	z.object({ action: z.literal("complete"), receipt: z.string().min(1) }),
]);

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ photoId: string }> },
) {
	const session = await readGuestSession();
	if (!session) return jsonError("Sesja gościa wygasła.", 401);
	try {
		assertSameOrigin(request);
	} catch (response) {
		return response as Response;
	}
	const parsed = requestSchema.safeParse(
		await request.json().catch(() => null),
	);
	if (!parsed.success) return jsonError("Nieprawidłowa akcja archiwum.", 400);
	const { photoId } = await params;
	const supabase = supabaseAdmin();
	const { data: photo, error } = await supabase
		.from("photos")
		.select(
			"id,original_filename,original_content_type,original_size,archive_status",
		)
		.eq("id", photoId)
		.eq("guest_id", session.guestId)
		.single();
	if (error || !photo) return jsonError("Nie znaleziono zdjęcia.", 404);
	if (photo.archive_status === "uploaded") {
		return noStoreJson({ ok: true, alreadyComplete: true });
	}

	if (parsed.data.action === "token") {
		return noStoreJson({
			archiveToken: await createArchiveToken({
				photoId,
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
		await supabase
			.from("photos")
			.update({
				archive_status: "uploaded",
				archive_key: receipt.archiveKey,
				last_error: null,
			})
			.eq("id", photoId);
		return noStoreJson({ ok: true });
	} catch {
		return jsonError("Nieprawidłowe potwierdzenie archiwum.", 400);
	}
}
