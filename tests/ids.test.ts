import test from "node:test";
import assert from "node:assert/strict";
import { AnchorMap, slug, sliceBlock, sliceHeading, stripFrontMatter, uniqueFileName } from "../src/ids.ts";

test("slug folds accents and lowercases", () => {
  assert.equal(slug("Café Crème"), "cafe-creme");
  assert.equal(slug("Ünïcödé"), "unicode");
});

test("slug turns symbols and punctuation runs into single dashes", () => {
  assert.equal(slug("Hello, World!  (draft)"), "hello-world-draft");
  assert.equal(slug("  --Foo__Bar--  "), "foo-bar");
  assert.equal(slug("a/b\\c"), "a-b-c");
  assert.equal(slug("Chapter 1.2"), "chapter-1-2");
});

test("slug keeps non-Latin letters", () => {
  assert.equal(slug("Привет, мир"), "привет-мир");
  assert.equal(slug("日本語 メモ"), "日本語-メモ");
});

test("slug of empty or symbol-only text is empty", () => {
  assert.equal(slug(""), "");
  assert.equal(slug("!!! ???"), "");
});

test("noteId gives same-basename notes in different folders distinct, stable ids", () => {
  const map = new AnchorMap();
  const work = map.noteId("work/Notes.md");
  const home = map.noteId("home/Notes.md");
  assert.equal(work, "note-notes");
  assert.equal(home, "note-notes-2");
  assert.equal(map.noteId("work/Notes.md"), work);
  assert.equal(map.noteId("home/Notes.md"), home);
});

test("noteId slugs the basename, ignores case of the extension and falls back when empty", () => {
  const map = new AnchorMap();
  assert.equal(map.noteId("Daily Log.md"), "note-daily-log");
  assert.equal(map.noteId("x/Plan.MD"), "note-plan");
  assert.equal(map.noteId("sub/.md"), "note-untitled");
});

test("headingId suffixes repeated headings and findHeading resolves to the first", () => {
  const map = new AnchorMap();
  const p = "Guide.md";
  assert.equal(map.headingId(p, "Setup"), "note-guide--setup");
  assert.equal(map.headingId(p, "Setup"), "note-guide--setup-2");
  assert.equal(map.headingId(p, "Setup"), "note-guide--setup-3");
  assert.equal(map.findHeading(p, "Setup"), "note-guide--setup");
});

test("heading ids are scoped to their note", () => {
  const map = new AnchorMap();
  const one = map.headingId("a.md", "Intro");
  const two = map.headingId("b.md", "Intro");
  assert.notEqual(one, two);
  assert.equal(map.findHeading("a.md", "Intro"), one);
  assert.equal(map.findHeading("b.md", "Intro"), two);
});

test("headings with no usable text get the section fallback", () => {
  const map = new AnchorMap();
  assert.equal(map.headingId("a.md", "???"), "note-a--section");
});

test("findHeading takes the last segment of a nested A#B fragment", () => {
  const map = new AnchorMap();
  const install = map.headingId("Guide.md", "Install");
  assert.equal(map.findHeading("Guide.md", "Setup#Install"), install);
  assert.equal(map.findHeading("Guide.md", "Install"), install);
});

test("findHeading returns null for missing headings and unknown notes", () => {
  const map = new AnchorMap();
  map.headingId("Guide.md", "Install");
  assert.equal(map.findHeading("Guide.md", "Nope"), null);
  assert.equal(map.findHeading("Guide.md", "Setup#Nope"), null);
  assert.equal(map.findHeading("Unknown.md", "Install"), null);
});

test("findHeading resolves a heading whose text looks like a duplicate suffix", {
  todo: "suspected bug: a heading literally named 'Intro 2' resolves to the second 'Intro'",
}, () => {
  const map = new AnchorMap();
  map.headingId("n.md", "Intro");
  map.headingId("n.md", "Intro");
  const literal = map.headingId("n.md", "Intro 2");
  assert.equal(map.findHeading("n.md", "Intro 2"), literal);
});

test("uniqueFileName replaces characters that are illegal on common OSes", () => {
  assert.equal(uniqueFileName('a<b>c:d"e/f\\g|h?i*j#k', "md", new Set()), "a-b-c-d-e-f-g-h-i-j-k.md");
  assert.equal(uniqueFileName("x\u0007y", "md", new Set()), "x-y.md");
});

test("uniqueFileName collapses whitespace and trims leading and trailing dots and spaces", () => {
  assert.equal(uniqueFileName("My   Note Title", "md", new Set()), "My Note Title.md");
  assert.equal(uniqueFileName("  .hidden. ", "md", new Set()), "hidden.md");
  assert.equal(uniqueFileName("notes...", "md", new Set()), "notes.md");
});

test("uniqueFileName treats tabs as whitespace", {
  todo: "suspected minor bug: a tab is replaced by '-' (control-char class runs before whitespace collapse)",
}, () => {
  assert.equal(uniqueFileName("My\tNote", "md", new Set()), "My Note.md");
});

test("uniqueFileName falls back to Untitled when nothing is left", () => {
  assert.equal(uniqueFileName("", "md", new Set()), "Untitled.md");
  assert.equal(uniqueFileName("...", "md", new Set()), "Untitled.md");
});

test("uniqueFileName prefixes Windows reserved device names", () => {
  assert.equal(uniqueFileName("CON", "md", new Set()), "_CON.md");
  assert.equal(uniqueFileName("nul", "md", new Set()), "_nul.md");
  assert.equal(uniqueFileName("com1", "md", new Set()), "_com1.md");
  assert.equal(uniqueFileName("LPT9.", "md", new Set()), "_LPT9.md");
  assert.equal(uniqueFileName("CONSOLE", "md", new Set()), "CONSOLE.md");
});

