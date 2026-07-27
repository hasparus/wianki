import type { UploadPhase } from "@/components/upload/types";

// Kept short and specific on purpose: each line should read like something
// the couple would actually text a guest, and work for guests of any gender.
const successMessages = [
	"Niezły z Ciebie fotograf! 📸",
	"Ale piękne wspomnienia! 💕",
	"Galeria zrobiła się jeszcze piękniejsza.",
	"Mamy to! Kadr zapisany.",
	"Fotograficzna robota pierwsza klasa.",
	"Cudownie, że dzielisz z nami tę chwilę.",
	"Kolejne wspomnienie uratowane!",
	"Brawo! Zdjęcia już do nas lecą.",
	"Album rośnie w oczach!",
	"To będzie wspaniała pamiątka.",
	"Masz oko do weselnych momentów.",
	"To zdjęcie zasługuje na konfetti.",
	"Dzięki! Będziemy do tego wracać.",
	"Ten moment już nam nie ucieknie.",
	"Pięknie uchwycone!",
	"Kolejny powód do uśmiechu.",
	"Dzięki za fotograficzny prezent.",
	"Ten kadr zostaje z nami.",
	"Mamy fotografa wśród gości!",
	"Świetny strzał!",
	"Tego momentu nie mogło zabraknąć.",
	"Dzięki za kawałek tej historii.",
	"Jest pięknie, dziękujemy!",
	"Kolejny kadr do oglądania przy kawie.",
	"Udało się! Zdjęcia są z nami.",
	"Brawo za refleks i dobre oko.",
	"Weselny album mówi: jeszcze!",
	"Dzięki, to naprawdę wiele dla nas znaczy.",
];

export const uploadCompleteInstruction =
	"Zdjęcia dotarły i za kilka minut pojawią się w galerii. Ich podgląd zostaje poniżej, a Ty możesz dodać kolejne.";

export function randomSuccessMessage() {
	return successMessages[Math.floor(Math.random() * successMessages.length)];
}

export function completedUploadMessage() {
	return `${randomSuccessMessage()} ${uploadCompleteInstruction}`;
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
