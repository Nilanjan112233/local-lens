import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Read .env without the VITE_ prefix filter. The token stays in the dev
  // server process and is never bundled into browser code.
  const env = loadEnv(mode, process.cwd(), '');
  const apiPort = env.PORT || '8787';
  const apiToken = (env.LOCALLENS_API_TOKEN || '').trim();

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${apiPort}`,
          // When the API requires a token, the dev proxy attaches it so the UI
          // (including PDF and JSON download links) keeps working.
          headers: apiToken ? { 'X-LocalLens-Token': apiToken } : undefined,
        },
      },
    },
  };
});
