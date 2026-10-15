// Renders notes with Obsidian's own Markdown renderer (so callouts, math, code highlighting, Dataview,
// Mermaid and plugins look as they do in Reading view), then rewrites links, images and embeds so the
// result is a self-contained document.

import { Component, FileSystemAdapter, MarkdownRenderer, TFile, type App } from "obsidian";
import { AnchorMap, sliceBlock, sliceHeading, stripFrontMatter } from "./ids.ts";
import { buildCss } from "./css.ts";
import type { ExportOptions } from "./options.ts";

const MAX_EMBED_DEPTH = 3;

const IMAGE_TYPES: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  svg: "image/svg+xml", bmp: "image/bmp", avif: "image/avif",
};

export interface RenderedNote {
  file: TFile;
  id: string;
  title: string;
  section: HTMLElement;
  /** Original-level (h1/h2) headings for the contents list. */
  outline: { level: number; text: string; id: string }[];
}

export class NoteRenderer {
  readonly anchors = new AnchorMap();
  private readonly paths: Set<string>;
  private readonly app: App;
  private readonly options: ExportOptions;
  /** Output file name per note, used for links in "one file per note" mode. */
  private readonly fileNames: Map<string, string>;

  constructor(app: App, paths: string[], options: ExportOptions, fileNames: Map<string, string>) {
    this.app = app;
    this.paths = new Set(paths);
    this.options = options;
    this.fileNames = fileNames;
  }

  async renderNote(file: TFile): Promise<RenderedNote> {
    const markdown = stripFrontMatter(await this.app.vault.cachedRead(file));
    const id = this.anchors.noteId(file.path);
    const section = createEl("section", { cls: "note" + (this.options.newPagePerNote ? " page-break" : "") });
    section.id = id;
    section.appendChild(createEl("h1", { cls: "note-title", text: file.basename }));
    const outline: RenderedNote["outline"] = [];
    const body = await this.renderMarkdown(markdown, file, 0, outline);
    section.appendChild(body);
    return { file, id, title: file.basename, section, outline };
  }

  private async renderMarkdown(markdown: string, file: TFile, depth: number, outline: RenderedNote["outline"] | null): Promise<HTMLElement> {
    const host = createDiv({ cls: "markdown-rendered note-body" });
    host.setCssProps({ position: "fixed", left: "-99999px", top: "0", width: "820px", visibility: "hidden" });
    document.body.appendChild(host);
    const component = new Component();
    component.load();
    try {
      await MarkdownRenderer.render(this.app, markdown, host, file.path, component);
      await settle(host);
      for (const junk of Array.from(host.querySelectorAll(".copy-code-button, .edit-block-button, .heading-collapse-indicator, .collapse-indicator, .metadata-container, .frontmatter, button"))) junk.remove();
      await this.processEmbeds(host, file, depth);
      this.processHeadings(host, file, depth, outline);
      this.processLinks(host, file);
      await this.inlineImages(host);
    } finally {
      component.unload();
      host.remove();
    }
    host.removeAttribute("style");
    return host;
  }

