"use client";

/**
 * The catalogue: search, filter, and act on every article.
 * Filtering is derived state — there is no second copy of the list to keep in
 * sync, which is what usually rots in tools like this.
 */

import { useMemo, useState } from "react";
import { joinParts, money, timeAgo } from "@/lib/format";
import { copy, rateList, replyFor } from "@/lib/whatsapp";
import { TIERS, type Product, type Session, type Status, type Tier } from "@/lib/types";
import { EmptyState } from "./ui/controls";
import { Icon } from "./ui/Icon";

type SortKey = "code" | "recent" | "priceHigh" | "priceLow";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "code", label: "Article code" },
  { value: "recent", label: "Recently updated" },
  { value: "priceHigh", label: "Rate: high to low" },
  { value: "priceLow", label: "Rate: low to high" },
];

const TIER_LABEL: Record<Tier, string> = {
  retail: "Retail",
  reseller: "Reseller",
  wholesale: "Wholesale",
};

const STATUS_BADGE: Record<Status, string> = {
  Available: "badge-ink",
  New: "badge-amber",
  "Low stock": "badge-amber",
  "Sold out": "badge-danger",
};

export function CatalogueView({
  products,
  session,
  categories,
  collections,
  onEdit,
  onDuplicate,
  onDelete,
  onMakeCard,
  onAdd,
  onNotify,
}: {
  products: Product[];
  session: Session;
  categories: string[];
  collections: string[];
  onEdit: (product: Product) => void;
  onDuplicate: (product: Product) => void;
  onDelete: (product: Product) => void;
  onMakeCard: (product: Product) => void;
  onAdd: () => void;
  onNotify: (message: string, tone?: "info" | "success" | "error") => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [collection, setCollection] = useState("All");
  const [sort, setSort] = useState<SortKey>("code");
  // Staff have no trade rates to show, so retail is the only meaningful column.
  const tiers = session.canSeeTradeRates ? TIERS : (["retail"] as const);
  const [tier, setTier] = useState<Tier>(session.canSeeTradeRates ? "reseller" : "retail");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = products.filter((p) => {
      if (category !== "All" && p.category !== category) return false;
      if (collection !== "All" && p.collection !== collection) return false;
      if (!needle) return true;
      return [p.code, p.name, p.fabric, p.colours.join(" "), p.collection, p.notes]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
    return sortProducts(matches, sort, tier);
  }, [products, query, category, collection, sort, tier]);

  const stats = useMemo(
    () => ({
      total: products.length,
      soldOut: products.filter((p) => p.status === "Sold out").length,
      noPhoto: products.filter((p) => p.photos.length === 0).length,
      noRate: products.filter((p) => p.prices[tier] == null).length,
    }),
    [products, tier],
  );

  if (products.length === 0) {
    return (
      <EmptyState
        icon="archive"
        title="The catalogue is empty"
        body="Add your first article — a code, a photo, and your rates. Everything is saved on this device the moment you press save."
        action={
          <button type="button" className="btn btn-primary" onClick={onAdd}>
            <Icon name="plus" size={16} />
            Add the first article
          </button>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h1 className="mt-1 text-3xl">
            {stats.total} {stats.total === 1 ? "article" : "articles"}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={() =>
              copy(rateList(visible, tier)).then((ok) =>
                onNotify(
                  ok
                    ? `${TIER_LABEL[tier]} rate list copied — ${visible.length} articles.`
                    : "Couldn't reach the clipboard.",
                  ok ? "success" : "error",
                ),
              )
            }
          >
            <Icon name="copy" size={15} />
            Copy rate list
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onAdd}>
            <Icon name="plus" size={15} />
            Add article
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------ health */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat value={stats.total} label="In catalogue" />
        <Stat value={stats.soldOut} label="Sold out" warn={stats.soldOut > 0} />
        <Stat value={stats.noPhoto} label="Missing a photo" warn={stats.noPhoto > 0} />
        <Stat
          value={stats.noRate}
          label={`No ${TIER_LABEL[tier].toLowerCase()} rate`}
          warn={stats.noRate > 0}
        />
      </div>

      {/* ------------------------------------------------------------ filter */}
      <div className="plate mb-6 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-56 flex-1">
            <Icon
              name="search"
              size={17}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-shell-500"
            />
            <input
              type="search"
              className="input pl-10"
              placeholder="Search code, fabric, colour, note…"
              aria-label="Search the catalogue"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <select
            className="input w-auto"
            aria-label="Sort by"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <select
            className="input w-auto"
            aria-label="Rates to show"
            value={tier}
            onChange={(e) => setTier(e.target.value as Tier)}
          >
            {tiers.map((t) => (
              <option key={t} value={t}>
                Show {TIER_LABEL[t].toLowerCase()} rates
              </option>
            ))}
          </select>
        </div>

        {(categories.length > 1 || collections.length > 1) && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-shell-100 pt-3">
            <FilterRow
              label="Category"
              options={categories}
              value={category}
              onChange={setCategory}
            />
            <FilterRow
              label="Collection"
              options={collections}
              value={collection}
              onChange={setCollection}
            />
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------- list */}
      {visible.length === 0 ? (
        <EmptyState
          icon="search"
          title="Nothing matches"
          body="Try a shorter search, or clear the category and collection filters."
          action={
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => {
                setQuery("");
                setCategory("All");
                setCollection("All");
              }}
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {visible.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              session={session}
              tier={tier}
              onEdit={() => onEdit(product)}
              onDuplicate={() => onDuplicate(product)}
              onDelete={() => onDelete(product)}
              onMakeCard={() => onMakeCard(product)}
              onNotify={onNotify}
            />
          ))}
        </ul>
      )}

      <p className="mt-8 text-center text-xs text-shell-500">
        Showing {visible.length} of {products.length}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------- row */

function ProductRow({
  product,
  session,
  tier,
  onEdit,
  onDuplicate,
  onDelete,
  onMakeCard,
  onNotify,
}: {
  product: Product;
  session: Session;
  tier: Tier;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMakeCard: () => void;
  onNotify: (message: string, tone?: "info" | "success" | "error") => void;
}) {
  const cover = product.photos[0]?.url;
  const description = joinParts([product.fabric, product.pieces, product.colours.join(", ")]);

  return (
    <li className="plate animate-rise flex flex-col overflow-hidden transition-shadow hover:shadow-lift">
      <div className="flex gap-4 p-4">
        <div className="relative size-24 shrink-0 overflow-hidden rounded-md border border-shell-200 bg-shell-100">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="size-full object-cover" />
          ) : (
            <span className="grid size-full place-items-center text-shell-300">
              <Icon name="image" size={20} />
            </span>
          )}
          {product.photos.length > 1 && (
            <span className="absolute bottom-1 right-1 rounded bg-ink-950/75 px-1.5 py-0.5 text-[0.625rem] font-semibold text-shell-50">
              {product.photos.length}
            </span>
          )}
        </div>

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-ui text-lg font-semibold tracking-wide text-ink-800">
              {product.code}
            </h3>
            <span className="badge badge-ink">{product.stitch}</span>
            {product.status !== "Available" && (
              <span className={`badge ${STATUS_BADGE[product.status]}`}>{product.status}</span>
            )}
            {!product.published && (
              <span className="badge badge-amber" title="Not visible to customers">
                Draft
              </span>
            )}
          </div>

          {product.name && <p className="mt-0.5 text-sm text-shell-900">{product.name}</p>}
          <p className="mt-1 text-sm text-shell-600">{description || "No details yet"}</p>

          <dl className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <div className="flex items-baseline gap-1.5">
              <dt className="text-xs text-shell-500">{TIER_LABEL[tier]}</dt>
              <dd className="numeric font-semibold text-shell-900">{money(product.prices[tier])}</dd>
            </div>
            {tier === "wholesale" && product.moq && (
              <div className="flex items-baseline gap-1.5">
                <dt className="text-xs text-shell-500">Min</dt>
                <dd className="numeric text-shell-900">{product.moq} pcs</dd>
              </div>
            )}
            <div className="flex items-baseline gap-1.5">
              <dt className="sr-only">Updated</dt>
              <dd className="text-xs text-shell-500">{timeAgo(product.updatedAt)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap gap-1 border-t border-shell-100 bg-shell-50/60 px-3 py-2">
        <button
          type="button"
          className="btn btn-amber btn-sm"
          onClick={() =>
            copy(replyFor(product, tier)).then((ok) =>
              onNotify(
                ok ? `${TIER_LABEL[tier]} reply copied.` : "Couldn't reach the clipboard.",
                ok ? "success" : "error",
              ),
            )
          }
        >
          <Icon name="whatsapp" size={15} />
          {TIER_LABEL[tier]} reply
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onMakeCard}>
          <Icon name="card" size={15} />
          Card
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>
          <Icon name="edit" size={15} />
          Edit
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDuplicate}>
          <Icon name="copy" size={15} />
          Duplicate
        </button>
        {session.canDelete && (
          <button
            type="button"
            className="btn btn-danger btn-sm ml-auto"
            onClick={onDelete}
            aria-label={`Delete ${product.code}`}
          >
            <Icon name="trash" size={15} />
          </button>
        )}
      </div>
    </li>
  );
}

