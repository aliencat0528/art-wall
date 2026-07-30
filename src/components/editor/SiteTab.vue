<script setup lang="ts">
import { inject } from 'vue'
import { useLibrary } from '@/composables/useLibrary'
import { useSettings } from '@/composables/useSettings'
import { EDITOR_STATUS } from '@/components/editor/status'

/** 站台分頁：站台資訊、資料匯出匯入與還原（整體背景已於 MR-014 收成單一光氛，不再可切換） */

const { settings, update } = useSettings()
const { exportJson, importJson, restorePresets } = useLibrary()
const { say, runBusy } = inject(EDITOR_STATUS)!

async function onExport() {
  const json = await exportJson()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `artwall-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
  say('已下載 JSON')
}

async function onImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  await runBusy(async () => {
    await importJson(await file.text())
    say('已匯入')
  })
  input.value = ''
}
</script>

<template>
  <div>
    <section class="block">
      <h3 class="block__title">
        站台資訊
      </h3>
      <label class="field">
        <span class="field__label">分頁標題</span>
        <input
          :value="settings.siteTitle"
          type="text"
          class="field__input"
          @input="update({ siteTitle: ($event.target as HTMLInputElement).value })"
        >
      </label>
      <label class="field">
        <span class="field__label">姓名／站名</span>
        <input
          :value="settings.name"
          type="text"
          class="field__input"
          @input="update({ name: ($event.target as HTMLInputElement).value })"
        >
      </label>
      <label class="field">
        <span class="field__label">簡介</span>
        <textarea
          :value="settings.statement"
          class="field__input field__input--area"
          rows="3"
          @input="update({ statement: ($event.target as HTMLTextAreaElement).value })"
        />
      </label>
      <label class="field">
        <span class="field__label">聯絡信箱</span>
        <input
          :value="settings.email"
          type="email"
          class="field__input"
          @input="update({ email: ($event.target as HTMLInputElement).value })"
        >
      </label>
    </section>

    <section class="block">
      <h3 class="block__title">
        資料
      </h3>
      <p class="block__note">
        編輯只存在這台瀏覽器（localStorage 與 IndexedDB）。訪客看到的仍是專案內建資料——
        要讓改動成為正式版本，請匯出 JSON 交給開發流程。
      </p>
      <div class="block__actions">
        <button
          type="button"
          class="button"
          @click="onExport"
        >
          匯出 JSON
        </button>
        <label class="button">
          匯入 JSON
          <input
            type="file"
            accept="application/json"
            class="visually-hidden"
            @change="onImport"
          >
        </label>
        <button
          type="button"
          class="button"
          @click="restorePresets(); say('已還原內建作品')"
        >
          還原內建作品
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.block + .block {
  margin-top: 1.6rem;
  padding-top: 1.2rem;
  border-top: 1px solid var(--line);
}

.block__title {
  margin-bottom: 0.7rem;
  font-family: var(--font-mono);
  font-size: 0.66rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--accent);
}

.block__note {
  margin-bottom: 0.8rem;
  font-size: 0.72rem;
  line-height: 1.7;
  color: var(--ink-faint);
}

.block__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-bottom: 0.8rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-bottom: 0.7rem;
}

.field__label {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  color: var(--ink-faint);
}

.field__input {
  width: 100%;
  padding: 0.45rem 0.55rem;
  font: inherit;
  font-size: 0.82rem;
  color: var(--ink);
  background: var(--bg);
  border: 1px solid var(--line-strong);
  border-radius: var(--card-radius);
}

.field__input:focus-visible {
  border-color: var(--accent);
  outline: none;
}

.field__input--area {
  resize: vertical;
  line-height: 1.7;
}

.button {
  display: inline-block;
  padding: 0.45rem 0.85rem;
  font-size: 0.78rem;
  color: var(--ink-soft);
  background: transparent;
  border: 1px solid var(--line-strong);
  border-radius: var(--card-radius);
  cursor: pointer;
  transition: color 200ms var(--ease), border-color 200ms var(--ease);
}

.button:hover,
.button:focus-within {
  color: var(--accent);
  border-color: var(--accent);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
