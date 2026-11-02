import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { sanitizeObjectName } from "../src/backend";
import { isValidOrigin, isValidSiteId } from "../src/claims";
import worker, {
	type Env,
	isPlatformHost,
	isPlausibleOrigin,
	selectBackend,
} from "../src/index";
import {
	archiveKeyPrefix,
	buildArchiveKey,
	siteArchivePrefix,
} from "../src/r2";

const photoId = "11111111-1111-4111-8111-111111111111";
const siteId = "22222222-2222-4222-8222-222222222222";
const otherSiteId = "33333333-3333-4333-8333-333333333333";
const platformHost = "wianki.app";
const origin = "https://rosia.wianki.app";
const customOrigin = "https://wesele.example.com";
const secret = "0123456789abcdef0123456789abcdef";

describe("Archive boundary", () => {
	it("sanitizes unsafe object names", () => {
		expect(sanitizeObjectName("abc/..\\photo\u0000.jpg")).toBe(
			"abc-..-photo-.jpg",
		);
	});

	it("keeps every object under a per-site, per-photo prefix so reconcile is a lookup", () => {
		const key = buildArchiveKey(siteId, photoId, "wesele.jpg");
		expect(key.startsWith(siteArchivePrefix(siteId))).toBe(true);
		expect(key.startsWith(archiveKeyPrefix(siteId, photoId))).toBe(true);
		expect(key).toBe(`sites/${siteId}/originals/${photoId}__wesele.jpg`);
	});

	it("keeps a traversing filename inside its own photo prefix", () => {
		const key = buildArchiveKey(siteId, photoId, "../../etc/passwd");
		expect(key.startsWith(archiveKeyPrefix(siteId, photoId))).toBe(true);
		expect(key).not.toContain("/etc/");
	});
});

describe("claim shapes", () => {
	it("accepts only short, URL-safe site ids", () => {
		expect(isValidSiteId(siteId)).toBe(true);
		expect(isValidSiteId("rosia-2026")).toBe(true);
		expect(isValidSiteId("")).toBe(false);
		expect(isValidSiteId("a/b")).toBe(false);
		expect(isValidSiteId("x".repeat(65))).toBe(false);
		expect(isValidSiteId(42)).toBe(false);
	});

	it("accepts https origins and plain-http localhost, nothing with a path", () => {
		expect(isValidOrigin("https://rosia.wianki.app")).toBe(true);
		expect(isValidOrigin("https://wesele.example.com:8443")).toBe(true);
		expect(isValidOrigin("http://localhost:3000")).toBe(true);
		expect(isValidOrigin("http://rosia.localhost:3000")).toBe(true);
		expect(isValidOrigin("http://rosia.wianki.app")).toBe(false);
		expect(isValidOrigin("https://rosia.wianki.app/")).toBe(false);
		expect(isValidOrigin("https://rosia.wianki.app/gallery")).toBe(false);
		expect(isValidOrigin("https://user:pw@rosia.wianki.app")).toBe(false);
		expect(isValidOrigin("rosia.wianki.app")).toBe(false);
		expect(isValidOrigin("null")).toBe(false);
	});
});

function bucketSpy(deleted: string[] = []) {
	return {
		delete: async (key: string) => {
			deleted.push(key);
		},
	} as unknown as R2Bucket;
}

function env(overrides: Partial<Env>): Env {
	return {
		PLATFORM_HOST: platformHost,
		ARCHIVE_TOKEN_SECRET: secret,
		GOOGLE_OAUTH_CLIENT_ID: "id",
		GOOGLE_OAUTH_CLIENT_SECRET: "secret",
		GOOGLE_OAUTH_REFRESH_TOKEN: "refresh",
		GOOGLE_DRIVE_FOLDER_ID: "folder",
		...overrides,
	};
}

describe("origin policy", () => {
	it("recognizes the platform host and its single-label subdomains only", () => {
		expect(isPlatformHost("wianki.app", platformHost)).toBe(true);
		expect(isPlatformHost("rosia.wianki.app", platformHost)).toBe(true);
		expect(isPlatformHost("ROSIA.wianki.app", platformHost)).toBe(true);
		expect(isPlatformHost("a.b.wianki.app", platformHost)).toBe(false);
		expect(isPlatformHost("evilwianki.app", platformHost)).toBe(false);
		expect(isPlatformHost("wianki.app.evil.example", platformHost)).toBe(false);
		expect(isPlatformHost("rosia.localhost", "localhost:3000")).toBe(true);
	});

	it("lets any https origin and localhost through the coarse layer, nothing else", () => {
		const e = env({});
		expect(isPlausibleOrigin(origin, e)).toBe(true);
		expect(isPlausibleOrigin(customOrigin, e)).toBe(true);
		expect(isPlausibleOrigin("http://rosia.wianki.app", e)).toBe(false);
		expect(isPlausibleOrigin("http://evil.example", e)).toBe(false);
		expect(isPlausibleOrigin(null, e)).toBe(false);
		expect(isPlausibleOrigin("null", e)).toBe(false);
		const local = env({ PLATFORM_HOST: "localhost:3000" });
		expect(isPlausibleOrigin("http://rosia.localhost:3000", local)).toBe(true);
		expect(isPlausibleOrigin("http://localhost:3000", local)).toBe(true);
	});
});

