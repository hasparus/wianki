import { SignJWT } from "jose";
import type { ArchiveBackend } from "./backend";
import {
	ArchiveError,
	AUDIENCE,
	type Claims,
	isLoopbackHost,
	isValidOrigin,
	misconfigured,
	verifyOperation,
} from "./claims";
import { type DriveEnv, driveBackend } from "./drive";
import { r2Backend } from "./r2";

export interface Env extends DriveEnv {
	/** Host (no scheme) the platform lives on, e.g. `wianki.app`; sites are its subdomains. */
	PLATFORM_HOST: string;
	ARCHIVE_TOKEN_SECRET: string;
	/** "r2" (default) or "drive" — see docs/integrations.md. */
	ARCHIVE_BACKEND?: string;
	ARCHIVE_BUCKET?: R2Bucket;
}

/**
 * One deployment archives to one place. Picking the backend explicitly rather
 * than inferring it from whichever credentials happen to be present means a
 * half-configured deploy fails loudly instead of quietly filing the wedding
 * somewhere nobody is looking.
 */
export function selectBackend(env: Env): ArchiveBackend {
	const choice = env.ARCHIVE_BACKEND ?? "r2";
	if (choice === "drive") return driveBackend(env);
	if (choice !== "r2") {
		throw misconfigured(
			`Nieznane archiwum: ${choice}. Ustaw "r2" albo "drive".`,
		);
	}
	if (!env.ARCHIVE_BUCKET) {
		throw misconfigured("Brak powiązania ARCHIVE_BUCKET dla archiwum R2.");
	}
	return r2Backend(env.ARCHIVE_BUCKET);
}

/** `wianki.app` itself or exactly one label below it (`rosia.wianki.app`). */
export function isPlatformHost(hostname: string, platformHost: string) {
	const platform = platformHost.toLowerCase().split(":")[0];
	const host = hostname.toLowerCase();
	if (host === platform) return true;
	if (!host.endsWith(`.${platform}`)) return false;
	const label = host.slice(0, -platform.length - 1);
	return label.length > 0 && !label.includes(".");
}

/**
 * Origin policy, in two layers.
 *
 * The real check is per request: an authenticated request's Origin must equal
 * the `origin` claim of its token. The app signs that claim, and the app is
 * the authority on which origin each site answers on — a platform subdomain
 * or a custom domain alike — so the Worker never keeps a list of its own.
 *
 * This function is the coarser layer, for what arrives without a token: the
 * CORS preflight, and error responses sent before a token could be read. A
 * preflight unlocks nothing by itself — every GET, PUT and DELETE still needs
 * a token whose origin claim matches — so it only has to keep junk out.
 * Allowed: the platform host and its single-label subdomains on the
 * platform's own scheme, and any https origin, because a custom domain is
 * always served over https and cannot be known here in advance. Plain http
 * is accepted for localhost only, for `wrangler dev` next to `next dev`.
 */
export function isPlausibleOrigin(origin: string | null, env: Env): boolean {
	if (!origin || !isValidOrigin(origin)) return false;
	const url = new URL(origin);
	if (isPlatformHost(url.hostname, env.PLATFORM_HOST)) {
		return url.protocol === "https:" || isLoopbackHost(url.hostname);
	}
	return url.protocol === "https:";
}

/** Reflects exactly the request Origin, never a wildcard, and tells caches so. */
function corsHeaders(
	origin: string | null,
	allowed: boolean,
): Record<string, string> {
	return allowed && origin
		? {
				"Access-Control-Allow-Origin": origin,
				"Access-Control-Allow-Headers": "Authorization, Content-Type",
				"Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
				"Access-Control-Max-Age": "86400",
				Vary: "Origin",
			}
		: { Vary: "Origin" };
}

function json(
	value: unknown,
	status: number,
	origin: string | null,
	allowed: boolean,
) {
	return Response.json(value, {
		status,
		headers: {
			"Cache-Control": "no-store",
			...corsHeaders(origin, allowed),
		},
	});
}

function receipt(env: Env, photoId: string, archiveKey: string, size: number) {
	return new SignJWT({ kind: "receipt", photoId, archiveKey, size })
		.setProtectedHeader({ alg: "HS256", typ: "JWT" })
		.setIssuedAt()
		.setAudience(AUDIENCE)
		.setExpirationTime("24h")
		.sign(new TextEncoder().encode(env.ARCHIVE_TOKEN_SECRET));
}

async function handle(
	request: Request,
	env: Env,
	backend: ArchiveBackend,
	claims: Claims,
	origin: string | null,
) {
	if (claims.operation === "upload") {
		if (!request.body) throw new ArchiveError("Brak treści oryginału.", 400);
		const declared = request.headers.get("Content-Length");
		if (declared !== null && Number(declared) !== claims.size) {
			throw new ArchiveError("Rozmiar pliku nie zgadza się z tokenem.", 400);
		}
		const stored = await backend.upload(request.body, claims);
		return json(
			{
				receipt: await receipt(env, claims.photoId, stored.key, stored.size),
				archiveKey: stored.key,
			},
			201,
			origin,
			true,
		);
	}

	if (claims.operation === "reconcile") {
		const found = await backend.find(claims.siteId, claims.photoId);
		if (!found) {
			return json({ error: "Nie znaleziono oryginału." }, 404, origin, true);
		}
		return json(
			{
				receipt: await receipt(env, claims.photoId, found.key, found.size),
				archiveKey: found.key,
			},
			200,
			origin,
			true,
		);
	}

	await backend.remove(claims.siteId, claims.photoId, claims.archiveKey);
	return json({ ok: true }, 200, origin, true);
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const origin = request.headers.get("Origin");
		const plausible = isPlausibleOrigin(origin, env);

		if (request.method === "OPTIONS") {
			if (!plausible) {
				return json({ error: "Niedozwolone źródło." }, 403, origin, false);
			}
			return new Response(null, {
				status: 204,
				headers: corsHeaders(origin, true),
			});
		}

		const match = new URL(request.url).pathname.match(
			/^\/v1\/archive\/([0-9a-f-]{36})$/,
		);
		if (!match) {
			return json({ error: "Nie znaleziono." }, 404, origin, plausible);
		}
		// Server-to-server calls from the app (reconcile, delete) carry no
		// Origin; a browser always does, and a junk one is refused before the
		// token is even read.
		if (origin && !plausible) {
			return json({ error: "Niedozwolone źródło." }, 403, origin, false);
		}

		try {
			const claims = await verifyOperation(
				request,
				env.ARCHIVE_TOKEN_SECRET,
				match[1],
			);
			if (origin && origin !== claims.origin) {
				// Signed for another site's origin: not reflected, so the page
				// that sent it learns nothing but "blocked by CORS".
				return json({ error: "Niedozwolone źródło." }, 403, origin, false);
			}
			return await handle(request, env, selectBackend(env), claims, origin);
		} catch (error) {
			if (error instanceof ArchiveError) {
				if (error.status >= 500) console.error(error.message);
				const message =
					error.status >= 500 ? "Archiwum jest niedostępne." : error.message;
				return json({ error: message }, error.status, origin, plausible);
			}
			console.error(error);
			return json(
				{ error: "Archiwum jest niedostępne." },
				502,
				origin,
				plausible,
			);
		}
	},
} satisfies ExportedHandler<Env>;
