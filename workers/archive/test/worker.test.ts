import { describe, expect, it } from "vitest";
import {
	archiveKeyPrefix,
	buildArchiveKey,
	isBrowserOriginAllowed,
	sanitizeObjectName,
} from "../src/index";

const photoId = "11111111-1111-4111-8111-111111111111";

describe("Archive boundary", () => {
	it("sanitizes unsafe object names", () => {
		expect(sanitizeObjectName("abc/..\\photo\u0000.jpg")).toBe(
			"abc-..-photo-.jpg",
		);
	});

	it("allows only the exact configured browser origin", () => {
		expect(
			isBrowserOriginAllowed(
				"https://wedding.pawel.space",
				"https://wedding.pawel.space",
			),
		).toBe(true);
		expect(
			isBrowserOriginAllowed(
				"https://evil.example",
				"https://wedding.pawel.space",
			),
		).toBe(false);
	});

	it("keeps every object under a per-photo prefix so reconcile is a lookup", () => {
		const key = buildArchiveKey(photoId, "wesele.jpg");
		expect(key.startsWith(archiveKeyPrefix(photoId))).toBe(true);
		expect(key).toBe(`originals/${photoId}__wesele.jpg`);
	});

	it("keeps a traversing filename inside its own photo prefix", () => {
		const key = buildArchiveKey(photoId, "../../etc/passwd");
		expect(key.startsWith(archiveKeyPrefix(photoId))).toBe(true);
		expect(key).not.toContain("/etc/");
	});
});
