import { Text } from "@medusajs/ui"

import Medusa from "../../../common/icons/medusa"
import NextJs from "../../../common/icons/nextjs"

const MedusaCTA = () => {
  return (
    <Text className="flex gap-x-2 txt-compact-small-plus items-center text-zinc-600">
      Powered by
      <a href="https://www.medusajs.com" target="_blank" rel="noreferrer" className="hover:opacity-80 transition-opacity">
        <Medusa fill="#52525b" className="fill-[#52525b]" />
      </a>
      &
      <a href="https://nextjs.org" target="_blank" rel="noreferrer" className="hover:opacity-80 transition-opacity">
        <NextJs fill="#52525b" />
      </a>
    </Text>
  )
}

export default MedusaCTA
