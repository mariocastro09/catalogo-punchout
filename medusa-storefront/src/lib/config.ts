import { getLocaleHeader } from "@lib/util/get-locale-header"
import Medusa, { FetchArgs, FetchInput } from "@medusajs/js-sdk"

// The Medusa backend URL used for Server-Side Rendering (internal Docker network call).
// Falls back to the public URL if the internal one isn't set.
let MEDUSA_BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL ||
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  "http://localhost:9000"

// The publishable key is baked in at build time via NEXT_PUBLIC_*.
// During Docker build, Coolify may inject a placeholder or unresolved variable.
// We sanitise it here: strip any non-ASCII characters to prevent the SDK's
// initClient from throwing "Cannot convert argument to a ByteString" when it
// tries to set the HTTP header x-publishable-api-key.
const rawKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""
// eslint-disable-next-line no-control-regex
const publishableKey = rawKey.replace(/[^\x00-\x7F]/g, "")

export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  debug: process.env.NODE_ENV === "development",
  publishableKey: publishableKey || undefined,
})

const originalFetch = sdk.client.fetch.bind(sdk.client)

sdk.client.fetch = async <T>(
  input: FetchInput,
  init?: FetchArgs
): Promise<T> => {
  const headers = init?.headers ?? {}
  let localeHeader: Record<string, string | null> | undefined
  try {
    localeHeader = await getLocaleHeader()
    headers["x-medusa-locale"] ??= localeHeader["x-medusa-locale"]
  } catch { }

  const newHeaders = {
    ...localeHeader,
    ...headers,
  }
  init = {
    ...init,
    headers: newHeaders,
  }
  return originalFetch(input, init)
}
