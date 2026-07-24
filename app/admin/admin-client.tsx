"use client";

import Image from "next/image";
import { useState } from "react";
import type { AdminPhoto } from "@/lib/admin";

type AdminAction = "approve" | "hide" | "retry_moderation" | "reconcile_archive";

const labels: Record<AdminAction, string> = {
  approve: "Zatwierdź",
  hide: "Ukryj",
  retry_moderation: "Sprawdź ponownie",
  reconcile_archive: "Znajdź w Drive",
};

export function AdminClient({ initial }: { initial: AdminPhoto[] }) {
  const [photos, setPhotos] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function refresh() {
    const response = await fetch("/api/admin/photos", { cache: "no-store" });
    const body = (await response.json()) as { photos?: AdminPhoto[]; error?: string };
    if (!response.ok || !body.photos) throw new Error(body.error ?? "Błąd kolejki.");
    setPhotos(body.photos);
  }

  async function act(photoId: string, action: AdminAction) {
    setPendingId(photoId);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/photos/${photoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Akcja nie powiodła się.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Błąd działania.");
    } finally {
      setPendingId(null);
    }
  }

  async function remove(photoId: string) {
    if (!window.confirm("Usunąć kopię galeryjną i przenieść oryginał do kosza Drive?")) {
      return;
    }
    setPendingId(photoId);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/photos/${photoId}`, {
        method: "DELETE",
      });
      const body = (await response.json()) as { error?: string; errors?: string[] };
      if (!response.ok) throw new Error(body.error ?? "Usuwanie nie powiodło się.");
      if (body.errors?.length) setMessage(body.errors.join(" "));
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Błąd usuwania.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-10">
      <header>
        <p className="text-sm font-bold uppercase tracking-[0.25em]">Panel pary młodej</p>
        <h1 className="mt-2 font-serif text-5xl font-bold">Kolejka zdjęć</h1>
        <p className="mt-3">
          Kod QR administratora działa jak wspólne hasło. Nie udostępniaj go gościom.
        </p>
      </header>
      {message ? (
        <p role="alert" className="mt-6 font-bold text-wedding-error">
          {message}
        </p>
      ) : null}
      {photos.length ? (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <li
              key={photo.id}
              className="overflow-hidden rounded-[1.5rem] border border-wedding-rose bg-wedding-cream shadow-md"
            >
              {photo.imageUrl ? (
                <Image
                  src={photo.imageUrl}
                  alt=""
                  width={800}
                  height={600}
                  unoptimized
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div className="grid aspect-[4/3] place-items-center bg-wedding-rose/30">
                  Brak kopii galeryjnej
                </div>
              )}
              <div className="p-4">
                <p className="truncate font-bold">{photo.originalFilename}</p>
                <dl className="mt-2 grid grid-cols-2 gap-1 text-sm">
                  <dt>Galeria</dt><dd>{photo.hotStatus}</dd>
                  <dt>Drive</dt><dd>{photo.archiveStatus}</dd>
                  <dt>Moderacja</dt><dd>{photo.moderationStatus}</dd>
                </dl>
                {photo.lastError ? (
                  <p className="mt-2 text-sm text-wedding-error">{photo.lastError}</p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {(["approve", "hide", "retry_moderation", "reconcile_archive"] as const).map(
                    (action) => (
                      <button
                        key={action}
                        type="button"
                        disabled={pendingId === photo.id}
                        onClick={() => act(photo.id, action)}
                        className="min-h-10 rounded-full border border-wedding-green px-3 text-sm font-bold hover:bg-wedding-rose/40 disabled:opacity-50"
                      >
                        {labels[action]}
                      </button>
                    ),
                  )}
                  <button
                    type="button"
                    disabled={pendingId === photo.id}
                    onClick={() => remove(photo.id)}
                    className="min-h-10 rounded-full bg-wedding-error px-3 text-sm font-bold text-white disabled:opacity-50"
                  >
                    Usuń
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-10 rounded-3xl bg-wedding-cream p-8 text-center text-lg">
          Kolejka jest pusta. Wszystko pod kontrolą.
        </p>
      )}
    </main>
  );
}