test("uniqueFileName caps the name at 120 characters", () => {
  assert.equal(uniqueFileName("a".repeat(300), "md", new Set()), "a".repeat(120) + ".md");
  assert.equal(uniqueFileName("a".repeat(119) + " b", "md", new Set()), "a".repeat(119) + ".md");
});

test("uniqueFileName suffixes case-insensitive duplicates", () => {
  const taken = new Set<string>();
  assert.equal(uniqueFileName("Note", "md", taken), "Note.md");
  assert.equal(uniqueFileName("note", "md", taken), "note 2.md");
  assert.equal(uniqueFileName("NOTE", "md", taken), "NOTE 3.md");
  assert.equal(uniqueFileName("Other", "md", taken), "Other.md");
  assert.ok(taken.has("note 3.md"));
});

test("uniqueFileName detects collisions with mixed-case names already in taken", {
  todo: "suspected bug: taken entries are not lowercased, so 'README.md' does not block 'Readme.md'",
}, () => {
  assert.equal(uniqueFileName("Readme", "md", new Set(["README.md"])), "Readme 2.md");
});

test("stripFrontMatter removes a leading YAML block", () => {
  assert.equal(stripFrontMatter("---\ntitle: A\ntags: [x]\n---\n# Body\n"), "# Body\n");
  assert.equal(stripFrontMatter("---\ntitle: A\n...\nBody"), "Body");
  assert.equal(stripFrontMatter("---\ntitle: A\n---"), "");
});

test("stripFrontMatter only strips the first block", () => {
  assert.equal(stripFrontMatter("---\na: 1\n---\nx\n---\ny"), "x\n---\ny");
});

test("stripFrontMatter leaves text without front matter alone", () => {
  const plain = "# Title\n\n---\n\nText";
  assert.equal(stripFrontMatter(plain), plain);
  const unclosed = "---\ntitle: A\n\nNo closing fence";
  assert.equal(stripFrontMatter(unclosed), unclosed);
});

test("stripFrontMatter handles CRLF line endings and a BOM", () => {
  assert.equal(stripFrontMatter("---\r\ntitle: A\r\n---\r\nBody\r\n"), "Body\r\n");
  assert.equal(stripFrontMatter("﻿---\ntitle: A\n---\nBody"), "Body");
});

test("stripFrontMatter strips an empty front matter block", {
  todo: "suspected bug: '---' immediately followed by '---' is not recognised as front matter",
}, () => {
  assert.equal(stripFrontMatter("---\n---\nBody"), "Body");
});

const doc = [
  "# Title",
  "intro",
  "## Alpha",
  "a1",
  "### Deep",
  "d1",
  "## Beta",
  "b1",
  "# Other",
  "o",
].join("\n");

test("sliceHeading returns the section up to the next heading of the same or higher level", () => {
  assert.equal(sliceHeading(doc, "Alpha"), "## Alpha\na1\n### Deep\nd1");
  assert.equal(sliceHeading(doc, "Beta"), "## Beta\nb1");
  assert.equal(sliceHeading(doc, "Other"), "# Other\no");
});

test("sliceHeading includes deeper subsections", () => {
  assert.equal(sliceHeading(doc, "Deep"), "### Deep\nd1");
  assert.equal(
    sliceHeading(doc, "Title"),
    "# Title\nintro\n## Alpha\na1\n### Deep\nd1\n## Beta\nb1",
  );
});

test("sliceHeading returns null for a missing heading", () => {
  assert.equal(sliceHeading(doc, "Gamma"), null);
  assert.equal(sliceHeading("#tag only\nbody", "tag"), null);
});

test("sliceHeading ignores headings inside code fences", () => {
  const fenced = "```md\n# Fake\n```\n\n~~~\n## Also fake\n~~~\n\n# Real\nbody";
  assert.equal(sliceHeading(fenced, "Fake"), null);
  assert.equal(sliceHeading(fenced, "Also fake"), null);
  assert.equal(sliceHeading(fenced, "Real"), "# Real\nbody");
});

test("sliceHeading matches by slug and accepts closing hashes and CRLF", () => {
  assert.equal(sliceHeading("## Café Plans ##\nx\n# End", "cafe plans"), "## Café Plans ##\nx");
  assert.equal(sliceHeading("# A\r\nx\r\n# B", "A"), "# A\nx");
});

const note = [
  "Intro paragraph",
  "",
  "The key fact is here",
  "and continues ^fact1",
  "",
  "After.",
  "",
  "- item one",
  "- item two ^two",
  "- item three",
].join("\n");

test("sliceBlock returns the paragraph carrying the block id, without the id", () => {
  assert.equal(sliceBlock(note, "fact1"), "The key fact is here\nand continues");
  assert.equal(sliceBlock("Top line ^t\n\nrest", "t"), "Top line");
});

test("sliceBlock returns null for an unknown id", () => {
  assert.equal(sliceBlock(note, "nope"), null);
});

test("sliceBlock escapes regex characters in the id", () => {
  assert.equal(sliceBlock("x ^a1", "a.1"), null);
});

test("sliceBlock returns just the list item carrying the block id", {
  todo: "suspected bug: a list item id returns the whole contiguous list and leaves '^two' in place",
}, () => {
  assert.equal(sliceBlock(note, "two"), "- item two");
});
