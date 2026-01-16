import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import pkg from './package.json'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

// 镜像支持版本的时间
const imageSupportVersionTime = '20251227'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          proxyCheckWorker: resolve('src/main/core/workers/proxyCheckWorker.ts')
        }
      }
    }
  },
  preload: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    },
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    base: './',
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __IMAGE_SUPPORT_VERSION_TIME__: imageSupportVersionTime
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [vue(), vueJsx()],
    server: {
      host: true,
      open: false
    }
  }
})
