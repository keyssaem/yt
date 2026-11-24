import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { localFsPlugin } from './dev/localFsPlugin'

// base './' + HashRouter → GitHub Pages 하위 경로(/yt/)에서도 그대로 동작
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), localFsPlugin()],
  server: { host: '127.0.0.1', port: 5180 },
})
