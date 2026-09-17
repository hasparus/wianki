import type { UploadPhase } from "@/components/upload/types";

export const uploadCompleteInstruction =
	"Zdjęcia dotarły. W galerii będą za kilka minut.";

export function phaseLabel(phase: UploadPhase) {
	return {
		queued: "Oczekuje",
		compressing: "Przygotowujemy kopię",
		uploading: "Wysyłamy",
		archive_failed: "Oryginał nie dotarł",
		done: "Gotowe",
		failed: "Nie udało się",
	}[phase];
}
