<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import EditorPanel from '@/components/EditorPanel.vue'
import GalleryAtmosphere from '@/components/GalleryAtmosphere.vue'
import IntroSequence from '@/components/IntroSequence.vue'
import SiteHeader from '@/components/SiteHeader.vue'
import WorkDetail from '@/components/WorkDetail.vue'
import WorkRail from '@/components/WorkRail.vue'
import { useAppearance } from '@/composables/useAppearance'
import { useGallery } from '@/composables/useGallery'
import { useLibrary } from '@/composables/useLibrary'
import { usePrefersReducedMotion } from '@/composables/useMediaQuery'
import { usePointerParallax } from '@/composables/usePointerParallax'
import { useSettings } from '@/composables/useSettings'

const {
  categories,
  exhibitions,
  viewMode,
  activeCategory,
  activeExhibitionId,
  activeExhibition,
  filteredWorks,
  selectedWork,
  railKey,
  setCategory,
  setMode,
  setExhibition,
  openWork,
  closeWork,
  stepWork,
  syncFromUrl,
} = useGallery()

const { settings } = useSettings()
const { init } = useLibrary()

useAppearance(activeCategory)
usePointerParallax()

const reducedMotion = usePrefersReducedMotion()
const editorOpen = ref(false)

const params = new URLSearchParams(window.location.search)

// 開場每次進站都播（不再記「已看過」旗標）。兩個例外：系統要求減少動態，
// 以及帶著作品深連結進站（`?w=`）——那是要直接看某一件，開場只會擋路。
// `?intro=0` 明確關掉，供 E2E 與現場展示使用。
const showIntro = ref(
  !reducedMotion.value && params.get('intro') !== '0' && !params.has('w'),
)

function finishIntro(): void {
  showIntro.value = false
}

onMounted(() => {
  syncFromUrl()
  init()
  window.addEventListener('popstate', syncFromUrl)
})

onBeforeUnmount(() => {
  window.removeEventListener('popstate', syncFromUrl)
})
</script>

<template>
  <div class="app">
    <GalleryAtmosphere :view-key="railKey" />

    <SiteHeader
      :categories="categories"
      :active="activeCategory"
      :count="filteredWorks.length"
      :name="settings.name"
      :statement="settings.statement"
      :view-mode="viewMode"
      :exhibitions="exhibitions"
      :active-exhibition-id="activeExhibitionId"
      @select="setCategory"
      @select-mode="setMode"
      @select-exhibition="setExhibition"
    />

    <main class="app__main">
      <p
        v-if="viewMode === 'exhibition' && activeExhibition?.preface"
        class="app__preface"
      >
        {{ activeExhibition.preface }}
      </p>
      <WorkRail
        :works="filteredWorks"
        :view-key="railKey"
        @open="openWork"
      />
    </main>

    <footer class="app__footer">
      <p class="app__hint">
        拖曳或滾動走過長廊 · 方向鍵逐件停留 · 點擊作品看細節
      </p>
      <div class="app__footer-right">
        <button
          type="button"
          class="app__edit"
          @click="editorOpen = true"
        >
          編輯內容
        </button>
        <a
          class="app__contact"
          :href="`mailto:${settings.email}`"
        >{{ settings.email }}</a>
      </div>
    </footer>

    <WorkDetail
      v-if="selectedWork"
      :work="selectedWork"
      @close="closeWork"
      @step="stepWork"
    />

    <EditorPanel
      v-if="editorOpen"
      @close="editorOpen = false"
    />

    <IntroSequence
      v-if="showIntro"
      @done="finishIntro"
    />
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app__main {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  min-height: 0;
}

/* 展覽前言：策展動線的開場白，置於長廊之上 */
.app__preface {
  max-width: 60ch;
  margin: 0 auto;
  padding: 0 var(--page-x);
  font-size: 0.9rem;
  line-height: 1.8;
  color: var(--ink-soft);
  text-align: center;
}

.app__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1.5rem;
  padding: 1rem var(--page-x) 1.5rem;
  /* 頁尾也用強調色收邊，讓分類的存在感貫穿整頁 */
  border-top: 2px solid var(--accent);
}

.app__footer-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.app__hint,
.app__contact,
.app__edit {
  font-family: var(--font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.08em;
  color: var(--ink-faint);
}

.app__edit {
  padding: 0.3rem 0.6rem;
  background: transparent;
  border: 1px solid var(--line-strong);
  border-radius: var(--card-radius);
  cursor: pointer;
  transition: color 200ms var(--ease), border-color 200ms var(--ease);
}

.app__contact {
  color: var(--ink-soft);
  text-decoration: none;
  border-bottom: 1px solid var(--accent);
  transition: color 200ms var(--ease);
}

.app__edit:hover,
.app__edit:focus-visible,
.app__contact:hover,
.app__contact:focus-visible {
  color: var(--accent);
  border-color: var(--accent);
}

@media (max-width: 899px) {
  .app__hint {
    display: none;
  }
}
</style>
