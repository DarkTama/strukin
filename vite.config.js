import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// On GitHub Pages a *project* site is served from /<repo-name>/, so the
// production base must match the repo name. Change this if you rename the repo.
// Local dev (`vite dev`) always serves from '/'.
const REPO_NAME = 'strukin'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Optional local-dev CORS bypass. Set VITE_API_PROXY=<your provider base>
  // (e.g. https://darktama.taile64290.ts.net) in .env.local, then set the
  // app's Base URL to "/proxy/v1". Requests go browser -> localhost -> Vite,
  // which forwards them server-side (no CORS). Dev only; not used in the build.
  const proxyTarget = env.VITE_API_PROXY

  return {
    plugins: [react()],
    base: command === 'build' ? `/${REPO_NAME}/` : '/',
    server: proxyTarget
      ? {
          proxy: {
            '/proxy': {
              target: proxyTarget,
              changeOrigin: true,
              secure: true,
              rewrite: (p) => p.replace(/^\/proxy/, ''),
            },
          },
        }
      : undefined,
  }
})
