import { describe, expect, it } from "vitest";
import JSZip from "jszip";

import { createWorkspaceBackupBlob, previewWorkspaceBackup } from "@/lib/workspace-backup";
import type { Document, Folder } from "@/types/content";
import type { WorkspaceBackupManifestV1 } from "@/types/backup";

const timestamp = "2026-09-01T00:00:00.000Z";
const folders: Folder[] = [
  { id: "root", name: "Research 🧭", parentId: null, order: 0, createdAt: timestamp, updatedAt: timestamp },
  { id: "nested", name: "เปิดตัว", parentId: "root", order: 0, createdAt: timestamp, updatedAt: timestamp },
  { id: "empty", name: "Empty", parentId: null, order: 1, createdAt: timestamp, updatedAt: timestamp }
];
const documents: Document[] = [
  { id: "booked", title: "Brief.md", body: "# Launch", folderId: "nested", order: 0, createdAt: timestamp, updatedAt: timestamp },
  { id: "duplicate", title: "Brief!", body: "Second", folderId: "nested", order: 1, createdAt: timestamp, updatedAt: timestamp },
  { id: "loose", title: "Scratch.md", body: "Loose note", folderId: null, order: 0, createdAt: timestamp, updatedAt: timestamp }
];

function readBlob(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

async function editableBackup() {
  const blob = await createWorkspaceBackupBlob({ appVersion: "0.1.0", workspace: { kind: "local", id: null, name: "Local Library" }, folders, documents, githubSources: [] });
  const zip = await JSZip.loadAsync(await readBlob(blob));
  const manifest = JSON.parse(await zip.file("manifest.json")!.async("string")) as WorkspaceBackupManifestV1;
  return { zip, manifest };
}

async function backupFile(zip: JSZip) {
  return new File([await zip.generateAsync({ type: "blob" })], "library.mdez.zip");
}

describe("workspace backups", () => {
  it("round-trips nested, empty, duplicate, and unbooked Markdown", async () => {
    const blob = await createWorkspaceBackupBlob({ appVersion: "0.1.0", workspace: { kind: "local", id: null, name: "Local Library" }, folders, documents, githubSources: [] });
    const zip = await JSZip.loadAsync(await readBlob(blob));
    expect(Object.keys(zip.files)).toContain("manifest.json");
    const preview = await previewWorkspaceBackup(new File([blob], "library.mdez.zip"));
    expect(preview.folderCount).toBe(folders.length);
    expect(preview.documentCount).toBe(documents.length);
    expect(preview.parsed.documents.map((item) => item.body)).toEqual(expect.arrayContaining(documents.map((item) => item.body)));
    expect(preview.parsed.manifest.documents.map((item) => item.path)).toContain("pages-without-book/scratch.md");
    expect(JSON.stringify(preview.parsed.manifest)).not.toMatch(/managementToken|accessKey|\"key\"/);
  });

  it("rejects files without the backup extension", async () => {
    await expect(previewWorkspaceBackup(new File(["nope"], "library.zip"))).rejects.toThrow("Choose an Mdez workspace backup ending in .mdez.zip.");
  });

  it("rejects a highly compressed Markdown page that inflates beyond the safe entry limit", async () => {
    const { zip, manifest } = await editableBackup();
    zip.file(manifest.documents[0].path, "A".repeat(10 * 1024 * 1024 + 1));
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 9 } });
    expect(blob.size).toBeLessThan(1024 * 1024);

    await expect(previewWorkspaceBackup(new File([blob], "library.mdez.zip"))).rejects.toThrow("A file in the backup expands beyond 10 MB.");
  });

  it("rejects unsafe and undeclared archive paths", async () => {
    const { zip } = await editableBackup();
    zip.file("undeclared.md", "unsafe");
    await expect(previewWorkspaceBackup(await backupFile(zip))).rejects.toThrow("The backup contains an undeclared Markdown file.");
  });

  it("rejects unsupported versions and duplicate IDs", async () => {
    const versioned = await editableBackup();
    versioned.zip.file("manifest.json", JSON.stringify({ ...versioned.manifest, schemaVersion: 2 }));
    await expect(previewWorkspaceBackup(await backupFile(versioned.zip))).rejects.toThrow("This backup version is not supported.");

    const duplicated = await editableBackup();
    duplicated.manifest.folders.push({ ...duplicated.manifest.folders[0] });
    duplicated.zip.file("manifest.json", JSON.stringify(duplicated.manifest));
    await expect(previewWorkspaceBackup(await backupFile(duplicated.zip))).rejects.toThrow("The backup contains duplicate book IDs.");
  });

  it("rejects missing files, unsafe paths, missing books, and cycles", async () => {
    const missing = await editableBackup();
    missing.zip.remove(missing.manifest.documents[0].path);
    await expect(previewWorkspaceBackup(await backupFile(missing.zip))).rejects.toThrow("The backup is missing a declared Markdown file.");

    const unsafe = await editableBackup();
    unsafe.manifest.documents[0].path = "../outside.md";
    unsafe.zip.file("manifest.json", JSON.stringify(unsafe.manifest));
    await expect(previewWorkspaceBackup(await backupFile(unsafe.zip))).rejects.toThrow("The backup contains an unsafe file path.");

    const missingBook = await editableBackup();
    missingBook.manifest.documents[0].folderId = "absent";
    missingBook.zip.file("manifest.json", JSON.stringify(missingBook.manifest));
    await expect(previewWorkspaceBackup(await backupFile(missingBook.zip))).rejects.toThrow("The backup references a missing book.");

    const cyclic = await editableBackup();
    cyclic.manifest.folders[0].parentId = "nested";
    cyclic.zip.file("manifest.json", JSON.stringify(cyclic.manifest));
    await expect(previewWorkspaceBackup(await backupFile(cyclic.zip))).rejects.toThrow("The backup contains a book cycle.");
  });
});
