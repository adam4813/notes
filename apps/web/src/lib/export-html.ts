/**
 * HTML export utilities.
 *
 * Converts a rendered note's DOM element into a self-contained HTML file with
 * images inlined as base64 data URLs so the file is portable.
 */

const EXPORT_CSS = `
*,*::before,*::after{box-sizing:border-box}
body{font-family:system-ui,sans-serif;line-height:1.6;max-width:860px;margin:2rem auto;padding:0 1.5rem;color:#1a1a1a}
h1,h2,h3,h4,h5,h6{line-height:1.25;margin:1.5em 0 0.5em}
h1{font-size:2em;border-bottom:1px solid #e0e0e0;padding-bottom:0.3em}
h2{font-size:1.5em;border-bottom:1px solid #e0e0e0;padding-bottom:0.2em}
p{margin:0.75em 0}
a{color:#0969da}
img{max-width:100%;height:auto;border-radius:4px}
pre{background:#f6f8fa;border-radius:6px;padding:1em;overflow-x:auto}
code{font-family:ui-monospace,monospace;font-size:0.9em;background:#f6f8fa;padding:0.15em 0.4em;border-radius:4px}
pre code{background:none;padding:0}
blockquote{margin:1em 0;padding:0 1em;border-left:4px solid #d0d7de;color:#555}
table{border-collapse:collapse;width:100%;margin:1em 0}
th,td{border:1px solid #d0d7de;padding:6px 13px;text-align:left}
th{background:#f6f8fa;font-weight:600}
ul,ol{padding-left:2em;margin:0.75em 0}
li{margin:0.25em 0}
hr{border:none;border-top:1px solid #e0e0e0;margin:1.5em 0}
input[type=checkbox]{margin-right:0.4em}
`;

/**
 * Fetches each `<img>` src in the provided HTML string and replaces the URL
 * with a base64 data URL.  Src values that are already data URLs are left
 * unchanged.  Failures are silently skipped so the export still completes.
 */
export async function inlineImages(html: string): Promise<string> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${html}</body>`, "text/html");
  const images = Array.from(doc.querySelectorAll<HTMLImageElement>("img[src]"));

  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute("src") ?? "";
      if (!src || src.startsWith("data:")) return;
      try {
        const response = await fetch(src);
        if (!response.ok) return;
        const blob = await response.blob();
        const dataUrl = await blobToDataUrl(blob);
        img.setAttribute("src", dataUrl);
      } catch {
        // Leave the original src on failure.
      }
    }),
  );

  return doc.body.innerHTML;
}

/** Wraps rendered body HTML in a complete, self-contained HTML document. */
export function buildHtmlDocument(title: string, bodyHtml: string): string {
  const escapedTitle = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapedTitle}</title>
<style>${EXPORT_CSS}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

/**
 * Exports the contents of `element` as a self-contained HTML file and
 * triggers a browser download.
 *
 * @param element - The DOM element whose `innerHTML` to export.
 * @param title   - The document title and base name for the downloaded file.
 */
export async function exportAsHtml(element: HTMLElement, title: string): Promise<void> {
  const rawHtml = element.innerHTML;
  const inlinedHtml = await inlineImages(rawHtml);
  const document = buildHtmlDocument(title, inlinedHtml);
  const blob = new Blob([document], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `${sanitizeFilename(title)}.html`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "-").trim() || "export";
}
