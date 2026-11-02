# Architecture

## Data flow

1. `review-lens facts` reads `git diff --numstat` between the merge base and the head, counts the lines of each file at the head, and classifies each path (`src/apps/cli/src/facts.ts`, `classify.ts`).
2. The Lens writer (an AI model, see the [skill](../skills/review-lens/SKILL.md)) reads the diff, the facts, and the code. It writes `lens.json`.
3. `review-lens check` validates the JSON against the schema and the facts (`src/packages/check`).
4. `review-lens html` runs the check, then puts the parsed lens into the viewer template (`src/apps/cli/src/html.ts`).
5. The viewer measures the cards in the DOM and calls the pure layout (`src/apps/viewer/src/map.ts`).

## Packages

| Package | Role |
| --- | --- |
| `@review-lens/schema` | Zod 4 schema and inferred types of the artifact (version 2) and of the facts file. |
| `@review-lens/layout` | Pure layout: lanes, rows, card positions, ports, edge paths, pills, nested child layout. No DOM. |
| `@review-lens/check` | `checkLens(raw, facts?, limits?)` returns errors and warnings. |
| `@review-lens/viewer` | Plain TypeScript DOM viewer. esbuild bundles it into one HTML template. |
| `@review-lens/cli` | `review-lens facts`, `check`, `html`. esbuild bundles it with the template. |

## Decisions

- **Semantic model.** The model names, groups, and explains. It never gives coordinates, sizes, or colors. The strict schema rejects unknown keys, so a coordinate or a typo fails the check.
- **Computed layout.** Layout is deterministic code with unit tests. Same input gives the same output, so a lens looks the same on every machine.
- **Own renderer.** HTML cards plus SVG edges. Cards hold several fields (title, text, file line, note, status) and can open in place.
- **Why not Mermaid or Pele for rendering.** They have no lanes, no multi-field cards, and no in-place expansion. When the model draws pixels, it needs a render, look, fix loop for every diagram. A computed layout removes that loop.
- **No zod in the viewer.** zod made the bundle 476 KB. The CLI validates before it writes the HTML and injects the parsed lens; the viewer only fills defaults (`src/apps/viewer/src/normalize.ts`).
- **Synchronous SHA-256 in the viewer.** GitHub diff anchors use the SHA-256 of the path. `crypto.subtle` needs a secure context and is async, so the viewer has its own small hash (`src/apps/viewer/src/sha256.ts`, tested against `node:crypto`).
- **Cycles in the map.** Edges that close a cycle do not rank, so ranks always converge.
- **React is not needed now.** The viewer is small and has little state.

## Building blocks

Planned: map, nested state machine, sequence, before/after split, table, timeline, note.
Implemented now: map (with note cards) and nested state machine.

## Later

- An importer for pstack `/statechart` output (Mermaid `stateDiagram` with `breaks`, `mayBreak`, and `bugPath` classes) into a card's `children`. The marks already exist in the schema.
- ELK as a layout engine for big maps. The current layout handles about 16 cards.
- Edges that skip a lane can cross cards of the lane in between. Route around them, or use ELK.
