import { Notice, normalizePath, type App, type TFile } from "obsidian";
import { uniqueFileName } from "./ids.ts";
import type { ExportOptions } from "./options.ts";
import { canPrintPdf, printToPdf } from "./pdf.ts";
import { NoteRenderer, assembleDocument, mathCss, type RenderedNote } from "./render.ts";

export interface ExportResult {
  /** Vault paths written. */
  written: string[];
  /** Set when PDF printing was unavailable and HTML was written instead. */
  fellBack: boolean;
}

export async function runExport(app: App, files: TFile[], options: ExportOptions, progress: (text: string) => void): Promise<ExportResult> {
  if (files.length === 0) throw new Error("No notes selected.");
  const wantPdf = options.format === "pdf";
  const fellBack = wantPdf && !canPrintPdf();
  const ext = wantPdf && !fellBack ? "pdf" : "html";
  const effective: ExportOptions = fellBack ? { ...options, format: "html" } : options;

  const folder = normalizePath(options.outputFolder.trim() || "/");
  if (folder !== "/" && !(await app.vault.adapter.exists(folder))) await app.vault.adapter.mkdir(folder);

  const taken = new Set<string>();
  const fileNames = new Map<string, string>();
  if (!options.merge) for (const file of files) fileNames.set(file.path, uniqueFileName(file.basename, ext, taken));

  const renderer = new NoteRenderer(app, files.map((f) => f.path), effective, fileNames);
  const rendered: RenderedNote[] = [];
  for (const [index, file] of files.entries()) {
    progress(`Rendering ${index + 1} of ${files.length}: ${file.basename}`);
    rendered.push(await renderer.renderNote(file));
  }
  for (const note of rendered) renderer.finalizeLinks(note.section);

  const extraCss = rendered.some((n) => n.section.querySelector("mjx-container")) ? await mathCss() : "";
  const written: string[] = [];
  const jobs = options.merge
    ? [{ name: uniqueFileName(options.title.trim() || (files.length === 1 ? files[0]!.basename : "Export"), ext, new Set()), title: options.title.trim() || (files.length === 1 ? files[0]!.basename : "Export"), notes: rendered, single: files.length === 1 }]
    : rendered.map((note) => ({ name: fileNames.get(note.file.path)!, title: note.title, notes: [note], single: true }));

  for (const [index, job] of jobs.entries()) {
    progress(`Writing ${index + 1} of ${jobs.length}: ${job.name}`);
    const html = assembleDocument({ title: job.title, notes: job.notes, options: effective, single: job.single, extraCss });
    const target = await freeName(app, folder, job.name);
    if (ext === "pdf") {
      const pdf = await printToPdf(html, options);
      await app.vault.adapter.writeBinary(target, pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer);
    } else {
      await app.vault.adapter.write(target, html);
    }
    written.push(target);
  }
  return { written, fellBack };
}

/** Never overwrites an existing file: "Name.pdf", "Name 2.pdf", … */
async function freeName(app: App, folder: string, name: string): Promise<string> {
  const dot = name.lastIndexOf(".");
  const base = name.slice(0, dot);
  const ext = name.slice(dot);
  let candidate = normalizePath(`${folder}/${name}`);
  for (let n = 2; await app.vault.adapter.exists(candidate); n++) candidate = normalizePath(`${folder}/${base} ${n}${ext}`);
  return candidate;
}

export function announce(app: App, result: ExportResult) {
  const first = result.written[0];
  const note = new Notice("", 12000);
  const el = note.messageEl ?? (note as unknown as { noticeEl: HTMLElement }).noticeEl;
  el.empty();
  const where = result.written.length === 1 ? first! : `${result.written.length} files in ${first!.split("/").slice(0, -1).join("/") || "vault"}`;
  el.createSpan({ text: (result.fellBack ? "PDF printing is unavailable here; wrote HTML instead (open it and use Print). " : "Exported ") + where + " " });
  if (first) {
    const open = el.createEl("a", { text: "Open", href: "#" });
    open.addEventListener("click", (event) => {
      event.preventDefault();
      void (app as unknown as { openWithDefaultApp(path: string): Promise<void> }).openWithDefaultApp(first);
    });
  }
}
