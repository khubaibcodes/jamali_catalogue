"use client";

/**
 * The shell: navigation, backup, and the wiring between the three views.
 *
 * All catalogue state lives in `useProducts`; all transient feedback lives in
 * `useToast`. This component owns only "what am I looking at right now", which
 * keeps it short enough to read in one sitting.
 */

import { useRef, useState } from "react";
import { useProducts } from "@/hooks/useProducts";
import { useToast } from "@/hooks/useToast";
import { exportBackup, exportCsv, parseBackup } from "@/lib/backup";
import { brand } from "@/lib/brand";
import type { Product, ProductDraft } from "@/lib/types";
import { CatalogueView } from "./CatalogueView";
import { CardStudio } from "./CardStudio";
import { ProductForm } from "./ProductForm";
import { ConfirmDialog, EmptyState, ToastHost } from "./ui/controls";
import { Icon, type IconName } from "./ui/Icon";

type View = "catalogue" | "editor" | "studio";

const NAV: { view: View; label: string; icon: IconName }[] = [
  { view: "catalogue", label: "Catalogue", icon: "grid" },
  { view: "editor", label: "Add", icon: "plus" },
  { view: "studio", label: "Cards", icon: "card" },
];

export function CatalogueManager() {
  const catalogue = useProducts();
  const { toast, show, dismiss, attempt } = useToast();

  const [view, setView] = useState<View>("catalogue");
  const [editing, setEditing] = useState<Product | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [studioId, setStudioId] = useState("");
  const restoreInput = useRef<HTMLInputElement>(null);

  /* ------------------------------------------------------------ navigation */

  const openEditor = (product: Product | null) => {
    setEditing(product);
    setView("editor");
  };

  const openStudio = (product: Product) => {
    setStudioId(product.id);
    setView("studio");
  };

  const goToCatalogue = () => {
    setEditing(null);
    setView("catalogue");
  };

  /* --------------------------------------------------------------- actions */

  async function saveProduct(draft: ProductDraft) {
    await attempt(async () => {
      const saved = await catalogue.upsert(draft, editing?.id);
      show(editing ? `${saved.code} updated.` : `${saved.code} added.`, "success");
      goToCatalogue();
    });
  }

  const duplicate = (product: Product) =>
    attempt(async () => {
      const copy = await catalogue.duplicate(product);
      show(`Copied to ${copy.code} — edit it now.`);
      openEditor(copy);
    });

  const confirmDelete = () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    void attempt(async () => {
      await catalogue.remove(target.id);
      if (studioId === target.id) setStudioId("");
      show(`${target.code} deleted.`);
    });
  };

  const restore = (file: File | undefined) =>
    file &&
    attempt(async () => {
      const rows = await parseBackup(file);
      await catalogue.restore(rows);
      show(`Restored ${rows.length} articles.`, "success");
      goToCatalogue();
    });

  /* ------------------------------------------------------------------ views */

  const body = () => {
    if (catalogue.state === "loading") return <LoadingSkeleton />;

    if (catalogue.state === "error") {
      return (
        <EmptyState
          icon="warning"
          title="The catalogue couldn't be opened"
          body={
            catalogue.error ??
            "Storage is unavailable. Private-browsing windows often block it — try a normal window."
          }
        />
      );
    }

    switch (view) {
      case "editor":
        return (
          <ProductForm
            editing={editing}
            categories={catalogue.categories}
            collections={catalogue.collections}
            isCodeTaken={catalogue.isCodeTaken}
            onSubmit={saveProduct}
            onCancel={goToCatalogue}
            onNotify={show}
          />
        );
      case "studio":
        return (
          <CardStudio
            products={catalogue.products}
            selectedId={studioId}
            onSelect={setStudioId}
            onAdd={() => openEditor(null)}
            onNotify={show}
          />
        );
      default:
        return (
          <CatalogueView
            products={catalogue.products}
            categories={catalogue.categories}
            collections={catalogue.collections}
            onEdit={openEditor}
            onDuplicate={duplicate}
            onDelete={setPendingDelete}
            onMakeCard={openStudio}
            onAdd={() => openEditor(null)}
            onNotify={show}
          />
        );
    }
  };

  const hasProducts = catalogue.products.length > 0;

  return (
    <div className="min-h-dvh">
      {/* ---------------------------------------------------------- masthead */}
      <header className="sticky top-0 z-30 border-b border-sand-200 bg-sand-50/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <div className="flex-1">
            <p className="wordmark text-lg text-emerald-800 sm:text-xl">{brand.name}</p>
            <p className="mt-0.5 text-[0.625rem] uppercase tracking-[0.2em] text-gold-700">
              {brand.purpose}
            </p>
          </div>

          <nav aria-label="Sections" className="hidden gap-1 sm:flex">
            {NAV.map((item) => (
              <NavButton
                key={item.view}
                {...item}
                active={view === item.view}
                onClick={() => (item.view === "editor" ? openEditor(null) : setView(item.view))}
              />
            ))}
          </nav>

          {hasProducts && (
            <div className="hidden items-center gap-1 border-l border-sand-200 pl-2 md:flex">
              <IconButton
                icon="download"
                label="Download a backup"
                onClick={() => {
                  exportBackup(catalogue.products);
                  show("Backup downloaded — keep it somewhere safe.", "success");
                }}
              />
              <IconButton
                icon="archive"
                label="Export rates as CSV"
                onClick={() => {
                  exportCsv(catalogue.products);
                  show("Rate sheet downloaded.", "success");
                }}
              />
              <IconButton
                icon="upload"
                label="Restore from a backup"
                onClick={() => restoreInput.current?.click()}
              />
            </div>
          )}
        </div>
        <div className="rule-gold" />
      </header>

      <main className="px-4 py-6 pb-28 sm:py-10 sm:pb-10">{body()}</main>

      {/* ------------------------------------------------------ mobile tabs */}
      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-sand-200 bg-sand-50/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
      >
        {NAV.map((item) => {
          const active = view === item.view;
          return (
            <button
              key={item.view}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => (item.view === "editor" ? openEditor(null) : setView(item.view))}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.6875rem] font-medium transition-colors ${
                active ? "text-emerald-800" : "text-sand-500"
              }`}
            >
              <Icon name={item.icon} size={20} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* ------------------------------------------------------------ footer */}
      <footer className="border-t border-sand-200 px-4 py-6 text-center text-xs leading-relaxed text-sand-500 max-sm:hidden">
        <p>
          Saved on this device only. Download a backup regularly — clearing browser data erases the
          catalogue.
        </p>
        <p className="mt-1">
          {brand.name} · {brand.website}
        </p>
      </footer>

      <input
        ref={restoreInput}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(event) => {
          void restore(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${pendingDelete?.code ?? ""}?`}
        body="The article and its photos are removed from this device. A downloaded backup is the only way to get them back."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <ToastHost toast={toast} onDismiss={dismiss} />
    </div>
  );
}

/* --------------------------------------------------------------- fragments */

function NavButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: IconName;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`btn btn-sm ${active ? "btn-primary" : "btn-ghost"}`}
    >
      <Icon name={icon} size={15} />
      {label}
    </button>
  );
}

function IconButton({
  icon,
  label,
  onClick,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className="btn btn-ghost btn-sm">
      <Icon name={icon} size={16} />
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-6xl" aria-busy="true" aria-label="Loading the catalogue">
      <div className="skeleton mb-6 h-9 w-52 rounded-md" />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton h-20 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton h-40 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
