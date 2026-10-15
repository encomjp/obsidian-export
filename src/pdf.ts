// Prints an HTML document to PDF with Obsidian's own Chromium (Electron's printToPDF), which keeps
// internal links as clickable PDF links and builds bookmarks from the headings.

import type { ExportOptions } from "./options.ts";

interface PrintWindow {
  loadURL(url: string): Promise<void>;
  destroy(): void;
  webContents: { printToPDF(options: Record<string, unknown>): Promise<Uint8Array> };
}

function remote(): { BrowserWindow: new (options: Record<string, unknown>) => PrintWindow } | null {
  try {
    const electron = require("electron");
    return electron.remote ?? require("@electron/remote");
  } catch {
    return null;
  }
}

export function canPrintPdf(): boolean {
  return remote() !== null;
}

export async function printToPdf(html: string, options: ExportOptions): Promise<Uint8Array> {
  const electron = remote();
  if (!electron) throw new Error("This Obsidian build does not expose PDF printing.");
  const fs = require("node:fs") as typeof import("node:fs");
  const os = require("node:os") as typeof import("node:os");
  const path = require("node:path") as typeof import("node:path");
  const url = require("node:url") as typeof import("node:url");
  const file = path.join(os.tmpdir(), `export-studio-${Date.now()}-${Math.random().toString(16).slice(2)}.html`);
  fs.writeFileSync(file, html, "utf8");
  const win = new electron.BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false, contextIsolation: true } });
  try {
    await win.loadURL(url.pathToFileURL(file).href);
    const inches = options.margin / 25.4;
    const footer = options.pageNumbers
      ? `<div style="width:100%;text-align:center;font:9px 'Segoe UI',Arial,sans-serif;color:#7a8094"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`
      : "<span></span>";
    return await win.webContents.printToPDF({
      pageSize: options.pageSize,
      landscape: options.landscape,
      printBackground: true,
      generateDocumentOutline: true,
      generateTaggedPDF: true,
      displayHeaderFooter: options.pageNumbers,
      headerTemplate: "<span></span>",
      footerTemplate: footer,
      margins: { top: inches, bottom: options.pageNumbers ? Math.max(inches, 0.6) : inches, left: inches, right: inches },
    });
  } finally {
    win.destroy();
    fs.rmSync(file, { force: true });
  }
}
