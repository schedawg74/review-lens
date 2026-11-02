import type { FileChange, Lens, NodeStatus } from "@review-lens/schema";
import { sha256Hex } from "./sha256";

export const fileName = (path: string): string => path.split("/").pop() ?? path;

export const pathTail = (path: string): string =>
  path.split("/").slice(-2).join("/");

export const shortSha = (sha: string): string => sha.slice(0, 7);

export const statusLabel = (status: NodeStatus): string =>
  status === "added" ? "new" : status;

export const fileLine = (files: readonly FileChange[] | undefined): string => {
  const first = files?.[0];
  if (!first) {
    return "";
  }
  const parts = [fileName(first.path)];
  if (first.add) {
    parts.push(` +${first.add}`);
  }
  if (first.del) {
    parts.push(` −${first.del}`);
  }
  const more = (files?.length ?? 0) - 1;
  if (more > 0) {
    parts.push(` · ${more} more`);
  }
  return parts.join("");
};

export const filesUrl = (pr: Lens["pr"]): string =>
  `https://github.com/${pr.repo}/pull/${pr.number}/files`;

export const diffUrl = (pr: Lens["pr"], path: string, line?: number): string =>
  `${filesUrl(pr)}#diff-${sha256Hex(path)}${line ? `R${line}` : ""}`;
