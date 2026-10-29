import { bindings } from "@/lib/cloudflare";
import { serverEnv } from "@/lib/env";

export type MailResult =
	| { delivered: true }
	| { delivered: false; devLink: string };

export const MAGIC_LINK_SUBJECT = "Logowanie do Wianków";

export function magicLinkText(url: string) {
	return [
		"Cześć,",
		"",
		"ktoś (mamy nadzieję, że Ty) poprosił o zalogowanie do konta Wianków.",
		"Otwórz ten link, aby wejść do konta:",
		"",
		url,
		"",
		"Link działa 15 minut i tylko raz. Jeśli to nie Ty, zignoruj tę wiadomość:",
		"bez kliknięcia nikt się nie zaloguje.",
		"",
		"Wianki",
	].join("\n");
}

/**
 * One e-mail the platform sends: the magic link. With the Cloudflare Email
 * Sending binding and a sender address it goes out as plain UTF-8 text.
 * Without them, development logs the link instead, and production refuses
 * rather than pretending a mail was sent.
 */
export async function sendMagicLink(
	email: string,
	url: string,
): Promise<MailResult> {
	const sender = bindings().SEND_EMAIL;
	const from = serverEnv().EMAIL_FROM;
	if (sender && from) {
		await sender.send({
			from: { name: "Wianki", email: from },
			to: email,
			subject: MAGIC_LINK_SUBJECT,
			headers: { "Auto-Submitted": "auto-generated" },
			text: magicLinkText(url),
		});
		return { delivered: true };
	}
	if (process.env.NODE_ENV !== "production") {
		console.info(`[mail] link logowania dla ${email}: ${url}`);
		return { delivered: false, devLink: url };
	}
	throw new Error(
		"Wysyłka e-maili nie jest skonfigurowana: ustaw EMAIL_FROM i podłącz binding SEND_EMAIL do Workera.",
	);
}
