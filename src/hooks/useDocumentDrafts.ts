"use client";

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

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
};

type Drafts = Record<string, string>;
type Timers = Record<string, number | undefined>;
type Versions = Record<string, number | undefined>;

function valuesByDocument(documents: Document[], getValue: (document: Document) => string) {
  return Object.fromEntries(documents.map((document) => [document.id, getValue(document)]));
}

function syncDraftMap(
  currentDrafts: Drafts,
  documents: Document[],
  persistedValues: Drafts,
  getValue: (document: Document) => string
) {
  const nextDrafts: Drafts = {};
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
  draftsRef: MutableRefObject<Drafts>,
  setDrafts: Dispatch<SetStateAction<Drafts>>
) {
  const next = { ...draftsRef.current, [id]: value };
  draftsRef.current = next;
  setDrafts(next);
}

function clearSavingDraft(
  id: string,
  value: string,
  setSavingDrafts: Dispatch<SetStateAction<Drafts>>
) {
  setSavingDrafts((current) => {
    if (current[id] !== value) return current;
    const next = { ...current };
    delete next[id];
    return next;
  });
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
  const [bodyDrafts, setBodyDrafts] = useState<Drafts>(initialBodies);
  const [titleDrafts, setTitleDrafts] = useState<Drafts>(initialTitles);
  const [savingBodies, setSavingBodies] = useState<Drafts>({});
  const [savingTitles, setSavingTitles] = useState<Drafts>({});

  const bodyDraftsRef = useRef(bodyDrafts);
  const titleDraftsRef = useRef(titleDrafts);
  const persistedBodiesRef = useRef(initialBodies());
  const persistedTitlesRef = useRef(initialTitles());
  const bodyTimersRef = useRef<Timers>({});
  const titleTimersRef = useRef<Timers>({});
  const bodyVersionsRef = useRef<Versions>({});
  const titleVersionsRef = useRef<Versions>({});
  const documentsRef = useRef(documents);
  const mountedRef = useRef(true);
  const persistBodyRef = useRef(persistBody);
  const persistTitleRef = useRef(persistTitle);

  documentsRef.current = documents;
  persistBodyRef.current = persistBody;
  persistTitleRef.current = persistTitle;

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

  useEffect(() => {
    const activeIds = new Set(documentsRef.current.map((document) => document.id));

    for (const id of Object.keys(bodyTimersRef.current)) {
      if (activeIds.has(id)) continue;
      window.clearTimeout(bodyTimersRef.current[id]);
      delete bodyTimersRef.current[id];
      delete bodyVersionsRef.current[id];
      bodyQueue.clear(id);
    }
    for (const id of Object.keys(titleTimersRef.current)) {
      if (activeIds.has(id)) continue;
      window.clearTimeout(titleTimersRef.current[id]);
      delete titleTimersRef.current[id];
      delete titleVersionsRef.current[id];
      titleQueue.clear(id);
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
    setSavingBodies((current) => Object.fromEntries(Object.entries(current).filter(([id]) => activeIds.has(id))));
    setSavingTitles((current) => Object.fromEntries(Object.entries(current).filter(([id]) => activeIds.has(id))));

    persistedBodiesRef.current = valuesByDocument(currentDocuments, (document) => document.body);
    persistedTitlesRef.current = valuesByDocument(currentDocuments, (document) => document.title);
  }, [bodyQueue, documentSignature, titleQueue]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      for (const [id, timer] of Object.entries(bodyTimersRef.current)) {
        window.clearTimeout(timer);
        bodyQueue.clear(id);
      }
      for (const [id, timer] of Object.entries(titleTimersRef.current)) {
        window.clearTimeout(timer);
        titleQueue.clear(id);
      }
      bodyTimersRef.current = {};
      titleTimersRef.current = {};
    };
  }, [bodyQueue, titleQueue]);

  function scheduleBodySave(id: string, body: string) {
    const version = (bodyVersionsRef.current[id] ?? 0) + 1;
    bodyVersionsRef.current[id] = version;
    window.clearTimeout(bodyTimersRef.current[id]);
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

      setSavingBodies((current) => ({ ...current, [id]: body }));
      void bodyQueue
        .enqueue(id, body)
        .then((updated) => {
          if (!mountedRef.current) return;
          clearSavingDraft(id, body, setSavingBodies);
          if (!updated) return;
          const stillCurrent =
            bodyVersionsRef.current[id] === version &&
            bodyDraftsRef.current[id] === body &&
            documentsRef.current.some((document) => document.id === id);
          if (!stillCurrent) return;

          setDocuments((current) => current.map((document) => (document.id === updated.id ? updated : document)));
          setError((current) => (current === SAVE_ERROR_MESSAGE ? null : current));
        })
        .catch(() => {
          if (!mountedRef.current) return;
          const stillCurrent = bodyVersionsRef.current[id] === version && bodyDraftsRef.current[id] === body;
          clearSavingDraft(id, body, setSavingBodies);
          if (stillCurrent) setError(SAVE_ERROR_MESSAGE);
        });
    }, SAVE_DELAY);
  }

  function scheduleTitleSave(id: string, title: string) {
    const version = (titleVersionsRef.current[id] ?? 0) + 1;
    titleVersionsRef.current[id] = version;
    window.clearTimeout(titleTimersRef.current[id]);
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

      setSavingTitles((current) => ({ ...current, [id]: title }));
      void titleQueue
        .enqueue(id, title)
        .then((updated) => {
          if (!mountedRef.current) return;
          clearSavingDraft(id, title, setSavingTitles);
          if (!updated) return;
          const stillCurrent =
            titleVersionsRef.current[id] === version &&
            titleDraftsRef.current[id] === title &&
            documentsRef.current.some((document) => document.id === id);
          if (!stillCurrent) return;

          if (updated.title !== title) {
            updateDraft(id, updated.title, titleDraftsRef, setTitleDrafts);
          }
          setDocuments((current) => current.map((document) => (document.id === updated.id ? updated : document)));
          setError((current) => (current === SAVE_ERROR_MESSAGE ? null : current));
        })
        .catch(() => {
          if (!mountedRef.current) return;
          const stillCurrent = titleVersionsRef.current[id] === version && titleDraftsRef.current[id] === title;
          clearSavingDraft(id, title, setSavingTitles);
          if (stillCurrent) setError(SAVE_ERROR_MESSAGE);
        });
    }, SAVE_DELAY);
  }

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

  return {
    liveDocuments,
    draftBody,
    draftTitle,
    saveStatus,
    changeBody: (body) => {
      if (!selectedDocumentId) return;
      updateDraft(selectedDocumentId, body, bodyDraftsRef, setBodyDrafts);
      scheduleBodySave(selectedDocumentId, body);
    },
    changeTitle: (title) => {
      if (!selectedDocumentId) return;
      updateDraft(selectedDocumentId, title, titleDraftsRef, setTitleDrafts);
      scheduleTitleSave(selectedDocumentId, title);
    }
  };
}