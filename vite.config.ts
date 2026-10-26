import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  // cópias do repositório em `.worktrees/` (trabalho em paralelo) não podem recarregar a página deste servidor
  server: { watch: { ignored: ['**/.worktrees/**'] } },
});
