import { CatalogProduct } from "./catalog";

export type SearchResult = {
  pid: number;
  score: number;
  name: string;
  manufacturer?: string;
  price?: number | null;
  stock?: number | null;
  url?: string;
  why: string;
  matchedTokens: string[];
};

const normalizeQuery = (query: string) => query.trim().toLowerCase();

const buildCatalogMap = (catalog: CatalogProduct[]) => {
  const map = new Map<number, CatalogProduct>();
  for (const item of catalog) {
    map.set(item.product_id, item);
  }
  return map;
};

export const runSearch = (
  rawQuery: string,
  matches: { pid: number; score: number }[],
  catalog: CatalogProduct[],
  mode: "lexical" | "semantic" | "hybrid" = "lexical"
): SearchResult[] => {
  const query = normalizeQuery(rawQuery);
  const tokens = query.split(/\s+/).filter(Boolean);
  const catalogMap = buildCatalogMap(catalog);

  return matches
    .map((match) => {
      const item = catalogMap.get(match.pid);
      if (!item) {
        return null;
      }
      const name = item.product_name;
      const manufacturer = item.product_manufacturer;
      const searchText = `${name} ${manufacturer ?? ""} ${
        item.product_model ?? ""
      } ${item.product_mpn ?? ""}`.toLowerCase();
      const hitTokens =
        mode === "semantic"
          ? []
          : tokens.filter((token) => searchText.includes(token));
      return {
        pid: match.pid,
        score: match.score,
        name,
        manufacturer,
        price: item.product_price ?? null,
        stock: item.product_stock ?? null,
        url: item.product_url,
        why:
          mode === "semantic"
            ? "Semantic similarity match."
            : mode === "hybrid"
            ? hitTokens.length > 0
              ? "Hybrid match: keywords + semantic similarity."
              : "Hybrid semantic match."
            : hitTokens.length > 0
            ? `Matched ${hitTokens.slice(0, 3).join(", ")}.`
            : "Matched catalog text.",
        matchedTokens: hitTokens,
      };
    })
    .filter((item): item is SearchResult => Boolean(item));
};