describe("backend selection", () => {
	it("defaults to R2, which needs its bucket binding", () => {
		expect(() =>
			selectBackend(env({ ARCHIVE_BUCKET: bucketSpy() })),
		).not.toThrow();
		expect(() => selectBackend(env({}))).toThrow(/ARCHIVE_BUCKET/);
	});

	it("selects Drive without needing a bucket", () => {
		expect(() =>
			selectBackend(env({ ARCHIVE_BACKEND: "drive" })),
		).not.toThrow();
	});

	it("rejects an unknown backend instead of archiving somewhere unexpected", () => {
		expect(() => selectBackend(env({ ARCHIVE_BACKEND: "dropbox" }))).toThrow(
			/Nieznane archiwum/,
		);
	});
});

describe("R2 removal", () => {
	it("refuses a key that belongs to another photo", async () => {
		const backend = selectBackend(env({ ARCHIVE_BUCKET: bucketSpy() }));
		await expect(
			backend.remove(
				siteId,
				photoId,
				`sites/${siteId}/originals/22222222__stolen.jpg`,
			),
		).rejects.toThrow(/nie należy/);
	});

	it("refuses a key that belongs to another site, even for the same photo id", async () => {
		const deleted: string[] = [];
		const backend = selectBackend(env({ ARCHIVE_BUCKET: bucketSpy(deleted) }));
		await expect(
			backend.remove(
				siteId,
				photoId,
				buildArchiveKey(otherSiteId, photoId, "wesele.jpg"),
			),
		).rejects.toThrow(/nie należy/);
		expect(deleted).toEqual([]);
	});

	it("refuses the legacy single-tenant layout", async () => {
		const backend = selectBackend(env({ ARCHIVE_BUCKET: bucketSpy() }));
		await expect(
			backend.remove(siteId, photoId, `originals/${photoId}__wesele.jpg`),
		).rejects.toThrow(/nie należy/);
	});

	it("deletes a key under the photo's own prefix", async () => {
		const deleted: string[] = [];
		const backend = selectBackend(env({ ARCHIVE_BUCKET: bucketSpy(deleted) }));
		const key = buildArchiveKey(siteId, photoId, "wesele.jpg");
		await backend.remove(siteId, photoId, key);
		expect(deleted).toEqual([key]);
	});
});

async function operationToken(claims: Record<string, unknown>) {
	return new SignJWT({ siteId, origin, ...claims })
		.setProtectedHeader({ alg: "HS256", typ: "JWT" })
		.setIssuedAt()
		.setAudience("wedding-archive")
		.setExpirationTime("10m")
		.sign(new TextEncoder().encode(secret));
}

function call(
	method: string,
	token: string | null,
	init: RequestInit & { id?: string; origin?: string | null } = {},
) {
	const { id = photoId, origin: requestOrigin = origin, ...rest } = init;
	return worker.fetch(
		new Request(`https://archive.example/v1/archive/${id}`, {
			method,
			headers: {
				...(requestOrigin ? { Origin: requestOrigin } : {}),
				...(token ? { Authorization: `Bearer ${token}` } : {}),
				...((rest.headers as Record<string, string>) ?? {}),
			},
			...rest,
		}),
		env({ ARCHIVE_BUCKET: bucketSpy() }),
	);
}

