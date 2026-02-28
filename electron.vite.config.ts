import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import pkg from './package.json'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { execSync } from 'child_process'

const getBuildInfo = () => {
  try {
    const commitCount = execSync('git rev-list --count HEAD').toString().trim()
    const commitHash = execSync('git rev-parse --short HEAD').toString().trim()
    return {
      versionCode: Number(commitCount),
      versionHash: commitHash
    }
  } catch (e) {
    return {
      versionCode: 0,
      versionHash: ''
    }
  }
}

const { versionCode, versionHash } = getBuildInfo()

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
      __APP_VERSION_CODE__: JSON.stringify(versionCode || 0),
      __APP_VERSION_HASH__: JSON.stringify(versionHash || ''),
      __IMAGE_SUPPORT_VERSION_TIME__: imageSupportVersionTime
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    assetsInclude: ['**/*.glb', '**/*.gltf'],
    plugins: [vue(), vueJsx()],
    server: {
      host: true,
      open: false
    }
  }
})
