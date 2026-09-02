export type Folder = {
  id: string;
  name: string;
  sourceId?: string;
  parentId: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type Document = {
  id: string;
  title: string;
  body: string;
  sourceId?: string;
  folderId: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type SaveStatus = "Saved" | "Saving..." | "Unsaved";

export type ViewMode = "shelf" | "editor" | "preview" | "split";

export type TitleFocusRequest = {
  documentId: string;
  requestId: number;
} | null;
