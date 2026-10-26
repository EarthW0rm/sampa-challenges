import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// cópias do repositório em `.worktrees/` (trabalho em paralelo) não podem recarregar a página deste servidor;
// caminho absoluto desta raiz: dentro de um worktree o padrão `**/.worktrees/**` ignoraria o próprio código
const WORKTREES = fileURLToPath(new URL('./.worktrees/', import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { watch: { ignored: [`${WORKTREES}**`] } },
});
