// The export look, after Starnote's HTML/PDF stylesheet: light page, Segoe UI, blue links.

export const LINK = "#2F58A5";

export function buildCss(): string {
  return `
:root { --text:#20232c; --muted:#6b7080; --line:#dfe2ea; --panel:#f3f4f8; --link:${LINK}; --accent:#6445b5; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; color: var(--text); background: #fff; font: 10.5pt/1.62 "Segoe UI", Inter, system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif; }
@media screen { body { max-width: 46rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; font-size: 16px; } }
h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin: 1.5em 0 .5em; break-after: avoid; }
h1 { font-size: 1.9em; } h2 { font-size: 1.5em; } h3 { font-size: 1.25em; } h4 { font-size: 1.1em; } h5, h6 { font-size: 1em; }
.note h1.note-title { margin-top: 0; padding-bottom: .3em; border-bottom: 2px solid var(--line); }
.note + .note { margin-top: 2.5em; }
.note.page-break { break-before: page; }
.note.page-break:first-of-type { break-before: auto; }
p, ul, ol, blockquote, table, pre, .callout { margin: 0 0 .9em; }
a { color: var(--link); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 2px; }
a.external-note { text-decoration-style: dashed; }
span.unresolved, span.plain-link { color: var(--text); }
a.tag, span.tag { background: #ebeef8; color: var(--link); border-radius: 999px; padding: .05em .55em; text-decoration: none; font-size: .9em; }
img, svg { max-width: 100%; height: auto; }
img { break-inside: avoid; }
hr { border: 0; border-top: 1px solid var(--line); margin: 1.6em 0; }
blockquote { margin-left: 0; padding: .1em 1em; border-left: 3px solid var(--accent); color: #3b3f4d; }
code { font: .92em Consolas, "SF Mono", Menlo, monospace; background: var(--panel); padding: .08em .35em; border-radius: 4px; }
pre { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: .7em .9em; white-space: pre-wrap; word-break: break-word; break-inside: avoid; }
pre code { background: none; padding: 0; font-size: .88em; }
.token.comment, .token.prolog, .token.doctype, .token.cdata { color: #7a8294; font-style: italic; }
.token.keyword, .token.atrule, .token.tag, .token.selector { color: #7a3fb5; }
.token.string, .token.char, .token.attr-value, .token.template-string { color: #2a7a3b; }
.token.number, .token.boolean, .token.constant, .token.symbol { color: #b5651d; }
.token.function, .token.class-name, .token.builtin { color: #1f5fbf; }
.token.property, .token.attr-name, .token.variable { color: #a02f5a; }
.token.operator, .token.punctuation { color: #4a4f5e; }
table { border-collapse: collapse; width: auto; max-width: 100%; break-inside: auto; }
th, td { border: 1px solid var(--line); padding: .35em .7em; vertical-align: top; }
th { background: var(--panel); text-align: left; }
tr { break-inside: avoid; }
ul.contains-task-list { list-style: none; padding-left: 1.2em; }
.task-list-item-checkbox { margin-right: .5em; }
.callout { border-left: 4px solid var(--c, #3b82f6); background: color-mix(in srgb, var(--c, #3b82f6) 9%, #fff); border-radius: 6px; padding: .6em .9em; break-inside: avoid; }
.callout-title { display: flex; align-items: center; gap: .5em; font-weight: 600; color: var(--c, #3b82f6); }
.callout-icon .svg-icon { width: 1.05em; height: 1.05em; vertical-align: -.15em; }
.callout-title-inner { flex: 1; }
.callout-fold { display: none; }
.callout-content > :last-child { margin-bottom: 0; }
.callout[data-callout="tip"], .callout[data-callout="hint"], .callout[data-callout="success"], .callout[data-callout="check"], .callout[data-callout="done"] { --c: #16a34a; }
.callout[data-callout="warning"], .callout[data-callout="caution"], .callout[data-callout="attention"] { --c: #d97706; }
.callout[data-callout="danger"], .callout[data-callout="error"], .callout[data-callout="bug"], .callout[data-callout="failure"], .callout[data-callout="fail"], .callout[data-callout="missing"] { --c: #dc2626; }
.callout[data-callout="question"], .callout[data-callout="help"], .callout[data-callout="faq"], .callout[data-callout="example"] { --c: #7c3aed; }
.callout[data-callout="quote"], .callout[data-callout="cite"] { --c: #6b7280; }
.callout[data-callout="abstract"], .callout[data-callout="summary"], .callout[data-callout="tldr"] { --c: #0891b2; }
.embed-note { border-left: 3px solid var(--line); margin: 0 0 .9em; padding: .1em 0 .1em 1em; }
.embed-note > :first-child { margin-top: 0; }
.embed-file { color: var(--muted); }
mjx-container { break-inside: avoid; }
mjx-container[display="true"] { display: block; text-align: center; margin: .8em 0; overflow: visible; }
.footnotes { font-size: .9em; color: #3b3f4d; }
.cover { min-height: 90vh; display: flex; flex-direction: column; justify-content: center; break-after: page; }
.cover h1 { font-size: 2.6em; margin: 0 0 .3em; }
.cover .meta { color: var(--muted); margin-bottom: 2em; }
.cover ol { color: var(--muted); }
.toc { break-after: page; }
.toc h2 { margin-top: 0; }
.toc ol { list-style: none; padding-left: 0; margin: 0; }
.toc ol ol { padding-left: 1.3em; }
.toc li { margin: .18em 0; }
.toc > ol > li > a { font-weight: 600; }
.toc li li a { font-weight: 400; }
.back-to-top { display: none; }
`;
}
