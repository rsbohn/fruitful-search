export type CatalogProduct = {
  product_id: number;
  product_name: string;
  product_url?: string;
  product_price?: number | null;
  product_sale_price?: number | null;
  product_stock?: number | null;
  product_image?: string;
  product_image_alt?: string;
  product_model?: string;
  product_mpn?: string;
  product_master_category?: number | null;
  product_manufacturer?: string;
  product_shipping_weight?: number | null;
  products_hts?: string;
  products_coo?: string;
  discontinue_status?: string;
  products_coming_soon?: number | null;
  products_rohs?: number | null;
  products_virtual?: number | null;
  image_is_video?: number | null;
  date_added?: string;
  parent_pid?: number | null;
  discount_pricing?: unknown;
};

export type CatalogPayload = CatalogProduct[];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
  return null;
};

const asString = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
};

const normalizeCatalogItem = (raw: Record<string, unknown>): CatalogProduct => {
  const productId = asNumber(raw.product_id);
  const productName = asString(raw.product_name);

  if (productId === null || !productName) {
    throw new Error("Catalog item missing product_id or product_name");
  }

  return {
    product_id: productId,
    product_name: productName,
    product_url: asString(raw.product_url),
    product_price: asNumber(raw.product_price),
    product_sale_price: asNumber(raw.product_sale_price),
    product_stock: asNumber(raw.product_stock),
    product_image: asString(raw.product_image),
    product_image_alt: asString(raw.product_image_alt),
    product_model: asString(raw.product_model),
    product_mpn: asString(raw.product_mpn),
    product_master_category: asNumber(raw.product_master_category),
    product_manufacturer: asString(raw.product_manufacturer),
    product_shipping_weight: asNumber(raw.product_shipping_weight),
    products_hts: asString(raw.products_hts),
    products_coo: asString(raw.products_coo),
    discontinue_status: asString(raw.discontinue_status),
    products_coming_soon: asNumber(raw.products_coming_soon),
    products_rohs: asNumber(raw.products_rohs),
    products_virtual: asNumber(raw.products_virtual),
    image_is_video: asNumber(raw.image_is_video),
    date_added: asString(raw.date_added),
    parent_pid: asNumber(raw.parent_pid),
    discount_pricing: raw.discount_pricing ?? undefined,
  };
};

const extractCatalogRows = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (isRecord(payload) && Array.isArray(payload.products)) {
    return payload.products;
  }
  throw new Error("Unsupported catalog JSON shape");
};

export const parseCatalogJson = (payload: unknown): CatalogPayload => {
  const rows = extractCatalogRows(payload);
  if (rows.length === 0) {
    throw new Error("Catalog JSON contains no products");
  }
  return rows.map((row) => {
    if (!isRecord(row)) {
      throw new Error("Catalog JSON includes non-object rows");
    }
    return normalizeCatalogItem(row);
  });
};
