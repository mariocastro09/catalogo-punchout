import { Text } from "@medusajs/ui"
import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "../thumbnail"
import PreviewPrice from "./price"

export default async function ProductPreview({
  product,
  isFeatured,
  region,
}: {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  region: HttpTypes.StoreRegion
}) {
  const { cheapestPrice } = getProductPrice({ product })

  return (
    <LocalizedClientLink href={`/products/${product.handle}`} className="group">
      <div
        data-testid="product-wrapper"
        className="flex flex-col rounded-xl bg-zinc-900 border border-white/8 overflow-hidden
          transition-all duration-300 hover:-translate-y-1 hover:shadow-xl
          hover:shadow-indigo-900/20 hover:border-white/15"
      >
        {/* Thumbnail */}
        <div className="overflow-hidden">
          <Thumbnail
            thumbnail={product.thumbnail}
            images={product.images}
            size="full"
            isFeatured={isFeatured}
            className="!rounded-none border-0 transition-transform duration-500 group-hover:scale-105"
          />
        </div>

        {/* Info bar */}
        <div className="px-4 py-3 flex items-center justify-between gap-x-2">
          <Text
            className="text-sm font-medium text-zinc-200 truncate"
            data-testid="product-title"
          >
            {product.title}
          </Text>
          <div className="flex items-center gap-x-2 shrink-0">
            {cheapestPrice && (
              <span className="text-xs font-semibold text-indigo-400">
                <PreviewPrice price={cheapestPrice} />
              </span>
            )}
          </div>
        </div>
      </div>
    </LocalizedClientLink>
  )
}
