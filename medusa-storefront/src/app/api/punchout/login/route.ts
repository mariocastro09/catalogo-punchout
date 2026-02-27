import { NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET || "supersecret"

// ── Public-facing storefront URL ─────────────────────────────────────────────
// NEXT_PUBLIC_BASE_URL is set to http://localhost:8002 in .env.local and
// docker-compose. We MUST NOT use request.nextUrl.origin here because inside
// the Docker container the Host header resolves to localhost:8000 (the internal
// container port), not localhost:8002 (the external browser-facing port).
const STOREFRONT_BASE_URL =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.STOREFRONT_URL ||
    "http://localhost:8002"

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get("token")

    const baseUrl = STOREFRONT_BASE_URL

    if (!token) {
        return NextResponse.redirect(new URL("/store", baseUrl))
    }

    try {
        // 1. Verify the short-lived Punchout JWT signed by FastAPI
        const decoded = jwt.verify(token, JWT_SECRET) as {
            b2b_company_id: string
            medusa_jwt?: string      // Real Medusa Bearer token (may be absent on errors)
            session_id?: string
            sku?: string
            browser_form_post_url?: string
        }

        const b2bCompanyId = decoded.b2b_company_id
        const medusaToken = decoded.medusa_jwt
        const sku = decoded.sku

        console.log(`[Punchout] B2B session established. Company: ${b2bCompanyId}`)

        // 2. Determine redirect target — no country prefix, middleware handles it
        // The Next.js middleware.ts auto-prepends the correct country code (e.g. /cl/)
        let targetPath = "/store"
        if (sku) {
            console.log(`[Punchout] Deep Link Level 2 → routing to SKU ${sku}`)
            targetPath = `/store` // Fallback to store; PDP needs a valid product handle
            // For a proper PDP deep link, use: targetPath = `/es/products/${sku}`
            // This requires the sku to be a valid Medusa product handle, not a variant ID.
        }

        const response = NextResponse.redirect(new URL(targetPath, baseUrl))

        // 3. Set the real Medusa session cookie (_medusa_jwt)
        //    This is the exact cookie that getAuthHeaders() in cookies.ts reads.
        //    Setting it here makes the browser fully authenticated with the Medusa backend.
        if (medusaToken) {
            response.cookies.set("_medusa_jwt", medusaToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 60 * 60 * 24 * 7, // 7 days (matches normal login TTL)
                path: "/",
            })
            console.log(`[Punchout] _medusa_jwt cookie set for ${b2bCompanyId}`)
        } else {
            console.warn(`[Punchout] No Medusa JWT in token — user will browse anonymously`)
        }

        // 4. Set the Punchout-specific tracking cookies
        response.cookies.set("_punchout_b2b_company", b2bCompanyId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24, // 24 hours
            path: "/",
        })

        if (decoded.session_id) {
            response.cookies.set("_punchout_session_id", decoded.session_id, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 60 * 60 * 24,
                path: "/",
            })
        }

        if (decoded.browser_form_post_url) {
            // Store the return URL so the "Transfer Cart" button knows where to POST
            response.cookies.set("_punchout_return_url", decoded.browser_form_post_url, {
                httpOnly: false, // needs to be readable by client-side cart JS
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 60 * 60 * 24,
                path: "/",
            })
        }

        return response

    } catch (error) {
        console.error("[Punchout] Token verification failed:", error)
        // Invalid or expired token → send to store anonymously
        return NextResponse.redirect(new URL("/store", baseUrl))
    }
}
