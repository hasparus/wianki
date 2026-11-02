/**
 * The HTTP side of a site, the way a browser sees it: one passphrase login
 * that answers with a cookie, then same-origin JSON calls carrying it. The
 * scripts never touch D1 or a bucket directly, so whatever they do lands in
 * exactly the state a phone or the admin page would have produced.
 */

const COOKIE_NAME = {
	guest: "wianki_guest",
	admin: "wianki_admin",
} as const;

export type SiteRole = keyof typeof COOKIE_NAME;

export type SiteApi = {
	origin: string;
	/** `fetch` with the site's origin and the session cookie already set. */
	call(path: string, init?: RequestInit): Promise<Response>;
	/** Same, parsing JSON and throwing the server's `error` on failure. */
	json<T>(path: string, init?: RequestInit): Promise<T>;
};

export function siteOriginFromEnv(value: string) {
	return value.replace(/\/$/, "");
}

/**
 * `POST /api/auth/guest` takes one passphrase and decides the role itself:
 * the admin passphrase yields the admin cookie, the guest one the guest
 * cookie. `role` says which the caller needs, so a guest passphrase handed
 * to an admin script fails here instead of a few requests later with 401.
 */
export async function loginSite(
	origin: string,
	passphrase: string,
	role: SiteRole,
): Promise<SiteApi> {
	const form = new FormData();
	form.set("passphrase", passphrase);
	const response = await fetch(`${origin}/api/auth/guest`, {
		method: "POST",
		headers: { Origin: origin },
		body: form,
		redirect: "manual",
	});
	if (!response.ok) throw new Error(`login failed (${response.status})`);
	const cookie = response.headers
		.getSetCookie()
		.map((c) => c.split(";")[0])
		.join("; ");
	if (!cookie.includes(COOKIE_NAME[role])) {
		throw new Error(`no ${role} cookie — is this the ${role} passphrase?`);
	}

	async function call(path: string, init: RequestInit = {}) {
		const headers = new Headers(init.headers);
		headers.set("Origin", origin);
		headers.set("Cookie", cookie);
		return fetch(`${origin}${path}`, { ...init, headers });
	}

	async function json<T>(path: string, init: RequestInit = {}) {
		const response = await call(path, init);
		const body = (await response.json().catch(() => ({}))) as T & {
			error?: string;
		};
		if (!response.ok) {
			throw new Error(body.error ?? `${path}: HTTP ${response.status}`);
		}
		return body;
	}

	return { origin, call, json };
}

export function jsonBody(value: unknown): RequestInit {
	return {
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(value),
	};
}
