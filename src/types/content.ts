export type Folder = {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type Document = {
  id: string;
  title: string;
  body: string;
  folderId: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type SaveStatus = "Saved" | "Saving..." | "Unsaved";

export type ViewMode = "shelf" | "editor" | "preview" | "split";
