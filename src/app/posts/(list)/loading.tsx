export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-5 pt-16" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="skeleton h-5 w-28" />
      <div className="skeleton h-14 w-3/4 mt-5" />
      <div className="skeleton h-14 w-1/2 mt-3" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 mt-14">
        {[0, 1, 2].map((i) => <div key={i}><div className="skeleton aspect-[3/2]" /><div className="skeleton h-6 w-5/6 mt-4" /><div className="skeleton h-4 w-1/3 mt-3" /></div>)}
      </div>
    </main>
  );
}
