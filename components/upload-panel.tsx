"use client";

import imageCompression from "browser-image-compression";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  acceptedOriginalTypes,
  MAX_BATCH_FILES,
  MAX_ORIGINAL_BYTES,
  type ModerationStatus,
} from "@/lib/domain";
import { supabaseBrowser } from "@/lib/supabase/browser";

type UploadPhase =
  | "queued"
  | "compressing"
  | "uploading"
  | "moderating"
  | "done"
  | "failed";

type UploadItem = {
  file: File;
  phase: UploadPhase;
  message: string;
};

type InitUpload = {
  photoId: string;
  path: string;
  uploadToken: string;
  archiveToken: string;
};

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

function phaseLabel(phase: UploadPhase) {
  return {
    queued: "Oczekuje",
    compressing: "Przygotowujemy kopię",
    uploading: "Wysyłamy",
    moderating: "Sprawdzamy",
    done: "Gotowe",
    failed: "Wymaga ponowienia",
  }[phase];
}

async function imageDimensions(file: Blob) {
  const bitmap = await createImageBitmap(file);
  const result = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return result;
}

async function compress(file: File) {
  if (file.type === "image/heic" || file.type === "image/heif") {
    try {
      const bitmap = await createImageBitmap(file);
      bitmap.close();
    } catch {
      throw new Error(
        "To urządzenie nie potrafi przygotować pliku HEIC. Wyeksportuj zdjęcie jako JPEG.",
      );
    }
  }
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.488,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: "image/webp",
    preserveExif: false,
    initialQuality: 0.86,
  });
  const dimensions = await imageDimensions(compressed);
  return { compressed, ...dimensions };
}