describe("HTTP boundary", () => {
	it("answers a preflight from a platform subdomain", async () => {
		const response = await worker.fetch(
			new Request(`https://archive.example/v1/archive/${photoId}`, {
				method: "OPTIONS",
				headers: { Origin: `https://rosia.${platformHost}` },
			}),
			env({}),
		);
		expect(response.status).toBe(204);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
			`https://rosia.${platformHost}`,
		);
		expect(response.headers.get("Vary")).toBe("Origin");
	});

	it("answers a preflight from a custom https domain, whose token will decide", async () => {
		const response = await worker.fetch(
			new Request(`https://archive.example/v1/archive/${photoId}`, {
				method: "OPTIONS",
				headers: { Origin: customOrigin },
			}),
			env({}),
		);
		expect(response.status).toBe(204);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
			customOrigin,
		);
	});

	it("refuses a plain-http preflight off localhost", async () => {
		const response = await worker.fetch(
			new Request(`https://archive.example/v1/archive/${photoId}`, {
				method: "OPTIONS",
				headers: { Origin: "http://evil.example" },
			}),
			env({}),
		);
		expect(response.status).toBe(403);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});

	it("rejects a junk origin before looking at the token", async () => {
		const response = await call("GET", null, { origin: "http://evil.example" });
		expect(response.status).toBe(403);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});

	it("rejects an origin that does not match the token, without reflecting it", async () => {
		const token = await operationToken({ photoId, operation: "reconcile" });
		const response = await call("GET", token, {
			origin: "https://evil.example",
		});
		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({ error: "Niedozwolone źródło." });
		expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});

	it("rejects a platform subdomain that is not the token's site", async () => {
		const token = await operationToken({ photoId, operation: "reconcile" });
		const response = await call("GET", token, {
			origin: "https://kasia.wianki.app",
		});
		expect(response.status).toBe(403);
	});

	it("reflects a custom domain when the token was signed for it", async () => {
		const token = await operationToken({
			photoId,
			operation: "delete",
			origin: customOrigin,
			archiveKey: buildArchiveKey(siteId, photoId, "wesele.jpg"),
		});
		const response = await call("DELETE", token, { origin: customOrigin });
		expect(response.status).toBe(200);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
			customOrigin,
		);
		expect(response.headers.get("Vary")).toBe("Origin");
	});

	it("lets the app call without an Origin, as a server does", async () => {
		const token = await operationToken({
			photoId,
			operation: "delete",
			archiveKey: buildArchiveKey(siteId, photoId, "wesele.jpg"),
		});
		const response = await call("DELETE", token, { origin: null });
		expect(response.status).toBe(200);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});

	it("answers 401, not 400, without a token", async () => {
		const response = await call("GET", null);
		expect(response.status).toBe(401);
		// The page is plausible, so it may read the error and show it.
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
	});

	it("refuses a token minted for another photo", async () => {
		const token = await operationToken({
			photoId: "22222222-2222-4222-8222-222222222222",
			operation: "reconcile",
		});
		expect((await call("GET", token)).status).toBe(403);
	});

	it("refuses a token without a site or with a malformed one", async () => {
		const missing = await new SignJWT({
			photoId,
			operation: "reconcile",
			origin,
		})
			.setProtectedHeader({ alg: "HS256", typ: "JWT" })
			.setIssuedAt()
			.setAudience("wedding-archive")
			.setExpirationTime("10m")
			.sign(new TextEncoder().encode(secret));
		expect((await call("GET", missing)).status).toBe(401);
		const malformed = await operationToken({
			photoId,
			operation: "reconcile",
			siteId: "../other",
		});
		expect((await call("GET", malformed)).status).toBe(401);
	});

	it("refuses a token whose origin claim is not an origin", async () => {
		const token = await operationToken({
			photoId,
			operation: "reconcile",
			origin: "https://rosia.wianki.app/gallery",
		});
		expect((await call("GET", token, { origin: null })).status).toBe(401);
	});

	it("refuses a token whose operation does not match the method", async () => {
		const token = await operationToken({ photoId, operation: "reconcile" });
		expect((await call("DELETE", token)).status).toBe(401);
	});

	it("refuses an oversized original before touching the archive", async () => {
		const token = await operationToken({
			photoId,
			operation: "upload",
			filename: "big.jpg",
			contentType: "image/jpeg",
			size: 26 * 1024 * 1024,
		});
		const response = await call("PUT", token, { body: "x" });
		expect(response.status).toBe(400);
	});

	it("refuses to delete a key under another site's prefix", async () => {
		const token = await operationToken({
			photoId,
			operation: "delete",
			archiveKey: buildArchiveKey(otherSiteId, photoId, "wesele.jpg"),
		});
		const response = await call("DELETE", token);
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: "Klucz nie należy do tego zdjęcia.",
		});
	});

	it("keeps a misconfigured deployment quiet behind a valid token", async () => {
		const token = await operationToken({ photoId, operation: "reconcile" });
		const response = await worker.fetch(
			new Request(`https://archive.example/v1/archive/${photoId}`, {
				method: "GET",
				headers: { Origin: origin, Authorization: `Bearer ${token}` },
			}),
			env({}),
		);
		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({
			error: "Archiwum jest niedostępne.",
		});
	});
});
