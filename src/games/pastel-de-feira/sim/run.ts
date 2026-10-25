/**
 * Executor de cenários sem tela (plan 5.3). Uso:
 *   npx esbuild src/games/pastel-de-feira/sim/run.ts --bundle --platform=node --format=esm --outfile=<tmp>/pf-sim.mjs
 *   node <tmp>/pf-sim.mjs --scenario <grupo|all> [--seed N] | --list | --replay <arquivo.json> | --bots <nome|all> [--seeds N] [--days N] [--json arquivo]
 * Sai com 0 se tudo passar, 1 se algum cenário falhar, 2 se o grupo não existir.
 */
import { GROUPS } from './scenarios';
import { readFileSync, writeFileSync } from 'node:fs';
import { BOT_NAMES, type BotName } from './bots';
import { formatReport, runBots } from './report';
import { parseReplay, runReplay } from './replay';

declare const process: { argv: string[]; exit(code?: number): never };

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const names = Object.keys(GROUPS);

if (process.argv.includes('--list')) {
  for (const g of names) console.log(`${g} (${GROUPS[g].length} cenários)`);
  process.exit(0);
}

const replayFile = arg('--replay');
if (replayFile) {
  try {
    const r = parseReplay(JSON.parse(readFileSync(replayFile, 'utf8')));
    const h = runReplay(r);
    console.log(`hash ${h} (esperado ${r.hash}) ${h === r.hash ? 'IGUAL' : 'DIFERENTE'}`);
    process.exit(h === r.hash ? 0 : 1);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(2);
  }
}

const botArg = arg('--bots');
if (botArg) {
  const names = botArg === 'all' ? BOT_NAMES : [botArg as BotName];
  if (names.some((n) => !BOT_NAMES.includes(n))) {
    console.error(`Robô inexistente: ${botArg}. Robôs: ${BOT_NAMES.join(', ')}`);
    process.exit(2);
  }
  const reports = runBots(names, Number(arg('--seeds') ?? 50), Number(arg('--days') ?? 20));
  console.log(formatReport(reports));
  const json = arg('--json');
  if (json) writeFileSync(json, JSON.stringify(reports, null, 1));
  process.exit(reports.every((r) => r.ok) ? 0 : 1);
}

const wanted = arg('--scenario') ?? 'all';
const seed = Number(arg('--seed') ?? 42);
const groups = wanted === 'all' ? names : [wanted];

if (groups.some((g) => !GROUPS[g])) {
  console.error(`Grupo inexistente: ${wanted}. Grupos: ${names.join(', ')}`);
  process.exit(2);
}

let failed = 0;
let total = 0;
for (const g of groups) {
  for (const sc of GROUPS[g]) {
    total++;
    try {
      sc.run(seed);
      console.log(`  ok    ${g}/${sc.id}`);
    } catch (e) {
      failed++;
      console.log(`  FALHA ${g}/${sc.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
console.log(`${total - failed}/${total} cenários passaram`);
process.exit(failed > 0 ? 1 : 0);
