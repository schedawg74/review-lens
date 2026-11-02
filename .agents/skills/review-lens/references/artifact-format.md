# Artifact format (version 2)

The schema is `src/packages/schema/src/index.ts`. Objects are strict: unknown keys are errors. Defaults are in brackets.

## Top level

| Key | Type | Meaning |
| --- | --- | --- |
| `version` | `2` | Format version. |
| `pr` | `{ repo, number, title, head }` | `repo` is `owner/name`. `head` is the head SHA. |
| `generatedBy` | `{ skill, role, model }` | Who wrote the lens. |
| `triage` | `{ files, classes[] }` | `classes[]` is `{ kind, label, files }`. `kind` is `logic`, `tests`, `generated`, `prompts`, `docs`, or `config`. |
| `title`, `summary` | string | Shown at the top of the sidebar. |
| `lanes[]` | `{ id, title }` | Columns, left to right. |
| `nodes[]` | card | See below. |
| `edges[]` | `{ from, to, kind [flow], label? }` | `kind` is `flow`, `moved`, or `removed`. |
| `decisions[]` | `{ id, kind, text, nodes[], path?, line? }` | Design questions. `nodes` holds card or child ids. |

## Card

| Key | Type | Meaning |
| --- | --- | --- |
| `id`, `lane`, `title` | string | `lane` is a lane id. |
| `kind` | `unit` [default], `store`, `note` | |
| `status` | `added`, `changed`, `removed`, `context` [default] | |
| `text` | string? | One short line on the card. |
| `note` | string? | A small second line, such as limits. |
| `summary` | string? | Shown in the sidebar. |
| `files[]` | `{ path, add, del }` | From `facts.json`. The card shows the first file. |
| `inside[]` | `{ name, path, line }` | Functions or types, with a line at head. |
| `expanded` | boolean? | Open the children in place at start. |
| `children` | `{ label, nodes[], edges[] }` | A state machine inside the card. |

A child state is `{ id, title, tone [neutral], summary?, inside?, mark? }`. `tone` is `neutral`, `warn`, `ok`, or `bad`. `mark` is `breaks`, `mayBreak`, or `bugPath`. A child edge is `{ from, to, label? }`.

## Check rules

`review-lens check lens.json [--facts facts.json]` reports:

- Errors: schema errors; unknown lanes; edges, decisions, or child edges to unknown ids; duplicate ids; a `line` without a `path`; a removed card with added lines; with facts: a file not in the diff, `+`/`−` that do not match, a line after the end of the file, a line in a deleted file.
- Warnings: more than 16 cards; more than 20 child edges; a card with no edge; triage classes that do not add up; with facts: an anchor path not in the diff, a file count that differs from the diff.

## Example

A short lens. The full example is [examples/invoice-pdf/lens.json](../../../../examples/invoice-pdf/lens.json).

```json
{
  "version": 2,
  "pr": { "repo": "example/ledgerly", "number": 418, "title": "feat(invoices): render invoice PDFs in an API job", "head": "4be81c07d9a2f6e35b10c8d47e9a3f2c61d05b7e" },
  "generatedBy": { "skill": "review-lens", "role": "Lens writer", "model": "hand-written example" },
  "triage": { "files": 3, "classes": [{ "kind": "logic", "label": "Logic", "files": 3 }] },
  "title": "Invoice PDF",
  "summary": "PDF generation moves from the worker to an API job.",
  "lanes": [
    { "id": "worker", "title": "Python worker" },
    { "id": "api", "title": "API (TypeScript)" }
  ],
  "nodes": [
    {
      "id": "GEN", "lane": "worker", "status": "removed", "title": "PDF generator",
      "files": [{ "path": "worker/billing/pdf_generator.py", "add": 0, "del": 168 }]
    },
    {
      "id": "JOB", "lane": "api", "status": "added", "title": "invoice-pdf job", "expanded": true,
      "files": [{ "path": "apps/api/src/jobs/invoice-pdf.job.ts", "add": 286, "del": 0 }],
      "children": {
        "label": "3 states",
        "nodes": [
          { "id": "queued", "title": "queued" },
          { "id": "rendering", "title": "rendering", "tone": "warn" },
          { "id": "done", "title": "done", "tone": "ok" }
        ],
        "edges": [
          { "from": "queued", "to": "rendering", "label": "claim lease" },
          { "from": "rendering", "to": "queued", "label": "retry after 30 s" },
          { "from": "rendering", "to": "done" }
        ]
      }
    }
  ],
  "edges": [{ "from": "GEN", "to": "JOB", "kind": "moved", "label": "moved to API" }],
  "decisions": [
    { "id": "d1", "kind": "ownership", "text": "The API now owns PDF generation. Right owner?", "nodes": ["JOB"], "path": "apps/api/src/jobs/invoice-pdf.job.ts", "line": 58 }
  ]
}
```
