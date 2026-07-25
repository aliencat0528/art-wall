import { createApp, defineAsyncComponent } from 'vue'
import '@/styles/main.css'
import App from './App.vue'

// `?lab=1` 進視覺原型實驗室（見 prototypes/PrototypeLab.vue）。
// 動態 import 讓原型自成一個 chunk，正式站首包不含這段程式碼；
// 方案定案後整包刪除，主站不留痕跡。
const root = new URLSearchParams(window.location.search).has('lab')
  ? defineAsyncComponent(() => import('@/prototypes/PrototypeLab.vue'))
  : App

createApp(root).mount('#app')
