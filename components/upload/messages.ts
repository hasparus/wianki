import type { UploadPhase } from "@/components/upload/types";

// What two people actually text back mid-reception: short, unfussy, pleased
// without performing it. No praise for the photographer, no exclamation on
// every line, no emoji. Verbs stay out of the past tense so the line works for
// a guest of any gender.
const successMessages = [
	"Mamy je.",
	"Są u nas. Dzięki.",
	"Dzięki, że robisz nam zdjęcia.",
	"O, dobre.",
	"Dzięki. Będziemy je oglądać.",
	"Dobre oko.",
	"Jedno więcej, którego byśmy nie mieli.",
	"Dorzucone do reszty.",
	"Dzięki, naprawdę.",
	"To nam zostanie.",
	"Dzięki za ten kadr.",
	"Zapisane.",
	"Tego nam brakowało.",
];

export const uploadCompleteInstruction =
	"Zdjęcia dotarły. W galerii będą za kilka minut, podgląd zostaje poniżej. W każdej chwili możesz dodać kolejne.";

export function randomSuccessMessage() {
	return successMessages[Math.floor(Math.random() * successMessages.length)];
}

export function completedUploadMessages() {
	return {
		celebration: randomSuccessMessage(),
		summary: uploadCompleteInstruction,
	};
}

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
