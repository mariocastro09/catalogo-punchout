"use client"

import { Popover, PopoverPanel, Transition } from "@headlessui/react"
import { ArrowRightMini, XMark } from "@medusajs/icons"
import { Text, clx, useToggleState } from "@medusajs/ui"
import { Fragment } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CountrySelect from "../country-select"
import LanguageSelect from "../language-select"
import { HttpTypes } from "@medusajs/types"
import { Locale } from "@lib/data/locales"

const SideMenuItems = {
  Home: "/",
  Store: "/store",
  Account: "/account",
  Cart: "/cart",
}

type SideMenuProps = {
  regions: HttpTypes.StoreRegion[] | null
  locales: Locale[] | null
  currentLocale: string | null
}

const SideMenu = ({ regions, locales, currentLocale }: SideMenuProps) => {
  const countryToggleState = useToggleState()
  const languageToggleState = useToggleState()

  return (
    <div className="h-full">
      <div className="flex items-center h-full">
        <Popover className="h-full flex">
          {({ open, close }) => (
            <>
              <div className="relative flex h-full">
                <Popover.Button
                  data-testid="nav-menu-button"
                  className="relative h-full flex items-center gap-1.5 text-sm text-zinc-400
                    hover:text-white transition-colors duration-200 focus:outline-none"
                >
                  <span className="sr-only">Open menu</span>
                  {/* Hamburger icon */}
                  <span className="flex flex-col gap-[5px] w-5">
                    <span
                      className={clx(
                        "block h-px bg-current transition-all duration-300 origin-center",
                        open ? "rotate-45 translate-y-[6px]" : ""
                      )}
                    />
                    <span
                      className={clx(
                        "block h-px bg-current transition-all duration-300",
                        open ? "opacity-0" : ""
                      )}
                    />
                    <span
                      className={clx(
                        "block h-px bg-current transition-all duration-300 origin-center",
                        open ? "-rotate-45 -translate-y-[6px]" : ""
                      )}
                    />
                  </span>
                  Menu
                </Popover.Button>
              </div>

              {open && (
                <div
                  className="fixed inset-0 z-[50] bg-black/30 backdrop-blur-sm pointer-events-auto"
                  onClick={close}
                  data-testid="side-menu-backdrop"
                />
              )}

              <Transition
                show={open}
                as={Fragment}
                enter="transition ease-out duration-200"
                enterFrom="opacity-0 -translate-x-4"
                enterTo="opacity-100 translate-x-0"
                leave="transition ease-in duration-150"
                leaveFrom="opacity-100 translate-x-0"
                leaveTo="opacity-0 -translate-x-4"
              >
                <PopoverPanel
                  className="flex flex-col absolute w-full pr-4 sm:pr-0 sm:w-[320px]
                    h-[calc(100vh-1rem)] z-[51] inset-x-0 m-2"
                >
                  <div
                    data-testid="nav-menu-popup"
                    className="flex flex-col h-full bg-zinc-950/95 backdrop-blur-2xl
                      border border-white/10 rounded-xl shadow-2xl justify-between p-6"
                  >
                    {/* Top — close */}
                    <div className="flex justify-between items-center mb-8">
                      <span className="text-xs font-semibold tracking-widest uppercase text-zinc-500">
                        Navigation
                      </span>
                      <button
                        data-testid="close-menu-button"
                        onClick={close}
                        className="text-zinc-500 hover:text-white transition-colors p-1 rounded-lg
                          hover:bg-white/10"
                      >
                        <XMark />
                      </button>
                    </div>

                    {/* Nav links */}
                    <ul className="flex flex-col gap-1 items-start justify-start flex-1">
                      {Object.entries(SideMenuItems).map(([name, href]) => (
                        <li key={name} className="w-full">
                          <LocalizedClientLink
                            href={href}
                            className="group flex items-center gap-3 text-2xl font-medium text-zinc-300
                              hover:text-white transition-colors duration-200 py-2 px-3 rounded-lg
                              hover:bg-white/5 w-full"
                            onClick={close}
                            data-testid={`${name.toLowerCase()}-link`}
                          >
                            <span
                              className="w-1 h-6 rounded-full bg-accent opacity-0 group-hover:opacity-100
                                transition-opacity duration-200"
                            />
                            {name}
                          </LocalizedClientLink>
                        </li>
                      ))}
                    </ul>

                    {/* Bottom — locale + copyright */}
                    <div className="flex flex-col gap-y-4 border-t border-white/10 pt-6">
                      {!!locales?.length && (
                        <div
                          className="flex justify-between items-center"
                          onMouseEnter={languageToggleState.open}
                          onMouseLeave={languageToggleState.close}
                        >
                          <LanguageSelect
                            toggleState={languageToggleState}
                            locales={locales}
                            currentLocale={currentLocale}
                          />
                          <ArrowRightMini
                            className={clx(
                              "transition-transform duration-150 text-zinc-500",
                              languageToggleState.state ? "-rotate-90" : ""
                            )}
                          />
                        </div>
                      )}
                      <div
                        className="flex justify-between items-center"
                        onMouseEnter={countryToggleState.open}
                        onMouseLeave={countryToggleState.close}
                      >
                        {regions && (
                          <CountrySelect
                            toggleState={countryToggleState}
                            regions={regions}
                          />
                        )}
                        <ArrowRightMini
                          className={clx(
                            "transition-transform duration-150 text-zinc-500",
                            countryToggleState.state ? "-rotate-90" : ""
                          )}
                        />
                      </div>
                      <Text className="txt-compact-small text-zinc-600">
                        © {new Date().getFullYear()} Punchout Catalog. All rights
                        reserved.
                      </Text>
                    </div>
                  </div>
                </PopoverPanel>
              </Transition>
            </>
          )}
        </Popover>
      </div>
    </div>
  )
}

export default SideMenu
