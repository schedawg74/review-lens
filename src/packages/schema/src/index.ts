import { z } from "zod";

const id = z.string().min(1);
const text = z.string().min(1);
const lineNumber = z.number().int().positive();

export const nodeStatusSchema = z.enum([
  "added",
  "changed",
  "removed",
  "context",
]);
export const nodeKindSchema = z.enum(["unit", "store", "note"]);
export const edgeKindSchema = z.enum(["flow", "moved", "removed"]);
export const toneSchema = z.enum(["neutral", "warn", "ok", "bad"]);
export const markSchema = z.enum(["breaks", "mayBreak", "bugPath"]);
export const triageKindSchema = z.enum([
  "logic",
  "tests",
  "generated",
  "docs",
  "prompts",
  "config",
]);

export const fileChangeSchema = z.strictObject({
  path: text,
  add: z.number().int().nonnegative(),
  del: z.number().int().nonnegative(),
});

export const anchorSchema = z.strictObject({
  name: text,
  path: text,
  line: lineNumber,
});

export const childNodeSchema = z.strictObject({
  id,
  title: text,
  tone: toneSchema.default("neutral"),
  summary: z.string().optional(),
  inside: z.array(anchorSchema).optional(),
  mark: markSchema.optional(),
});

export const childEdgeSchema = z.strictObject({
  from: id,
  to: id,
  label: z.string().optional(),
});

export const childrenSchema = z.strictObject({
  label: text,
  nodes: z.array(childNodeSchema).min(1),
  edges: z.array(childEdgeSchema),
});

export const lensNodeSchema = z.strictObject({
  id,
  lane: id,
  kind: nodeKindSchema.default("unit"),
  status: nodeStatusSchema.default("context"),
  title: text,
  text: z.string().optional(),
  note: z.string().optional(),
  summary: z.string().optional(),
  files: z.array(fileChangeSchema).optional(),
  inside: z.array(anchorSchema).optional(),
  expanded: z.boolean().optional(),
  children: childrenSchema.optional(),
});

export const lensEdgeSchema = z.strictObject({
  from: id,
  to: id,
  kind: edgeKindSchema.default("flow"),
  label: z.string().optional(),
});

export const decisionSchema = z.strictObject({
  id,
  kind: text,
  text,
  nodes: z.array(id).min(1),
  path: text.optional(),
  line: lineNumber.optional(),
});

export const laneSchema = z.strictObject({
  id,
  title: text,
});

export const triageClassSchema = z.strictObject({
  kind: triageKindSchema,
  label: text,
  files: z.number().int().nonnegative(),
});

export const triageSchema = z.strictObject({
  files: z.number().int().nonnegative(),
  classes: z.array(triageClassSchema),
});

export const lensSchema = z.strictObject({
  version: z.literal(2),
  pr: z.strictObject({
    repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, "use owner/name"),
    number: z.number().int().positive(),
    title: text,
    head: z.string().regex(/^[0-9a-f]{7,40}$/, "use a commit SHA"),
  }),
  generatedBy: z.strictObject({
    skill: text,
    role: text,
    model: text,
  }),
  triage: triageSchema,
  title: text,
  summary: text,
  lanes: z.array(laneSchema).min(1),
  nodes: z.array(lensNodeSchema).min(1),
  edges: z.array(lensEdgeSchema),
  decisions: z.array(decisionSchema),
});

export const factsFileSchema = z.object({
  path: text,
  add: z.number().int().nonnegative(),
  del: z.number().int().nonnegative(),
  binary: z.boolean().optional(),
  lines: z.number().int().nonnegative().nullable(),
  class: triageKindSchema,
});

export const factsSchema = z.object({
  version: z.literal(1),
  base: text,
  head: text,
  files: z.array(factsFileSchema),
  triage: triageSchema,
});

export type NodeStatus = z.infer<typeof nodeStatusSchema>;
export type NodeKind = z.infer<typeof nodeKindSchema>;
export type EdgeKind = z.infer<typeof edgeKindSchema>;
export type Tone = z.infer<typeof toneSchema>;
export type Mark = z.infer<typeof markSchema>;
export type TriageKind = z.infer<typeof triageKindSchema>;
export type FileChange = z.infer<typeof fileChangeSchema>;
export type Anchor = z.infer<typeof anchorSchema>;
export type ChildNode = z.infer<typeof childNodeSchema>;
export type ChildEdge = z.infer<typeof childEdgeSchema>;
export type Children = z.infer<typeof childrenSchema>;
export type LensNode = z.infer<typeof lensNodeSchema>;
export type LensEdge = z.infer<typeof lensEdgeSchema>;
export type Decision = z.infer<typeof decisionSchema>;
export type Lane = z.infer<typeof laneSchema>;
export type TriageClass = z.infer<typeof triageClassSchema>;
export type Triage = z.infer<typeof triageSchema>;
export type Lens = z.infer<typeof lensSchema>;
export type LensInput = z.input<typeof lensSchema>;
export type FactsFile = z.infer<typeof factsFileSchema>;
export type Facts = z.infer<typeof factsSchema>;

export const parseLens = (raw: unknown): Lens => lensSchema.parse(raw);
