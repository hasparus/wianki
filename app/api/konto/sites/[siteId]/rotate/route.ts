import { z } from "zod";
import { entryLinks, rotateEntryToken } from "@/lib/accounts";
import { denyOwnerRequest } from "@/lib/auth/session";
import { platformOrigin } from "@/lib/env";
import { jsonError, noStoreJson } from "@/lib/http";

type Context = { params: Promise<{ siteId: string }> };

const bodySchema = z.object({ which: z.enum(["guest", "admin"]) });

/**
 * Issues a new entry token. The response carries the new links so the page
 * can redraw its QR codes without a reload; the admin rotation also logs
 * every admin device out.
 */
export async function POST(request: Request, { params }: Context) {
	const guard = await denyOwnerRequest(request, platformOrigin());
	if ("response" in guard) return guard.response;
	const { siteId } = await params;
	const parsed = bodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return jsonError("Wybierz, który kod odnowić.", 400);
	try {
		const site = await rotateEntryToken(
			siteId,
			guard.session.accountId,
			parsed.data.which,
		);
		if (!site) return jsonError("Nie znaleziono galerii.", 404);
		return noStoreJson({ which: parsed.data.which, ...entryLinks(site) });
	} catch (error) {
		console.error("[konto] nie udało się odnowić kodu:", error);
		return jsonError("Nie udało się odnowić kodu.", 500);
	}
}
