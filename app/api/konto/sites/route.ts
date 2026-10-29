import { AccountError, createSite } from "@/lib/accounts";
import { denyOwnerRequest } from "@/lib/auth/session";
import { platformOrigin } from "@/lib/env";
import { jsonError, noStoreJson } from "@/lib/http";

/** Creates a gallery for the signed-in owner. */
export async function POST(request: Request) {
	const guard = await denyOwnerRequest(request, platformOrigin());
	if ("response" in guard) return guard.response;
	const body = (await request.json().catch(() => null)) as unknown;
	if (!body || typeof body !== "object") {
		return jsonError("Nieprawidłowe dane formularza.", 400);
	}
	try {
		const site = await createSite(
			guard.session.accountId,
			body as Parameters<typeof createSite>[1],
		);
		return noStoreJson(
			{
				site: {
					id: site.id,
					slug: site.slug,
					title: site.title,
					origin: site.origin,
				},
			},
			{ status: 201 },
		);
	} catch (error) {
		if (error instanceof AccountError)
			return jsonError(error.message, error.status);
		console.error("[konto] nie udało się utworzyć galerii:", error);
		return jsonError("Nie udało się utworzyć galerii.", 500);
	}
}
