import { z } from "zod";
import { denyAdminRequest } from "@/lib/auth/session";
import { jsonError, noStoreJson } from "@/lib/http";
import { SLIDESHOW_MAX_SUBTITLE, SLIDESHOW_MAX_TITLE } from "@/lib/slideshow";
import { supabaseAdmin } from "@/lib/supabase/server";

const updateSchema = z.object({
	title: z.string().trim().min(1).max(SLIDESHOW_MAX_TITLE),
	subtitle: z
		.string()
		.trim()
		.max(SLIDESHOW_MAX_SUBTITLE)
		.optional()
		.transform((value) => value || null),
});

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ slideId: string }> },
) {
	const denied = await denyAdminRequest(request);
	if (denied) return denied;
	const parsed = updateSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return jsonError("Nieprawidłowa treść slajdu.", 400);
	const { slideId } = await params;
	const { data, error } = await supabaseAdmin()
		.from("slideshow_slides")
		.update({ title: parsed.data.title, subtitle: parsed.data.subtitle })
		.eq("id", slideId)
		.eq("kind", "text")
		.select("id");
	if (error) return jsonError("Nie udało się zapisać slajdu.", 500);
	if (!data?.length) return jsonError("Nie znaleziono slajdu tekstowego.", 404);
	return noStoreJson({ ok: true });
}

export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ slideId: string }> },
) {
	const denied = await denyAdminRequest(request);
	if (denied) return denied;
	const { slideId } = await params;
	const { data, error } = await supabaseAdmin()
		.from("slideshow_slides")
		.delete()
		.eq("id", slideId)
		.select("id");
	if (error) return jsonError("Nie udało się usunąć slajdu.", 500);
	if (!data?.length) return jsonError("Nie znaleziono slajdu.", 404);
	return noStoreJson({ ok: true });
}
