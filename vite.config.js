import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

import { demoSmsPilotPlugin } from './vite/demoSmsPilotPlugin.js'

export function createViteConfig({ command, mode }) {
  const plugins = [vue()]

  if (command === 'serve' && mode === 'demo') {
    const serverEnv = loadEnv(mode, process.cwd(), '')
    plugins.push(
      demoSmsPilotPlugin({
        apiKey: serverEnv.SMSPILOT_API_KEY,
      }),
    )
  }

  return {
    plugins,
    test: {
      clearMocks: true,
      environment: 'jsdom',
    },
  }
}

export default defineConfig(createViteConfig)
