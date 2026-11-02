# Drawing guide

These rules come from the pstack skills `statechart`, `teach`, `ketchup`, and `how` in [cursor/plugins, harness/pstack](https://github.com/cursor/plugins/tree/main/harness/pstack) (MIT). They are adapted to the lens format.

## When to draw

- Draw only when a picture lands faster than words. A diagram should clarify, not decorate.
- Never draw boxes with nothing that connects them. Never draw a status list as a diagram.
- Never give a fact twice.

## Labels

- Write labels in the reader's words: short, as a person would say them.
- Do not use variable names or code identifiers in state labels. Card titles may use the code name (`finalize_invoice`, `invoice-pdf job`).
- Card `text` is one short line. Put detail in `summary`, which shows in the sidebar.

## Size

- A map has at most about 12 to 16 cards.
- A state machine has about 20 arrows or fewer.
- Make labels coarser before you hide things. Merge two small cards into one before you drop one.

## Map

- Lanes are packages or layers, in the order the data flows (left to right).
- A card is one unit of logic: a function, a job, a handler, a schema field, a store, a vendor.
- `status`: `added` for new logic, `changed`, `removed` for deleted logic, `context` for code the PR uses but does not change.
- `kind`: `unit` (default), `store` for tables, buckets, queues, and vendors, `note` for a short note.
- Use `flow` edges for calls and data. Use `removed` edges for calls the PR deletes.
- Use `moved` edges when logic changes its owner: from the removed card to the card that now holds the logic. Give one of them a label such as "moved to API".

## State machines

- Show a state machine (`children` of a card) when the PR adds or changes statuses, enums, retries, leases, or timeouts.
- Start with the first state. Use edge labels for the cause of a step ("claim lease", "retry after 30 s").
- Each rule the reader must agree to is a decision or, with a model checker, an invariant.
- Mark a state that breaks a rule with `breaks`, or `mayBreak` when it breaks the rule only in some runs. Mark the states on the shortest path to it with `bugPath`, as pstack `/statechart` does.
- Replay a bug path against the real code before you show it. If you cannot replay it, write a decision instead.
- Set `expanded: true` on the card when the state machine is the main point of the PR.

## Notes

- Add a data-lifetime note when personal or sensitive data crosses a boundary or is stored. Say where the data lives, and when it is removed.

## Decisions

- Decisions are design questions for the owner. Typical kinds: `ownership`, `state`, `rollout`, `behavior` (a behavior change), `extract?`.
- Anchor each decision to one or more nodes and, when possible, a `path` and `line` that you read at the head SHA.
- Write four or five decisions at most. Each one must be something the owner can answer.
