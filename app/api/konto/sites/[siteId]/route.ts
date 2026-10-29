import {
	AccountError,
	publicSiteSettings,
	updateSiteSettings,
} from "@/lib/accounts";
import { denyOwnerRequest } from "@/lib/auth/session";
import { platformOrigin } from "@/lib/env";
import { jsonError, noStoreJson } from "@/lib/http";

type Context = { params: Promise<{ siteId: string }> };

export async function PATCH(request: Request, { params }: Context) {
	const guard = await denyOwnerRequest(request, platformOrigin());
	if ("response" in guard) return guard.response;
	const { siteId } = await params;
	const body = (await request.json().catch(() => null)) as unknown;
	if (!body || typeof body !== "object") {
		return jsonError("Nieprawidłowe dane formularza.", 400);
	}
	try {
		const site = await updateSiteSettings(
			siteId,
			guard.session.accountId,
			body as Parameters<typeof updateSiteSettings>[2],
		);
		if (!site) return jsonError("Nie znaleziono galerii.", 404);
		return noStoreJson({ site: publicSiteSettings(site) });
	} catch (error) {
		if (error instanceof AccountError)
			return jsonError(error.message, error.status);
		console.error("[konto] nie udało się zapisać ustawień:", error);
		return jsonError("Nie udało się zapisać ustawień.", 500);
	}
}
