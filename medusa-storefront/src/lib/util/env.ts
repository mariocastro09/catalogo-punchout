export const getBaseURL = () => {
  const url = process.env.NEXT_PUBLIC_BASE_URL || "https://localhost:8000"
  // Coolify may pass SERVICE_FQDN_* without protocol at build time (e.g. "tienda.smartpaws.cl").
  // new URL() requires a full URL with scheme — add https:// if missing.
  if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
    return `https://${url}`
  }
  return url
}
