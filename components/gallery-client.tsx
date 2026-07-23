"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { GalleryItem, GalleryStats } from "@/lib/domain";
import { UploadPanel } from "@/components/upload-panel";

type GalleryResponse = {
  items: GalleryItem[];
  nextCursor: string | null;
  stats: GalleryStats;
  error?: string;
};

export function GalleryClient({ initial }: { initial: GalleryResponse }) {
  const [items, setItems] = useState(initial.items);
  const [stats, setStats] = useState(initial.stats);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [selected, setSelected] = useState<GalleryItem | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(initial.error ?? "");

  useEffect(() => {
    if (!selected) return;
    function close(event: KeyboardEvent) {
      if (event.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selected]);

  async function fetchPage(nextCursor?: string | null) {
    const url = nextCursor
      ? `/api/gallery?cursor=${encodeURIComponent(nextCursor)}`
      : "/api/gallery";
    const response = await fetch(url, { cache: "no-store" });
    const body = (await response.json()) as GalleryResponse;
    if (!response.ok) throw new Error(body.error ?? "Nie udało się odświeżyć.");
    return body;
  }

  async function refresh() {
    setPending(true);
    setMessage("");
    try {
      const body = await fetchPage();
      setItems(body.items);
      setCursor(body.nextCursor);
      setStats(body.stats);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Błąd odświeżania.");
    } finally {
      setPending(false);
    }
  }

  async function loadMore() {
    if (!cursor) return;
    setPending(true);
    try {
      const body = await fetchPage(cursor);
      setItems((current) => [...current, ...body.items]);
      setCursor(body.nextCursor);
      setStats(body.stats);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Błąd galerii.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <header className="grid gap-6 py-8 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.3em]">
            Wspomnienia z naszego dnia
          </p>
          <h1 className="font-serif text-5xl font-bold sm:text-7xl">
            Nasze wesele
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-8">
            Dziękujemy, że świętujecie razem z nami. Dodajcie swoje kadry i
            zobaczcie ten dzień oczami wszystkich gości.
          </p>
          <p className="font-bold" aria-live="polite">
            {stats.contributingGuests} gości dodało już {stats.approvedPhotos} zdjęć
          </p>
        </header>

        <div className="mx-auto mb-10 max-w-2xl">
          <UploadPanel onComplete={refresh} />
        </div>

        <section aria-labelledby="gallery-title">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <h2 id="gallery-title" className="font-serif text-3xl font-bold">
              Galeria
            </h2>
            <button
              type="button"
              onClick={refresh}
              disabled={pending}
              className="min-h-11 rounded-full border-2 border-wedding-green px-5 font-bold hover:bg-wedding-rose/40 disabled:opacity-60"
            >
              {pending ? "Odświeżamy…" : "Odśwież galerię"}
            </button>
          </div>
          {message ? (
            <p role="alert" className="mb-4 font-semibold text-wedding-error">
              {message}
            </p>
          ) : null}
          {items.length ? (
            <ul className="columns-2 gap-3 sm:columns-3 lg:columns-4">
              {items.map((item) => (
                <li key={item.id} className="mb-3 break-inside-avoid">
                  <button
                    type="button"
                    onClick={() => setSelected(item)}
                    className="group block w-full overflow-hidden rounded-2xl bg-wedding-rose/30 shadow-sm focus-visible:outline-4"
                    aria-label="Powiększ zdjęcie"
                  >
                    <Image
                      src={item.imageUrl}
                      alt=""
                      width={item.width ?? 1200}
                      height={item.height ?? 900}
                      unoptimized
                      className="h-auto w-full transition duration-300 group-hover:scale-[1.02]"
                    />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-[2rem] border border-dashed border-wedding-green/50 p-10 text-center">
              <p className="font-serif text-2xl font-bold">
                Pierwsze zdjęcia pojawią się tutaj.
              </p>
              <p className="mt-2">Może zaczniesz nasz wspólny album?</p>
            </div>
          )}
          {cursor ? (
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={pending}
                className="min-h-12 rounded-full bg-wedding-green px-7 font-bold text-wedding-rose disabled:opacity-60"
              >
                Pokaż więcej
              </button>
            </div>
          ) : null}
        </section>
      </main>
      {selected ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Powiększone zdjęcie"
          className="fixed inset-0 z-50 grid place-items-center bg-[var(--wedding-overlay)] p-4"
          onClick={() => setSelected(null)}
        >
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="absolute right-4 top-4 min-h-11 rounded-full bg-wedding-ivory px-5 font-bold text-wedding-green"
          >
            Zamknij
          </button>
          <Image
            src={selected.imageUrl}
            alt=""
            width={selected.width ?? 1600}
            height={selected.height ?? 1200}
            unoptimized
            className="max-h-[88vh] w-auto max-w-full rounded-2xl object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}
