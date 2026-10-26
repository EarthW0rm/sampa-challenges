#!/usr/bin/env node
// Cobertura regra × teste (spec RN-08): cada `<SIGLA>-RN-NN` do manual (README do jogo) precisa de pelo
// menos um teste de ponta a ponta que cite o número no nome, e nenhum teste pode citar regra inexistente.
//
// Uso:
//   npm run test:e2e:cobertura                    # todos os jogos e o hub; exit 1 se houver pendência
//   npm run test:e2e:cobertura -- --jogo <id>     # só um jogo (ou `hub`)
//   npm run test:e2e:cobertura -- --md <id>       # tabela regra → arquivos de teste em Markdown (para o manual)
//
// Fontes: `src/games/<id>/README.md` (menos `_modelo` e `pastel-de-feira`, cujos IDs `RN-NN` têm
// cobertura própria) e, para o hub, os `HUB-RN-NN` de `e2e/README.md`. Testes: títulos de `test(...)` e
// `test.describe(...)` em `e2e/<id>/**/*.spec.ts` e `e2e/hub/`.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['_modelo', 'pastel-de-feira']);
const RN = /\b([A-Z]{2,4})-RN-(\d+[a-z]?)\b/g;
const TITLE = /\btest(?:\.describe)?(?:\.(?:only|skip|fail|fixme|serial|parallel))*\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;

function args() {
  const a = process.argv.slice(2);
  const get = (flag) => {
    const i = a.indexOf(flag);
    return i >= 0 ? a[i + 1] : undefined;
  };
  return { jogo: get('--jogo'), md: get('--md') };
}

const ids = (text) => new Set([...text.matchAll(RN)].map((m) => `${m[1]}-RN-${m[2]}`));

function specFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...specFiles(p));
    else if (name.endsWith('.spec.ts')) out.push(p);
  }
  return out.sort();
}

/** Regra → arquivos de teste que a citam (pelo título de `test`/`test.describe`). */
function testsByRule(dir) {
  const map = new Map();
  for (const file of specFiles(dir)) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(TITLE)) {
      for (const id of ids(m[2])) {
        if (!map.has(id)) map.set(id, new Set());
        map.get(id).add(relative(dir, file));
      }
    }
  }
  return map;
}

function targets() {
  const games = readdirSync(join(root, 'src/games'))
    .filter((d) => !SKIP.has(d) && existsSync(join(root, 'src/games', d, 'README.md')))
    .map((id) => ({ id, manual: join(root, 'src/games', id, 'README.md'), tests: join(root, 'e2e', id) }));
  const hub = { id: 'hub', manual: join(root, 'e2e/README.md'), tests: join(root, 'e2e/hub'), only: 'HUB' };
  return [...games, hub];
}

function check(t) {
  const text = existsSync(t.manual) ? readFileSync(t.manual, 'utf8') : '';
  let rules = [...ids(text)];
  if (t.only) rules = rules.filter((r) => r.startsWith(`${t.only}-`));
  const sigla = rules[0]?.split('-')[0];
  const byRule = testsByRule(t.tests);
  const tested = [...byRule.keys()].filter((r) => (t.only ? r.startsWith(`${t.only}-`) : !sigla || r.startsWith(`${sigla}-`)));
  const missing = rules.filter((r) => !byRule.has(r));
  const unknown = tested.filter((r) => !rules.includes(r));
  return { ...t, rules, byRule, missing, unknown };
}

const order = (a, b) => {
  const na = Number.parseInt(a.split('-RN-')[1], 10);
  const nb = Number.parseInt(b.split('-RN-')[1], 10);
  return na - nb || a.localeCompare(b);
};

const { jogo, md } = args();
const all = targets();

if (md) {
  const t = all.find((x) => x.id === md);
  if (!t) {
    console.error(`jogo "${md}" não encontrado`);
    process.exit(2);
  }
  const r = check(t);
  console.log('| Regra | Testes |');
  console.log('|---|---|');
  for (const rule of [...r.rules].sort(order)) {
    const files = [...(r.byRule.get(rule) ?? [])].map((f) => `\`${f}\``).join(', ');
    console.log(`| ${rule} | ${files || '**sem teste**'} |`);
  }
  process.exit(r.missing.length || r.unknown.length ? 1 : 0);
}

let failed = false;
const rows = [];
for (const t of all) {
  if (jogo && t.id !== jogo) continue;
  const r = check(t);
  if (r.rules.length === 0) {
    failed = true;
    rows.push({ jogo: r.id, regras: 0, cobertas: 0, pendencias: 'manual sem RN' });
    continue;
  }
  const notes = [];
  if (r.missing.length) notes.push(`sem teste: ${r.missing.sort(order).join(', ')}`);
  if (r.unknown.length) notes.push(`teste cita regra inexistente: ${r.unknown.sort(order).join(', ')}`);
  if (notes.length) failed = true;
  rows.push({ jogo: r.id, regras: r.rules.length, cobertas: r.rules.length - r.missing.length, pendencias: notes.join('; ') || 'ok' });
}

if (rows.length === 0) {
  console.error(`jogo "${jogo}" não encontrado`);
  process.exit(2);
}
const w = Math.max(...rows.map((r) => r.jogo.length), 4);
console.log(`${'jogo'.padEnd(w)}  regras  cobertas  pendências`);
for (const r of rows) console.log(`${r.jogo.padEnd(w)}  ${String(r.regras).padStart(6)}  ${String(r.cobertas).padStart(8)}  ${r.pendencias}`);
process.exit(failed ? 1 : 0);
