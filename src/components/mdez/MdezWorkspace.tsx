"use client";

import { useEffect, useMemo, useState } from "react";

import { listContent } from "@/lib/repository";
import type { Document, Folder, MobileTab, SaveStatus, ViewMode } from "@/types/content";
import { Mascot } from "@/components/mdez/Mascot";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

const viewOptions: { value: ViewMode; label: string }[] = [
  { value: "split", label: "Split" },
  { value: "editor", label: "Edit" },
  { value: "preview", label: "Read" }
];

const mobileOptions: { value: MobileTab; label: string }[] = [
  { value: "files", label: "Files" },
  { value: "edit", label: "Edit" },
  { value: "read", label: "Read" }
];

export function MdezWorkspace() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [mobileTab, setMobileTab] = useState<MobileTab>("files");
  const [saveStatus] = useState<SaveStatus>("Saved");
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let alive = true;

    listContent()
      .then((content) => {
        if (!alive) {
          return;
        }

        setFolders(content.folders);
        setDocuments(content.documents);
        setSelectedDocumentId(content.documents[0]?.id ?? null);
        setSelectedFolderId(content.documents[0]?.folderId ?? null);
        setIsReady(true);
      })
      .catch(() => {
        if (!alive) {
          return;
        }

        setError("IndexedDB is unavailable. Mdez can show the workspace, but it cannot save local documents in this browser session.");
        setIsReady(true);
      });

    return () => {
      alive = false;
    };
  }, []);

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId]
  );

  const visibleDocuments = selectedFolderId === null ? documents : documents.filter((document) => document.folderId === selectedFolderId);
  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) ?? null;

  const showEditor = viewMode === "split" || viewMode === "editor";
  const showReader = viewMode === "split" || viewMode === "preview";
  const contentGridColumns = viewMode === "split" ? "lg:grid-cols-2" : "lg:grid-cols-1";

  function handleSelectFolder(folderId: string | null) {
    const firstDocument = folderId === null ? documents[0] : documents.find((document) => document.folderId === folderId);

    setSelectedFolderId(folderId);
    setSelectedDocumentId(firstDocument?.id ?? null);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-abyss text-cream">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(159,234,255,0.24),transparent_28%),radial-gradient(circle_at_84%_18%,rgba(200,168,255,0.18),transparent_24%),radial-gradient(circle_at_50%_95%,rgba(255,128,204,0.16),transparent_30%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1800px] flex-col px-4 py-4 sm:px-5 lg:px-6">
        <header className="mb-4 flex items-center justify-between gap-3 rounded-[2rem] border-2 border-white/70 bg-white/10 p-3 shadow-sticker lg:hidden">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ice">Mdez</p>
            <h1 className="truncate text-2xl font-black text-bubble">Workspace</h1>
          </div>
          <SegmentedControl label="Mobile workspace view" value={mobileTab} options={mobileOptions} onChange={setMobileTab} />
        </header>

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside
            className={`min-h-0 rounded-[2rem] border-2 border-white/70 bg-white/10 p-4 shadow-sticker lg:block ${
              mobileTab === "files" ? "block" : "hidden"
            }`}
          >
            <div className="flex h-full min-h-[calc(100vh-8rem)] flex-col gap-5 lg:min-h-0">
              <div className="text-center">
                <Mascot />
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-ice">Markdown Easy Reader</p>
                <h2 className="mt-1 text-4xl font-black text-bubble drop-shadow-[0_3px_0_rgba(255,255,255,0.95)]">Mdez</h2>
              </div>

              {error ? (
                <p className="rounded-3xl border-2 border-bubble/70 bg-bubble/15 p-3 text-sm font-semibold leading-6 text-cream" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-3xl border-2 border-white/60 bg-abyss/45 p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-cream/60">Folders</p>
                  <p className="mt-1 text-3xl font-black text-ice">{folders.length}</p>
                </div>
                <div className="rounded-3xl border-2 border-white/60 bg-abyss/45 p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-cream/60">Documents</p>
                  <p className="mt-1 text-3xl font-black text-mint">{documents.length}</p>
                </div>
              </div>

              <section className="min-h-0 flex-1 overflow-hidden rounded-3xl border-2 border-white/60 bg-abyss/45">
                <div className="border-b-2 border-white/40 px-4 py-3">
                  <h3 className="text-sm font-black uppercase tracking-[0.16em] text-cream/75">Files</h3>
                </div>
                <div className="max-h-[48vh] overflow-auto p-3 lg:max-h-none">
                  <button
                    type="button"
                    onClick={() => handleSelectFolder(null)}
                    aria-pressed={selectedFolderId === null}
                    className={`mb-2 w-full rounded-2xl px-3 py-2 text-left text-sm font-bold transition ${
                      selectedFolderId === null ? "bg-ice text-abyss" : "text-cream/80 hover:bg-white/10 hover:text-cream"
                    }`}
                  >
                    All documents
                  </button>

                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      type="button"
                      onClick={() => handleSelectFolder(folder.id)}
                      aria-pressed={selectedFolderId === folder.id}
                      className={`mb-2 w-full rounded-2xl px-3 py-2 text-left text-sm font-bold transition ${
                        selectedFolderId === folder.id ? "bg-ice text-abyss" : "text-cream/80 hover:bg-white/10 hover:text-cream"
                      }`}
                    >
                      {folder.name}
                    </button>
                  ))}

                  <div className="mt-4 border-t-2 border-white/30 pt-3">
                    {isReady && visibleDocuments.length === 0 ? (
                      <p className="rounded-2xl bg-white/10 p-3 text-sm leading-6 text-cream/70">No documents here yet.</p>
                    ) : null}
                    {!isReady ? <p className="rounded-2xl bg-white/10 p-3 text-sm leading-6 text-cream/70">Loading workspace...</p> : null}
                    {visibleDocuments.map((document) => (
                      <button
                        key={document.id}
                        type="button"
                        onClick={() => {
                          handleSelectFolder(document.folderId);
                          setSelectedDocumentId(document.id);
                          setMobileTab("edit");
                        }}
                        aria-pressed={selectedDocumentId === document.id}
                        className={`mb-2 w-full rounded-2xl px-3 py-2 text-left transition ${
                          selectedDocumentId === document.id ? "bg-bubble text-abyss" : "text-cream/80 hover:bg-white/10 hover:text-cream"
                        }`}
                      >
                        <span className="block truncate text-sm font-black">{document.title}</span>
                        <span className="mt-1 block truncate text-xs font-semibold opacity-70">{document.updatedAt}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          </aside>

          <section
            className={`min-h-0 rounded-[2rem] border-2 border-white/70 bg-white/10 p-4 shadow-sticker ${
              mobileTab === "files" ? "hidden lg:block" : "block"
            }`}
          >
            <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4 lg:min-h-0 lg:h-full">
              <div className="flex flex-col gap-3 border-b-2 border-white/40 pb-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-ice">
                    {selectedFolder ? selectedFolder.name : "All documents"}
                  </p>
                  <h2 className="mt-1 truncate text-3xl font-black text-cream">
                    {selectedDocument?.title ?? (isReady ? "No document selected" : "Loading workspace...")}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="rounded-full border-2 border-white/60 bg-abyss/45 px-3 py-1.5 text-sm font-bold text-cream/80">{saveStatus}</p>
                  <div className="hidden lg:block">
                    <SegmentedControl label="Workspace view" value={viewMode} options={viewOptions} onChange={setViewMode} />
                  </div>
                </div>
              </div>

              <div className={`grid min-h-0 flex-1 gap-4 ${contentGridColumns}`}>
                <article
                  className={`min-h-[24rem] rounded-3xl border-2 border-white/60 bg-abyss/55 p-4 ${
                    mobileTab === "edit" ? "block" : "hidden"
                  } ${showEditor ? "lg:block" : "lg:hidden"}`}
                >
                  <div className="flex h-full flex-col">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-mint">Editor</p>
                    <div className="mt-4 flex flex-1 items-center justify-center rounded-[1.5rem] border-2 border-dashed border-white/40 bg-white/5 p-6 text-center">
                      <p className="max-w-sm text-sm font-semibold leading-6 text-cream/70">
                        {selectedDocument
                          ? "Editor placeholder. Markdown editing arrives in the next task."
                          : "Choose a document to start editing."}
                      </p>
                    </div>
                  </div>
                </article>

                <article
                  className={`min-h-[24rem] rounded-3xl border-2 border-white/60 bg-cream p-4 text-abyss ${
                    mobileTab === "read" ? "block" : "hidden"
                  } ${showReader ? "lg:block" : "lg:hidden"}`}
                >
                  <div className="flex h-full flex-col">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-bubble">Reader</p>
                    <div className="mt-4 flex flex-1 items-center justify-center rounded-[1.5rem] border-2 border-dashed border-abyss/30 bg-white p-6 text-center">
                      <p className="max-w-sm text-sm font-semibold leading-6 text-abyss/65">
                        {selectedDocument
                          ? "Reader placeholder. Rendered markdown preview arrives in the next task."
                          : "Select a document to preview it here."}
                      </p>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
