import LocalizedClientLink from "@modules/common/components/localized-client-link"

// Inline SVGs — no external icon dependency needed
const RocketIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-3"
  >
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </svg>
)

const ArrowRightIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className ?? "size-4"}
  >
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
)

export default function Hero() {
  return (
    <section className="mx-auto w-full max-w-5xl relative">
      {/* Top radial gradient shade */}
      <div
        aria-hidden="true"
        className="absolute inset-0 isolate hidden overflow-hidden contain-strict lg:block pointer-events-none"
      >
        <div className="absolute inset-0 -top-14 isolate -z-10 bg-[radial-gradient(35%_80%_at_49%_0%,rgba(99,102,241,0.12),transparent)] contain-strict" />
      </div>

      {/* Outer vertical faded borders (desktop only) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 mx-auto hidden min-h-screen w-full max-w-5xl lg:block pointer-events-none"
      >
        <div className="absolute inset-y-0 left-0 z-10 h-full w-px bg-gradient-to-b from-transparent via-white/15 to-transparent" />
        <div className="absolute inset-y-0 right-0 z-10 h-full w-px bg-gradient-to-b from-transparent via-white/15 to-transparent" />
      </div>

      {/* Main content */}
      <div className="relative flex flex-col items-center justify-center gap-5 pt-32 pb-28">
        {/* Inner vertical faded borders */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 size-full overflow-hidden pointer-events-none"
        >
          <div className="absolute inset-y-0 left-4 w-px bg-gradient-to-b from-transparent via-white/10 to-white/10 md:left-8" />
          <div className="absolute inset-y-0 right-4 w-px bg-gradient-to-b from-transparent via-white/10 to-white/10 md:right-8" />
          <div className="absolute inset-y-0 left-8 w-px bg-gradient-to-b from-transparent via-white/5 to-white/5 md:left-12" />
          <div className="absolute inset-y-0 right-8 w-px bg-gradient-to-b from-transparent via-white/5 to-white/5 md:right-12" />
        </div>

        {/* Announcement badge */}
        <a
          href="/store"
          className="group mx-auto flex w-fit items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-1 shadow backdrop-blur-sm
            animate-in fade-in slide-in-from-bottom-10 fill-mode-backwards transition-all delay-500 duration-500 ease-out
            hover:border-indigo-500/40 hover:bg-indigo-500/10"
        >
          <span className="text-indigo-400">
            <RocketIcon />
          </span>
          <span className="text-xs text-zinc-300">B2B Punchout ready</span>
          <span className="block h-5 border-l border-white/10" />
          <span className="text-zinc-400 transition-transform duration-150 ease-out group-hover:translate-x-1">
            <ArrowRightIcon className="size-3" />
          </span>
        </a>

        {/* Headline */}
        <h1
          className="animate-in fade-in slide-in-from-bottom-10 fill-mode-backwards text-balance text-center text-4xl tracking-tight delay-100 duration-500 ease-out md:text-5xl lg:text-6xl
            text-white font-semibold [text-shadow:0_0px_50px_rgba(99,102,241,0.25)]"
        >
          Your B2B Catalog,{" "}
          <span className="text-indigo-400">Ready to Punch Out</span>
        </h1>

        {/* Subtitle */}
        <p className="animate-in fade-in slide-in-from-bottom-10 mx-auto max-w-md fill-mode-backwards text-center text-base text-zinc-400 tracking-wide delay-200 duration-500 ease-out sm:text-lg">
          Connect your eProcurement system to a fully negotiated catalog — instant
          SSO, live pricing, and cXML/OCI support out of the box.
        </p>

        {/* CTAs */}
        <div className="animate-in fade-in slide-in-from-bottom-10 flex flex-row flex-wrap items-center justify-center gap-3 fill-mode-backwards pt-2 delay-300 duration-500 ease-out">
          <LocalizedClientLink
            href="/store"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-zinc-200 backdrop-blur-sm
              hover:bg-white/10 hover:border-white/20 transition-all duration-200"
          >
            Browse Catalog
          </LocalizedClientLink>

          <LocalizedClientLink
            href="/account"
            className="group inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20
              hover:bg-indigo-500 transition-all duration-200"
          >
            Get Started
            <ArrowRightIcon className="size-4 transition-transform duration-150 ease-out group-hover:translate-x-1" />
          </LocalizedClientLink>
        </div>
      </div>
    </section>
  )
}
