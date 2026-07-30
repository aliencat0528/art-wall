import { ref, watchEffect } from 'vue'
import type { SiteSettings } from '@/types'
import { PROFILE } from '@/data/works'

/** 站台設定：分頁標題與作者資訊。存 localStorage，改了就生效 */

const STORAGE_KEY = 'artwall.settings.v1'

const DEFAULTS: SiteSettings = {
  siteTitle: '作品牆 Art Wall',
  name: PROFILE.name,
  statement: PROFILE.statement,
  email: PROFILE.email,
}

/**
 * 只收目前認得的欄位。
 *
 * 舊版存過 `background`（整體背景四選一，MR-014 已移除）——直接 spread 會把那筆
 * 讀回記憶體再存回去，讓已經廢掉的欄位在 localStorage 裡永生。
 */
function load(): SiteSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const stored = JSON.parse(raw) as Partial<SiteSettings>
    const next = { ...DEFAULTS }
    for (const key of Object.keys(DEFAULTS) as (keyof SiteSettings)[]) {
      const value = stored[key]
      if (typeof value === 'string') next[key] = value
    }
    return next
  } catch {
    return { ...DEFAULTS }
  }
}

const settings = ref<SiteSettings>(load())

// 分頁標題跟著設定走
watchEffect(() => {
  document.title = settings.value.siteTitle || DEFAULTS.siteTitle
})

export function useSettings() {
  function update(patch: Partial<SiteSettings>): void {
    settings.value = { ...settings.value, ...patch }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value))
    } catch {
      // 存不了就只在這次瀏覽有效
    }
  }

  function reset(): void {
    settings.value = { ...DEFAULTS }
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // 同上
    }
  }

  return { settings, update, reset }
}
