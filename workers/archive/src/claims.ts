import { jwtVerify } from "jose";

export const AUDIENCE = "wedding-archive";
export const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;
const MAX_SITE_ID_LENGTH = 64;
const SITE_ID_PATTERN = /^[A-Za-z0-9-]+$/;

/**
 * Every operation names the wedding it belongs to and the origin the app
 * serves that wedding from. The app signs both: it is the authority on which
 * site a photo belongs to and which origin that site answers on, so the
 * Worker never has to look either up.
 */
type SiteClaims = {
	photoId: string;
	siteId: string;
	origin: string;
};

/**
 * What a capability token is allowed to say, parsed once. Each operation
 * carries exactly the fields it needs, so the handlers below open with no
 * guard clauses and nothing downstream has to re-check whether a filename
 * happens to be present.
 */
export type Claims =
	| (SiteClaims & {
			operation: "upload";
			filename: string;
			contentType: string;
			size: number;
	  })
	| (SiteClaims & { operation: "reconcile" })
	| (SiteClaims & { operation: "delete"; archiveKey: string });

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

/** `localhost` and its subdomains (`rosia.localhost`) are the only plain-http origins. */
export function isLoopbackHost(hostname: string) {
	return (
		hostname === "localhost" ||
		hostname.endsWith(".localhost") ||
		hostname === "127.0.0.1" ||
		hostname === "[::1]"
	);
}

/**
 * An origin is scheme + host (+ port), nothing else. Anything with a path,
 * credentials, query or a non-https scheme off localhost is refused, so a
 * sloppy claim can never be reflected into `Access-Control-Allow-Origin`.
 */
export function isValidOrigin(value: string) {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return false;
	}
	if (url.origin !== value) return false;
	if (url.protocol === "https:") return true;
	return url.protocol === "http:" && isLoopbackHost(url.hostname);
}

export function isValidSiteId(value: unknown): value is string {
	return (
		typeof value === "string" &&
		value.length > 0 &&
		value.length <= MAX_SITE_ID_LENGTH &&
		SITE_ID_PATTERN.test(value)
	);
}

function parseClaims(payload: Record<string, unknown>, method: string): Claims {
	const operation = methodOperation[method];
	if (!operation) throw new ArchiveError("Niedozwolona metoda.", 405);
	if (typeof payload.photoId !== "string") {
		throw unauthorized("Nieprawidłowy token operacji.");
	}
	if (payload.operation !== operation) {
		throw unauthorized("Token nie pasuje do tej operacji.");
	}
	if (!isValidSiteId(payload.siteId)) {
		throw unauthorized("Token nie wskazuje strony.");
	}
	if (typeof payload.origin !== "string" || !isValidOrigin(payload.origin)) {
		throw unauthorized("Token nie wskazuje źródła.");
	}
	const site: SiteClaims = {
		photoId: payload.photoId,
		siteId: payload.siteId,
		origin: payload.origin,
	};

	if (operation === "reconcile") return { ...site, operation };

	if (operation === "delete") {
		if (typeof payload.archiveKey !== "string" || !payload.archiveKey) {
			throw badRequest("Brak pliku do usunięcia.");
		}
		return { ...site, operation, archiveKey: payload.archiveKey };
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
		...site,
		operation,
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
