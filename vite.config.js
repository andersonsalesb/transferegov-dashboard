import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/transferegov-dashboard/', // Necessário para rotas corretas no GitHub Pages
  server: {
    port: 3000
  }
});
