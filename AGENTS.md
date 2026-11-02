# Repository instructions

review-lens turns an AI-written PR review into a visual lens: a JSON artifact with lanes, cards, edges, nested state machines, notes, and decisions to check. See [architecture](.agents/memory/architecture.md).

## Start here

- Read complete files before you change them.
- Report to the user in ASD-STE100 Simplified Technical English. Use short, active sentences. Keep technical names exact.
- Read [the memory index](.agents/memory/README.md), then load the notes for the task. Source code, manifests, and tests define current behavior.
- Use [README.md](README.md) for setup and commands.
- Preserve the user's staged and unstaged changes. Use Conventional Commits.

## Implementation rules

- Build the smallest complete solution. Keep concerns separate. Do not add compatibility layers, speculative abstractions, or temporary code.
- The model writes semantic JSON only. Never add coordinates, sizes, or colors to the artifact format.
- Keep `@review-lens/layout` pure: no DOM, no I/O, same input gives the same output.
- Define the artifact format once, in `src/packages/schema`. Other packages import its types.
- The viewer must stay one self-contained HTML file under 300 KB. Do not add runtime dependencies to it.
- Do not add a UI framework. The viewer uses plain DOM code.

## Code

- Annotate types. Do not use `any`, TypeScript enums, non-null assertions, `console` (except in `scripts/`, `bin`, and tests), `debugger`, or `var`.
- Use `type`, not `interface`. Use type-only imports and exports, arrow functions, `for...of`, and early returns. Avoid nested ternaries and unnecessary comments.
- Build DOM with `textContent` and `setAttribute`. Do not put lens text into `innerHTML`.

## Skills and checks

- Load [review-lens](.agents/skills/review-lens/SKILL.md) to write a lens for a PR.
- `pnpm lint` checks without fixes; `pnpm check` changes files. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before a commit.
- After a viewer or layout change, build the example and look at it: `pnpm review-lens html examples/invoice-pdf/lens.json -o examples/invoice-pdf/lens.html`, then `pnpm screenshots` (see [scripts/screenshots.mjs](scripts/screenshots.mjs)). Fix overlaps, clipped text, and edges through cards.
- Keep durable decisions in `.agents/memory/`. Keep task status in the PR or issue.
