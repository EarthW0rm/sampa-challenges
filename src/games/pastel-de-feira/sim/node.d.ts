/** Só o que o executor de cenários usa do Node (o projeto não depende de @types/node). */
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: string): string;
}
