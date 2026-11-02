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
- **Dołączanie z sali.** Gdy strona ma ustawiony kod dołączenia (w konsoli
  `/konto`), w lewym dolnym rogu pokazu (tylko na dużych ekranach) pojawia
  się kod QR i krótki adres `/p/<kod>`. Zeskanowanie nadaje sesję gościa i
  otwiera pokaz. To osobny, krótki sekret: zdjęcie ekranu z QR unieważnia
  się, zmieniając sam kod w konsoli, bez wymiany wydrukowanych kodów przy
  stołach. Bez kodu `/p/*` jest zamknięte, a QR się nie wyświetla.

## Zasady zgodne z resztą aplikacji

- Pokaz wyświetla wyłącznie zdjęcia spełniające regułę galerii
  (`hot_status=uploaded`, `moderation_status=approved`). Ukrycie zdjęcia w
  panelu usuwa je też z pokazu.
- Reakcje i komentarze są **anonimowe i ulotne**. Nie zapisujemy ich nigdzie —
  istnieją tylko w pamięci pokoju Durable Object w czasie pokazu. Żadnych
  nazwisk, e-maili ani adresów IP.
- Komentarze: 140 znaków, znaki sterujące wycięte, tempo wysyłania ograniczone
  na połączenie.
- **Jeden pokój na wesele.** Pokój nazywa się id strony. Token wydany dla
  jednej strony nie otwiera pokoju innej, a worker sprawdza też, że
  `Origin` połączenia to adres tej właśnie strony — subdomena platformy
  albo własna domena.

## Architektura

- Slajdy: tabela `slideshow_slides` w D1 (`db/migrations/0001_platform.sql`),
  z `site_id`, edytowana wyłącznie przez API administratora. Tempo:
  `slideshow_settings`, jeden wiersz na stronę.
- Realtime: `workers/slideshow-live` na
  [PartyServer](https://github.com/cloudflare/partykit) (Durable Objects),
  jeden pokój na wesele pod `/parties/slideshow-party/<id strony>`.
  Przeglądarka łączy się przez `partysocket`; `host`, `party`, `room` i token
  dostaje z `/api/slideshow/live`.
- Kontrakt po drucie — typy wiadomości, walidacja, limity, weryfikacja tokenu —
  mieszka wyłącznie w `lib/slideshow-protocol.ts`. Worker importuje ten sam
  plik, więc obie strony nie mogą się rozjechać.
- Autoryzacja: `/api/slideshow/live` (ciasteczko gościa lub administratora)
  wydaje 12-godzinny token HS256 (`SLIDESHOW_LIVE_SECRET`) z rolą, pokojem i
  adresem strony. Worker sprawdza przy nawiązaniu WebSocketu, że token jest
  ważny, że jego pokój to pokój z adresu i że `Origin` to adres z tokenu.
  Worker nie ma własnej listy adresów — aplikacja jest tu źródłem prawdy.
- Bez `SLIDESHOW_LIVE_URL` i `SLIDESHOW_LIVE_SECRET` pokaz działa bez warstwy
  live, bez paska reakcji. Nic się nie psuje.

## Wdrożenie workera

Produkcyjnie worker, jego Durable Object i sekret `LIVE_TOKEN_SECRET` (ten
sam, co `SLIDESHOW_LIVE_SECRET` aplikacji) deklaruje `alchemy.run.ts` razem
z resztą infrastruktury — patrz `docs/deploy.md`. Worker nie ma żadnych
zmiennych konfiguracyjnych: adres i pokój podróżują w tokenie.

Lokalnie:

```bash
cd workers/slideshow-live
cp .dev.vars.example .dev.vars   # wpisz LIVE_TOKEN_SECRET
npx wrangler dev
```

W aplikacji ustaw `SLIDESHOW_LIVE_URL` na adres workera i
`SLIDESHOW_LIVE_SECRET` na ten sam sekret.
