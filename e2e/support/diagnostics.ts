/**
 * Arquivo de diagnóstico de cada partida do piloto (`partida-<n>.json`, plan.md 3.4): semente, comandos e
 * resultado, para reproduzir a partida e comparar duas execuções com a mesma semente.
 */
import { writeFileSync } from 'node:fs';
import type { TestInfo } from '@playwright/test';

export type MatchStatus = 'fim' | 'travou' | 'erro';

export interface MatchCommand {
  /** Quadro do piloto em que o gesto começou. */
  q: number;
  /** Gesto: `key:ArrowLeft:30`, `tap:x,y`, `drag:x,y>x,y`, `click:<rótulo>`, `wait:n`. */
  g: string;
  /** Alvo do gesto; `null` = gesto sem alvo (RN-21). */
  alvo: string | null;
}

export interface MatchRecord {
  jogo: string;
  variante: string;
  semente: number;
  status: MatchStatus;
  quadros: number;
  comandos: MatchCommand[];
  resultado: Record<string, unknown>;
  erros: string[];
}

/** Grava `partida-<n>.json` na pasta de saída do teste e devolve o caminho. */
export function writeMatch(testInfo: TestInfo, n: number, data: MatchRecord): string {
  const path = testInfo.outputPath(`partida-${n}.json`);
  writeFileSync(path, JSON.stringify(data, null, 2));
  return path;
}
