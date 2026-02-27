/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Punchout Catalog — Chile Hardware Store Seed Data
 *  Region: América / Chile  |  Currency: CLP (Peso Chileno)
 *  Products: Realistic B2B hardware/industrial supplies
 *  Price Lists: B2B Bulk Buyer (15% off) + B2B Premium (20% off)
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { CreateInventoryLevelInput, ExecArgs, IFileModuleService } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  PriceListStatus,
  PriceListType,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createPriceListsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresStep,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";
import { ApiKey } from "../../.medusa/types/query-entry-points";

// ─── Helper: update store currencies ────────────────────────────────────────
const updateStoreCurrencies = createWorkflow(
  "update-store-currencies",
  (input: {
    supported_currencies: { currency_code: string; is_default?: boolean }[];
    store_id: string;
  }) => {
    const normalizedInput = transform({ input }, (data) => ({
      selector: { id: data.input.store_id },
      update: {
        supported_currencies: data.input.supported_currencies.map((c) => ({
          currency_code: c.currency_code,
          is_default: c.is_default ?? false,
        })),
      },
    }));
    const stores = updateStoresStep(normalizedInput);
    return new WorkflowResponse(stores);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ─── Helper: download a remote image and upload it to Medusa file storage ────
async function downloadAndUpload(
  fileService: IFileModuleService,
  url: string,
  filename: string
): Promise<string> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const mimeType = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    const [file] = await fileService.createFiles([{
      filename,
      mimeType,
      content: buffer.toString("base64"),
    }]);
    return file.url;
  } catch (err) {
    // If download fails (e.g. link is dead), fall back to a neutral placeholder
    return `https://placehold.co/700x700/1a1a2e/ffffff?text=${encodeURIComponent(filename.replace(/\.[^.]+$/, ""))}`;
  }
}

// ── 0. Admin User ──────────────────────────────────────────────────────────
import {
  createUserAccountWorkflow,
} from "@medusajs/medusa/core-flows";



