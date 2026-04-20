import Link from "next/link";

export default function PreviewIndexPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-sky-300">Preview</p>
          <h1 className="text-3xl font-semibold">Local AI Preview Routes</h1>
          <p className="max-w-2xl text-sm text-slate-300">
            Use these routes to test integrated recommendation and coach flows without dashboard login.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/preview/assistant"
            className="rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:border-sky-400 hover:bg-slate-900/80"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-sky-300">Unified flow</p>
            <h2 className="mt-2 text-xl font-medium">Assistant Preview</h2>
            <p className="mt-2 text-sm text-slate-300">
              Route one message into coach feedback or recommendation tools and inspect the structured output.
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}
