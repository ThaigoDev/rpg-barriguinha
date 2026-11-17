import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Gera um único dist/index.html com tudo embutido: dá pra abrir direto no navegador
// ou publicar no GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { target: 'es2020' },
});
