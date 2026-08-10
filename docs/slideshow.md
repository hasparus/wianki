# Pokaz slajdów z reakcjami na żywo

## Co to jest

- `/pokaz` — pełnoekranowy pokaz dla gości i pary młodej, wygodny na telefonie:
  autoodtwarzanie, przesuwanie gestem, strzałki. Reakcje emoji ulatują do góry,
  komentarze płyną przez ekran — u wszystkich oglądających naraz.
- **Prowadzący zawsze steruje.** Urządzenie administratora przejmuje pokaz od
  razu po wejściu na `/pokaz`, reszta śledzi jego slajd (po id slajdu, z
  awaryjnym indeksem, gdy talie się różnią). Wygrywa ostatnie podłączone;
  wcześniejsze zostaje widzem i dostaje przycisk „Przejmij pokaz”. Goście mogą
  w każdej chwili przeglądać sami i wracają przyciskiem „Wróć do pokazu na
  żywo”. Zerwane połączenie prowadzącego kończy tryb na żywo — ale nie zmienia
  zapisanego tempa — a pozostałe urządzenia administratora przejmują pokaz
  same. Restart workera nie przerywa wieczoru.
- `/admin/pokaz` — edytor dla pary młodej: zdjęcia z zatwierdzonej galerii,
  slajdy tekstowe, kolejność (przeciąganie na komputerze, strzałki na
  telefonie), tempo slajdu.
- Bez ułożonej listy pokaz gra wszystkie zatwierdzone zdjęcia galerii
  chronologicznie, do 150. Działa od pierwszego dnia.
- **Dołączanie z sali.** Po ustawieniu `GUEST_JOIN_CODE` w lewym dolnym rogu
  pokazu (tylko na dużych ekranach) pojawia się kod QR i krótki adres
  `/p/<kod>`. Zeskanowanie nadaje sesję gościa i otwiera pokaz. To osobny,
  krótki sekret: zdjęcie ekranu z QR unieważnia się rotując sam
  `GUEST_JOIN_CODE`, bez wymiany wydrukowanych kodów przy stołach. Bez tej
  zmiennej `/p/*` jest zamknięte, a QR się nie wyświetla.

## Zasady zgodne z resztą aplikacji

- Pokaz wyświetla wyłącznie zdjęcia spełniające regułę galerii
  (`hot_status=uploaded`, `moderation_status=approved`). Ukrycie zdjęcia w
  panelu usuwa je też z pokazu.
- Reakcje i komentarze są **anonimowe i ulotne**. Nie zapisujemy ich nigdzie —
  istnieją tylko w pamięci pokoju Durable Object w czasie pokazu. Żadnych
  nazwisk, e-maili ani adresów IP.
- Komentarze: 140 znaków, znaki sterujące wycięte, tempo wysyłania ograniczone
  na połączenie.

## Architektura

- Slajdy: tabela `slideshow_slides` (migracja `202608050001_slideshow.sql`),
  edytowana wyłącznie przez API administratora. Tempo: `slideshow_settings`.
- Realtime: `workers/slideshow-live` na
  [PartyServer](https://github.com/cloudflare/partykit) (Durable Objects),
  jeden pokój na wesele. Przeglądarka łączy się przez `partysocket`.
- Kontrakt po drucie — typy wiadomości, walidacja, limity, weryfikacja tokenu —
  mieszka wyłącznie w `lib/slideshow-protocol.ts`. Worker importuje ten sam
  plik, więc obie strony nie mogą się rozjechać.
- Autoryzacja: `/api/slideshow/live` (ciasteczko gościa lub administratora)
  wydaje 12-godzinny token HS256 (`SLIDESHOW_LIVE_SECRET`), który worker
  sprawdza przy nawiązaniu WebSocketu. Dodatkowo sprawdzany jest `Origin`.
- Bez `SLIDESHOW_LIVE_URL` i `SLIDESHOW_LIVE_SECRET` pokaz działa bez warstwy
  live, bez paska reakcji. Nic się nie psuje.

## Wdrożenie workera

```bash
cd workers/slideshow-live
npx wrangler deploy
npx wrangler secret put LIVE_TOKEN_SECRET   # to samo co SLIDESHOW_LIVE_SECRET w Vercel
```

`ALLOWED_ORIGIN` w `wrangler.jsonc` musi być dokładnym adresem, z którego
serwowana jest aplikacja. Do developmentu skopiuj `.dev.vars.example` do
`.dev.vars`.

W Vercel ustaw `SLIDESHOW_LIVE_URL` na adres workera i `SLIDESHOW_LIVE_SECRET`
na sekret z kroku wyżej.
