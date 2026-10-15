import { Modal, Setting, TFile, TFolder, type App } from "obsidian";
import { buildTree, checkState, filesUnder, filterTree, linkedNotes, type TreeNode } from "./selection.ts";
import type { ExportOptions, OtherNoteLinks, PageSize } from "./options.ts";

export interface PickerResult {
  files: TFile[];
  options: ExportOptions;
}

export class ExportModal extends Modal {
  private readonly selected: Set<string>;
  private readonly options: ExportOptions;
  private readonly onSubmit: (result: PickerResult) => void;
  private readonly expandedFolders = new Set<string>();
  private query = "";
  private treeEl!: HTMLElement;
  private countEl!: HTMLElement;
  private root!: TreeNode;

  constructor(app: App, preselected: string[], options: ExportOptions, onSubmit: (result: PickerResult) => void) {
    super(app);
    this.selected = new Set(preselected);
    this.options = { ...options };
    this.onSubmit = onSubmit;
    for (const path of preselected) {
      const parts = path.split("/");
      for (let i = 1; i < parts.length; i++) this.expandedFolders.add(parts.slice(0, i).join("/"));
    }
  }

  override onOpen() {
    this.modalEl.addClass("es-modal");
    this.titleEl.setText("Export notes");
    this.root = buildTree(this.app.vault.getMarkdownFiles().map((f) => f.path));

    const layout = this.contentEl.createDiv({ cls: "es-layout" });
    const left = layout.createDiv({ cls: "es-left" });
    const search = left.createEl("input", { type: "search", placeholder: "Filter notes…", cls: "es-search" });
    search.addEventListener("input", () => { this.query = search.value; this.renderTree(); });
    const bar = left.createDiv({ cls: "es-bar" });
    this.countEl = bar.createSpan({ cls: "es-count" });
    const addBtn = bar.createEl("button", { text: "Add linked notes", attr: { title: "Also select every note the selection links to" } });
    addBtn.addEventListener("click", () => {
      for (const path of linkedNotes(this.selected, this.app.metadataCache.resolvedLinks, (p) => p.toLowerCase().endsWith(".md"), 1)) this.selected.add(path);
      this.renderTree();
    });
    const clearBtn = bar.createEl("button", { text: "Clear" });
    clearBtn.addEventListener("click", () => { this.selected.clear(); this.renderTree(); });
    this.treeEl = left.createDiv({ cls: "es-tree" });

    this.buildOptions(layout.createDiv({ cls: "es-right" }));

    const footer = this.contentEl.createDiv({ cls: "es-footer" });
    const cancel = footer.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());
    const go = footer.createEl("button", { text: "Export", cls: "mod-cta" });
    go.addEventListener("click", () => {
      const files = [...this.selected].map((p) => this.app.vault.getAbstractFileByPath(p)).filter((f): f is TFile => f instanceof TFile);
      if (files.length === 0) return;
      files.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: "base" }));
      this.close();
      this.onSubmit({ files, options: this.options });
    });
    this.renderTree();
  }

  private buildOptions(el: HTMLElement) {
    const o = this.options;
    new Setting(el).setName("Format").addDropdown((d) => d.addOption("pdf", "PDF").addOption("html", "HTML").setValue(o.format).onChange((v) => { o.format = v as ExportOptions["format"]; }));
    new Setting(el).setName("One document").setDesc("Merge the notes so links between them jump inside the file. Off: one file per note.").addToggle((t) => t.setValue(o.merge).onChange((v) => { o.merge = v; }));
    new Setting(el).setName("Title").setDesc("Used for the file name and cover page.").addText((t) => t.setPlaceholder("Export").setValue(o.title).onChange((v) => { o.title = v; }));
    new Setting(el).setName("Cover page").addToggle((t) => t.setValue(o.cover).onChange((v) => { o.cover = v; }));
    new Setting(el).setName("Contents").addToggle((t) => t.setValue(o.toc).onChange((v) => { o.toc = v; }));
    new Setting(el).setName("Page numbers").addToggle((t) => t.setValue(o.pageNumbers).onChange((v) => { o.pageNumbers = v; }));
    new Setting(el).setName("New page per note").addToggle((t) => t.setValue(o.newPagePerNote).onChange((v) => { o.newPagePerNote = v; }));
    new Setting(el).setName("Links to other notes").setDesc("For notes that are not part of this export.")
      .addDropdown((d) => d.addOption("obsidian", "Open in Obsidian").addOption("plain", "Plain text").setValue(o.otherLinks).onChange((v) => { o.otherLinks = v as OtherNoteLinks; }));
    new Setting(el).setName("Page size").addDropdown((d) => d.addOptions({ A4: "A4", A5: "A5", Letter: "Letter", Legal: "Legal" }).setValue(o.pageSize).onChange((v) => { o.pageSize = v as PageSize; }))
      .addToggle((t) => t.setTooltip("Landscape").setValue(o.landscape).onChange((v) => { o.landscape = v; }));
    new Setting(el).setName("Margin (mm)").addSlider((s) => s.setLimits(5, 40, 1).setValue(o.margin).setDynamicTooltip().onChange((v) => { o.margin = v; }));
    new Setting(el).setName("Save to folder").setDesc("Inside your vault. Existing files are never overwritten.").addText((t) => t.setPlaceholder("Exports").setValue(o.outputFolder).onChange((v) => { o.outputFolder = v; }));
  }

  private renderTree() {
    this.treeEl.empty();
    const tree = filterTree(this.root, this.query);
    if (tree) for (const child of tree.children) this.renderNode(this.treeEl, child, 0);
    this.countEl.setText(`${this.selected.size} selected`);
  }

  private renderNode(parent: HTMLElement, node: TreeNode, depth: number) {
    const row = parent.createDiv({ cls: "es-row" });
    row.style.paddingLeft = `${depth * 16 + 6}px`;
    const searching = this.query.trim() !== "";
    const expanded = searching || this.expandedFolders.has(node.path);
    if (node.folder) {
      const arrow = row.createSpan({ cls: "es-arrow", text: expanded ? "▾" : "▸" });
      arrow.addEventListener("click", () => { this.expandedFolders.has(node.path) ? this.expandedFolders.delete(node.path) : this.expandedFolders.add(node.path); this.renderTree(); });
    } else row.createSpan({ cls: "es-arrow" });
    const box = row.createEl("input", { type: "checkbox" });
    const state = node.folder ? checkState(node, this.selected) : this.selected.has(node.path) ? "all" : "none";
    box.checked = state === "all";
    box.indeterminate = state === "some";
    box.addEventListener("change", () => {
      const files = node.folder ? filesUnder(node) : [node.path];
      for (const f of files) box.checked ? this.selected.add(f) : this.selected.delete(f);
      this.renderTree();
    });
    const label = row.createSpan({ cls: "es-label" + (node.folder ? " is-folder" : ""), text: node.folder ? node.name : node.name.replace(/\.md$/i, "") });
    label.addEventListener("click", () => box.click());
    if (node.folder && expanded) for (const child of node.children) this.renderNode(parent, child, depth + 1);
  }

  override onClose() {
    this.contentEl.empty();
  }
}

export function notesIn(folder: TFolder): string[] {
  const out: string[] = [];
  const walk = (f: TFolder) => { for (const c of f.children) c instanceof TFolder ? walk(c) : c instanceof TFile && c.extension === "md" && out.push(c.path); };
  walk(folder);
  return out;
}
