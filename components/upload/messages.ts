import type { UploadPhase } from "@/components/upload/types";

const successMessages = [
	"Niezły z Ciebie fotograf! 📸",
	"Złapałeś ten moment idealnie! ✨",
	"Ale piękne wspomnienia! 💕",
	"To zdjęcie trafi prosto do naszego serca.",
	"Dzięki — właśnie zatrzymałeś chwilę na dłużej.",
	"Galeria zrobiła się jeszcze piękniejsza.",
	"Mamy to! Kadr zapisany.",
	"Fotograficzna robota pierwsza klasa.",
	"Miłość dobrze wygląda w Twoim obiektywie.",
	"Cudownie, że dzielisz z nami tę chwilę.",
	"Kolejne wspomnienie uratowane!",
	"Ten kadr ma weselną moc.",
	"Brawo! Zdjęcia już do nas lecą.",
	"Piękna chwila, piękne zdjęcie.",
	"Dziękujemy za Twoje spojrzenie na ten dzień.",
	"Album rośnie w oczach!",
	"To będzie wspaniała pamiątka.",
	"Masz oko do weselnych momentów.",
	"Uśmiech zapisany na zawsze.",
	"Właśnie dodałeś trochę magii.",
	"Kadr pełen miłości — dziękujemy!",
	"To zdjęcie zasługuje na konfetti.",
	"Weselna kronika właśnie się powiększyła.",
	"Dzięki! Będziemy do tego wracać.",
	"Ten moment już nam nie ucieknie.",
	"Pięknie uchwycone!",
	"Zdjęcia bezpiecznie dotarły.",
	"Wspaniale widzieć ten dzień Twoimi oczami.",
	"Kolejny powód do uśmiechu.",
	"Dzięki za fotograficzny prezent.",
	"Właśnie stworzyłeś część naszego albumu.",
	"Ten kadr zostaje z nami.",
	"Mamy fotografa wśród gości!",
	"Świetny strzał!",
	"Tego momentu nie mogło zabraknąć.",
	"Miłość, radość i dobry kadr.",
	"Wysłane z sercem, odebrane z uśmiechem.",
	"Dzięki za kawałek tej historii.",
	"Ten dzień właśnie zyskał kolejną pamiątkę.",
	"Fotograficzna magia zadziałała.",
	"Jest pięknie — dziękujemy!",
	"Twoje zdjęcia są już częścią naszej historii.",
	"Kolejny kadr do oglądania przy kawie.",
	"Udało się! Zdjęcia są z nami.",
	"Brawo za refleks i dobre oko.",
	"Ten moment będzie żył dalej.",
	"Dziękujemy za zatrzymanie tej chwili.",
	"Weselny album mówi: jeszcze!",
	"Kadr przyjęty z wielką radością.",
	"Dzięki — to naprawdę wiele dla nas znaczy.",
];

export const uploadCompleteInstruction =
	"Zdjęcia bezpiecznie dotarły i za kilka minut pojawią się w galerii. Poniżej widzisz ich podgląd — śmiało dodawaj kolejne.";

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
		archive_failed: "Oryginał wymaga ponowienia",
		done: "Gotowe",
		failed: "Wymaga ponowienia",
	}[phase];
}
