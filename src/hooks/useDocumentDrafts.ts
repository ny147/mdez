"use client";

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LatestSaveQueue } from "@/lib/latest-save-queue";
import type { Document, SaveStatus } from "@/types/content";

export const SAVE_ERROR_MESSAGE = "Mdez could not save this page. Your current text remains visible in the editor.";

const SAVE_DELAY = 650;

type Options = {
  documents: Document[];
  selectedDocumentId: string | null;
  setDocuments: Dispatch<SetStateAction<Document[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
  persistBody: (id: string, body: string) => Promise<Document>;
  persistTitle: (id: string, title: string) => Promise<Document>;
};

export type DocumentDraftController = {
  liveDocuments: Document[];
  draftBody: string;
  draftTitle: string;
  saveStatus: SaveStatus;
  changeBody: (body: string) => void;
  changeTitle: (title: string) => void;
  renameTitleById: (id: string, title: string) => Promise<Document | null>;
};

type Values = Record<string, string>;
type Timers = Record<string, number | undefined>;
type Counters = Record<string, number | undefined>;

function valuesByDocument(documents: Document[], getValue: (document: Document) => string) {
  return Object.fromEntries(documents.map((document) => [document.id, getValue(document)]));
}

function syncDraftMap(
  currentDrafts: Values,
  documents: Document[],
  persistedValues: Values,
  getValue: (document: Document) => string
) {
  const nextDrafts: Values = {};
  let changed = false;

  for (const document of documents) {
    const persistedValue = getValue(document);
    const currentDraft = currentDrafts[document.id];
    const previousPersistedValue = persistedValues[document.id];
    const hasLocalDraft =
      currentDraft !== undefined &&
      previousPersistedValue !== undefined &&
      currentDraft !== previousPersistedValue;

    nextDrafts[document.id] = hasLocalDraft ? currentDraft : persistedValue;
    changed ||= currentDraft !== nextDrafts[document.id];
  }

  return changed || Object.keys(currentDrafts).length !== documents.length ? nextDrafts : currentDrafts;
}

function updateDraft(
  id: string,
  value: string,
  draftsRef: MutableRefObject<Values>,
  setDrafts: Dispatch<SetStateAction<Values>>
) {
  if (draftsRef.current[id] === value) return;
  const next = { ...draftsRef.current, [id]: value };
  draftsRef.current = next;
  setDrafts(next);
}

function clearSavingDraft(
  id: string,
  value: string,
  setSavingDrafts: Dispatch<SetStateAction<Values>>
) {
  setSavingDrafts((current) => {
    if (current[id] !== value) return current;
    const next = { ...current };
    delete next[id];
    return next;
  });
}

function retainActiveValues(current: Values, activeIds: Set<string>) {
  const entries = Object.entries(current).filter(([id]) => activeIds.has(id));
  return entries.length === Object.keys(current).length ? current : Object.fromEntries(entries);
}

function nextCounter(counters: MutableRefObject<Counters>, id: string) {
  const next = (counters.current[id] ?? 0) + 1;
  counters.current[id] = next;
  return next;
}

function decrementCounter(counters: MutableRefObject<Counters>, id: string) {
  const next = (counters.current[id] ?? 1) - 1;
  if (next > 0) counters.current[id] = next;
  else delete counters.current[id];
}

export function useDocumentDrafts({
  documents,
  selectedDocumentId,
  setDocuments,
  setError,
  persistBody,
  persistTitle
}: Options): DocumentDraftController {
  const initialBodies = () => valuesByDocument(documents, (document) => document.body);
  const initialTitles = () => valuesByDocument(documents, (document) => document.title);
  const [bodyDrafts, setBodyDrafts] = useState<Values>(initialBodies);
  const [titleDrafts, setTitleDrafts] = useState<Values>(initialTitles);
  const [savingBodies, setSavingBodies] = useState<Values>({});
  const [savingTitles, setSavingTitles] = useState<Values>({});

  const bodyDraftsRef = useRef(bodyDrafts);
  const titleDraftsRef = useRef(titleDrafts);
  const persistedBodiesRef = useRef(initialBodies());
  const persistedTitlesRef = useRef(initialTitles());
  const bodyTimersRef = useRef<Timers>({});
  const titleTimersRef = useRef<Timers>({});
  const bodyVersionsRef = useRef<Counters>({});
  const titleVersionsRef = useRef<Counters>({});
  const bodyRequestsRef = useRef<Counters>({});
  const titleRequestsRef = useRef<Counters>({});
  const knownBodyIdsRef = useRef(new Set<string>());
  const knownTitleIdsRef = useRef(new Set<string>());
  const documentsRef = useRef(documents);
  const selectedDocumentIdRef = useRef(selectedDocumentId);
  const mountedRef = useRef(true);
  const persistBodyRef = useRef(persistBody);
  const persistTitleRef = useRef(persistTitle);
  const setDocumentsRef = useRef(setDocuments);
  const setErrorRef = useRef(setError);

  documentsRef.current = documents;
  selectedDocumentIdRef.current = selectedDocumentId;
  persistBodyRef.current = persistBody;
  persistTitleRef.current = persistTitle;
  setDocumentsRef.current = setDocuments;
  setErrorRef.current = setError;

  const bodyQueue = useMemo(
    () => new LatestSaveQueue<string, Document>((id, body) => persistBodyRef.current(id, body)),
    []
  );
  const titleQueue = useMemo(
    () => new LatestSaveQueue<string, Document>((id, title) => persistTitleRef.current(id, title)),
    []
  );

  const documentSignature = JSON.stringify(
    documents.map((document) => [document.id, document.body, document.title])
  );

  const enqueueBody = useCallback(
    async (id: string, body: string, version: number) => {
      knownBodyIdsRef.current.add(id);
      nextCounter(bodyRequestsRef, id);
      setSavingBodies((current) => ({ ...current, [id]: body }));

      try {
        const updated = await bodyQueue.enqueue(id, body);
        if (!mountedRef.current) return null;
        clearSavingDraft(id, body, setSavingBodies);
        if (!updated) return null;

        const stillCurrent =
          bodyVersionsRef.current[id] === version &&
          bodyDraftsRef.current[id] === body &&
          documentsRef.current.some((document) => document.id === id);
        if (!stillCurrent) return null;

        setDocumentsRef.current((current) =>
          current.map((document) => (document.id === updated.id ? updated : document))
        );
        if (selectedDocumentIdRef.current === id) {
          setErrorRef.current((current) => (current === SAVE_ERROR_MESSAGE ? null : current));
        }
        return updated;
      } catch (error) {
        if (mountedRef.current) {
          clearSavingDraft(id, body, setSavingBodies);
          const stillCurrent =
            bodyVersionsRef.current[id] === version &&
            bodyDraftsRef.current[id] === body &&
            documentsRef.current.some((document) => document.id === id);
          if (stillCurrent && selectedDocumentIdRef.current === id) {
            setErrorRef.current(SAVE_ERROR_MESSAGE);
          }
        }
        throw error;
      } finally {
        decrementCounter(bodyRequestsRef, id);
      }
    },
    [bodyQueue]
  );

  const enqueueTitle = useCallback(
    async (id: string, title: string, version: number, reportSaveError: boolean) => {
      knownTitleIdsRef.current.add(id);
      nextCounter(titleRequestsRef, id);
      setSavingTitles((current) => ({ ...current, [id]: title }));

      try {
        const updated = await titleQueue.enqueue(id, title);
        if (!mountedRef.current) return null;
        clearSavingDraft(id, title, setSavingTitles);
        if (!updated) return null;

        const stillCurrent =
          titleVersionsRef.current[id] === version &&
          titleDraftsRef.current[id] === title &&
          documentsRef.current.some((document) => document.id === id);
        if (!stillCurrent) return null;

        if (updated.title !== title) {
          updateDraft(id, updated.title, titleDraftsRef, setTitleDrafts);
        }
        setDocumentsRef.current((current) =>
          current.map((document) => (document.id === updated.id ? updated : document))
        );
        if (selectedDocumentIdRef.current === id) {
          setErrorRef.current((current) => (current === SAVE_ERROR_MESSAGE ? null : current));
        }
        return updated;
      } catch (error) {
        if (mountedRef.current) {
          clearSavingDraft(id, title, setSavingTitles);
          const stillCurrent =
            titleVersionsRef.current[id] === version &&
            titleDraftsRef.current[id] === title &&
            documentsRef.current.some((document) => document.id === id);
          if (reportSaveError && stillCurrent && selectedDocumentIdRef.current === id) {
            setErrorRef.current(SAVE_ERROR_MESSAGE);
          }
        }
        throw error;
      } finally {
        decrementCounter(titleRequestsRef, id);
      }
    },
    [titleQueue]
  );

  const scheduleBodySave = useCallback(
    (id: string, body: string) => {
      knownBodyIdsRef.current.add(id);
      const version = nextCounter(bodyVersionsRef, id);
      window.clearTimeout(bodyTimersRef.current[id]);
      delete bodyTimersRef.current[id];

      const restoringActiveSave = (bodyRequestsRef.current[id] ?? 0) > 0;
      if (body === persistedBodiesRef.current[id] && !restoringActiveSave) {
        clearSavingDraft(id, body, setSavingBodies);
        return;
      }

      bodyTimersRef.current[id] = window.setTimeout(() => {
        delete bodyTimersRef.current[id];
        if (
          !mountedRef.current ||
          bodyVersionsRef.current[id] !== version ||
          bodyDraftsRef.current[id] !== body ||
          !documentsRef.current.some((document) => document.id === id)
        ) {
          return;
        }
        void enqueueBody(id, body, version).catch(() => undefined);
      }, SAVE_DELAY);
    },
    [enqueueBody]
  );

  const scheduleTitleSave = useCallback(
    (id: string, title: string) => {
      knownTitleIdsRef.current.add(id);
      const version = nextCounter(titleVersionsRef, id);
      window.clearTimeout(titleTimersRef.current[id]);
      delete titleTimersRef.current[id];

      const restoringActiveSave = (titleRequestsRef.current[id] ?? 0) > 0;
      if (title === persistedTitlesRef.current[id] && !restoringActiveSave) {
        clearSavingDraft(id, title, setSavingTitles);
        return;
      }

      titleTimersRef.current[id] = window.setTimeout(() => {
        delete titleTimersRef.current[id];
        if (
          !mountedRef.current ||
          titleVersionsRef.current[id] !== version ||
          titleDraftsRef.current[id] !== title ||
          !documentsRef.current.some((document) => document.id === id)
        ) {
          return;
        }
        void enqueueTitle(id, title, version, true).catch(() => undefined);
      }, SAVE_DELAY);
    },
    [enqueueTitle]
  );

  const changeBody = useCallback(
    (body: string) => {
      const id = selectedDocumentIdRef.current;
      if (!id) return;
      updateDraft(id, body, bodyDraftsRef, setBodyDrafts);
      scheduleBodySave(id, body);
    },
    [scheduleBodySave]
  );

  const changeTitle = useCallback(
    (title: string) => {
      const id = selectedDocumentIdRef.current;
      if (!id) return;
      updateDraft(id, title, titleDraftsRef, setTitleDrafts);
      scheduleTitleSave(id, title);
    },
    [scheduleTitleSave]
  );

  const renameTitleById = useCallback(
    (id: string, title: string) => {
      if (!documentsRef.current.some((document) => document.id === id)) {
        return Promise.resolve(null);
      }
      knownTitleIdsRef.current.add(id);
      updateDraft(id, title, titleDraftsRef, setTitleDrafts);
      const version = nextCounter(titleVersionsRef, id);
      window.clearTimeout(titleTimersRef.current[id]);
      delete titleTimersRef.current[id];
      return enqueueTitle(id, title, version, false);
    },
    [enqueueTitle]
  );

  useEffect(() => {
    const activeIds = new Set(documentsRef.current.map((document) => document.id));
    const bodyWorkIds = new Set([
      ...knownBodyIdsRef.current,
      ...Object.keys(bodyTimersRef.current),
      ...Object.keys(bodyVersionsRef.current)
    ]);
    const titleWorkIds = new Set([
      ...knownTitleIdsRef.current,
      ...Object.keys(titleTimersRef.current),
      ...Object.keys(titleVersionsRef.current)
    ]);

    for (const id of bodyWorkIds) {
      if (activeIds.has(id)) continue;
      window.clearTimeout(bodyTimersRef.current[id]);
      delete bodyTimersRef.current[id];
      nextCounter(bodyVersionsRef, id);
      bodyQueue.clear(id);
      knownBodyIdsRef.current.delete(id);
    }
    for (const id of titleWorkIds) {
      if (activeIds.has(id)) continue;
      window.clearTimeout(titleTimersRef.current[id]);
      delete titleTimersRef.current[id];
      nextCounter(titleVersionsRef, id);
      titleQueue.clear(id);
      knownTitleIdsRef.current.delete(id);
    }

    const currentDocuments = documentsRef.current;
    const previousBodies = persistedBodiesRef.current;
    const previousTitles = persistedTitlesRef.current;
    setBodyDrafts((current) => {
      const next = syncDraftMap(current, currentDocuments, previousBodies, (document) => document.body);
      bodyDraftsRef.current = next;
      return next;
    });
    setTitleDrafts((current) => {
      const next = syncDraftMap(current, currentDocuments, previousTitles, (document) => document.title);
      titleDraftsRef.current = next;
      return next;
    });
    setSavingBodies((current) => retainActiveValues(current, activeIds));
    setSavingTitles((current) => retainActiveValues(current, activeIds));
    persistedBodiesRef.current = valuesByDocument(currentDocuments, (document) => document.body);
    persistedTitlesRef.current = valuesByDocument(currentDocuments, (document) => document.title);
  }, [bodyQueue, documentSignature, titleQueue]);

  const clearAllWork = useCallback(() => {
    const bodyIds = new Set([
      ...knownBodyIdsRef.current,
      ...Object.keys(bodyTimersRef.current),
      ...Object.keys(bodyVersionsRef.current)
    ]);
    const titleIds = new Set([
      ...knownTitleIdsRef.current,
      ...Object.keys(titleTimersRef.current),
      ...Object.keys(titleVersionsRef.current)
    ]);
    for (const id of bodyIds) {
      window.clearTimeout(bodyTimersRef.current[id]);
      bodyQueue.clear(id);
    }
    for (const id of titleIds) {
      window.clearTimeout(titleTimersRef.current[id]);
      titleQueue.clear(id);
    }
    bodyTimersRef.current = {};
    titleTimersRef.current = {};
  }, [bodyQueue, titleQueue]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearAllWork();
    };
  }, [clearAllWork]);

  const selectedDocument = documents.find((document) => document.id === selectedDocumentId) ?? null;
  const draftBody = selectedDocument ? bodyDrafts[selectedDocument.id] ?? selectedDocument.body : "";
  const draftTitle = selectedDocument ? titleDrafts[selectedDocument.id] ?? selectedDocument.title : "";
  const bodyIsSaving = selectedDocument ? savingBodies[selectedDocument.id] === draftBody : false;
  const titleIsSaving = selectedDocument ? savingTitles[selectedDocument.id] === draftTitle : false;
  const bodyIsDirty = selectedDocument ? draftBody !== selectedDocument.body : false;
  const titleIsDirty = selectedDocument ? draftTitle !== selectedDocument.title : false;
  const saveStatus: SaveStatus =
    bodyIsSaving || titleIsSaving ? "Saving..." : bodyIsDirty || titleIsDirty ? "Unsaved" : "Saved";
  const liveDocuments = useMemo(
    () =>
      documents.map((document) => ({
        ...document,
        body: bodyDrafts[document.id] ?? document.body,
        title: titleDrafts[document.id] ?? document.title
      })),
    [bodyDrafts, documents, titleDrafts]
  );

  return useMemo(
    () => ({
      liveDocuments,
      draftBody,
      draftTitle,
      saveStatus,
      changeBody,
      changeTitle,
      renameTitleById
    }),
    [changeBody, changeTitle, draftBody, draftTitle, liveDocuments, renameTitleById, saveStatus]
  );
}