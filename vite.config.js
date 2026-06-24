import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// On GitHub Pages a *project* site is served from /<repo-name>/, so the
// production base must match the repo name. Change this if you rename the repo.
// Local dev (`vite dev`) always serves from '/'.
const REPO_NAME = 'reimburse-organizer'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? `/${REPO_NAME}/` : '/',
}))
