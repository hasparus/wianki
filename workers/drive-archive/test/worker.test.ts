import { describe, expect, it } from "vitest";
import { isBrowserOriginAllowed, sanitizeDriveFilename } from "../src/index";

describe("Drive archive boundary", () => {
	it("sanitizes unsafe Drive filenames", () => {
		expect(sanitizeDriveFilename("abc/..\\photo\u0000.jpg")).toBe(
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
});