export function UploadPanel({ onComplete }: { onComplete: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState("");

  function update(index: number, patch: Partial<UploadItem>) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  }

  function choose(files: FileList | null) {
    setSummary("");
    const selected = Array.from(files ?? []);
    if (selected.length > MAX_BATCH_FILES) {
      setSummary("W jednym podejściu możesz wybrać maksymalnie 10 zdjęć.");
      return;
    }
    const invalid = selected.find(
      (file) =>
        !acceptedOriginalTypes.includes(
          file.type as (typeof acceptedOriginalTypes)[number],
        ) || file.size > MAX_ORIGINAL_BYTES,
    );
    if (invalid) {
      setSummary(
        `${invalid.name}: obsługujemy zdjęcia JPEG, PNG, WebP i HEIC do 25 MB.`,
      );
      return;
    }
    setItems(
      selected.map((file) => ({ file, phase: "queued", message: "" })),
    );
  }

  async function processOne(index: number, init: InitUpload) {
    const file = items[index].file;
    try {
      update(index, { phase: "compressing", message: "" });
      const { compressed, width, height } = await compress(file);
      update(index, { phase: "uploading" });
      const hotPromise = supabaseBrowser().storage
        .from("gallery")
        .uploadToSignedUrl(init.path, init.uploadToken, compressed, {
          contentType: compressed.type,
          cacheControl: "3600",
        });
      const archivePromise = fetch(
        `${process.env.NEXT_PUBLIC_ARCHIVE_WORKER_URL ?? ""}/v1/archive/${init.photoId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${init.archiveToken}`,
            "Content-Type": file.type,
            "Content-Length": String(file.size),
          },
          body: file,
        },
      );
      const [hot, archiveResponse] = await Promise.all([hotPromise, archivePromise]);
      if (hot.error) throw hot.error;
      let archiveReceipt: string | null = null;
      let archiveError: string | null = null;
      if (archiveResponse.ok) {
        const archive = (await archiveResponse.json()) as { receipt?: string };
        archiveReceipt = archive.receipt ?? null;
      } else {
        archiveError = "Oryginał nie dotarł do archiwum Drive.";
      }
      update(index, { phase: "moderating" });
      const finalize = await fetch(`/api/uploads/${init.photoId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          archiveReceipt,
          archiveError,
          derivativeSize: compressed.size,
          derivativeType: compressed.type,
          width,
          height,
        }),
      });
      const result = (await finalize.json()) as {
        error?: string;
        warning?: string | null;
        moderationStatus?: ModerationStatus;
      };
      if (!finalize.ok) throw new Error(result.error ?? "Finalizacja nie powiodła się.");
      update(index, {
        phase: "done",
        message: result.warning
          ? "Kopia galeryjna dotarła; oryginał wymaga naszej kontroli."
          : result.moderationStatus === "approved"
            ? "Zdjęcie jest gotowe do pokazania."
            : "Zdjęcie czeka na naszą kontrolę.",
      });
      return true;
    } catch (error) {
      update(index, {
        phase: "failed",
        message: error instanceof Error ? error.message : "Nie udało się wysłać.",
      });
      return false;
    }
  }

  async function upload() {
    if (!consent || !items.length || busy) return;
    setBusy(true);
    setSummary("");
    try {
      const response = await fetch("/api/uploads/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consent: true,
          files: items.map(({ file }) => ({
            name: file.name,
            type: file.type,
            size: file.size,
          })),
        }),
      });
      const initialized = (await response.json()) as {
        error?: string;
        uploads?: InitUpload[];
      };
      if (!response.ok || !initialized.uploads) {
        throw new Error(initialized.error ?? "Nie udało się rozpocząć.");
      }
      const results: boolean[] = [];
      let next = 0;
      async function worker() {
        while (next < initialized.uploads!.length) {
          const index = next++;
          results[index] = await processOne(index, initialized.uploads![index]);
        }
      }
      await Promise.all([worker(), worker()]);
      const succeeded = results.filter(Boolean).length;
      if (succeeded === results.length) {
        setSummary(
          successMessages[Math.floor(Math.random() * successMessages.length)],
        );
        onComplete();
      } else {
        setSummary(`Dotarło ${succeeded} z ${results.length} zdjęć. Sprawdź błędy poniżej.`);
      }
    } catch (error) {
      setSummary(error instanceof Error ? error.message : "Nie udało się wysłać.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="upload-title"
      className="rounded-[2rem] border border-wedding-rose bg-wedding-cream p-5 shadow-lg shadow-wedding-rose/15 sm:p-7"
    >
      <h2 id="upload-title" className="font-serif text-3xl font-bold">
        Dodaj swoje zdjęcia
      </h2>
      <p className="mt-2 leading-7">
        Jednorazowo wybierz maksymalnie 10 zdjęć. Oryginały zachowamy, a do
        galerii przygotujemy lekkie kopie.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        onChange={(event) => choose(event.target.files)}
        className="sr-only"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="mt-5 min-h-12 rounded-full border-2 border-wedding-green px-6 font-bold hover:bg-wedding-rose/40 disabled:opacity-60"
      >
        Wybierz zdjęcia
      </button>
      {items.length ? (
        <ul className="mt-5 grid gap-3" aria-live="polite">
          {items.map((item, index) => (
            <li
              key={`${item.file.name}-${index}`}
              className="rounded-2xl bg-white/75 px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate font-semibold">{item.file.name}</span>
                <span className="shrink-0 text-sm">{phaseLabel(item.phase)}</span>
              </div>
              {item.message ? <p className="mt-1 text-sm">{item.message}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <label className="mt-5 flex items-start gap-3 text-sm leading-6">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-1 size-5 accent-wedding-green"
        />
        <span>
          Zgadzam się na przechowanie i sprawdzenie zdjęć zgodnie z{" "}
          <Link href="/privacy" className="font-bold underline">
            informacją o prywatności
          </Link>
          .
        </span>
      </label>
      <button
        type="button"
        onClick={upload}
        disabled={!consent || !items.length || busy}
        className="mt-5 min-h-12 w-full rounded-full bg-wedding-green px-6 font-bold text-wedding-rose hover:bg-wedding-green-soft disabled:cursor-not-allowed disabled:bg-wedding-disabled disabled:text-white"
      >
        {busy ? "Wysyłamy zdjęcia…" : "Wyślij zdjęcia"}
      </button>
      {summary ? (
        <p role="status" className="mt-4 font-bold">
          {summary}
        </p>
      ) : null}
    </section>
  );
}
