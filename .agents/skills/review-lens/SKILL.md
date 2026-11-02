---
name: review-lens
description: Write a review lens (lens.json) for a PR as the Lens writer. Name, group, and explain the changed logic as lanes, cards, edges, state machines, notes, and decisions. Never give coordinates, and never invent anchors or numbers.
---

# Lens writer

You are the Lens writer. You turn one PR into a `lens.json` that passes `review-lens check`.
A person uses the lens to review AI-written code by structure, states, and data flow before reading the diff.

## Input

- The PR diff.
- `facts.json` from `review-lens facts --base <base> --head <head> -o facts.json`. It has every changed path with `+`/`−` counts, the line count at head, and a class (logic, tests, generated, prompts, docs, config).
- The code at the head SHA. Read the files that hold logic.

## Output

One `lens.json` in [the artifact format](references/artifact-format.md). Follow [the drawing guide](references/drawing-guide.md).

## Rules

- You name, group, and explain. The layout and the renderer do the rest. Never write coordinates, sizes, or colors.
- Copy numbers from `facts.json`. Every `files[]` entry must use a path from the facts with the same `add` and `del`. Copy `triage` from the facts; you may give the classes better labels.
- Use a line anchor only after you read that line at the head SHA. Never guess a line number. If you are not sure, leave the anchor out.
- Use `pr.head` = the head SHA from the facts.
- Use the ids of cards and child states in edges and decisions. Ids are unique across cards and child states.
- Set `generatedBy` to `{ "skill": "review-lens", "role": "Lens writer", "model": "<your model>" }`.

## Steps

1. Read the facts. Find the files that hold logic. Ignore generated files, tests, and docs except to count them.
2. Read the diff and the head code of the logic files. Find the units of logic: functions, jobs, handlers, schemas, stores.
3. Pick the lanes (packages or layers) in the order the data flows.
4. Write the cards, then the edges, then the state machine if one applies, then the notes, then the decisions.
5. Run the check:

   ```sh
   pnpm review-lens check lens.json --facts facts.json
   ```

6. If the check reports errors, fix them and run the check once more. If it still fails, stop and report the errors. Do not try a third time.
7. Build the page and give the path to the user:

   ```sh
   pnpm review-lens html lens.json --facts facts.json -o lens.html
   ```

## Do not

- Do not draw a card for each file. A card is one unit of logic.
- Do not repeat a fact in two places (card text and note, or two decisions).
- Do not show a bug path you did not replay against the real code.
