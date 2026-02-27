import { listCategories } from "@lib/data/categories"
import { listCollections } from "@lib/data/collections"
import { Text, clx } from "@medusajs/ui"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import MedusaCTA from "@modules/layout/components/medusa-cta"

export default async function Footer() {
  const { collections } = await listCollections({
    fields: "*products",
  })
  const productCategories = await listCategories()

  return (
    <footer className="bg-zinc-950 border-t border-white/8 w-full">
      <div className="content-container flex flex-col w-full">
        {/* Main links */}
        <div className="flex flex-col gap-y-8 xsmall:flex-row items-start justify-between py-20">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <LocalizedClientLink
              href="/"
              className="text-sm font-semibold tracking-widest uppercase text-white hover:text-accent transition-colors"
            >
              Punchout Catalog
            </LocalizedClientLink>
            <p className="text-xs text-zinc-600 max-w-[200px] leading-relaxed">
              Enterprise B2B procurement, simplified.
            </p>
          </div>

          {/* Link columns */}
          <div className="text-small-regular gap-8 md:gap-x-16 grid grid-cols-2 sm:grid-cols-3">
            {productCategories && productCategories?.length > 0 && (
              <div className="flex flex-col gap-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Categories
                </span>
                <ul
                  className="grid grid-cols-1 gap-2"
                  data-testid="footer-categories"
                >
                  {productCategories?.slice(0, 6).map((c) => {
                    if (c.parent_category) return null

                    const children =
                      c.category_children?.map((child) => ({
                        name: child.name,
                        handle: child.handle,
                        id: child.id,
                      })) || null

                    return (
                      <li
                        className="flex flex-col gap-2 text-zinc-500"
                        key={c.id}
                      >
                        <LocalizedClientLink
                          className={clx(
                            "hover:text-white transition-colors duration-200 text-xs",
                            children && "font-medium text-zinc-400"
                          )}
                          href={`/categories/${c.handle}`}
                          data-testid="category-link"
                        >
                          {c.name}
                        </LocalizedClientLink>
                        {children && (
                          <ul className="grid grid-cols-1 ml-3 gap-1.5">
                            {children.map((child) => (
                              <li key={child.id}>
                                <LocalizedClientLink
                                  className="hover:text-white transition-colors duration-200 text-xs text-zinc-600"
                                  href={`/categories/${child.handle}`}
                                  data-testid="category-link"
                                >
                                  {child.name}
                                </LocalizedClientLink>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {collections && collections.length > 0 && (
              <div className="flex flex-col gap-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Collections
                </span>
                <ul
                  className={clx("grid grid-cols-1 gap-2 text-zinc-500", {
                    "grid-cols-2": (collections?.length || 0) > 3,
                  })}
                >
                  {collections?.slice(0, 6).map((c) => (
                    <li key={c.id}>
                      <LocalizedClientLink
                        className="hover:text-white transition-colors duration-200 text-xs"
                        href={`/collections/${c.handle}`}
                      >
                        {c.title}
                      </LocalizedClientLink>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Platform
              </span>
              <ul className="grid grid-cols-1 gap-y-2 text-zinc-500">
                <li>
                  <a
                    href="https://github.com/medusajs"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white transition-colors duration-200 text-xs"
                  >
                    GitHub
                  </a>
                </li>
                <li>
                  <a
                    href="https://docs.medusajs.com"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white transition-colors duration-200 text-xs"
                  >
                    Documentation
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/medusajs/nextjs-starter-medusa"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white transition-colors duration-200 text-xs"
                  >
                    Source code
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex w-full mb-10 py-5 border-t border-white/5 justify-between items-center">
          <Text className="txt-compact-small text-zinc-600">
            © {new Date().getFullYear()} Punchout Catalog. All rights reserved.
          </Text>
          <MedusaCTA />
        </div>
      </div>
    </footer>
  )
}