export default async function seedChileHardwareData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fileModuleService: IFileModuleService = container.resolve(Modules.FILE);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const storeModuleService = container.resolve(Modules.STORE);
  logger.info("👤  Seeding admin user...");
  const authModuleService = container.resolve(Modules.AUTH);
  const { authIdentity, error } = await authModuleService.register("emailpass", {
    body: {
      email: "admin@punchout.cl",
      password: "supersecret",
    },
  } as any);

  if (error) {
    logger.error("Failed to create auth identity:");
    logger.error(error);
  }

  const { result: user } = await createUserAccountWorkflow(container).run({
    input: {
      userData: {
        email: "admin@punchout.cl",
        first_name: "Admin",
        last_name: "Punchout",
      },
      authIdentityId: authIdentity!.id,
    },
  });
  logger.info(`✅  Admin user created: ${user.email}`);

  // Countries in América region (Chile is the main B2B market)
  const americaCountries = ["cl", "ar", "pe", "co", "mx", "br"];

  // ── 1. Store & Sales Channel ───────────────────────────────────────────────
  logger.info("🏪  Seeding store and sales channel...");
  const [store] = await storeModuleService.listStores();

  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Canal de Ventas Hardware",
  });

  if (!defaultSalesChannel.length) {
    const { result: scResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [{ name: "Canal de Ventas Hardware" }],
      },
    });
    defaultSalesChannel = scResult;
  }

  // Add CLP, USD as supported currencies; CLP is default
  await updateStoreCurrencies(container).run({
    input: {
      store_id: store.id,
      supported_currencies: [
        { currency_code: "clp", is_default: true },
        { currency_code: "usd" },
      ],
    },
  });

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: { default_sales_channel_id: defaultSalesChannel[0].id },
    },
  });

  // ── 2. América Region with CLP ─────────────────────────────────────────────
  logger.info("🌎  Seeding América region (CLP)...");
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "América",
          currency_code: "clp",
          countries: americaCountries,
          payment_providers: ["pp_system_default"],
        },
      ],
    },
  });
  const region = regionResult[0];
  logger.info("✅  América region created.");

  // ── 3. Tax Regions ─────────────────────────────────────────────────────────
  logger.info("🧾  Seeding tax regions...");
  await createTaxRegionsWorkflow(container).run({
    input: americaCountries.map((country_code) => ({
      country_code,
      provider_id: "tp_system",
    })),
  });
  logger.info("✅  Tax regions seeded.");

  // ── 4. Stock Location (Santiago de Chile) ─────────────────────────────────
  logger.info("🏭  Seeding stock location (Santiago, CL)...");
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "Bodega Santiago",
          address: {
            city: "Santiago",
            country_code: "CL",
            address_1: "Av. Vicuña Mackenna 4860, Macul",
          },
        },
      ],
    },
  });
  const stockLocation = stockLocationResult[0];

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: { default_location_id: stockLocation.id },
    },
  });

  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
  });
  logger.info("✅  Stock location created.");

  // ── 5. Fulfillment & Shipping ──────────────────────────────────────────────
  logger.info("🚚  Seeding fulfillment and shipping...");
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  });
  let shippingProfile = shippingProfiles.length ? shippingProfiles[0] : null;

  if (!shippingProfile) {
    const { result: spResult } = await createShippingProfilesWorkflow(
      container
    ).run({
      input: { data: [{ name: "Perfil de Envío Estándar", type: "default" }] },
    });
    shippingProfile = spResult[0];
  }

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "Despacho Nacional Chile",
    type: "shipping",
    service_zones: [
      {
        name: "Chile",
        geo_zones: americaCountries.map((code) => ({
          country_code: code,
          type: "country" as const,
        })),
      },
    ],
  });

  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
  });

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Despacho Estándar (3-5 días)",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: { label: "Estándar", description: "Despacho en 3-5 días hábiles.", code: "standard" },
        prices: [
          { currency_code: "clp", amount: 5990 },
          { currency_code: "usd", amount: 7 },
          { region_id: region.id, amount: 5990 },
        ],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
      {
        name: "Despacho Express (24 hrs)",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: { label: "Express", description: "Despacho al día siguiente hábil.", code: "express" },
        prices: [
          { currency_code: "clp", amount: 9990 },
          { currency_code: "usd", amount: 12 },
          { region_id: region.id, amount: 9990 },
        ],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
      {
        name: "Retiro en Bodega (Gratis)",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: { label: "Retiro", description: "Retiro en Bodega Santiago.", code: "pickup" },
        prices: [
          { currency_code: "clp", amount: 0 },
          { currency_code: "usd", amount: 0 },
          { region_id: region.id, amount: 0 },
        ],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
    ],
  });
  logger.info("✅  Shipping options created.");

  // ── 6. Publishable API Key ─────────────────────────────────────────────────
  logger.info("🔑  Seeding publishable API key...");
  let publishableApiKey: ApiKey | null = null;
  const { data: existingKeys } = await query.graph({
    entity: "api_key",
    fields: ["id", "token"],
    filters: { type: "publishable" },
  });
  publishableApiKey = existingKeys?.[0] ?? null;

  if (!publishableApiKey) {
    const { result: [keyResult] } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [{ title: "Hardware Webshop", type: "publishable", created_by: "" }],
      },
    });
    publishableApiKey = keyResult as ApiKey;
  }

  // Fetch current sales channels on the key so we can remove any auto-linked ones.
  // Medusa auto-links "Default Sales Channel" to its default publishable key at migration time.
  // Having >1 sales channel on a key causes a 400 "inventory cannot be calculated" error.
  const { data: currentKeyData } = await query.graph({
    entity: "api_key",
    fields: ["id", "sales_channels.id"],
    filters: { id: publishableApiKey.id },
  });
  const existingScIds: string[] =
    (currentKeyData?.[0] as any)?.sales_channels?.map((sc: any) => sc.id) ?? [];
  const toRemove = existingScIds.filter((id) => id !== defaultSalesChannel[0].id);

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel[0].id],
      remove: toRemove,
    },
  });

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: { id: stockLocation.id, add: [defaultSalesChannel[0].id] },
  });
  logger.info(`✅  Publishable API Key: ${publishableApiKey.token}`);

  // ── 7. Product Categories ─────────────────────────────────────────────────
  logger.info("📦  Seeding product categories...");
  const { result: categoryResult } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        { name: "Herramientas Eléctricas", is_active: true },
        { name: "Herramientas Manuales", is_active: true },
        { name: "Seguridad Industrial", is_active: true },
        { name: "Fijaciones y Tornillería", is_active: true },
        { name: "Pinturas y Revestimientos", is_active: true },
        { name: "Materiales Eléctricos", is_active: true },
      ],
    },
  });

  const catId = (name: string) =>
    categoryResult.find((c) => c.name === name)!.id;

  const sc = [{ id: defaultSalesChannel[0].id }];

  // ── 8. Products w/ CLP Prices ─────────────────────────────────────────────
  logger.info("🖼️  Downloading and uploading product images...");
  const [
    imgTaladro,
    imgAmoladora,
    imgLlave,
    imgMartillo,
    imgCasco,
    imgGuantes,
    imgTornillo,
    imgPintura,
    imgCable,
    imgDisyuntor,
  ] = await Promise.all([
    downloadAndUpload(fileModuleService, "https://resources.bosch.com/media/global/en/products/category_pages/tools/blue/drills_and_screwdrivers/2607019577.jpg", "bosch-gsb13re.jpg"),
    downloadAndUpload(fileModuleService, "https://makita.cl/media/catalog/product/cache/1/image/700x700/17f82f742ffe127f42dca9de82fb58b3/9/5/9563cvr_1.jpg", "makita-ga4530.jpg"),
    downloadAndUpload(fileModuleService, "https://http2.mlstatic.com/D_NQ_NP_2X_943271-MLC48543073620_122021-F.webp", "ingco-llave-impacto.webp"),
    downloadAndUpload(fileModuleService, "https://www.stanley.com.ar/media/catalog/product/cache/1/image/9df78eab33525d08d6e5fb8d27136e95/5/1/51-032.jpg", "stanley-martillo-fatmax.jpg"),
    downloadAndUpload(fileModuleService, "https://multimedia.3m.com/mws/media/1032877O/3m-full-brim-hard-hat-h-802v.jpg", "3m-casco-h700.jpg"),
    downloadAndUpload(fileModuleService, "https://www.honeywellsafety.com/images/products/Cut5Glove.jpg", "honeywell-guantes-anticorte.jpg"),
    downloadAndUpload(fileModuleService, "https://www.hilti.cl/medias/sys_master/images/h1a/h52/9261778755614.jpg", "tornillo-hexagonal-m8.jpg"),
    downloadAndUpload(fileModuleService, "https://www.sherwin-williams.cl/media/catalog/product/cache/1/image/700x700/p/i/pintura.jpg", "sherwin-williams-anticorrosiva.jpg"),
    downloadAndUpload(fileModuleService, "https://www.madisa.cl/media/catalog/product/cache/1/image/700x700/cable_thhn.jpg", "cable-thhn-12awg.jpg"),
    downloadAndUpload(fileModuleService, "https://download.schneider-electric.com/files?p_Doc_Ref=S1N10638&p_enDocType=Image&p_File_Name=S1N10638.JPG", "schneider-acti9-2p.jpg"),
  ]);
  logger.info("✅  Product images uploaded to local file storage.");

  logger.info("🔧  Seeding hardware products...");
  const { result: productResult } = await createProductsWorkflow(
    container
  ).run({
    input: {
      products: [
        // ── Taladro Percutor Bosch ──────────────────────────────────────────
        {
          title: "Taladro Percutor Bosch GSB 13 RE",
          category_ids: [catId("Herramientas Eléctricas")],
          description:
            "Taladro percutor confiable con 600W, ideal para trabajo con hormigón, madera y metal. Sistema de 2 velocidades y empuñadura ergonómica.",
          handle: "taladro-percutor-bosch-gsb-13-re",
          weight: 1800,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{ url: imgTaladro }],
          options: [{ title: "Voltaje", values: ["220V"] }],
          variants: [
            {
              title: "220V",
              sku: "BOSCH-GSB13RE-220",
              options: { Voltaje: "220V" },
              prices: [
                { amount: 89990, currency_code: "clp" },
                { amount: 100, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: sc,
        },

        // ── Amoladora Angular Makita ─────────────────────────────────────────
        {
          title: "Amoladora Angular Makita GA4530",
          category_ids: [catId("Herramientas Eléctricas")],
          description:
            "Amoladora angular 115mm con motor de 720W. Protector ajustable, switch de seguridad y cabezal de engranajes en aluminio fundido para larga vida útil.",
          handle: "amoladora-angular-makita-ga4530",
          weight: 1600,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{ url: imgAmoladora }],
          options: [{ title: "Disco", values: ['115mm', '125mm'] }],
          variants: [
            {
              title: '115mm',
              sku: "MAKITA-GA4530-115",
              options: { Disco: '115mm' },
              prices: [
                { amount: 54990, currency_code: "clp" },
                { amount: 65, currency_code: "usd" },
              ],
            },
            {
              title: '125mm',
              sku: "MAKITA-GA4530-125",
              options: { Disco: '125mm' },
              prices: [
                { amount: 64990, currency_code: "clp" },
                { amount: 75, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: sc,
        },

        // ── Llave de Impacto Neumática ───────────────────────────────────────
        {
          title: "Llave de Impacto Neumática 1/2\" Ingco",
          category_ids: [catId("Herramientas Eléctricas")],
          description:
            "Llave de impacto neumática con 1/2\" de cuadrado de manejo. Torque máximo 680 Nm. Ideal para autopistas, mecánica pesada e industria.",
          handle: "llave-impacto-neumatica-ingco",
          weight: 2100,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{ url: imgLlave }],
          options: [{ title: "Tamaño", values: ['1/2"'] }],
          variants: [
            {
              title: '1/2"',
              sku: "INGCO-KEIW0008-12",
              options: { Tamaño: '1/2"' },
              prices: [
                { amount: 39990, currency_code: "clp" },
                { amount: 48, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: sc,
        },

        // ── Martillo Carpintero Stanley ──────────────────────────────────────
        {
          title: "Martillo Carpintero Stanley FatMax 450g",
          category_ids: [catId("Herramientas Manuales")],
          description:
            "Martillo de garra con mango de fibra de vidrio anti-vibración. Cabeza de acero forjado de 450g. Diseñado para clavado profesional de alto rendimiento.",
          handle: "martillo-stanley-fatmax-450g",
          weight: 620,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{ url: imgMartillo }],
          options: [{ title: "Peso", values: ["450g", "570g"] }],
          variants: [
            {
              title: "450g",
              sku: "STANLEY-FMHT51032-450",
              options: { Peso: "450g" },
              prices: [
                { amount: 29990, currency_code: "clp" },
                { amount: 35, currency_code: "usd" },
              ],
            },
            {
              title: "570g",
              sku: "STANLEY-FMHT51033-570",
              options: { Peso: "570g" },
              prices: [
                { amount: 34990, currency_code: "clp" },
                { amount: 42, currency_code: "usd" },
              ],
            },
          ],
          sales_channels: sc,
        },

        // ── Casco Seguridad 3M ───────────────────────────────────────────────
        {
          title: "Casco de Seguridad 3M H-700 Series",
          category_ids: [catId("Seguridad Industrial")],
          description:
            "Casco de seguridad clase E con ventilación superior. Suspensión de 4 puntos para mayor comodidad. Cumple norma ANSI Z89.1 y EN 397.",
          handle: "casco-seguridad-3m-h700",
          weight: 380,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{ url: imgCasco }],
          options: [{ title: "Color", values: ["Blanco", "Amarillo", "Azul", "Rojo"] }],
          variants: [
            { title: "Blanco", sku: "3M-H700-BL", options: { Color: "Blanco" }, prices: [{ amount: 12990, currency_code: "clp" }, { amount: 15, currency_code: "usd" }] },
            { title: "Amarillo", sku: "3M-H700-AM", options: { Color: "Amarillo" }, prices: [{ amount: 12990, currency_code: "clp" }, { amount: 15, currency_code: "usd" }] },
            { title: "Azul", sku: "3M-H700-AZ", options: { Color: "Azul" }, prices: [{ amount: 13990, currency_code: "clp" }, { amount: 17, currency_code: "usd" }] },
            { title: "Rojo", sku: "3M-H700-RO", options: { Color: "Rojo" }, prices: [{ amount: 13990, currency_code: "clp" }, { amount: 17, currency_code: "usd" }] },
          ],
          sales_channels: sc,
        },

        // ── Guantes Anticorte ────────────────────────────────────────────────
        {
          title: "Guantes Anticorte Nivel 5 Honeywell",
          category_ids: [catId("Seguridad Industrial")],
          description:
            "Guantes de protección contra cortes nivel 5 (EN 388). Recubrimiento poliuretano en palma, alta destreza. Ideales para manipulación de metales y vidrio.",
          handle: "guantes-anticorte-nivel5-honeywell",
          weight: 120,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{ url: imgGuantes }],
          options: [{ title: "Talla", values: ["S", "M", "L", "XL", "XXL"] }],
          variants: [
            { title: "S", sku: "HON-ANTICORTE-S", options: { Talla: "S" }, prices: [{ amount: 6990, currency_code: "clp" }, { amount: 8, currency_code: "usd" }] },
            { title: "M", sku: "HON-ANTICORTE-M", options: { Talla: "M" }, prices: [{ amount: 6990, currency_code: "clp" }, { amount: 8, currency_code: "usd" }] },
            { title: "L", sku: "HON-ANTICORTE-L", options: { Talla: "L" }, prices: [{ amount: 6990, currency_code: "clp" }, { amount: 8, currency_code: "usd" }] },
            { title: "XL", sku: "HON-ANTICORTE-XL", options: { Talla: "XL" }, prices: [{ amount: 6990, currency_code: "clp" }, { amount: 8, currency_code: "usd" }] },
            { title: "XXL", sku: "HON-ANTICORTE-XXL", options: { Talla: "XXL" }, prices: [{ amount: 7490, currency_code: "clp" }, { amount: 9, currency_code: "usd" }] },
          ],
          sales_channels: sc,
        },

        // ── Tornillos hexagonales galvanizados ──────────────────────────────
        {
          title: "Tornillo Hexagonal Galvanizado M8 (Caja 100 unid.)",
          category_ids: [catId("Fijaciones y Tornillería")],
          description:
            "Tornillos hexagonales de acero galvanizado grado 8.8. Alta resistencia a la corrosión, ideales para estructuras metálicas y construcción civil.",
          handle: "tornillo-hexagonal-galvanizado-m8",
          weight: 900,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{ url: imgTornillo }],
          options: [{ title: "Largo", values: ["25mm", "40mm", "60mm", "80mm"] }],
          variants: [
            { title: "M8 × 25mm", sku: "TORN-HEX-M8-25", options: { Largo: "25mm" }, prices: [{ amount: 4990, currency_code: "clp" }, { amount: 6, currency_code: "usd" }] },
            { title: "M8 × 40mm", sku: "TORN-HEX-M8-40", options: { Largo: "40mm" }, prices: [{ amount: 5990, currency_code: "clp" }, { amount: 7, currency_code: "usd" }] },
            { title: "M8 × 60mm", sku: "TORN-HEX-M8-60", options: { Largo: "60mm" }, prices: [{ amount: 6990, currency_code: "clp" }, { amount: 8, currency_code: "usd" }] },
            { title: "M8 × 80mm", sku: "TORN-HEX-M8-80", options: { Largo: "80mm" }, prices: [{ amount: 8490, currency_code: "clp" }, { amount: 10, currency_code: "usd" }] },
          ],
          sales_channels: sc,
        },

        // ── Pintura Anticorrosiva Sherwin-Williams ───────────────────────────
        {
          title: "Pintura Anticorrosiva Sherwin-Williams Pro Industrial",
          category_ids: [catId("Pinturas y Revestimientos")],
          description:
            "Esmalte anticorrosivo alquídico de alta adherencia. Excelente resistencia a la humedad y oxidación. Para superficies metálicas industriales.",
          handle: "pintura-anticorrosiva-sherwin-williams",
          weight: 4500,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{ url: imgPintura }],
          options: [
            { title: "Color", values: ["Gris Grafito", "Negro Mate", "Café Óxido"] },
            { title: "Tamaño", values: ["1 litro", "4 litros", "20 litros"] },
          ],
          variants: [
            { title: "Gris Grafito / 1L", sku: "SW-ANTICORR-GG-1L", options: { Color: "Gris Grafito", Tamaño: "1 litro" }, prices: [{ amount: 12990, currency_code: "clp" }, { amount: 15, currency_code: "usd" }] },
            { title: "Gris Grafito / 4L", sku: "SW-ANTICORR-GG-4L", options: { Color: "Gris Grafito", Tamaño: "4 litros" }, prices: [{ amount: 42990, currency_code: "clp" }, { amount: 51, currency_code: "usd" }] },
            { title: "Gris Grafito / 20L", sku: "SW-ANTICORR-GG-20L", options: { Color: "Gris Grafito", Tamaño: "20 litros" }, prices: [{ amount: 179990, currency_code: "clp" }, { amount: 215, currency_code: "usd" }] },
            { title: "Negro Mate / 1L", sku: "SW-ANTICORR-NM-1L", options: { Color: "Negro Mate", Tamaño: "1 litro" }, prices: [{ amount: 12990, currency_code: "clp" }, { amount: 15, currency_code: "usd" }] },
            { title: "Negro Mate / 4L", sku: "SW-ANTICORR-NM-4L", options: { Color: "Negro Mate", Tamaño: "4 litros" }, prices: [{ amount: 42990, currency_code: "clp" }, { amount: 51, currency_code: "usd" }] },
            { title: "Café Óxido / 4L", sku: "SW-ANTICORR-CO-4L", options: { Color: "Café Óxido", Tamaño: "4 litros" }, prices: [{ amount: 44990, currency_code: "clp" }, { amount: 54, currency_code: "usd" }] },
          ],
          sales_channels: sc,
        },

        // ── Cable Eléctrico THHN ─────────────────────────────────────────────
        {
          title: "Cable Eléctrico THHN 12 AWG (Rollo 100m)",
          category_ids: [catId("Materiales Eléctricos")],
          description:
            "Cable de cobre THHN/THWN-2, calibre 12 AWG. Temperatura máxima 90°C. Apto para instalaciones residenciales e industriales bajo norma IEC 60227.",
          handle: "cable-electrico-thhn-12awg-100m",
          weight: 3800,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{ url: imgCable }],
          options: [{ title: "Color", values: ["Negro", "Rojo", "Blanco", "Verde/Amarillo (Tierra)"] }],
          variants: [
            { title: "Negro", sku: "CABLE-THHN12-NEG", options: { Color: "Negro" }, prices: [{ amount: 34990, currency_code: "clp" }, { amount: 42, currency_code: "usd" }] },
            { title: "Rojo", sku: "CABLE-THHN12-ROJ", options: { Color: "Rojo" }, prices: [{ amount: 34990, currency_code: "clp" }, { amount: 42, currency_code: "usd" }] },
            { title: "Blanco", sku: "CABLE-THHN12-BLA", options: { Color: "Blanco" }, prices: [{ amount: 34990, currency_code: "clp" }, { amount: 42, currency_code: "usd" }] },
            { title: "Verde/Amarillo (Tierra)", sku: "CABLE-THHN12-TIE", options: { Color: "Verde/Amarillo (Tierra)" }, prices: [{ amount: 35990, currency_code: "clp" }, { amount: 43, currency_code: "usd" }] },
          ],
          sales_channels: sc,
        },

        // ── Disyuntor Termomagnético Schneider ──────────────────────────────
        {
          title: "Disyuntor Termomagnético Schneider Acti9 2P",
          category_ids: [catId("Materiales Eléctricos")],
          description:
            "Disyuntor termomagnético bipolar Schneider Acti9 iC60N. Alta capacidad de ruptura 6kA. Para instalaciones industriales y residenciales. Certificado IEC 60947.",
          handle: "disyuntor-schneider-acti9-2p",
          weight: 350,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{ url: imgDisyuntor }],
          options: [{ title: "Amperaje", values: ["10A", "16A", "20A", "25A", "32A", "40A", "50A", "63A"] }],
          variants: [
            { title: "10A", sku: "SCHN-ACTI9-2P-10A", options: { Amperaje: "10A" }, prices: [{ amount: 14990, currency_code: "clp" }, { amount: 18, currency_code: "usd" }] },
            { title: "16A", sku: "SCHN-ACTI9-2P-16A", options: { Amperaje: "16A" }, prices: [{ amount: 14990, currency_code: "clp" }, { amount: 18, currency_code: "usd" }] },
            { title: "20A", sku: "SCHN-ACTI9-2P-20A", options: { Amperaje: "20A" }, prices: [{ amount: 15990, currency_code: "clp" }, { amount: 19, currency_code: "usd" }] },
            { title: "25A", sku: "SCHN-ACTI9-2P-25A", options: { Amperaje: "25A" }, prices: [{ amount: 16990, currency_code: "clp" }, { amount: 20, currency_code: "usd" }] },
            { title: "32A", sku: "SCHN-ACTI9-2P-32A", options: { Amperaje: "32A" }, prices: [{ amount: 17990, currency_code: "clp" }, { amount: 21, currency_code: "usd" }] },
            { title: "40A", sku: "SCHN-ACTI9-2P-40A", options: { Amperaje: "40A" }, prices: [{ amount: 19990, currency_code: "clp" }, { amount: 24, currency_code: "usd" }] },
            { title: "50A", sku: "SCHN-ACTI9-2P-50A", options: { Amperaje: "50A" }, prices: [{ amount: 22990, currency_code: "clp" }, { amount: 27, currency_code: "usd" }] },
            { title: "63A", sku: "SCHN-ACTI9-2P-63A", options: { Amperaje: "63A" }, prices: [{ amount: 25990, currency_code: "clp" }, { amount: 31, currency_code: "usd" }] },
          ],
          sales_channels: sc,
        },
      ],
    },
  });
  logger.info(`✅  ${productResult.length} products created.`);

  // ── 9. Inventory Levels ────────────────────────────────────────────────────
  logger.info("📊  Seeding inventory levels...");
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  });

  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: inventoryItems.map((item) => ({
        location_id: stockLocation.id,
        stocked_quantity: 500,
        inventory_item_id: item.id,
      })) as CreateInventoryLevelInput[],
    },
  });
  logger.info("✅  Inventory levels seeded (500 unidades por SKU).");

  // ── 10. B2B Price Lists ────────────────────────────────────────────────────
  // Price lists in Medusa v2 override the base price for matched variants.
  // We collect all variant IDs from created products and apply discounted prices.
  logger.info("💼  Seeding B2B price lists...");

  // Fetch full product data with variants
  const { data: fullProducts } = await query.graph({
    entity: "product",
    fields: ["id", "variants.id", "variants.sku", "variants.prices.*"],
  });

  // Build a map: sku → { variantId, baseClpPrice }
  const skuMap: Record<string, { variantId: string; baseClpPrice: number }> = {};
  for (const product of fullProducts) {
    for (const variant of (product as any).variants ?? []) {
      const basePriceObj = (variant.prices ?? []).find(
        (p: any) => p.currency_code === "clp"
      );
      if (basePriceObj && variant.sku) {
        skuMap[variant.sku] = {
          variantId: variant.id,
          baseClpPrice: basePriceObj.amount,
        };
      }
    }
  }

  const allVariantIds = Object.values(skuMap);

  // Helper: build price list prices with a given discount %
  const buildPriceListPrices = (discountPct: number) =>
    allVariantIds.map(({ variantId, baseClpPrice }) => ({
      variant_id: variantId,
      currency_code: "clp",
      amount: Math.round(baseClpPrice * (1 - discountPct / 100)),
    }));

  // Price List 1: B2B Comprador Industrial (15% descuento)
  await createPriceListsWorkflow(container).run({
    input: {
      price_lists_data: [
        {
          title: "B2B Comprador Industrial — 15% Descuento",
          description:
            "Precios corporativos B2B para compradores industriales calificados. Descuento del 15% sobre precio lista en CLP.",
          status: PriceListStatus.ACTIVE,
          prices: buildPriceListPrices(15),
          rules: {},
        },
      ],
    },
  });

  // Price List 2: B2B Premium — Grandes Volúmenes (20% descuento)
  await createPriceListsWorkflow(container).run({
    input: {
      price_lists_data: [
        {
          title: "B2B Premium — Grandes Volúmenes (20% Descuento)",
          description:
            "Precios exclusivos para clientes con volúmenes de compra mensual superior a CLP 2.000.000. Descuento del 20% sobre precio lista.",
          status: PriceListStatus.ACTIVE,
          prices: buildPriceListPrices(20),
          rules: {},
        },
      ],
    },
  });

  logger.info("✅  B2B price lists created.");

  logger.info("────────────────────────────────────────────────────");
  logger.info("🎉  Seed completado exitosamente.");
  logger.info(`    Región:           América (CLP)`);
  logger.info(`    Productos:        ${productResult.length} productos de ferretería`);
  logger.info(`    SKUs:             ${allVariantIds.length} variantes`);
  logger.info(`    Listas de precio: 2 (B2B Industrial 15%, B2B Premium 20%)`);
  logger.info(`    API Key:          ${publishableApiKey.token}`);
  logger.info("────────────────────────────────────────────────────");
}
