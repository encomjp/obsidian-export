export type ExportFormat = "pdf" | "html";
export type PageSize = "A4" | "A5" | "Letter" | "Legal";
export type OtherNoteLinks = "obsidian" | "plain";

export interface ExportOptions {
  format: ExportFormat;
  /** One document with every note (links jump inside it) or one file per note. */
  merge: boolean;
  pageSize: PageSize;
  landscape: boolean;
  /** Page margin in millimetres. */
  margin: number;
  cover: boolean;
  toc: boolean;
  pageNumbers: boolean;
  newPagePerNote: boolean;
  /** What a link to a note that is not part of the export becomes. */
  otherLinks: OtherNoteLinks;
  title: string;
  /** Vault folder the files are written to. */
  outputFolder: string;
}

export const DEFAULT_OPTIONS: ExportOptions = {
  format: "pdf",
  merge: true,
  pageSize: "A4",
  landscape: false,
  margin: 18,
  cover: false,
  toc: true,
  pageNumbers: true,
  newPagePerNote: true,
  otherLinks: "obsidian",
  title: "",
  outputFolder: "Exports",
};