  /** Headings move down one level (the note title is the h1) and get anchors; embedded notes get none. */
  private processHeadings(root: HTMLElement, file: TFile, depth: number, outline: RenderedNote["outline"] | null) {
    for (const heading of Array.from(root.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6"))) {
      if (heading.closest(".embed-note")) continue;
      const level = Number(heading.tagName.slice(1));
      const text = (heading.getAttribute("data-heading") ?? heading.textContent ?? "").trim();
      const next = createEl(`h${Math.min(6, level + 1 + depth)}` as keyof HTMLElementTagNameMap);
      for (const attr of Array.from(heading.attributes)) if (attr.name !== "id") next.setAttribute(attr.name, attr.value);
      while (heading.firstChild) next.appendChild(heading.firstChild);
      if (depth === 0) {
        next.id = this.anchors.headingId(file.path, text);
        if (outline && level <= 2) outline.push({ level, text, id: next.id });
      }
      heading.replaceWith(next);
    }
  }

  private async processEmbeds(root: HTMLElement, file: TFile, depth: number) {
    for (const embed of Array.from(root.querySelectorAll<HTMLElement>(".internal-embed"))) {
      const src = embed.getAttribute("src") ?? "";
      const [linkpath = "", fragment = ""] = splitFirst(src, "#");
      const target = this.app.metadataCache.getFirstLinkpathDest(linkpath, file.path);
      if (!target) { embed.replaceWith(note(`Missing embed: ${src}`)); continue; }
      const ext = target.extension.toLowerCase();
      if (ext in IMAGE_TYPES) continue; // already an <img>; inlined later
      if (ext !== "md") { embed.replaceWith(this.fileLink(target, "📎 " + target.name)); continue; }
      if (depth >= MAX_EMBED_DEPTH) { embed.replaceWith(this.fileLink(target, target.basename)); continue; }
      let markdown = stripFrontMatter(await this.app.vault.cachedRead(target));
      if (fragment.startsWith("^")) markdown = sliceBlock(markdown, fragment.slice(1)) ?? markdown;
      else if (fragment) markdown = sliceHeading(markdown, fragment.split("#").pop() ?? "") ?? markdown;
      const box = createDiv({ cls: "embed-note" });
      box.appendChild(await this.renderMarkdown(markdown, target, depth + 1, null));
      embed.replaceWith(box);
    }
  }

  /** Marks links to notes with their target; the final href is set once every note is rendered. */
  private processLinks(root: HTMLElement, file: TFile) {
    for (const a of Array.from(root.querySelectorAll<HTMLAnchorElement>("a"))) {
      if (a.classList.contains("tag")) { const tag = createSpan({ cls: "tag", text: a.textContent ?? "" }); a.replaceWith(tag); continue; }
      if (a.classList.contains("internal-link")) {
        const href = a.getAttribute("data-href") ?? a.getAttribute("href") ?? "";
        const [linkpath = "", fragment = ""] = splitFirst(href, "#");
        const target = linkpath ? this.app.metadataCache.getFirstLinkpathDest(linkpath, file.path) : file;
        for (const attr of ["data-href", "href", "target", "rel"]) a.removeAttribute(attr);
        if (!target) { a.replaceWith(span("unresolved", a.textContent ?? "")); continue; }
        a.setAttribute("data-ex-path", target.path);
        if (fragment) a.setAttribute("data-ex-frag", fragment);
        continue;
      }
      a.removeAttribute("target");
      a.removeAttribute("rel");
    }
  }

  /** Final pass over the finished sections: turn marked links into real hrefs. */
  finalizeLinks(root: HTMLElement) {
    const vault = encodeURIComponent(this.app.vault.getName());
    for (const a of Array.from(root.querySelectorAll<HTMLAnchorElement>("a[data-ex-path]"))) {
      const path = a.getAttribute("data-ex-path") ?? "";
      const fragment = a.getAttribute("data-ex-frag") ?? "";
      a.removeAttribute("data-ex-path");
      a.removeAttribute("data-ex-frag");
      const isNote = path.toLowerCase().endsWith(".md");
      if (isNote && this.paths.has(path)) {
        const anchor = (fragment && !fragment.startsWith("^") ? this.anchors.findHeading(path, fragment) : null) ?? this.anchors.noteId(path);
        if (this.options.merge) { a.setAttribute("href", `#${anchor}`); continue; }
        const name = this.fileNames.get(path);
        if (name) { a.setAttribute("href", encodeURI(name) + (this.options.format === "html" ? `#${anchor}` : "")); continue; }
      }
      if (this.options.otherLinks === "obsidian") {
        a.setAttribute("href", `obsidian://open?vault=${vault}&file=${encodeURIComponent(path)}`);
        a.classList.add("external-note");
      } else {
        a.replaceWith(span("plain-link", a.textContent ?? ""));
      }
    }
  }

  private fileLink(file: TFile, text: string): HTMLElement {
    return createEl("a", {
      cls: "embed-file external-note",
      text,
      attr: { href: `obsidian://open?vault=${encodeURIComponent(this.app.vault.getName())}&file=${encodeURIComponent(file.path)}` },
    });
  }

  private async inlineImages(root: HTMLElement) {
    for (const img of Array.from(root.querySelectorAll("img"))) {
      const src = img.getAttribute("src") ?? "";
      if (!src || src.startsWith("data:")) continue;
      const file = this.fileFromResourceUrl(src);
      const type = file ? IMAGE_TYPES[file.extension.toLowerCase()] : undefined;
      if (!file || !type) continue;
      const data = await this.app.vault.readBinary(file);
      img.setAttribute("src", `data:${type};base64,${Buffer.from(data).toString("base64")}`);
      img.removeAttribute("srcset");
    }
  }

  private fileFromResourceUrl(src: string): TFile | null {
    try {
      const url = new URL(src);
      if (url.protocol !== "app:") return null;
      const adapter = this.app.vault.adapter;
      if (!(adapter instanceof FileSystemAdapter)) return null;
      const norm = (value: string) => value.replace(/\\/g, "/").replace(/^\/([A-Za-z]:)/, "$1");
      const full = norm(decodeURIComponent(url.pathname));
      const base = norm(adapter.getBasePath()).replace(/\/$/, "");
      if (!full.toLowerCase().startsWith(base.toLowerCase() + "/")) return null;
      const found = this.app.vault.getAbstractFileByPath(full.slice(base.length + 1));
      return found instanceof TFile ? found : null;
    } catch {
      return null;
    }
  }
}

export interface AssembleInput {
  title: string;
  notes: RenderedNote[];
  options: ExportOptions;
  /** Set when the document stands for a single note (one file per note). */
  single?: boolean;
  /** Extra stylesheet text (the inlined MathJax styles), when a note has math. */
  extraCss?: string;
}

/** The complete HTML document: optional cover and contents, then every note. */
export function assembleDocument(input: AssembleInput): string {
  const { title, notes, options } = input;
  const doc = document.implementation.createHTMLDocument(title);
  doc.documentElement.lang = navigator.language || "en";
  doc.head.appendChild(createEl("meta", { attr: { charset: "utf-8" } }));
  doc.head.appendChild(createEl("style", { text: buildCss() + (input.extraCss ?? "") }));

  if (options.cover && !input.single) {
    const cover = createEl("header", { cls: "cover" });
    const h = createEl("h1", { text: title });
    const when = createDiv({ cls: "meta" });
    when.textContent = `${new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })} · ${notes.length} note${notes.length === 1 ? "" : "s"}`;
    cover.append(h, when);
    doc.body.appendChild(cover);
  }
  if (options.toc && !input.single && notes.length > 0 && options.merge) {
    const nav = createEl("nav", { cls: "toc" });
    const h = createEl("h2", { text: "Contents" });
    const list = createEl("ol");
    for (const n of notes) {
      const li = createEl("li");
      li.appendChild(anchor(doc, `#${n.id}`, n.title));
      const inner = n.outline.filter((o) => o.level === 2 || o.level === 1);
      if (inner.length > 0) {
        const sub = createEl("ol");
        for (const o of inner) {
          const item = createEl("li");
          item.appendChild(anchor(doc, `#${o.id}`, o.text));
          sub.appendChild(item);
        }
        li.appendChild(sub);
      }
      list.appendChild(li);
    }
    nav.append(h, list);
    doc.body.appendChild(nav);
  }
  for (const n of notes) doc.body.appendChild(doc.importNode(n.section, true));
  return "<!doctype html>\n" + doc.documentElement.outerHTML;
}

function anchor(doc: Document, href: string, text: string): HTMLAnchorElement {
  return createEl("a", { text, attr: { href } });
}

function span(className: string, text: string): HTMLSpanElement {
  return createSpan({ cls: className, text });
}

function note(text: string): HTMLElement {
  return createEl("p", { cls: "embed-file", text });
}

function splitFirst(text: string, sep: string): [string, string] {
  const at = text.indexOf(sep);
  return at < 0 ? [text, ""] : [text.slice(0, at), text.slice(at + 1)];
}

/** Waits until post-processors (Mermaid, MathJax, Dataview, embeds) stop changing the rendered tree. */
async function settle(el: HTMLElement, maxMs = 4000) {
  const started = Date.now();
  let last = "";
  let stable = 0;
  while (Date.now() - started < maxMs) {
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    const busy = el.querySelector(".markdown-rendering, .is-loading, .dataview-loading") !== null;
    const now = el.innerHTML.length + ":" + el.querySelectorAll("svg, img, mjx-container").length;
    stable = now === last && !busy ? stable + 1 : 0;
    last = now;
    if (stable >= 2) return;
  }
}

const fontCache = new Map<string, string>();

/** MathJax's stylesheet with its fonts inlined, since Obsidian's own font URLs do not exist in an export. */
export async function mathCss(): Promise<string> {
  const sheet = document.getElementById("MJX-CHTML-styles")?.textContent ?? "";
  const urls = [...new Set([...sheet.matchAll(/url\(["']?([^"')]+\.woff2?)["']?\)/g)].map((m) => m[1]!))];
  let css = sheet;
  for (const rel of urls) {
    let data = fontCache.get(rel);
    if (!data) {
      try {
        // fetch, not requestUrl: app:// resource URLs (Obsidian's bundled fonts) are only readable by the renderer's fetch.
        const response = await fetch(new URL(rel, "app://obsidian.md/").href);
        if (!response.ok) continue;
        data = `data:font/woff2;base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
        fontCache.set(rel, data);
      } catch {
        continue;
      }
    }
    css = css.split(rel).join(data);
  }
  return css;
}
