import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAppStore } from './stores/app'
import { useAuthStore } from './stores/auth'
import './styles/tokens.css'
import './styles/base.css'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)

// восстановление данных и таймера до первого рендера
useAppStore().init()
// восстановление выбранной роли
useAuthStore().restore()

app.use(router)
app.mount('#app')
