import { stuck } from "./exit.ts";

export type ParsedArgs = {
  flags: Map<string, string>;
  rest: string[];
};

export function parseArgs(argv: string[], allowed: ReadonlySet<string>): ParsedArgs {
  const flags = new Map<string, string>();
  const rest: string[] = [];
  let i = 0;
  while (i < argv.length) {
    const tok = argv[i];
    if (tok === "--") {
      rest.push(...argv.slice(i + 1));
      break;
    }
    if (tok === "-") {
      rest.push(tok);
      i += 1;
      continue;
    }
    if (tok.startsWith("--")) {
      const eq = tok.indexOf("=");
      let name: string;
      let value: string | undefined;
      if (eq >= 0) {
        name = tok.slice(2, eq);
        value = tok.slice(eq + 1);
        i += 1;
      } else {
        name = tok.slice(2);
        if (i + 1 >= argv.length) stuck(`missing --${name} value`);
        value = argv[i + 1];
        i += 2;
      }
      if (!allowed.has(name)) stuck("unknown flag");
      flags.set(name, value);
      continue;
    }
    if (tok.startsWith("-")) stuck("unknown flag");
    rest.push(...argv.slice(i));
    break;
  }
  return { flags, rest };
}
