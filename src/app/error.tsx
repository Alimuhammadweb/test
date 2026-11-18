"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-5 py-24 text-center">
      <h1 className="headline text-4xl">Nimadir xato ketdi</h1>
      <p className="mt-3 text-mute font-serif text-lg">Sahifani yuklab bo‘lmadi. Birozdan keyin qayta urinib ko‘ring.</p>
      <div className="mt-6 flex justify-center gap-3">
        <button type="button" onClick={reset} className="btn">Qayta urinish</button>
        <a href="/" className="btn2">Bosh sahifa</a>
      </div>
    </main>
  );
}
