// Anchor ids and output file names. Pure logic, no Obsidian imports, so it is unit tested directly.

export function slug(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

/** Stable, unique anchor ids for the notes of one export and for the headings inside each. */
export class AnchorMap {
  private readonly noteIds = new Map<string, string>();
  private readonly used = new Set<string>();
  private readonly headings = new Map<string, Map<string, string>>();

  noteId(path: string): string {
    const known = this.noteIds.get(path);
    if (known) return known;
    const base = "note-" + (slug(path.replace(/\.md$/i, "").split("/").pop() ?? "") || "untitled");
    let id = base;
    for (let n = 2; this.used.has(id); n++) id = `${base}-${n}`;
    this.used.add(id);
    this.noteIds.set(path, id);
    return id;
  }

  /** Id for a heading of a note; repeated headings get -2, -3, and the first one wins for links. */
  headingId(path: string, text: string): string {
    const noteId = this.noteId(path);
    let table = this.headings.get(path);
    if (!table) this.headings.set(path, (table = new Map()));
    const base = slug(text) || "section";
    let key = base;
    for (let n = 2; table.has(key); n++) key = `${base}-${n}`;
    const id = `${noteId}--${key}`;
    table.set(key, id);
    return id;
  }

  /** Id to link to for `[[Note#Heading]]`, or null when the heading was not rendered. */
  findHeading(path: string, fragment: string): string | null {
    const last = fragment.split("#").pop() ?? "";
    return this.headings.get(path)?.get(slug(last)) ?? null;
  }
}

const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** A file name that is safe on Windows, macOS and Linux, unique among `taken` (case-insensitive). */
export function uniqueFileName(base: string, ext: string, taken: Set<string>): string {
  let name = base.replace(/\s+/g, " ").replace(/[<>:"/\\|?*#^[\]\u0000-\u001f]/g, "-").replace(/^[ .]+|[ .]+$/g, "");
  if (!name) name = "Untitled";
  if (RESERVED.test(name)) name = `_${name}`;
  name = name.slice(0, 120).replace(/[ .]+$/g, "");
  let candidate = `${name}.${ext}`;
  for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = `${name} ${n}.${ext}`;
  taken.add(candidate.toLowerCase());
  return candidate;
}

/** Strips a leading YAML front matter block. */
export function stripFrontMatter(markdown: string): string {
  return markdown.replace(/^﻿?---[ \t]*\r?\n(?:[\s\S]*?\r?\n)?(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/, "");
}

/** The part of a note under a heading (until the next heading of the same or a higher level). */
export function sliceHeading(markdown: string, heading: string): string | null {
  const lines = markdown.split(/\r?\n/);
  const want = slug(heading);
  let start = -1;
  let level = 0;
  let fence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (fence) continue;
    const match = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const depth = match[1]!.length;
    if (start < 0) {
      if (slug(match[2] ?? "") === want) {
        start = i;
        level = depth;
      }
    } else if (depth <= level) {
      return lines.slice(start, i).join("\n");
    }
  }
  return start < 0 ? null : lines.slice(start).join("\n");
}

/** The paragraph or list item carrying a `^block-id`. */
export function sliceBlock(markdown: string, blockId: string): string | null {
  const lines = markdown.split(/\r?\n/);
  const marker = new RegExp(`\\^${blockId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`);
  const at = lines.findIndex((line) => marker.test(line));
  if (at < 0) return null;
  if (/^\s*(?:[-*+]|\d+[.)])\s/.test(lines[at] ?? "")) return (lines[at] ?? "").replace(marker, "").trimEnd();
  let from = at;
  let to = at;
  while (from > 0 && (lines[from - 1] ?? "").trim() !== "") from--;
  while (to < lines.length - 1 && (lines[to + 1] ?? "").trim() !== "") to++;
  return lines.slice(from, to + 1).join("\n").replace(marker, "").trimEnd();
}
