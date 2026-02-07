import React from "react";
import { CatalogProduct, parseCatalogJson } from "./catalog";
import { buildCategoryMap, parseCategoriesJson, CategoryEntry } from "./categories";
import { parseEmbeddingsJson } from "./embeddings";
import { createLexicalWorker } from "./lexicalWorkerClient";
import { createSemanticWorker, SemanticIndexStats } from "./semanticWorkerClient";
import { embedQuery } from "./semanticEmbed";
import { runSearch } from "./search";
import {
  loadCategoriesText,
  loadCatalogText,
  loadEmbeddingsText,
  saveCategoriesText,
  saveCatalogText,
  saveEmbeddingsText,
} from "./storage";

const placeholders = [
  "Search 'Feather I2C', 'USB-C PD 12V', '8-channel ADC'",
  "Try: 'compact motor driver, 5V'",
  "Find: 'STEMMA QT temp sensor'",
];

export default function App() {
  const [view, setView] = React.useState<"home" | "help">("home");
  const [placeholderIndex, setPlaceholderIndex] = React.useState(0);
  const [catalog, setCatalog] = React.useState<CatalogProduct[]>([]);
  const [categoryMap, setCategoryMap] = React.useState<Map<number, CategoryEntry>>(
    new Map()
  );
  const [categoryStatus, setCategoryStatus] = React.useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [categoryMessage, setCategoryMessage] = React.useState(
    "Import the categories JSON to display category names."
  );
  const [catalogStatus, setCatalogStatus] = React.useState<
    "empty" | "loading" | "ready" | "error"
  >("empty");
  const [catalogMessage, setCatalogMessage] = React.useState(
    "Import the catalog JSON to build your local index."
  );
  const [indexStatus, setIndexStatus] = React.useState<
    "idle" | "building" | "ready" | "error"
  >("idle");
  const [indexMessage, setIndexMessage] = React.useState(
    "Import a catalog to build the lexical index."
  );
  const [indexProgress, setIndexProgress] = React.useState<{
    processed: number;
    total: number;
  } | null>(null);
  const [workerStatus, setWorkerStatus] = React.useState<
    "checking" | "online" | "offline"
  >("checking");
  const autoRestartedRef = React.useRef(false);
  const [semanticStatus, setSemanticStatus] = React.useState<
    "idle" | "building" | "ready" | "error"
  >("idle");
  const [semanticMessage, setSemanticMessage] = React.useState(
    "Import embeddings to enable semantic search."
  );
  const [semanticModel, setSemanticModel] = React.useState<string | null>(null);
  const [semanticDimension, setSemanticDimension] = React.useState<number | null>(
    null
  );
  const [semanticCount, setSemanticCount] = React.useState<number | null>(null);
  const [query, setQuery] = React.useState("");
  const [searchMode, setSearchMode] = React.useState<
    "lexical" | "semantic" | "hybrid"
  >("lexical");
  const [resultMode, setResultMode] = React.useState<
    "lexical" | "semantic" | "hybrid"
  >("lexical");
  const [searchResults, setSearchResults] = React.useState<
    ReturnType<typeof runSearch>
  >([]);
  const [searchMessage, setSearchMessage] = React.useState(
    "Enter a query to see results."
  );
  const [selectedPid, setSelectedPid] = React.useState<number | null>(null);
  const [inStockOnly, setInStockOnly] = React.useState(false);
  const [priceMin, setPriceMin] = React.useState<string>("");
  const [priceMax, setPriceMax] = React.useState<string>("");
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const embeddingsInputRef = React.useRef<HTMLInputElement | null>(null);
  const categoriesInputRef = React.useRef<HTMLInputElement | null>(null);
  const [workerKey, setWorkerKey] = React.useState(0);
  const workerClient = React.useMemo(() => createLexicalWorker(), [workerKey]);
  const semanticWorker = React.useMemo(() => createSemanticWorker(), []);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    return () => workerClient.terminate();
  }, [workerClient]);

  React.useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        await workerClient.ping();
        if (active) {
          setWorkerStatus("online");
        }
      } catch {
        if (active) {
          if (!autoRestartedRef.current) {
            autoRestartedRef.current = true;
            setWorkerStatus("checking");
            setWorkerKey((prev) => prev + 1);
          } else {
            setWorkerStatus("offline");
          }
        }
      }
    };
    void check();
    const timer = window.setInterval(check, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [workerClient]);

  React.useEffect(() => {
    return () => semanticWorker.terminate();
  }, [semanticWorker]);

  const buildIndex = React.useCallback(
    async (items: CatalogProduct[]) => {
      if (items.length === 0) {
        setIndexStatus("idle");
        setIndexMessage("Import a catalog to build the lexical index.");
        setIndexProgress(null);
        return;
      }
      setIndexStatus("building");
      setIndexMessage("Building lexical index...");
      setIndexProgress({ processed: 0, total: items.length });
      try {
        const stats = await workerClient.buildIndex(items, (processed, total) => {
          const pct =
            total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
          setIndexMessage(
            `Building lexical index... ${pct}% (${processed}/${total})`
          );
          setIndexProgress({ processed, total });
        });
        setIndexStatus("ready");
        setIndexMessage(
          `Index ready (${stats.docsIndexed} docs, ${stats.uniqueTokens} tokens) in ${Math.round(
            stats.buildMs
          )}ms.`
        );
        setIndexProgress(null);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to build lexical index.";
        setIndexStatus("error");
        setIndexMessage(message);
        setIndexProgress(null);
      }
    },
    [workerClient]
  );

  React.useEffect(() => {
    if (
      workerStatus === "online" &&
      catalog.length > 0 &&
      (indexStatus === "idle" || indexStatus === "error")
    ) {
      void buildIndex(catalog);
    }
  }, [workerStatus, catalog, indexStatus, buildIndex]);

  const buildSemanticIndex = React.useCallback(
    async (
      items: { pid: number; embedding: number[] }[],
      model?: string
    ): Promise<
      | { ok: true; stats: SemanticIndexStats }
      | { ok: false; message: string }
    > => {
      if (items.length === 0) {
        setSemanticStatus("idle");
        setSemanticMessage("Import embeddings to enable semantic search.");
        setSemanticModel(null);
        setSemanticDimension(null);
        setSemanticCount(null);
        return { ok: false, message: "No embeddings provided." };
      }
      setSemanticStatus("building");
      setSemanticMessage("Building semantic index...");
      try {
        const stats = await semanticWorker.buildIndex(items);
        setSemanticStatus("ready");
        setSemanticMessage(
          `Semantic index ready (${stats.docsIndexed} vectors, ${stats.dimension}d).`
        );
        setSemanticModel(model ?? null);
        setSemanticDimension(stats.dimension);
        setSemanticCount(stats.docsIndexed);
        return { ok: true, stats };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to build semantic index.";
        setSemanticStatus("error");
        setSemanticMessage(message);
        return { ok: false, message };
      }
    },
    [semanticWorker]
  );

  const handleSearch = React.useCallback(
    async (nextQuery?: string) => {
      const trimmed = (nextQuery ?? query).trim();
      if (!trimmed) {
        setSearchResults([]);
        setSearchMessage("Enter a query to see results.");
        return;
      }
      if (catalog.length === 0) {
        setSearchResults([]);
        setSearchMessage("Import a catalog before searching.");
        return;
      }
      if (searchMode !== "lexical" && semanticStatus !== "ready") {
        setSearchResults([]);
        setSearchMessage("Import embeddings to enable semantic search.");
        return;
      }
      setSearchMessage("Searching...");
      try {
        if (searchMode === "semantic") {
          if (!semanticModel || !semanticDimension) {
            setSearchResults([]);
            setSearchMessage("Semantic model metadata missing. Re-import embeddings.");
            return;
          }
          const embedded = await embedQuery(trimmed, semanticModel);
          if (embedded.dimension !== semanticDimension) {
            throw new Error(
              `Query embedding dimension ${embedded.dimension} does not match index dimension ${semanticDimension}.`
            );
          }
          const matches = await semanticWorker.query(embedded.vector, 24);
          const shaped = runSearch(trimmed, matches, catalog, "semantic");
          setSearchResults(shaped);
          setResultMode("semantic");
          setSearchMessage(
            shaped.length > 0
              ? `Showing ${shaped.length} semantic matches.`
              : "No matches yet. Try another query."
          );
          return;
        }
        if (searchMode === "hybrid") {
          if (!semanticModel || !semanticDimension) {
            setSearchResults([]);
            setSearchMessage("Semantic model metadata missing. Re-import embeddings.");
            return;
          }
          const [lexicalMatches, embedded] = await Promise.all([
            workerClient.query(trimmed, 48),
            embedQuery(trimmed, semanticModel),
          ]);
          if (embedded.dimension !== semanticDimension) {
            throw new Error(
              `Query embedding dimension ${embedded.dimension} does not match index dimension ${semanticDimension}.`
            );
          }
          const semanticMatches = await semanticWorker.query(embedded.vector, 48);
          const maxLex = lexicalMatches.reduce(
            (acc, item) => Math.max(acc, item.score),
            0
          );
          const lexicalMap = new Map<number, number>();
          for (const item of lexicalMatches) {
            lexicalMap.set(item.pid, maxLex > 0 ? item.score / maxLex : 0);
          }
          const semanticMap = new Map<number, number>();
          for (const item of semanticMatches) {
            semanticMap.set(item.pid, item.score);
          }
          const merged = new Map<
            number,
            { pid: number; score: number; lexical?: number; semantic?: number }
          >();
          for (const [pid, score] of lexicalMap) {
            merged.set(pid, { pid, score, lexical: score });
          }
          for (const [pid, score] of semanticMap) {
            const entry = merged.get(pid);
            if (entry) {
              entry.semantic = score;
            } else {
              merged.set(pid, { pid, score, semantic: score });
            }
          }
          const weighted = [...merged.values()].map((item) => {
            const lex = item.lexical ?? 0;
            const sem = item.semantic ?? 0;
            const score = 0.6 * lex + 0.4 * sem;
            return { ...item, score };
          });
          weighted.sort((a, b) => b.score - a.score);
          const top = weighted.slice(0, 24);
          const shaped = runSearch(trimmed, top, catalog, "hybrid").map((item) => {
            const meta = merged.get(item.pid);
            const hasLex = Boolean(meta?.lexical);
            const hasSem = Boolean(meta?.semantic);
            let why = item.why;
            if (hasLex && hasSem) {
              why = "Hybrid match: keyword + semantic similarity.";
            } else if (hasSem) {
              why = "Semantic similarity match.";
            } else if (hasLex) {
              why = item.matchedTokens.length
                ? `Matched ${item.matchedTokens.slice(0, 3).join(", ")}.`
                : "Matched catalog text.";
            }
            return { ...item, why };
          });
          setSearchResults(shaped);
          setResultMode("hybrid");
          setSearchMessage(
            shaped.length > 0
              ? `Showing ${shaped.length} hybrid matches.`
              : "No matches yet. Try another query."
          );
          return;
        }
        const matches = await workerClient.query(trimmed, 24);
        const shaped = runSearch(trimmed, matches, catalog, "lexical");
        setSearchResults(shaped);
        setResultMode("lexical");
        setSearchMessage(
          shaped.length > 0
            ? `Showing ${shaped.length} matches.`
            : "No matches yet. Try another query."
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Search failed.";
        setSearchResults([]);
        setSearchMessage(message);
      }
    },
    [
      catalog,
      query,
      searchMode,
      semanticDimension,
      semanticModel,
      semanticStatus,
      semanticWorker,
      workerClient,
    ]
  );

  React.useEffect(() => {
    let active = true;
    const loadCachedCatalog = async () => {
      setCatalogStatus("loading");
      setCatalogMessage("Checking local storage...");
      try {
        const { text, backend } = await loadCatalogText();
        if (!active) {
          return;
        }
        if (!text) {
          setCatalogStatus("empty");
          setCatalogMessage("Import the catalog JSON to build your local index.");
          setIndexStatus("idle");
          setIndexMessage("Import a catalog to build the lexical index.");
          setIndexProgress(null);
          return;
        }
        const parsed = parseCatalogJson(JSON.parse(text));
        setCatalog(parsed);
        setCatalogStatus("ready");
        const label =
          backend === "none" ? "local storage unavailable" : backend.toUpperCase();
        setCatalogMessage(`Catalog loaded (${parsed.length} products) from ${label}.`);
        await buildIndex(parsed);
      } catch (error) {
        if (!active) {
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load catalog from storage.";
        setCatalog([]);
        setCatalogStatus("error");
        setCatalogMessage(message);
        setIndexStatus("error");
        setIndexMessage("Failed to load catalog. Index not built.");
        setIndexProgress(null);
      }
    };
    loadCachedCatalog();
    return () => {
      active = false;
    };
  }, [buildIndex]);

  React.useEffect(() => {
    let active = true;
    const loadCachedEmbeddings = async () => {
      setSemanticStatus("building");
      setSemanticMessage("Checking stored embeddings...");
      try {
        const { text, backend } = await loadEmbeddingsText();
        if (!active) {
          return;
        }
        if (!text) {
          setSemanticStatus("idle");
          setSemanticMessage("Import embeddings to enable semantic search.");
          return;
        }
        const parsed = parseEmbeddingsJson(JSON.parse(text));
        const label =
          backend === "none" ? "local storage unavailable" : backend.toUpperCase();
        const result = await buildSemanticIndex(parsed.items, parsed.model);
        if (result.ok) {
          setSemanticMessage(
            `Embeddings loaded (${parsed.items.length} vectors) from ${label}.`
          );
        }
      } catch (error) {
        if (!active) {
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load embeddings from storage.";
        setSemanticStatus("error");
        setSemanticMessage(message);
      }
    };
    loadCachedEmbeddings();
    return () => {
      active = false;
    };
  }, [buildSemanticIndex]);

  React.useEffect(() => {
    let active = true;
    const loadCachedCategories = async () => {
      setCategoryStatus("loading");
      setCategoryMessage("Checking stored categories...");
      try {
        const { text, backend } = await loadCategoriesText();
        if (!active) {
          return;
        }
        if (!text) {
          setCategoryStatus("idle");
          setCategoryMessage("Import the categories JSON to display category names.");
          setCategoryMap(new Map());
          return;
        }
        const parsed = parseCategoriesJson(JSON.parse(text));
        const map = buildCategoryMap(parsed);
        const label =
          backend === "none" ? "local storage unavailable" : backend.toUpperCase();
        setCategoryMap(map);
        setCategoryStatus("ready");
        setCategoryMessage(
          `Categories loaded (${map.size} entries) from ${label}.`
        );
      } catch (error) {
        if (!active) {
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load categories from storage.";
        setCategoryMap(new Map());
        setCategoryStatus("error");
        setCategoryMessage(message);
      }
    };
    loadCachedCategories();
    return () => {
      active = false;
    };
  }, []);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportEmbeddingsClick = () => {
    embeddingsInputRef.current?.click();
  };

  const handleImportCategoriesClick = () => {
    categoriesInputRef.current?.click();
  };

  const handleHelpClick = () => {
    setView("help");
  };

  const handleRefreshIndex = () => {
    if (catalog.length === 0) {
      setIndexStatus("idle");
      setIndexMessage("Import a catalog to build the lexical index.");
      setIndexProgress(null);
      return;
    }
    void buildIndex(catalog);
  };

  const handleRestartWorker = () => {
    setWorkerStatus("checking");
    autoRestartedRef.current = false;
    setWorkerKey((prev) => prev + 1);
  };

  const handleRefreshSemantic = () => {
    if (semanticStatus !== "ready" || semanticCount === null) {
      setSemanticStatus("idle");
      setSemanticMessage("Import embeddings to enable semantic search.");
      return;
    }
    void (async () => {
      const { text } = await loadEmbeddingsText();
      if (!text) {
        setSemanticStatus("idle");
        setSemanticMessage("Import embeddings to enable semantic search.");
        return;
      }
      const parsed = parseEmbeddingsJson(JSON.parse(text));
      await buildSemanticIndex(parsed.items, parsed.model);
    })();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setCatalogStatus("loading");
    setCatalogMessage(`Reading ${file.name}...`);
    try {
      const text = await file.text();
      const parsed = parseCatalogJson(JSON.parse(text));
      const backend = await saveCatalogText(text);
      setCatalog(parsed);
      setCatalogStatus("ready");
      await buildIndex(parsed);
      setCatalogMessage(
        backend === "none"
          ? `Catalog loaded (${parsed.length} products). Local storage unavailable.`
          : `Catalog loaded (${parsed.length} products). Saved to ${backend.toUpperCase()}.`
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to parse catalog JSON.";
      setCatalog([]);
      setCatalogStatus("error");
      setCatalogMessage(message);
    } finally {
      event.target.value = "";
    }
  };

  const handleEmbeddingsChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setSemanticStatus("building");
    setSemanticMessage(`Reading ${file.name}...`);
    try {
      const text = await file.text();
      const parsed = parseEmbeddingsJson(JSON.parse(text));
      const backend = await saveEmbeddingsText(text);
      const result = await buildSemanticIndex(parsed.items, parsed.model);
      if (result.ok) {
        setSemanticMessage(
          backend === "none"
            ? `Embeddings loaded (${parsed.items.length} vectors). Local storage unavailable.`
            : `Embeddings loaded (${parsed.items.length} vectors). Saved to ${backend.toUpperCase()}.`
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to parse embeddings JSON.";
      setSemanticStatus("error");
      setSemanticMessage(message);
    } finally {
      event.target.value = "";
    }
  };

  const handleCategoriesChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setCategoryStatus("loading");
    setCategoryMessage(`Reading ${file.name}...`);
    try {
      const text = await file.text();
      const parsed = parseCategoriesJson(JSON.parse(text));
      const map = buildCategoryMap(parsed);
      const backend = await saveCategoriesText(text);
      setCategoryMap(map);
      setCategoryStatus("ready");
      setCategoryMessage(
        backend === "none"
          ? `Categories loaded (${map.size} entries). Local storage unavailable.`
          : `Categories loaded (${map.size} entries). Saved to ${backend.toUpperCase()}.`
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to parse categories JSON.";
      setCategoryMap(new Map());
      setCategoryStatus("error");
      setCategoryMessage(message);
    } finally {
      event.target.value = "";
    }
  };

  const statusLabel = (() => {
    switch (catalogStatus) {
      case "loading":
        return "Importing";
      case "ready":
        return "Catalog ready";
      case "error":
        return "Import error";
      default:
        return "Not indexed";
    }
  })();

  const statusTone =
    catalogStatus === "ready" ? "ready" : catalogStatus === "error" ? "error" : "";
  const semanticTone =
    semanticStatus === "ready"
      ? "ready"
      : semanticStatus === "error"
      ? "error"
      : "";
  const results = catalog.length > 0 ? catalog.slice(0, 4) : null;
  const catalogById = React.useMemo(() => {
    const map = new Map<number, CatalogProduct>();
    for (const item of catalog) {
      map.set(item.product_id, item);
    }
    return map;
  }, [catalog]);
  const resultsToRender =
    searchResults.length > 0
      ? searchResults
      : results
      ? results.map((item) => ({
          pid: item.product_id,
          score: 0,
          name: item.product_name,
          manufacturer: item.product_manufacturer,
          price: item.product_price ?? null,
          stock: item.product_stock ?? null,
          url: item.product_url,
          why: "Imported from catalog.",
          matchedTokens: [],
        }))
      : [];
  const priceMinValue = Number(priceMin);
  const priceMaxValue = Number(priceMax);
  const hasPriceMin = priceMin.trim() !== "" && !Number.isNaN(priceMinValue);
  const hasPriceMax = priceMax.trim() !== "" && !Number.isNaN(priceMaxValue);
  const filtersActive = inStockOnly || hasPriceMin || hasPriceMax;
  const filteredResults = resultsToRender.filter((item) => {
    if (inStockOnly) {
      if (typeof item.stock !== "number" || item.stock <= 0) {
        return false;
      }
    }
    if (hasPriceMin || hasPriceMax) {
      if (typeof item.price !== "number") {
        return false;
      }
      if (hasPriceMin && item.price < priceMinValue) {
        return false;
      }
      if (hasPriceMax && item.price > priceMaxValue) {
        return false;
      }
    }
    return true;
  });
  const selectedResult =
    selectedPid !== null
      ? filteredResults.find((item) => item.pid === selectedPid) ??
        resultsToRender.find((item) => item.pid === selectedPid)
      : null;
  const selectedCatalog =
    selectedResult && catalogById.has(selectedResult.pid)
      ? catalogById.get(selectedResult.pid)
      : null;
  const selectedCategory =
    selectedCatalog?.product_master_category != null
      ? categoryMap.get(selectedCatalog.product_master_category) ?? null
      : null;

  const escapeRegExp = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const highlightText = (text: string, tokens?: string[]) => {
    const safeTokens = tokens ?? [];
    if (!text || safeTokens.length === 0) {
      return text;
    }
    const uniqueTokens = Array.from(new Set(safeTokens)).filter(Boolean);
    if (uniqueTokens.length === 0) {
      return text;
    }
    const pattern = uniqueTokens.map(escapeRegExp).join("|");
    const regex = new RegExp(`(${pattern})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, index) => {
      if (regex.test(part)) {
        return (
          <mark key={`${part}-${index}`} className="highlight">
            {part}
          </mark>
        );
      }
      return <span key={`${part}-${index}`}>{part}</span>;
    });
  };

  const filterChips = [
    inStockOnly
      ? {
          label: "In stock",
          onClear: () => setInStockOnly(false),
        }
      : null,
    hasPriceMin || hasPriceMax
      ? {
          label: `Price ${hasPriceMin ? `$${priceMinValue}` : "Any"} - ${
            hasPriceMax ? `$${priceMaxValue}` : "Any"
          }`,
          onClear: () => {
            setPriceMin("");
            setPriceMax("");
          },
        }
      : null,
  ].filter(
    (chip): chip is { label: string; onClear: () => void } => Boolean(chip)
  );

  if (view === "help") {
    return (
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <span className="brand-dot" />
            Fruitful Search
          </div>
          <nav className="topbar-actions">
            <button className="ghost" onClick={() => setView("home")}>
              Back to search
            </button>
          </nav>
        </header>
        <main className="layout">
          <section className="help-page">
            <div className="help-header">
              <p className="eyebrow">Help</p>
              <h2>Get set up fast</h2>
              <p className="muted">
                Fruitful Search runs locally in your browser and only uses the JSON
                files you import.
              </p>
            </div>
            <div className="help-grid">
              <article className="help-card">
                <h3>What is this</h3>
                <p>
                  A local-first explorer for the Adafruit product catalog. It builds
                  an on-device index, keeps searches private, and explains why each
                  result matches. After you import the catalog, it works offline.
                </p>
              </article>
              <article className="help-card">
                <h3>Getting the catalog</h3>
                <p className="muted">
                  API endpoint: <code>https://www.adafruit.com/api/products</code>
                </p>
                <ol className="help-list">
                  <li>Download the JSON manually or run `scripts/download_adafruit_catalog.py`.</li>
                  <li>Click “Import catalog” and select the downloaded file.</li>
                  <li>Wait for the index to finish building before searching.</li>
                </ol>
                <p className="help-note">
                  Compliance: do not hotlink images, respect ≤5 requests/min, and
                  follow the project compliance checklist.
                </p>
              </article>
              <article className="help-card">
                <h3>Getting the categories</h3>
                <p className="muted">
                  API endpoint: <code>https://www.adafruit.com/api/categories</code>
                </p>
                <ol className="help-list">
                  <li>Download the categories JSON from the endpoint.</li>
                  <li>Click “Import categories” and select the file.</li>
                  <li>Category names will appear in the Details panel.</li>
                </ol>
              </article>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" />
          Fruitful Search
        </div>
        <nav className="topbar-actions">
          <button className="ghost" onClick={handleImportClick}>
            Import catalog
          </button>
          <button className="ghost" onClick={handleImportCategoriesClick}>
            Import categories
          </button>
          <button className="ghost" onClick={handleImportEmbeddingsClick}>
            Import embeddings
          </button>
          <button
            className="ghost"
            onClick={handleRefreshIndex}
            disabled={catalog.length === 0 || indexStatus === "building"}
          >
            Refresh index
          </button>
          <button className="ghost" onClick={handleHelpClick}>
            Help
          </button>
        </nav>
      </header>

      <main className="layout">
        <section className="hero">
          <div>
            <p className="eyebrow">Local-first catalog explorer</p>
            <h1>
              Find the missing piece.
              <span className="accent"> Fast, local, explainable.</span>
            </h1>
            <p className="lede">
              A browser-native search workspace for Adafruit parts. Works offline once you
              import the catalog. Uses on-device indexing for speed and privacy.
            </p>
            <div className="searchbar">
              <span className="search-icon">⌕</span>
              <input
                type="text"
                placeholder={placeholders[placeholderIndex]}
                aria-label="Search catalog"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleSearch();
                  }
                }}
              />
              <button className="primary" onClick={() => handleSearch()}>
                Search
              </button>
            </div>
            <div className="chips">
              <button className="chip">Inspire me</button>
              <button className="chip">Recently viewed</button>
              <button className="chip">In stock only</button>
            </div>
          </div>
        </section>

        <details className="hero-collapsible" open>
          <summary className="hero-summary">
            <span className="hero-summary-title">Index & Filters</span>
            <span className="hero-summary-statuses">
              <span className="hero-summary-item">
                <span className={`status-dot ${statusTone}`} />
                <span className={`status-text ${statusTone}`}>
                  {catalogStatus === "ready"
                    ? "Catalog ready"
                    : catalogStatus === "loading"
                    ? "Catalog loading"
                    : catalogStatus === "error"
                    ? "Catalog error"
                    : "Catalog not indexed"}
                </span>
              </span>
              <span className="hero-summary-item">
                <span
                  className={`status-dot ${
                    semanticStatus === "ready"
                      ? "ready"
                      : semanticStatus === "error"
                      ? "error"
                      : ""
                  }`}
                />
                <span
                  className={`status-text ${
                    semanticStatus === "ready"
                      ? "ready"
                      : semanticStatus === "error"
                      ? "error"
                      : ""
                  }`}
                >
                  {semanticStatus === "ready"
                    ? "Semantic ready"
                    : semanticStatus === "building"
                    ? "Semantic building"
                    : semanticStatus === "error"
                    ? "Semantic error"
                    : "Semantic not indexed"}
                </span>
              </span>
              <span className="hero-summary-item">
                <span
                  className={`status-dot ${
                    categoryStatus === "ready"
                      ? "ready"
                      : categoryStatus === "error"
                      ? "error"
                      : ""
                  }`}
                />
                <span
                  className={`status-text ${
                    categoryStatus === "ready"
                      ? "ready"
                      : categoryStatus === "error"
                      ? "error"
                      : ""
                  }`}
                >
                  {categoryStatus === "ready"
                    ? "Categories ready"
                    : categoryStatus === "loading"
                    ? "Categories loading"
                    : categoryStatus === "error"
                    ? "Categories error"
                    : "Categories not loaded"}
                </span>
              </span>
              <span className="hero-summary-item">
                <span className={`worker-dot ${workerStatus}`} />
                <span className="hero-summary-text">
                  {workerStatus === "online"
                    ? "Worker online"
                    : workerStatus === "offline"
                    ? "Worker offline"
                    : "Worker checking"}
                </span>
              </span>
            </span>
          </summary>
          <section className="hero-split">
            <div className="hero-stack">
              <div className="hero-panel">
                <div className="panel-header">
                  <span>Lexical index</span>
                  <span className={`status-dot ${statusTone}`} />
                  <span className={`status-text ${statusTone}`}>{statusLabel}</span>
                  <span
                    className={`worker-dot ${workerStatus}`}
                    title={`Worker ${workerStatus}`}
                  />
                  <span className="worker-text">
                    {workerStatus === "online"
                      ? "Worker online"
                      : workerStatus === "offline"
                      ? "Worker offline"
                      : "Worker checking"}
                  </span>
                </div>
                <div className="panel-body">
                  <p>{catalogMessage}</p>
                  <p className="muted">{indexMessage}</p>
                  {indexStatus === "building" && indexProgress ? (
                    <div className="progress">
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${
                              indexProgress.total > 0
                                ? Math.min(
                                    100,
                                    Math.round(
                                      (indexProgress.processed /
                                        indexProgress.total) *
                                        100
                                    )
                                  )
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <div className="progress-text">
                        {indexProgress.processed}/{indexProgress.total} indexed
                      </div>
                    </div>
                  ) : null}
                  <div className="panel-actions">
                    <button className="primary" onClick={handleImportClick}>
                      Import catalog
                    </button>
                    <button className="ghost" onClick={handleRefreshIndex}>
                      Refresh index
                    </button>
                    <button className="ghost" onClick={handleRestartWorker}>
                      Restart worker
                    </button>
                  </div>
                </div>
              </div>
              <div className="hero-panel">
                <div className="panel-header">
                  <span>Semantic index</span>
                  <span className={`status-dot ${semanticTone}`} />
                  <span className={`status-text ${semanticTone}`}>
                    {semanticStatus === "ready"
                      ? "Ready"
                      : semanticStatus === "building"
                      ? "Building"
                      : semanticStatus === "error"
                      ? "Error"
                      : "Not indexed"}
                  </span>
                </div>
                <div className="panel-body">
                  <p>{semanticMessage}</p>
                  <p className="muted">
                    {semanticModel
                      ? `Model: ${semanticModel} · ${semanticDimension ?? "?"}d`
                      : "Provide embeddings with model metadata to enable semantic search."}
                  </p>
                  <div className="panel-actions">
                    <button className="primary" onClick={handleImportEmbeddingsClick}>
                      Import embeddings
                    </button>
                    <button className="ghost" onClick={handleRefreshSemantic}>
                      Refresh index
                    </button>
                  </div>
                </div>
              </div>
              <div className="hero-panel">
                <div className="panel-header">
                  <span>Categories</span>
                  <span
                    className={`status-dot ${
                      categoryStatus === "ready"
                        ? "ready"
                        : categoryStatus === "error"
                        ? "error"
                        : ""
                    }`}
                  />
                  <span
                    className={`status-text ${
                      categoryStatus === "ready"
                        ? "ready"
                        : categoryStatus === "error"
                        ? "error"
                        : ""
                    }`}
                  >
                    {categoryStatus === "ready"
                      ? "Ready"
                      : categoryStatus === "loading"
                      ? "Loading"
                      : categoryStatus === "error"
                      ? "Error"
                      : "Not loaded"}
                  </span>
                </div>
                <div className="panel-body">
                  <p>{categoryMessage}</p>
                  <div className="panel-actions">
                    <button className="primary" onClick={handleImportCategoriesClick}>
                      Import categories
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <aside className="filters">
              <div className="section-title">Filters</div>
              <div className="filter-block">
                <div className="filter-label">In stock</div>
                <button
                  className={`filter-toggle ${inStockOnly ? "active" : ""}`}
                  onClick={() => setInStockOnly((prev) => !prev)}
                >
                  {inStockOnly ? "Only show in-stock" : "Include out-of-stock"}
                </button>
              </div>
              <div className="filter-block">
                <div className="filter-label">Price range</div>
                <div className="price-inputs">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Min"
                    value={priceMin}
                    onChange={(event) => setPriceMin(event.target.value)}
                  />
                  <span className="price-sep">–</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Max"
                    value={priceMax}
                    onChange={(event) => setPriceMax(event.target.value)}
                  />
                </div>
              </div>
              <div className="filter-footer">
                <button
                  className="ghost"
                  onClick={() => {
                    setInStockOnly(false);
                    setPriceMin("");
                    setPriceMax("");
                  }}
                  disabled={!filtersActive}
                >
                  Clear all
                </button>
                <button className="ghost" disabled>
                  Save view
                </button>
              </div>
              {filtersActive ? (
                <div className="filter-summary">
                  <div className="filter-label">Active filters</div>
                  <div className="filter-chip-list">
                    {filterChips.map((chip) => (
                      <button
                        key={chip.label}
                        className="filter-chip"
                        onClick={chip.onClear}
                      >
                        {chip.label}
                        <span className="filter-chip-x">×</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </aside>
          </section>
        </details>

        <section className="content">
          <section className="results">
            <div className="results-header">
              <div>
                <h2>Results</h2>
                <p className="muted">
                  {filtersActive
                    ? `${searchMessage} Showing ${filteredResults.length} after filters.`
                    : searchMessage}
                </p>
              </div>
                <div className="results-actions">
                  <div className="mode-toggle">
                    <button
                      className={`ghost ${searchMode === "lexical" ? "active" : ""}`}
                      onClick={() => setSearchMode("lexical")}
                    >
                      Keyword
                    </button>
                    <button
                      className={`ghost ${searchMode === "hybrid" ? "active" : ""}`}
                      onClick={() => setSearchMode("hybrid")}
                      disabled={semanticStatus !== "ready"}
                    >
                      Hybrid
                    </button>
                    <button
                      className={`ghost ${searchMode === "semantic" ? "active" : ""}`}
                      onClick={() => setSearchMode("semantic")}
                      disabled={semanticStatus !== "ready"}
                    >
                      Semantic
                    </button>
                  </div>
                  <button className="ghost">Sort: relevance</button>
                  <button className="ghost">Compare</button>
                </div>
              </div>

            <div className="result-list">
              {filteredResults.map((item, index) => {
                const inStock =
                  typeof item.stock === "number" && item.stock > 0;
                const price =
                  typeof item.price === "number"
                    ? `$${item.price.toFixed(2)}`
                    : "$--.--";
                const rank = index + 1;
                const scoreFill =
                  resultMode === "semantic" || resultMode === "hybrid"
                    ? Math.min(100, Math.max(8, item.score * 100))
                    : Math.min(100, Math.max(12, item.score * 20));
                return (
                  <article
                    key={item.pid}
                    className={`result-card ${
                      selectedPid === item.pid ? "selected" : ""
                    }`}
                    onClick={() => setSelectedPid(item.pid)}
                  >
                    <div className="result-meta">
                      <div className="result-meta-left">
                        <span className="rank-badge">#{rank}</span>
                        <span className="result-tag">
                          {item.manufacturer ?? "Catalog"}
                        </span>
                      </div>
                      <div className="result-meta-right">
                        <span className="result-stock">
                          {inStock ? "🟢 In stock" : "⚪ Out of stock"}
                        </span>
                      </div>
                    </div>
                    <div
                      className="score-bar"
                      title={`Score ${item.score.toFixed(1)}`}
                      style={
                        {
                          "--score-fill": `${scoreFill}%`,
                        } as React.CSSProperties
                      }
                    />
                    <h3>{highlightText(item.name, item.matchedTokens)}</h3>
                    <p>{highlightText(item.why, item.matchedTokens)}</p>
                    <div className="result-footer">
                      <span className="price">{price}</span>
                      <button
                        className="ghost"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedPid(item.pid);
                        }}
                      >
                        View details
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <aside className="details">
            <div className="section-title">Details</div>
            <div className="details-card">
              {selectedResult ? (
                <>
                  <div className="details-header">
                    <span className="details-tag">
                      {selectedResult.manufacturer ?? "Catalog"}
                    </span>
                    <span className="details-stock">
                      {typeof selectedResult.stock === "number" &&
                      selectedResult.stock > 0
                        ? "🟢 In stock"
                        : "⚪ Out of stock"}
                    </span>
                  </div>
                  <h3>{highlightText(selectedResult.name, selectedResult.matchedTokens)}</h3>
                  <p className="muted">
                    {highlightText(selectedResult.why, selectedResult.matchedTokens)}
                  </p>
                  <div className="details-grid">
                    <div>
                      <div className="details-label">Price</div>
                      <div className="details-value">
                        {typeof selectedResult.price === "number"
                          ? `$${selectedResult.price.toFixed(2)}`
                          : "$--.--"}
                      </div>
                    </div>
                    <div>
                      <div className="details-label">Score</div>
                      <div className="details-value">
                        {selectedResult.score.toFixed(1)}
                      </div>
                    </div>
                    <div>
                      <div className="details-label">Matched</div>
                      <div className="details-value">
                        {selectedResult.matchedTokens.length > 0
                          ? selectedResult.matchedTokens.slice(0, 6).join(", ")
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="details-label">Model</div>
                      <div className="details-value">
                        {selectedCatalog?.product_model ?? "—"}
                      </div>
                    </div>
                    <div>
                      <div className="details-label">MPN</div>
                      <div className="details-value">
                        {selectedCatalog?.product_mpn ?? "—"}
                      </div>
                    </div>
                    <div>
                      <div className="details-label">Category</div>
                      <div className="details-value">
                        {selectedCategory
                          ? selectedCategory.path
                          : selectedCatalog?.product_master_category ?? "—"}
                      </div>
                    </div>
                  </div>
                  <div className="details-actions">
                    {selectedResult.url ? (
                      <a
                        className="ghost"
                        href={selectedResult.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View on Adafruit
                      </a>
                    ) : (
                      <button className="ghost" disabled>
                        View on Adafruit
                      </button>
                    )}
                  </div>
                  <p className="details-attribution">
                    Data source: Adafruit Products API.
                  </p>
                </>
              ) : (
                <>
                  <h3>Pick a result</h3>
                  <p className="muted">
                    Product details, specs, and attribution links will appear here.
                  </p>
                  <button className="ghost" disabled>
                    View on Adafruit
                  </button>
                </>
              )}
            </div>
          </aside>
        </section>

      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        onChange={handleFileChange}
        hidden
      />
      <input
        ref={embeddingsInputRef}
        type="file"
        accept="application/json"
        onChange={handleEmbeddingsChange}
        hidden
      />
      <input
        ref={categoriesInputRef}
        type="file"
        accept="application/json"
        onChange={handleCategoriesChange}
        hidden
      />
    </div>
  );
}
