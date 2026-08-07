import { afterEach, describe, expect, it, vi } from "vitest";
import {
	completedUploadMessages,
	uploadCompleteInstruction,
} from "@/components/upload/messages";

describe("upload completion message", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("separates the short celebration from the persistent instruction", () => {
		vi.spyOn(Math, "random").mockReturnValue(0);

		expect(completedUploadMessages()).toEqual({
			celebration: "Niezły z Ciebie fotograf! 📸",
			summary: uploadCompleteInstruction,
		});
		expect(uploadCompleteInstruction).not.toContain("zamknąć tę stronę");
		expect(uploadCompleteInstruction).toContain("możesz dodać kolejne");
	});
});
