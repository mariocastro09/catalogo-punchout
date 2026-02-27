const checkEnvVariables = require("./check-env-variables")

checkEnvVariables()

/**
 * Medusa Cloud-related environment variables
 */
const S3_HOSTNAME = process.env.MEDUSA_CLOUD_S3_HOSTNAME
const S3_PATHNAME = process.env.MEDUSA_CLOUD_S3_PATHNAME

const MEDUSA_INTERNAL_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Proxy Medusa file uploads so the Next.js image optimizer can reach them
  // from inside Docker (localhost:9000 from storefront → medusa:9000 internally)
  async rewrites() {
    return [
      {
        source: "/uploads/:path*",
        destination: `${MEDUSA_INTERNAL_URL}/uploads/:path*`,
      },
      {
        source: "/static/:path*",
        destination: `${MEDUSA_INTERNAL_URL}/static/:path*`,
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        // Allow the storefront's own origin (rewrites make /uploads served here)
        protocol: "http",
        hostname: "punchout-storefront",
      },
      {
        protocol: "https",
        hostname: "medusa-public-images.s3.eu-west-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.us-east-1.amazonaws.com",
      },
      // Fallback placeholder used by seed helper when image download fails
      { protocol: "https", hostname: "placehold.co" },
      ...(S3_HOSTNAME && S3_PATHNAME
        ? [
          {
            protocol: "https",
            hostname: S3_HOSTNAME,
            pathname: S3_PATHNAME,
          },
        ]
        : []),
    ],
  },
}

module.exports = nextConfig
