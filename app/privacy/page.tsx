import Link from "next/link";

export default function PrivacyPage() {
  const email = process.env.DELETION_CONTACT_EMAIL ?? "adres pary młodej";
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-5 py-12">
      <article className="rounded-[2rem] bg-wedding-cream p-7 shadow-lg sm:p-10">
        <p className="text-sm font-bold uppercase tracking-[0.2em]">
          Prywatność zdjęć
        </p>
        <h1 className="mt-3 font-serif text-4xl font-bold">Krótko i po ludzku</h1>
        <div className="mt-6 space-y-5 leading-7">
          <p>
            Zdjęcia są przeznaczone wyłącznie dla naszych gości. Pomniejszone
            kopie przechowujemy prywatnie w Supabase, a oryginały w prywatnym
            folderze Google Drive.
          </p>
          <p>
            Pomniejszona kopia jest sprawdzana przez Google Cloud Vision pod
            kątem treści dla dorosłych, przemocy i treści obscenicznych.
            Automatyczna decyzja może zostać przez nas zmieniona.
          </p>
          <p>
            Z kopii galeryjnej usuwamy metadane EXIF. Oryginał zachowuje
            metadane aparatu. Nie przypisujemy zdjęć do imienia, e-maila ani
            adresu IP.
          </p>
          <p>
            Przechowujemy zdjęcia do czasu ręcznego usunięcia. Jeżeli chcesz
            usunąć konkretne zdjęcie, napisz na:{" "}
            <strong>{email}</strong>.
          </p>
        </div>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-11 items-center rounded-full bg-wedding-green px-6 font-bold text-wedding-rose"
        >
          Wróć do galerii
        </Link>
      </article>
    </main>
  );
}
