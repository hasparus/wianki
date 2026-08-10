import { type JWTPayload, jwtVerify, SignJWT } from "jose";
import type { ArchiveBackend } from "./backend";
import { type DriveEnv, driveBackend } from "./drive";
import { r2Backend } from "./r2";

export interface Env extends DriveEnv {
	ALLOWED_ORIGIN: string;
	ARCHIVE_TOKEN_SECRET: string;
	/** "r2" (default) or "drive" — see docs/integrations.md. */
	ARCHIVE_BACKEND?: string;
	ARCHIVE_BUCKET?: R2Bucket;
}

type Operation = "upload" | "delete" | "reconcile";

type OperationClaims = JWTPayload & {
	photoId: string;
	operation: Operation;
	filename?: string;
	contentType?: string;
	size?: number;
	archiveKey?: string;
};

const audience = "wedding-archive";
const maxOriginalBytes = 25 * 1024 * 1024;
const encoder = new TextEncoder();

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
		throw new Error(`Nieznane archiwum: ${choice}. Ustaw "r2" albo "drive".`);
	}
	if (!env.ARCHIVE_BUCKET) {
		throw new Error("Brak powiązania ARCHIVE_BUCKET dla archiwum R2.");
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

async function verifyOperation(request: Request, env: Env) {
	const authorization = request.headers.get("Authorization");
	if (!authorization?.startsWith("Bearer ")) {
		throw new Error("Brak tokenu operacji.");
	}
	const { payload } = await jwtVerify(
		authorization.slice("Bearer ".length),
		encoder.encode(env.ARCHIVE_TOKEN_SECRET),
		{ algorithms: ["HS256"], audience },
	);
	if (
		typeof payload.photoId !== "string" ||
		!["upload", "delete", "reconcile"].includes(String(payload.operation))
	) {
		throw new Error("Nieprawidłowy token operacji.");
	}
	return payload as OperationClaims;
}

function receipt(env: Env, photoId: string, archiveKey: string, size: number) {
	return new SignJWT({ kind: "receipt", photoId, archiveKey, size })
		.setProtectedHeader({ alg: "HS256", typ: "JWT" })
		.setIssuedAt()
		.setAudience(audience)
		.setExpirationTime("24h")
		.sign(encoder.encode(env.ARCHIVE_TOKEN_SECRET));
}

async function uploadOriginal(
	request: Request,
	env: Env,
	backend: ArchiveBackend,
	claims: OperationClaims,
) {
	if (
		claims.operation !== "upload" ||
		typeof claims.filename !== "string" ||
		typeof claims.contentType !== "string" ||
		typeof claims.size !== "number" ||
		claims.size <= 0 ||
		claims.size > maxOriginalBytes ||
		!request.body
	) {
		throw new Error("Nieprawidłowe parametry oryginału.");
	}
	const requestLength = Number(
		request.headers.get("Content-Length") ?? claims.size,
	);
	if (requestLength !== claims.size)
		throw new Error("Rozmiar pliku nie zgadza się z tokenem.");

	const stored = await backend.upload(request.body, {
		photoId: claims.photoId,
		filename: claims.filename,
		contentType: claims.contentType,
		size: claims.size,
	});
	return {
		receipt: await receipt(env, claims.photoId, stored.key, stored.size),
		archiveKey: stored.key,
	};
}

async function reconcileOriginal(
	env: Env,
	backend: ArchiveBackend,
	claims: OperationClaims,
) {
	if (claims.operation !== "reconcile")
		throw new Error("Nieprawidłowa operacja.");
	const found = await backend.find(claims.photoId);
	if (!found) return null;
	return {
		receipt: await receipt(env, claims.photoId, found.key, found.size),
		archiveKey: found.key,
	};
}

async function removeOriginal(
	backend: ArchiveBackend,
	claims: OperationClaims,
) {
	if (claims.operation !== "delete" || !claims.archiveKey) {
		throw new Error("Brak pliku do usunięcia.");
	}
	await backend.remove(claims.photoId, claims.archiveKey);
	return { ok: true };
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
			const backend = selectBackend(env);
			const claims = await verifyOperation(request, env);
			if (claims.photoId !== match[1]) {
				return json(
					{ error: "Token dotyczy innego zdjęcia." },
					403,
					origin,
					env,
				);
			}
			if (request.method === "PUT") {
				return json(
					await uploadOriginal(request, env, backend, claims),
					201,
					origin,
					env,
				);
			}
			if (request.method === "GET") {
				const result = await reconcileOriginal(env, backend, claims);
				return result
					? json(result, 200, origin, env)
					: json({ error: "Nie znaleziono oryginału." }, 404, origin, env);
			}
			if (request.method === "DELETE") {
				return json(await removeOriginal(backend, claims), 200, origin, env);
			}
			return json({ error: "Niedozwolona metoda." }, 405, origin, env);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Błąd archiwum.";
			return json({ error: message }, 400, origin, env);
		}
	},
} satisfies ExportedHandler<Env>;
