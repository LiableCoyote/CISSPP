/**
 * Triggers a file download from an in-memory blob.
 *
 * Two details matter and were previously wrong at every call site:
 * - the anchor is appended to the document before clicking, because Firefox has
 *   historically ignored a programmatic click on a detached element;
 * - the object URL is revoked on a timer rather than synchronously after the
 *   click, which otherwise races the browser's download and can produce a
 *   silent zero-byte file.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Serialises `data` as pretty-printed JSON and downloads it. */
export function downloadJSON(data: unknown, filename: string) {
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), filename);
}
