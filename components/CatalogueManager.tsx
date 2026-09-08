"use client";

/**
 * The shell: navigation, backup, sign-out, and the wiring between views.
 *
 * The article being edited is held as an *id*, not an object. Photo uploads
 * mutate the product inside `useProducts`, and a snapshot copy would go stale
 * the moment a photo was added — the panel would keep rendering the old list.
 */

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProducts } from "@/hooks/useProducts";
import { useToast } from "@/hooks/useToast";
import { exportBackup, exportCsv, importBackup } from "@/lib/backup";
import { brand } from "@/lib/brand";
import type { Product, ProductDraft, Session } from "@/lib/types";
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

export function CatalogueManager({ session }: { session: Session }) {
  const catalogue = useProducts(session);
  const { toast, show, dismiss, attempt } = useToast();
  const router = useRouter();

  const [view, setView] = useState<View>("catalogue");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [studioId, setStudioId] = useState("");
  const [importing, setImporting] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);

  // Always the live copy, so photo changes appear immediately.
  const editing = catalogue.products.find((p) => p.id === editingId) ?? null;

  /* ------------------------------------------------------------ navigation */

  const openEditor = (product: Product | null) => {
    setEditingId(product?.id ?? null);
    setView("editor");
  };

  const openStudio = (product: Product) => {
    setStudioId(product.id);
    setView("studio");
  };

  const goToCatalogue = () => {
    setEditingId(null);
    setView("catalogue");
  };

  /* --------------------------------------------------------------- actions */

  async function saveProduct(draft: ProductDraft) {
    const saved = await catalogue.upsert(draft, editing?.id);
    if (editing) {
      show(`${saved.code} updated.`, "success");
      goToCatalogue();
    } else {
      // Keep a new article open so its photos can be attached straight away.
      setEditingId(saved.id);
      show(`${saved.code} added — now add its photos.`, "success");
    }
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
      await catalogue.remove(target);
      if (studioId === target.id) setStudioId("");
      if (editingId === target.id) goToCatalogue();
      show(`${target.code} deleted.`);
    });
  };

  const runImport = (file: File | undefined) => {
    if (!file) return;
    setImporting(true);
    void attempt(async () => {
      try {
        const result = await importBackup(
          catalogue.supabase,
          file,
          session.canSeeTradeRates,
        );
        await catalogue.reload();
        const parts = [`Imported ${result.imported} article(s)`];
        if (result.photosUploaded) parts.push(`${result.photosUploaded} photo(s)`);
        if (result.skipped.length) parts.push(`skipped ${result.skipped.length} already present`);
        if (result.photosFailed) parts.push(`${result.photosFailed} photo(s) failed`);
        show(`${parts.join(" · ")}. Imported articles start as drafts.`, "success");
      } finally {
        setImporting(false);
      }
    });
  };

  async function signOut() {
    await catalogue.supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  /* ------------------------------------------------------------------ views */

  const body = () => {
    if (catalogue.state === "loading") return <LoadingSkeleton />;

    if (catalogue.state === "error") {
      return (
        <EmptyState
          icon="warning"
          title="The catalogue couldn't be loaded"
          body={catalogue.error ?? "The database didn't respond. Try again in a moment."}
        />
      );
    }

    switch (view) {
      case "editor":
        return (
          <ProductForm
            key={editingId ?? "new"}
            editing={editing}
            session={session}
            categories={catalogue.categories}
            collections={catalogue.collections}
            isCodeTaken={catalogue.codeTaken}
            onSubmit={saveProduct}
            onCancel={goToCatalogue}
            onAddPhoto={catalogue.addPhoto}
            onRemovePhoto={catalogue.removePhoto}
            onMakeCover={catalogue.makeCover}
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
            session={session}
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
      <header className="sticky top-0 z-30 border-b border-shell-200 bg-shell-50/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <div className="flex-1">
            <p className="wordmark text-lg text-ink-800 sm:text-xl">{brand.name}</p>
            <p className="mt-0.5 text-[0.625rem] uppercase tracking-[0.2em] text-amber-700">
              {brand.purpose}
            </p>
          </div>

          {/* The phone-first capture screen. Separate from "Add" above, which
              opens the full desk form. */}
          <Link href="/admin/add" className="btn btn-amber btn-sm">
            <Icon name="image" size={15} />
            <span className="max-sm:sr-only">Quick add</span>
          </Link>

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

          <div className="hidden items-center gap-1 border-l border-shell-200 pl-2 md:flex">
            {hasProducts && (
              <>
                <IconButton
                  icon="download"
                  label="Download a snapshot"
                  onClick={() => {
                    exportBackup(catalogue.products);
                    show("Snapshot downloaded.", "success");
                  }}
                />
                <IconButton
                  icon="archive"
                  label="Export rates as CSV"
                  onClick={() => {
                    exportCsv(catalogue.products, session.canSeeTradeRates);
                    show("Rate sheet downloaded.", "success");
                  }}
                />
              </>
            )}
            <IconButton
              icon="upload"
              label="Import a backup from the old app"
              onClick={() => importInput.current?.click()}
            />
          </div>

          <div className="flex items-center gap-2 border-l border-shell-200 pl-2">
            {/* Only owners may invite, and the page redirects staff away, so
                there is nothing to gain by showing them the door. */}
            {session.role === "owner" && (
              <Link href="/admin/team" className="btn btn-ghost btn-sm">
                <Icon name="people" size={15} />
                <span className="max-lg:sr-only">Team</span>
              </Link>
            )}
            <span className="hidden text-xs text-shell-600 lg:block">
              {session.email}
              <span className="ml-1 text-shell-500">({session.role})</span>
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </div>
        <div className="rule-amber" />
      </header>

      {importing && (
        <p className="bg-ink-800 px-4 py-2 text-center text-sm text-shell-50">
          Importing — uploading photos can take a minute. Don&apos;t close this tab.
        </p>
      )}

      <main className="px-4 py-6 pb-28 sm:py-10 sm:pb-10">{body()}</main>

      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-shell-200 bg-shell-50/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
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
                active ? "text-ink-800" : "text-shell-500"
              }`}
            >
              <Icon name={item.icon} size={20} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <footer className="border-t border-shell-200 px-4 py-6 text-center text-xs leading-relaxed text-shell-500 max-sm:hidden">
        <p>
          Stored in the Jamaali database. Signed in as {session.email}.
        </p>
        <p className="mt-1">
          {brand.name} · {brand.website}
        </p>
      </footer>

      <input
        ref={importInput}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(event) => {
          runImport(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${pendingDelete?.code ?? ""}?`}
        body="The article, its rates and its photos are removed permanently."
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
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="btn btn-ghost btn-sm"
    >
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
