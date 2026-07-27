import { afterEach, describe, expect, it, vi } from "vitest";
import {
	completedUploadMessage,
	randomSuccessMessage,
	uploadCompleteInstruction,
} from "@/components/upload/messages";

describe("upload completion message", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("keeps the rotating success copy and invites further uploads", () => {
		vi.spyOn(Math, "random").mockReturnValue(0);

		expect(completedUploadMessage()).toBe(
			`Niezły z Ciebie fotograf! 📸 ${uploadCompleteInstruction}`,
		);
		expect(uploadCompleteInstruction).not.toContain("zamknąć tę stronę");
		expect(uploadCompleteInstruction).toContain("możesz dodać kolejne");
	});

	it("keeps every success message free of em dashes and gendered past forms", () => {
		const seen = new Set<string>();
		for (let step = 0; step < 200; step += 1) {
			vi.spyOn(Math, "random").mockReturnValue(step / 200);
			const message = randomSuccessMessage();
			seen.add(message);
			expect(message).not.toContain("—");
			// Polish -łeś/-łaś suffixes address one gender only.
			expect(message).not.toMatch(/łeś\b|łaś\b/u);
			vi.restoreAllMocks();
		}
		expect(seen.size).toBeGreaterThan(10);
	});
});
