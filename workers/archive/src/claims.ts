import { jwtVerify } from "jose";

export const AUDIENCE = "wedding-archive";
export const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;

/**
 * What a capability token is allowed to say, parsed once. Each operation
 * carries exactly the fields it needs, so the handlers below open with no
 * guard clauses and nothing downstream has to re-check whether a filename
 * happens to be present.
 */
export type Claims =
	| {
			operation: "upload";
			photoId: string;
			filename: string;
			contentType: string;
			size: number;
	  }
	| { operation: "reconcile"; photoId: string }
	| { operation: "delete"; photoId: string; archiveKey: string };

/**
 * Distinguishes "your token is bad" from "this deployment is broken" from
 * "the archive itself failed", so the browser can tell a permanent rejection
 * from something worth retrying, and internal messages stay internal.
 */
export class ArchiveError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
	}
}

export const unauthorized = (message: string) => new ArchiveError(message, 401);
export const badRequest = (message: string) => new ArchiveError(message, 400);
export const misconfigured = (message: string) =>
	new ArchiveError(message, 500);
export const upstreamFailed = (message: string) =>
	new ArchiveError(message, 502);

const methodOperation: Record<string, Claims["operation"]> = {
	PUT: "upload",
	GET: "reconcile",
	DELETE: "delete",
};

function parseClaims(payload: Record<string, unknown>, method: string): Claims {
	const operation = methodOperation[method];
	if (!operation) throw new ArchiveError("Niedozwolona metoda.", 405);
	if (typeof payload.photoId !== "string") {
		throw unauthorized("Nieprawidłowy token operacji.");
	}
	if (payload.operation !== operation) {
		throw unauthorized("Token nie pasuje do tej operacji.");
	}
	const photoId = payload.photoId;

	if (operation === "reconcile") return { operation, photoId };

	if (operation === "delete") {
		if (typeof payload.archiveKey !== "string" || !payload.archiveKey) {
			throw badRequest("Brak pliku do usunięcia.");
		}
		return { operation, photoId, archiveKey: payload.archiveKey };
	}

	if (
		typeof payload.filename !== "string" ||
		typeof payload.contentType !== "string" ||
		typeof payload.size !== "number" ||
		!Number.isFinite(payload.size) ||
		payload.size <= 0 ||
		payload.size > MAX_ORIGINAL_BYTES
	) {
		throw badRequest("Nieprawidłowe parametry oryginału.");
	}
	return {
		operation,
		photoId,
		filename: payload.filename,
		contentType: payload.contentType,
		size: payload.size,
	};
}

export async function verifyOperation(
	request: Request,
	secret: string,
	photoIdFromPath: string,
): Promise<Claims> {
	const authorization = request.headers.get("Authorization");
	if (!authorization?.startsWith("Bearer ")) {
		throw unauthorized("Brak tokenu operacji.");
	}
	let payload: Record<string, unknown>;
	try {
		({ payload } = await jwtVerify(
			authorization.slice("Bearer ".length),
			new TextEncoder().encode(secret),
			{ algorithms: ["HS256"], audience: AUDIENCE },
		));
	} catch {
		throw unauthorized("Nieprawidłowy token operacji.");
	}
	const claims = parseClaims(payload, request.method);
	if (claims.photoId !== photoIdFromPath) {
		throw new ArchiveError("Token dotyczy innego zdjęcia.", 403);
	}
	return claims;
}
