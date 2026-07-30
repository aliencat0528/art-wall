import { createApp } from 'vue'
import '@/styles/main.css'
import App from './App.vue'

// 原型實驗室（`?lab=1`）已於 MR-014 定案後整包移除：選定方案 F 暗場光氛，
// 落地在 GalleryAtmosphere／WorkRail／WorkCard，主站不再留切換入口。
createApp(App).mount('#app')