/* --------------------------------------------------------------- fragments */

function Stat({ value, label, warn = false }: { value: number; label: string; warn?: boolean }) {
  return (
    <div className="plate p-3.5">
      <p
        className={`numeric font-display text-2xl leading-none ${
          warn ? "text-amber-700" : "text-ink-800"
        }`}
      >
        {value}
      </p>
      <p className="mt-1.5 text-xs text-shell-600">{label}</p>
    </div>
  );
}

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="eyebrow">{label}</span>
      {["All", ...options].map((option) => (
        <button
          key={option}
          type="button"
          className="chip"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ sorting */

function sortProducts(products: Product[], sort: SortKey, tier: Tier): Product[] {
  const sorted = [...products];
  switch (sort) {
    case "recent":
      return sorted.sort((a, b) => b.updatedAt - a.updatedAt);
    case "priceHigh":
      return sorted.sort((a, b) => byRate(a, b, tier, -1));
    case "priceLow":
      return sorted.sort((a, b) => byRate(a, b, tier, 1));
    default:
      return sorted.sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true }));
  }
}

/** Articles with no rate sink to the bottom either way — a blank isn't zero. */
function byRate(a: Product, b: Product, tier: Tier, direction: 1 | -1): number {
  const left = a.prices[tier];
  const right = b.prices[tier];
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return direction * (left - right);
}
