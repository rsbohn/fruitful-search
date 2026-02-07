export type CategoryNode = {
  category_id: number;
  category_name: string;
  category_url?: string;
  subcategories?: CategoryNode[];
};

export type CategoryEntry = {
  id: number;
  name: string;
  path: string;
  url?: string;
};

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

const normalizeCategoryNode = (raw: Record<string, unknown>): CategoryNode => {
  const id = asNumber(raw.category_id);
  const name = asString(raw.category_name);
  if (id === null || !name) {
    throw new Error("Category item missing category_id or category_name");
  }
  const subcategories = Array.isArray(raw.subcategories)
    ? raw.subcategories.map((entry) => {
        if (!isRecord(entry)) {
          throw new Error("Category JSON includes non-object subcategory rows");
        }
        return normalizeCategoryNode(entry);
      })
    : undefined;
  return {
    category_id: id,
    category_name: name,
    category_url: asString(raw.category_url),
    subcategories,
  };
};

const extractCategoryRows = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (isRecord(payload) && Array.isArray(payload.categories)) {
    return payload.categories;
  }
  throw new Error("Unsupported categories JSON shape");
};

export const parseCategoriesJson = (payload: unknown): CategoryNode[] => {
  const rows = extractCategoryRows(payload);
  if (rows.length === 0) {
    throw new Error("Categories JSON contains no categories");
  }
  return rows.map((row) => {
    if (!isRecord(row)) {
      throw new Error("Categories JSON includes non-object rows");
    }
    return normalizeCategoryNode(row);
  });
};

export const buildCategoryMap = (
  nodes: CategoryNode[]
): Map<number, CategoryEntry> => {
  const map = new Map<number, CategoryEntry>();
  const walk = (list: CategoryNode[], parentPath: string | null) => {
    for (const node of list) {
      const path = parentPath ? `${parentPath} > ${node.category_name}` : node.category_name;
      if (!map.has(node.category_id)) {
        map.set(node.category_id, {
          id: node.category_id,
          name: node.category_name,
          path,
          url: node.category_url,
        });
      }
      if (node.subcategories && node.subcategories.length > 0) {
        walk(node.subcategories, path);
      }
    }
  };
  walk(nodes, null);
  return map;
};
