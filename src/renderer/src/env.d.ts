/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// 3D 模型文件类型声明
declare module '*.glb?url' {
  const src: string
  export default src
}

declare module '*.gltf?url' {
  const src: string
  export default src
}

declare module '*.glb' {
  const src: string
  export default src
}

declare module '*.gltf' {
  const src: string
  export default src
}

declare const __APP_VERSION__: string
declare const __APP_VERSION_CODE__: number
declare const __APP_VERSION_HASH__: string
declare const __IMAGE_SUPPORT_VERSION_TIME__: string
declare const __GA_MEASUREMENT_ID__: string
