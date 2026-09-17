import { SignJWT } from "jose";
import type { ArchiveBackend } from "./backend";
import {
	ArchiveError,
	AUDIENCE,
	type Claims,
	misconfigured,
	verifyOperation,
} from "./claims";
import { type DriveEnv, driveBackend } from "./drive";
import { r2Backend } from "./r2";

export interface Env extends DriveEnv {
	ALLOWED_ORIGIN: string;
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

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
	return origin === env.ALLOWED_ORIGIN
		? {
				"Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
				"Access-Control-Allow-Headers": "Authorization, Content-Type",
				"Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
				"Access-Control-Max-Age": "86400",
				Vary: "Origin",
			}
		: {};
}

function json(value: unknown, status: number, origin: string | null, env: Env) {
	return Response.json(value, {
		status,
		headers: {
			"Cache-Control": "no-store",
			...corsHeaders(origin, env),
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
			env,
		);
	}

	if (claims.operation === "reconcile") {
		const found = await backend.find(claims.photoId);
		if (!found) {
			return json({ error: "Nie znaleziono oryginału." }, 404, origin, env);
		}
		return json(
			{
				receipt: await receipt(env, claims.photoId, found.key, found.size),
				archiveKey: found.key,
			},
			200,
			origin,
			env,
		);
	}

	await backend.remove(claims.photoId, claims.archiveKey);
	return json({ ok: true }, 200, origin, env);
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const origin = request.headers.get("Origin");
		if (request.method === "OPTIONS") {
			if (origin !== env.ALLOWED_ORIGIN) {
				return json({ error: "Niedozwolone źródło." }, 403, origin, env);
			}
			return new Response(null, {
				status: 204,
				headers: corsHeaders(origin, env),
			});
		}

		const match = new URL(request.url).pathname.match(
			/^\/v1\/archive\/([0-9a-f-]{36})$/,
		);
		if (!match) return json({ error: "Nie znaleziono." }, 404, origin, env);
		if (origin && origin !== env.ALLOWED_ORIGIN) {
			return json({ error: "Niedozwolone źródło." }, 403, origin, env);
		}

		try {
			const claims = await verifyOperation(
				request,
				env.ARCHIVE_TOKEN_SECRET,
				match[1],
			);
			return await handle(request, env, selectBackend(env), claims, origin);
		} catch (error) {
			if (error instanceof ArchiveError) {
				if (error.status >= 500) console.error(error.message);
				const message =
					error.status >= 500 ? "Archiwum jest niedostępne." : error.message;
				return json({ error: message }, error.status, origin, env);
			}
			console.error(error);
			return json({ error: "Archiwum jest niedostępne." }, 502, origin, env);
		}
	},
} satisfies ExportedHandler<Env>;
