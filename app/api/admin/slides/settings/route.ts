import { z } from "zod";
import { readAdminSession } from "@/lib/auth/session";
import { assertSameOrigin, jsonError, noStoreJson } from "@/lib/http";
import {
	SLIDESHOW_MAX_SECONDS,
	SLIDESHOW_MIN_SECONDS,
	setSlideSeconds,
} from "@/lib/slideshow";

const bodySchema = z.object({
	slideSeconds: z
		.number()
		.int()
		.min(SLIDESHOW_MIN_SECONDS)
		.max(SLIDESHOW_MAX_SECONDS),
});

export async function PATCH(request: Request) {
	if (!(await readAdminSession())) return jsonError("Brak dostępu.", 401);
	try {
		assertSameOrigin(request);
	} catch (response) {
		return response as Response;
	}
	const parsed = bodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return jsonError(
			`Czas slajdu musi być liczbą od ${SLIDESHOW_MIN_SECONDS} do ${SLIDESHOW_MAX_SECONDS} sekund.`,
			400,
		);
	}
	try {
		return noStoreJson({
			slideSeconds: await setSlideSeconds(parsed.data.slideSeconds),
		});
	} catch {
		return jsonError("Nie udało się zapisać ustawienia.", 500);
	}
}
