import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { setupElementPlus } from './plugins/element-plus'
import { setupGlobalComponents } from './plugins/components'
import { initErrorCapture } from './utils/logger'
import i18n from './locales'
import './assets/main.scss'

const app = createApp(App)

// 初始化错误日志捕获
initErrorCapture(app)

setupElementPlus(app)
setupGlobalComponents(app)
app.use(router)
app.use(i18n)

app.mount('#app')
