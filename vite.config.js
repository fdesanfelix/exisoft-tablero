import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    // base relativa: hace que la app funcione tanto en la raíz (vercel/netlify)
    // como bajo un subpath (GitHub Pages → usuario.github.io/<repo>/).
    // Como no usamos react-router, esto es seguro.
    base: './',
    server: { port: 5173, host: true },
});
