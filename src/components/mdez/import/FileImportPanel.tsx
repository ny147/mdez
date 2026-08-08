"use client";

export type FileImportPanelProps = {
  dragging: boolean;
  message: string;
  busy: boolean;
  onFiles: (files: FileList | File[]) => void;
  onDraggingChange: (dragging: boolean) => void;
};

export function FileImportPanel({
  dragging,
  message,
  busy,
  onFiles,
  onDraggingChange
}: FileImportPanelProps) {
  return (
    <div
      id="import-panel-files"
      role="tabpanel"
      aria-labelledby="import-source-files"
      className="mt-5"
    >
      <label
        data-drop-state={dragging ? "active" : "idle"}
        className={"flex cursor-pointer flex-col items-center justify-center gap-3 rounded border border-dashed border-border bg-panel px-4 py-8 text-center transition hover:border-accent hover:bg-surface-2 " + (dragging ? "border-accent bg-surface-2" : "")}
        onDragEnter={(event) => {
          event.preventDefault();
          onDraggingChange(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          onDraggingChange(true);
        }}
        onDragLeave={() => onDraggingChange(false)}
        onDrop={(event) => {
          event.preventDefault();
          onDraggingChange(false);
          onFiles(event.dataTransfer.files);
        }}
      >
        <span className="text-sm font-black text-accent-read">Drop Markdown files here</span>
        <span className="primary-button px-4 py-2">Choose Markdown files</span>
        <input
          className="sr-only"
          type="file"
          aria-label="Choose Markdown files"
          accept=".md,.markdown,text/markdown"
          multiple
          disabled={busy}
          onChange={(event) => {
            if (event.currentTarget.files) {
              onFiles(event.currentTarget.files);
            }

            event.currentTarget.value = "";
          }}
        />
      </label>
      {message ? (
        <p className="mt-4 rounded border border-accent-files/40 bg-panel px-4 py-3 text-sm font-bold text-ink">
          {message}
        </p>
      ) : null}
    </div>
  );
}
