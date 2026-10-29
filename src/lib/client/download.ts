export interface DownloadResult {
  ok: boolean;
  message?: string;
}

/**
 * Browser-only JSON download. Callers provide the exact payload so the export
 * always mirrors the record the user is looking at.
 */
export function downloadJson(
  filename: string,
  payload: unknown,
): DownloadResult {
  try {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch {
    return {
      ok: false,
      message:
        "The browser could not create the export file. Check that downloads are permitted.",
    };
  }
}
