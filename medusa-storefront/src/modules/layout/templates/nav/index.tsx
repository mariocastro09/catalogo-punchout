import { Suspense } from "react"

import { listRegions } from "@lib/data/regions"
import { listLocales } from "@lib/data/locales"
import { getLocale } from "@lib/data/locale-actions"
import { StoreRegion } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButton from "@modules/layout/components/cart-button"
import SideMenu from "@modules/layout/components/side-menu"

export default async function Nav() {
  const [regions, locales, currentLocale] = await Promise.all([
    listRegions().then((regions: StoreRegion[]) => regions),
    listLocales(),
    getLocale(),
  ])

  return (
    <div className="sticky top-0 inset-x-0 z-50">
      <header
        className="relative h-16 mx-auto border-b duration-200
          bg-black/70 backdrop-blur-lg border-white/10 shadow-md"
      >
        <nav
          className="content-container txt-xsmall-plus text-zinc-400 flex items-center
            justify-between w-full h-full text-small-regular"
        >
          {/* Left — hamburger menu */}
          <div className="flex-1 basis-0 h-full flex items-center">
            <div className="h-full">
              <SideMenu
                regions={regions}
                locales={locales}
                currentLocale={currentLocale}
              />
            </div>
          </div>

          {/* Center — brand */}
          <div className="flex items-center h-full">
            <LocalizedClientLink
              href="/"
              className="text-sm font-semibold tracking-widest uppercase
                text-white hover:text-accent transition-colors duration-200"
              data-testid="nav-store-link"
            >
              Punchout Catalog
            </LocalizedClientLink>
          </div>

          {/* Right — account + cart */}
          <div className="flex items-center gap-x-6 h-full flex-1 basis-0 justify-end">
            <div className="hidden small:flex items-center gap-x-6 h-full">
              <LocalizedClientLink
                className="text-zinc-400 hover:text-white transition-colors duration-200 text-sm"
                href="/account"
                data-testid="nav-account-link"
              >
                Account
              </LocalizedClientLink>
            </div>
            <Suspense
              fallback={
                <LocalizedClientLink
                  className="text-zinc-400 hover:text-white transition-colors duration-200 flex gap-2 text-sm"
                  href="/cart"
                  data-testid="nav-cart-link"
                >
                  Cart (0)
                </LocalizedClientLink>
              }
            >
              <CartButton />
            </Suspense>
          </div>
        </nav>
      </header>
    </div>
  )
}
