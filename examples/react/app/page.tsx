import ComparisonDemo from "../components/ComparisonDemo";

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col items-center bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(16,185,129,0.10),transparent_60%),radial-gradient(ellipse_60%_50%_at_50%_120%,rgba(244,63,94,0.08),transparent_60%)] font-sans dark:bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(16,185,129,0.12),transparent_60%),radial-gradient(ellipse_60%_50%_at_50%_120%,rgba(244,63,94,0.10),transparent_60%)]">
      <main className="flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-10 sm:px-8 sm:py-16">
        <Hero />
        <ComparisonDemo />
        <Footer />
      </main>
    </div>
  );
}

function Hero() {
  return (
    <header className="flex flex-col items-start gap-5">
      <a
        href="https://github.com/eklavya-raj/fetchstream-js"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/70 px-3 py-1 text-xs font-medium text-zinc-700 backdrop-blur-sm transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300 dark:hover:border-zinc-700"
      >
        <span className="size-1.5 rounded-full bg-emerald-500" />
        fetchstream-js · streaming JSON parser
        <span className="text-zinc-400 dark:text-zinc-600">→</span>
      </a>
      <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
        Stop waiting for{" "}
        <span className="bg-gradient-to-br from-rose-500 to-amber-500 bg-clip-text text-transparent">
          JSON.parse
        </span>
        .
        <br />
        Render rows{" "}
        <span className="bg-gradient-to-br from-emerald-500 to-teal-500 bg-clip-text text-transparent">
          while bytes are still arriving
        </span>
        .
      </h1>
      <p className="max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
        A live, head-to-head benchmark against a real{" "}
        <span className="font-mono text-zinc-800 dark:text-zinc-200">
          ~5 MB
        </span>{" "}
        JSON payload. Both panes pull the same bytes over the same network —
        only{" "}
        <span className="font-semibold text-zinc-900 dark:text-zinc-50">
          when those bytes become visible UI
        </span>{" "}
        differs.
      </p>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-4 flex flex-col items-start gap-3 border-t border-zinc-200 pt-6 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:text-zinc-400">
      <p>
        Dataset:{" "}
        <a
          className="font-mono text-zinc-700 hover:underline dark:text-zinc-300"
          href="https://microsoftedge.github.io/Demos/json-dummy-data/"
          target="_blank"
          rel="noreferrer"
        >
          microsoftedge.github.io/Demos/json-dummy-data
        </a>
      </p>
      <p className="flex items-center gap-3">
        <a
          className="hover:underline"
          href="https://www.npmjs.com/package/fetchstream-js"
          target="_blank"
          rel="noreferrer"
        >
          npm
        </a>
        <a
          className="hover:underline"
          href="https://github.com/eklavya-raj/fetchstream-js"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </p>
    </footer>
  );
}
