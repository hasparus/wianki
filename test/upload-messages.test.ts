import { afterEach, describe, expect, it, vi } from "vitest";
import {
	completedUploadMessages,
	randomSuccessMessage,
	uploadCompleteInstruction,
} from "@/components/upload/messages";

/** Every distinct line the picker can land on, sampled across its range. */
function everySuccessMessage() {
	const seen = new Set<string>();
	for (let step = 0; step < 200; step += 1) {
		vi.spyOn(Math, "random").mockReturnValue(step / 200);
		seen.add(randomSuccessMessage());
		vi.restoreAllMocks();
	}
	return seen;
}

describe("upload completion message", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("separates the short celebration from the persistent instruction", () => {
		vi.spyOn(Math, "random").mockReturnValue(0);

		expect(completedUploadMessages()).toEqual({
			celebration: "Mamy je.",
			summary: uploadCompleteInstruction,
		});
		expect(uploadCompleteInstruction).not.toContain("zamknąć tę stronę");
		expect(uploadCompleteInstruction).toContain("możesz dodać kolejne");
	});

	it("keeps every success message free of em dashes and gendered past forms", () => {
		const seen = everySuccessMessage();
		for (const message of seen) {
			expect(message).not.toContain("—");
			// Polish -łeś/-łaś suffixes address one gender only.
			expect(message).not.toMatch(/łeś\b|łaś\b/u);
		}
		expect(seen.size).toBeGreaterThan(10);
	});

	/**
	 * The couple thanking a guest, not an assistant congratulating one. Emoji
	 * and an exclamation mark on every line were the tell that the list had
	 * been written for them rather than by them.
	 */
	it("keeps the voice plain rather than congratulatory", () => {
		const seen = everySuccessMessage();
		for (const message of seen) {
			expect(message).not.toMatch(/\p{Extended_Pictographic}/u);
		}
		const shouted = [...seen].filter((message) => message.includes("!"));
		expect(shouted.length * 4).toBeLessThanOrEqual(seen.size);
	});
});
