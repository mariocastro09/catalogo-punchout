import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import "styles/globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
  title: {
    default: "Punchout Catalog",
    template: "%s | Punchout Catalog",
  },
  description:
    "B2B Punchout-Ready Catalog — negotiated pricing, cXML/OCI integration, seamless SSO.",
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#09090b] text-zinc-100 antialiased">
        <main className="relative">{props.children}</main>
      </body>
    </html>
  )
}
