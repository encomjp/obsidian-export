import test from "node:test";
import assert from "node:assert/strict";
import { buildTree, checkState, filesUnder, filterTree, linkedNotes } from "../src/selection.ts";
import type { TreeNode } from "../src/selection.ts";

function child(node: TreeNode, name: string): TreeNode {
  const found = node.children.find((c) => c.name === name);
  assert.ok(found, `expected child ${name}`);
  return found;
}

test("buildTree puts folders first and sorts names naturally", () => {
  const tree = buildTree(["Note 10.md", "Note 2.md", "zeta.md", "Alpha/x.md", "beta/y.md"]);
  assert.deepEqual(
    tree.children.map((c) => c.name),
    ["Alpha", "beta", "Note 2.md", "Note 10.md", "zeta.md"],
  );
});

test("buildTree records folder and file paths", () => {
  const tree = buildTree(["a/b/c.md", "a/d.md"]);
  const a = child(tree, "a");
  assert.equal(a.folder, true);
  assert.equal(a.path, "a");
  assert.deepEqual(a.children.map((c) => c.name), ["b", "d.md"]);
  const c = child(child(a, "b"), "c.md");
  assert.equal(c.path, "a/b/c.md");
  assert.equal(c.folder, false);
});

test("buildTree handles empty input and duplicate paths", () => {
  assert.deepEqual(buildTree([]).children, []);
  assert.equal(buildTree(["a.md", "a.md"]).children.length, 1);
});

test("filesUnder lists files below a node in tree order", () => {
  const tree = buildTree(["z.md", "f/b.md", "f/a.md", "f/g/c.md"]);
  assert.deepEqual(filesUnder(tree), ["f/g/c.md", "f/a.md", "f/b.md", "z.md"]);
  assert.deepEqual(filesUnder(child(tree, "z.md")), ["z.md"]);
});

const tree = buildTree([
  "Projects/Alpha Plan.md",
  "Projects/Beta.md",
  "Journal/2024/Alpha day.md",
  "Inbox.md",
]);

test("filterTree keeps only files matching every word, with their folders", () => {
  const result = filterTree(tree, "alpha plan");
  assert.ok(result);
  assert.deepEqual(filesUnder(result), ["Projects/Alpha Plan.md"]);
  assert.deepEqual(result.children.map((c) => c.path), ["Projects"]);
  assert.deepEqual(child(result, "Projects").children.map((c) => c.name), ["Alpha Plan.md"]);
});

test("filterTree keeps ancestor folders of nested matches", () => {
  const result = filterTree(tree, "alpha");
  assert.ok(result);
  assert.deepEqual(filesUnder(result), ["Journal/2024/Alpha day.md", "Projects/Alpha Plan.md"]);
  const journal = child(child(result, "Journal"), "2024");
  assert.deepEqual(journal.children.map((c) => c.name), ["Alpha day.md"]);
});

test("filterTree is case-insensitive and matches folder names too", () => {
  assert.deepEqual(filesUnder(filterTree(tree, "ALPHA")!), filesUnder(filterTree(tree, "alpha")!));
  assert.deepEqual(filesUnder(filterTree(tree, "journal alpha")!), ["Journal/2024/Alpha day.md"]);
});

test("filterTree with no matches yields no files", () => {
  assert.deepEqual(filesUnder(filterTree(tree, "nomatch")!), []);
});

test("filterTree with a blank query returns the tree unchanged", () => {
  assert.equal(filterTree(tree, "   "), tree);
});

test("checkState reports none, some or all for folders and files", () => {
  const t = buildTree(["f/a.md", "f/b.md", "g.md"]);
  const f = child(t, "f");
  assert.equal(checkState(f, new Set()), "none");
  assert.equal(checkState(f, new Set(["f/a.md"])), "some");
  assert.equal(checkState(f, new Set(["f/a.md", "f/b.md"])), "all");
  assert.equal(checkState(f, new Set(["g.md"])), "none");
  assert.equal(checkState(child(t, "g.md"), new Set(["g.md"])), "all");
  assert.equal(checkState(child(t, "g.md"), new Set(["f/a.md"])), "none");
  assert.equal(checkState(t, new Set(["f/a.md", "f/b.md"])), "some");
});

const resolved: Record<string, Record<string, number>> = {
  "a.md": { "b.md": 1, "img.png": 2 },
  "b.md": { "d.md": 1, "a.md": 1 },
  "d.md": { "e.md": 3 },
};
const isNote = (p: string) => p.endsWith(".md");

test("linkedNotes at depth 1 returns direct outgoing notes only", () => {
  assert.deepEqual(linkedNotes(["a.md"], resolved, isNote), ["b.md"]);
  assert.deepEqual(linkedNotes(["a.md"], resolved, isNote, 1), ["b.md"]);
});

test("linkedNotes at depth 2 follows links from the notes found", () => {
  assert.deepEqual(linkedNotes(["a.md"], resolved, isNote, 2), ["b.md", "d.md"]);
  assert.deepEqual(linkedNotes(["a.md"], resolved, isNote, 3), ["b.md", "d.md", "e.md"]);
});

test("linkedNotes excludes the selection, including selected notes reached by links", () => {
  assert.deepEqual(linkedNotes(new Set(["a.md", "b.md"]), resolved, isNote, 2), ["d.md", "e.md"]);
  assert.deepEqual(linkedNotes(["a.md", "b.md"], resolved, isNote), ["d.md"]);
});

test("linkedNotes ignores non-note targets and backlinks", () => {
  assert.ok(!linkedNotes(["a.md"], resolved, isNote, 3).includes("img.png"));
  assert.deepEqual(linkedNotes(["d.md"], resolved, isNote), ["e.md"]);
});

test("linkedNotes returns nothing for notes without outgoing links", () => {
  assert.deepEqual(linkedNotes(["zzz.md"], resolved, isNote, 2), []);
});
