import { z } from "zod";
import { findAccountByEmail, issueLoginToken } from "@/lib/accounts";
import { platformOrigin, serverEnv } from "@/lib/env";
import { assertSameOrigin, jsonError, noStoreJson } from "@/lib/http";
import { sendMagicLink } from "@/lib/mail";

const bodySchema = z.object({
	email: z.string().trim().max(254).pipe(z.email()),
});

/**
 * Asks for a magic link. The answer is the same whether or not the address
 * has an account, so the form cannot be used to find out who owns a gallery.
 * With sign-ups closed, only known addresses get a token; everyone else gets
 * the same quiet 200.
 */
export async function POST(request: Request) {
	const origin = platformOrigin();
	try {
		assertSameOrigin(request, origin);
	} catch (response) {
		return response as Response;
	}
	const parsed = bodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return jsonError("Podaj poprawny adres e-mail.", 400);
	const email = parsed.data.email.toLowerCase();

	if (!serverEnv().SIGNUP_ENABLED && !(await findAccountByEmail(email))) {
		return noStoreJson({ ok: true });
	}

	const { token } = await issueLoginToken(email);
	const url = `${origin}/konto/login/verify?token=${encodeURIComponent(token)}`;
	try {
		const result = await sendMagicLink(email, url);
		return noStoreJson(
			result.delivered ? { ok: true } : { ok: true, devLink: result.devLink },
		);
	} catch (error) {
		console.error(
			"[auth] nie udało się wysłać linku logowania:",
			error instanceof Error ? error.message : error,
		);
		return jsonError(
			"Nie udało się wysłać wiadomości z linkiem. Spróbuj ponownie za chwilę.",
			500,
		);
	}
}
