// The note tree behind the picker, and the "add linked notes" expansion. Pure logic.

export interface TreeNode {
  name: string;
  path: string;
  folder: boolean;
  children: TreeNode[];
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** Builds a folder tree from note paths; folders first, then natural alphabetical order. */
export function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = { name: "", path: "", folder: true, children: [] };
  for (const path of paths) {
    const parts = path.split("/");
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]!;
      const isFile = i === parts.length - 1;
      const childPath = parts.slice(0, i + 1).join("/");
      let child = node.children.find((c) => c.name === name && c.folder === !isFile);
      if (!child) {
        child = { name, path: childPath, folder: !isFile, children: [] };
        node.children.push(child);
      }
      node = child;
    }
  }
  sortTree(root);
  return root;
}

function sortTree(node: TreeNode) {
  node.children.sort((a, b) => (a.folder === b.folder ? collator.compare(a.name, b.name) : a.folder ? -1 : 1));
  for (const child of node.children) sortTree(child);
}

export function filesUnder(node: TreeNode): string[] {
  return node.folder ? node.children.flatMap(filesUnder) : [node.path];
}

/** Keeps files matching every word of `query` (in their path) and the folders leading to them. */
export function filterTree(node: TreeNode, query: string): TreeNode | null {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return node;
  const walk = (current: TreeNode): TreeNode | null => {
    if (!current.folder) {
      const hay = current.path.toLowerCase();
      return words.every((w) => hay.includes(w)) ? current : null;
    }
    const children = current.children.map(walk).filter((c): c is TreeNode => c !== null);
    return children.length > 0 || current.path === "" ? { ...current, children } : null;
  };
  return walk(node);
}

export type CheckState = "none" | "some" | "all";

export function checkState(node: TreeNode, selected: Set<string>): CheckState {
  const files = filesUnder(node);
  const count = files.filter((f) => selected.has(f)).length;
  return count === 0 ? "none" : count === files.length ? "all" : "some";
}

/** Notes linked from the selection (outgoing links), up to `depth` hops, excluding what is selected. */
export function linkedNotes(
  selected: Iterable<string>,
  resolved: Record<string, Record<string, number>>,
  isNote: (path: string) => boolean,
  depth = 1,
): string[] {
  const seen = new Set(selected);
  const found: string[] = [];
  let frontier = [...seen];
  for (let hop = 0; hop < depth; hop++) {
    const next: string[] = [];
    for (const from of frontier) {
      for (const to of Object.keys(resolved[from] ?? {})) {
        if (seen.has(to) || !isNote(to)) continue;
        seen.add(to);
        found.push(to);
        next.push(to);
      }
    }
    frontier = next;
  }
  return found;
}
