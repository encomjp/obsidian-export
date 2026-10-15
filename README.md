# Export Studio for Obsidian

Export notes to **PDF** or **HTML** with Starnote's clean look, and with **clickable links between the
exported notes**. Desktop only, no dependencies besides the plugin.

- **Note picker.** Choose notes from a folder tree (filter, folder checkboxes, **Add linked notes**), or
  right-click a note, folder, or a multi-selection in the file explorer and choose **Export…**.
- **Linked PDFs.** `[[wikilinks]]` between exported notes become blue links that jump to the note or
  heading inside the PDF. The PDF also gets bookmarks from the headings, an optional cover page,
  contents list, and page numbers. Links to notes that are not exported open them in Obsidian
  (`obsidian://` link) or become plain text, your choice.
- **One document or one file per note.** In per-note mode the links point at the sibling files.
- **Faithful rendering.** Notes are rendered by Obsidian itself: callouts, tables, task lists, code
  highlighting, math (MathJax, fonts embedded), note and heading embeds (`![[Note#Heading]]`), images
  (inlined), and plugin output such as Mermaid or Dataview.
- **Options.** Page size, orientation, margins, new page per note, output folder. Existing files are
  never overwritten (`Name 2.pdf`).
- **Commands.** *Export notes…* and *Export current note to PDF*.

PDFs are printed with Obsidian's own Chromium (`printToPDF`); if a build does not expose it, the plugin
writes the HTML instead and you can print it from a browser.

## Install

Unzip into `<vault>/.obsidian/plugins/export-studio/` and enable **Export Studio**. To build:

```bash
npm install && npm run build
```

`npm test` runs the unit tests for the link, anchor and selection logic.

## Not an official product

An independent port of Starnote's export. Not affiliated with or endorsed by Obsidian (Dynalist Inc.).
Provided "as is" under the MIT licence, without warranty; you are responsible for what you export.
