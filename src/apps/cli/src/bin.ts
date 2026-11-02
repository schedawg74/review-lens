#!/usr/bin/env node
import { parseArgs } from "node:util";
import {
  checkCommand,
  factsCommand,
  htmlCommand,
  type Output,
} from "./commands";

const USAGE = `Usage:
  review-lens facts --base <ref> --head <ref> [--cwd <dir>] [-o facts.json]
  review-lens check <lens.json> [--facts facts.json]
  review-lens html <lens.json> -o <out.html> [--facts facts.json]`;

const usage = (message?: string): Output => ({
  code: message ? 2 : 0,
  stdout: message ? [] : [USAGE],
  stderr: message ? [message, USAGE] : [],
});

const run = (argv: string[]): Output => {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      base: { type: "string" },
      head: { type: "string" },
      cwd: { type: "string", default: "." },
      out: { type: "string", short: "o" },
      facts: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  const [command, file] = positionals;
  if (values.help || !command) {
    return usage();
  }
  switch (command) {
    case "facts":
      if (!(values.base && values.head)) {
        return usage("facts needs --base and --head");
      }
      return factsCommand({
        base: values.base,
        head: values.head,
        cwd: values.cwd,
        out: values.out,
      });
    case "check":
      return file
        ? checkCommand({ lens: file, facts: values.facts })
        : usage("check needs a lens file");
    case "html":
      if (!(file && values.out)) {
        return usage("html needs a lens file and -o <out.html>");
      }
      return htmlCommand({ lens: file, out: values.out, facts: values.facts });
    default:
      return usage(`Unknown command "${command}"`);
  }
};

const main = (): number => {
  try {
    const output = run(process.argv.slice(2));
    for (const line of output.stdout) {
      console.log(line);
    }
    for (const line of output.stderr) {
      console.error(line);
    }
    return output.code;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
};

process.exitCode = main();
