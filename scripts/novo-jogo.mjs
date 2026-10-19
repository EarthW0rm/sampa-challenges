#!/usr/bin/env node
// Cria um jogo novo a partir de src/games/_modelo.
// Uso: npm run novo-jogo -- meu-jogo "Meu Jogo"
import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [id, ...titleParts] = process.argv.slice(2);
const title = titleParts.join(' ').trim();

if (!id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
  console.error('Uso: npm run novo-jogo -- <id-em-minusculas-com-hifen> "Título do Jogo"');
  console.error('Ex.: npm run novo-jogo -- metro-lotado "Metrô Lotado"');
  process.exit(1);
}

const src = join(root, 'src/games/_modelo');
const dest = join(root, 'src/games', id);
if (existsSync(dest)) {
  console.error(`Já existe uma pasta src/games/${id}.`);
  process.exit(1);
}

const component = id
  .split('-')
  .map((p) => p[0].toUpperCase() + p.slice(1))
  .join('')
  .replace(/^[0-9]/, (d) => 'Jogo' + d);

cpSync(src, dest, { recursive: true });

const TEXT = /\.(ts|tsx|css|md|json)$/;
function fill(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) fill(p);
    else if (TEXT.test(name)) {
      const s = readFileSync(p, 'utf8')
        .replaceAll('__ID__', id)
        .replaceAll('__TITULO__', title || component)
        .replaceAll('__COMPONENTE__', component);
      writeFileSync(p, s);
    }
  }
}
fill(dest);

console.log(`Jogo criado em src/games/${id}/`);
console.log('  manifest.ts  → título, descrição, capa e tags do card no hub');
console.log('  Game.tsx     → componente principal do jogo');
console.log('  assets/      → imagens do jogo (troque assets/capa.png pela capa)');
console.log('  README.md    → regras e parâmetros (preencha)');
console.log('  CLAUDE.md    → guia técnico para quem for mexer no código (preencha)');
console.log('Rode "npm run dev": o jogo já aparece no hub.');
