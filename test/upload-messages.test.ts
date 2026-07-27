import { afterEach, describe, expect, it, vi } from "vitest";
import {
	completedUploadMessage,
	uploadCompleteInstruction,
} from "@/components/upload/messages";

describe("upload completion message", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("keeps the rotating success copy and clearly permits closing the page", () => {
		vi.spyOn(Math, "random").mockReturnValue(0);

		expect(completedUploadMessage()).toBe(
			`Niezły z Ciebie fotograf! 📸 ${uploadCompleteInstruction}`,
		);
		expect(uploadCompleteInstruction).toContain("możesz już zamknąć tę stronę");
	});
});
