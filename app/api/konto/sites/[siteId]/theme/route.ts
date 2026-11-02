import { z } from "zod";
import { readOwnerSession } from "@/lib/auth/session";
import { first, nowIso, run } from "@/lib/db";
import { platformOrigin } from "@/lib/env";
import { assertSameOrigin, jsonError, noStoreJson } from "@/lib/http";
import { themeSchema, themeToCss } from "@/lib/theme";

const bodySchema = z.object({ theme: themeSchema });

/**
 * Saves a site's theme. The owner cookie names an account; the site must
 * belong to it, so a stranger's site id is indistinguishable from a missing
 * one. The stored JSON is the parsed theme, never the raw body.
 */
export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ siteId: string }> },
) {
	const session = await readOwnerSession();
	if (!session) return jsonError("Brak dostępu.", 401);
	try {
		assertSameOrigin(request, platformOrigin());
	} catch (error) {
		if (error instanceof Response) return error;
		throw error;
	}

	const parsed = bodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success)
		return jsonError("Nieprawidłowe ustawienia wyglądu.", 400);

	const { siteId } = await params;
	const site = await first<{ id: string }>(
		"select id from sites where id = ? and account_id = ?",
		[siteId, session.accountId],
	);
	if (!site) return jsonError("Nie znaleziono strony.", 404);

	const theme = parsed.data.theme;
	try {
		await run("update sites set theme_json = ?, updated_at = ? where id = ?", [
			JSON.stringify(theme),
			nowIso(),
			site.id,
		]);
	} catch {
		return jsonError("Nie udało się zapisać wyglądu.", 500);
	}
	return noStoreJson({ ok: true, css: themeToCss(theme) });
}
