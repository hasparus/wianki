# Pokaz slajdów z reakcjami na żywo

## Co to jest

- `/pokaz` — pełnoekranowy pokaz slajdów dla gości (i pary młodej), wygodny na
  telefonie: autoodtwarzanie, przesuwanie gestem, klawisze strzałek. Reakcje
  emoji ulatują do góry, a komentarze płyną przez ekran w bąbelkach — u
  wszystkich oglądających jednocześnie.
- **Prowadzący zawsze steruje**: urządzenie administratora przejmuje pokaz
  automatycznie po wejściu na `/pokaz` — wszystkie pozostałe śledzą jego slajd
  (dopasowanie po id slajdu, z awaryjnym indeksem, gdy talie się różnią).
  Ostatnie podłączone urządzenie administratora wygrywa; wcześniejsze staje
  się widzem i dostaje przycisk „Przejmij pokaz”. Goście mogą w każdej chwili
  przeglądać samodzielnie — wraca się przyciskiem „Wróć do pokazu na żywo”.
  Zerwanie połączenia prowadzącego kończy tryb na żywo, a pozostałe urządzenia
  administratora same przejmują pokaz; klient prowadzącego odzyskuje pokaz po
  ponownym połączeniu, więc restart workera nie przerywa wieczoru.
- `/admin/pokaz` — edytor pokazu dla pary młodej: dodawanie zdjęć z
  zatwierdzonej galerii, slajdy tekstowe, zmiana kolejności (przeciąganie na
  komputerze, strzałki na telefonie).
- Bez ułożonej listy pokaz gra automatycznie wszystkie zatwierdzone zdjęcia
  galerii chronologicznie (do 150), więc działa od pierwszego dnia.
- **Dołączanie z sali**: po ustawieniu `GUEST_JOIN_CODE` w lewym dolnym rogu
  pokazu (na dużych ekranach — projektor, laptop) pojawia się kod QR i krótki
  adres `/p/<kod>`. Zeskanowanie lub wpisanie adresu nadaje sesję gościa i
  otwiera pokaz. Kod jest osobnym, krótkim sekretem — zdjęcie ekranu z QR
  można unieważnić rotując sam `GUEST_JOIN_CODE`, bez wymiany wydrukowanych
  kodów przy stołach. Bez ustawionej zmiennej ścieżka `/p/*` pozostaje
  zamknięta, a QR się nie wyświetla.

## Zasady zgodne z resztą aplikacji

- Pokaz wyświetla wyłącznie zdjęcia spełniające regułę galerii
  (`hot_status=uploaded` i `moderation_status=approved`). Ukrycie zdjęcia w
  panelu usuwa je też z pokazu.
- Reakcje i komentarze są **anonimowe i ulotne** — nie są nigdzie zapisywane,
  istnieją tylko w pamięci pokoju Durable Object podczas trwania pokazu.
  Nie zbieramy nazwisk, e-maili ani adresów IP.
- Komentarze są przycinane do 140 znaków i filtrowane ze znaków sterujących;
  worker ogranicza tempo wysyłania na połączenie.

## Architektura

- Slajdy: tabela `slideshow_slides` (migracja `202608050001_slideshow.sql`),
  edytowana wyłącznie przez API administratora.
- Realtime: `workers/slideshow-live` — Cloudflare Worker na
  [PartyServer](https://github.com/cloudflare/partykit) (Durable Objects),
  jeden pokój na wesele. Przeglądarka łączy się przez `partysocket`.
- Autoryzacja: `/api/slideshow/live` (ciasteczko gościa lub administratora)
  wydaje 12-godzinny token HS256 (`SLIDESHOW_LIVE_SECRET`), który worker
  weryfikuje przy nawiązaniu WebSocketu; dodatkowo sprawdzany jest nagłówek
  `Origin`.
- Gdy `SLIDESHOW_LIVE_URL`/`SLIDESHOW_LIVE_SECRET` nie są ustawione, pokaz
  działa bez warstwy live (bez paska reakcji) — nic się nie psuje.

## Wdrożenie workera

```bash
cd workers/slideshow-live
npx wrangler deploy
npx wrangler secret put LIVE_TOKEN_SECRET   # ta sama wartość co SLIDESHOW_LIVE_SECRET w Vercel
```

`ALLOWED_ORIGIN` jest ustawione w `wrangler.jsonc` na
`https://wedding.pawel.space`; do developmentu lokalnego skopiuj
`.dev.vars.example` do `.dev.vars`.

W Vercel ustaw `SLIDESHOW_LIVE_URL` na adres wdrożonego workera oraz
`SLIDESHOW_LIVE_SECRET` na sekret z kroku powyżej.
