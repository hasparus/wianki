import { type JWTPayload, jwtVerify, SignJWT } from "jose";

export interface Env {
	ALLOWED_ORIGIN: string;
	ARCHIVE_TOKEN_SECRET: string;
	ARCHIVE_BUCKET: R2Bucket;
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
const keyPrefix = "originals/";

/**
 * Object keys stay human-readable so the couple can browse the bucket, while
 * the `originals/<photoId>__` prefix keeps reconciliation a single deterministic
 * prefix listing instead of a metadata search.
 */
export function archiveKeyPrefix(photoId: string) {
	return `${keyPrefix}${photoId}__`;
}

export function buildArchiveKey(photoId: string, filename: string) {
	return `${archiveKeyPrefix(photoId)}${sanitizeObjectName(filename)}`;
}

export function sanitizeObjectName(value: string) {
	return (
		value
			// biome-ignore lint/suspicious/noControlCharactersInRegex: path separators and control characters are exactly what gets replaced here.
			.replace(/[\u0000-\u001f/\\]+/g, "-")
			.slice(0, 180) || "zdjecie"
	);
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

async function receipt(
	env: Env,
	photoId: string,
	archiveKey: string,
	size: number,
) {
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

	const archiveKey = buildArchiveKey(claims.photoId, claims.filename);
	const object = await env.ARCHIVE_BUCKET.put(archiveKey, request.body, {
		httpMetadata: {
			contentType: claims.contentType,
			// Browsers downloading straight from a signed bucket URL keep the
			// guest's original filename rather than the prefixed key.
			contentDisposition: `attachment; filename="${sanitizeObjectName(claims.filename)}"`,
		},
		customMetadata: { photoId: claims.photoId },
	});
	if (!object) throw new Error("Archiwum nie przyjęło oryginału.");
	if (object.size !== claims.size) {
		await env.ARCHIVE_BUCKET.delete(archiveKey);
		throw new Error("Zapisany rozmiar nie zgadza się z tokenem.");
	}
	return {
		receipt: await receipt(env, claims.photoId, archiveKey, object.size),
		archiveKey,
	};
}

async function reconcileOriginal(env: Env, claims: OperationClaims) {
	if (claims.operation !== "reconcile")
		throw new Error("Nieprawidłowa operacja.");
	const listed = await env.ARCHIVE_BUCKET.list({
		prefix: archiveKeyPrefix(claims.photoId),
		limit: 1,
	});
	const object = listed.objects[0];
	if (!object) return null;
	return {
		receipt: await receipt(env, claims.photoId, object.key, object.size),
		archiveKey: object.key,
	};
}

async function deleteOriginal(env: Env, claims: OperationClaims) {
	if (claims.operation !== "delete" || !claims.archiveKey) {
		throw new Error("Brak pliku do usunięcia.");
	}
	if (!claims.archiveKey.startsWith(archiveKeyPrefix(claims.photoId))) {
		throw new Error("Klucz nie należy do tego zdjęcia.");
	}
	await env.ARCHIVE_BUCKET.delete(claims.archiveKey);
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
					await uploadOriginal(request, env, claims),
					201,
					origin,
					env,
				);
			}
			if (request.method === "GET") {
				const result = await reconcileOriginal(env, claims);
				return result
					? json(result, 200, origin, env)
					: json({ error: "Nie znaleziono oryginału." }, 404, origin, env);
			}
			if (request.method === "DELETE") {
				return json(await deleteOriginal(env, claims), 200, origin, env);
			}
			return json({ error: "Niedozwolona metoda." }, 405, origin, env);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Błąd archiwum.";
			return json({ error: message }, 400, origin, env);
		}
	},
} satisfies ExportedHandler<Env>;
