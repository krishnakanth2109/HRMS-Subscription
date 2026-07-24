import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url'; // ✅ Required for ESM
import { dirname } from 'path';      // ✅ Get directory from URL

const __filename = fileURLToPath(import.meta.url); // ✅ Fix __filename
const __dirname = dirname(__filename);             // ✅ Fix __dirname

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'), // ✅ Path alias works now
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
