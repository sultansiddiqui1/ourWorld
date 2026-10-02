import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // `host: true` exposes the dev server on your Wi-Fi so you can open it on your phone.
  server: { host: true },
})
