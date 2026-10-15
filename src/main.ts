import { Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder, type App } from "obsidian";
import { announce, runExport } from "./exporter.ts";
import { ExportModal, notesIn } from "./modal.ts";
import { DEFAULT_OPTIONS, type ExportOptions } from "./options.ts";

export default class ExportStudioPlugin extends Plugin {
  options: ExportOptions = { ...DEFAULT_OPTIONS };

  override async onload() {
    this.options = { ...DEFAULT_OPTIONS, ...((await this.loadData()) as Partial<ExportOptions> | null) };
    this.addRibbonIcon("file-output", "Export notes…", () => this.openPicker(this.app.workspace.getActiveFile()?.path ? [this.app.workspace.getActiveFile()!.path] : []));
    this.addCommand({ id: "export-notes", name: "Export notes…", callback: () => this.openPicker(this.activeNote()) });
    this.addCommand({
      id: "export-current-pdf",
      name: "Export current note to PDF",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") return false;
        if (!checking) void this.run([file], { ...this.options, format: "pdf", merge: true, cover: false, toc: false, title: "" });
        return true;
      },
    });
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
      if (file instanceof TFile && file.extension === "md") menu.addItem((i) => i.setTitle("Export…").setIcon("file-output").onClick(() => this.openPicker([file.path])));
      else if (file instanceof TFolder) menu.addItem((i) => i.setTitle("Export folder…").setIcon("file-output").onClick(() => this.openPicker(notesIn(file))));
    }));
    this.registerEvent(this.app.workspace.on("files-menu", (menu, files) => {
      const notes = files.flatMap((f) => (f instanceof TFile && f.extension === "md" ? [f.path] : f instanceof TFolder ? notesIn(f) : []));
      if (notes.length > 1) menu.addItem((i) => i.setTitle(`Export ${notes.length} notes…`).setIcon("file-output").onClick(() => this.openPicker(notes)));
    }));
    this.addSettingTab(new ExportSettingTab(this.app, this));
  }

  private activeNote(): string[] {
    const file = this.app.workspace.getActiveFile();
    return file && file.extension === "md" ? [file.path] : [];
  }

  openPicker(preselected: string[]) {
    new ExportModal(this.app, preselected, this.options, ({ files, options }) => {
      this.options = options;
      void this.saveData(options);
      void this.run(files, options);
    }).open();
  }

  async run(files: TFile[], options: ExportOptions) {
    const status = new Notice("Exporting…", 0);
    try {
      const result = await runExport(this.app, files, options, (text) => status.setMessage(text));
      status.hide();
      announce(this.app, result);
    } catch (error) {
      status.hide();
      new Notice(`Export failed: ${(error as Error).message}`, 10000);
      console.error("[export-studio]", error);
    }
  }
}

class ExportSettingTab extends PluginSettingTab {
  private readonly plugin: ExportStudioPlugin;
  constructor(app: App, plugin: ExportStudioPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  override display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("p", { text: "Defaults for the export dialog; the dialog remembers your last choices too. Not affiliated with Obsidian or Starnote's makers beyond being a port of Starnote's export." });
    new Setting(containerEl).setName("Save to folder").setDesc("Vault folder for exported files.").addText((t) => t.setValue(this.plugin.options.outputFolder).onChange((v) => { this.plugin.options.outputFolder = v; void this.plugin.saveData(this.plugin.options); }));
  }
}
