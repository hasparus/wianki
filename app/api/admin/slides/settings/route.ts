import { z } from "zod";
import { denyAdminRequest } from "@/lib/auth/session";
import { jsonError, noStoreJson } from "@/lib/http";
import { siteFromRequest } from "@/lib/sites";
import { setSlideSeconds } from "@/lib/slideshow";
import {
	SLIDESHOW_MAX_SECONDS,
	SLIDESHOW_MIN_SECONDS,
} from "@/lib/slideshow-protocol";

const bodySchema = z.object({
	slideSeconds: z
		.number()
		.int()
		.min(SLIDESHOW_MIN_SECONDS)
		.max(SLIDESHOW_MAX_SECONDS),
});

export async function PATCH(request: Request) {
	const site = await siteFromRequest(request);
	if (!site) return jsonError("Nie znaleziono strony.", 404);
	const denied = await denyAdminRequest(request, site);
	if (denied) return denied;
	const parsed = bodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return jsonError(
			`Czas slajdu musi być liczbą od ${SLIDESHOW_MIN_SECONDS} do ${SLIDESHOW_MAX_SECONDS} sekund.`,
			400,
		);
	}
	try {
		return noStoreJson({
			slideSeconds: await setSlideSeconds(site.id, parsed.data.slideSeconds),
		});
	} catch {
		return jsonError("Nie udało się zapisać ustawienia.", 500);
	}
}
