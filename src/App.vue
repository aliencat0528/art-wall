<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import EditorPanel from '@/components/EditorPanel.vue'
import GalleryAtmosphere from '@/components/GalleryAtmosphere.vue'
import GalleryHall from '@/components/GalleryHall.vue'
import IntroSequence from '@/components/IntroSequence.vue'
import SiteHeader from '@/components/SiteHeader.vue'
import WorkDetail from '@/components/WorkDetail.vue'
import WorkRail from '@/components/WorkRail.vue'
import { useAppearance } from '@/composables/useAppearance'
import { useGallery } from '@/composables/useGallery'
import { useLibrary } from '@/composables/useLibrary'
import { usePrefersReducedMotion } from '@/composables/useMediaQuery'
import { usePointerParallax } from '@/composables/usePointerParallax'
import { usePointerAfterimage } from '@/composables/usePointerAfterimage'
import { useSettings } from '@/composables/useSettings'

const {
  categories,
  exhibitions,
  viewMode,
  layout,
  activeCategory,
  activeExhibitionId,
  activeExhibition,
  filteredWorks,
  selectedWork,
  railKey,
  setCategory,
  setMode,
  setLayout,
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
usePointerAfterimage()

const reducedMotion = usePrefersReducedMotion()
const editorOpen = ref(false)

/**
 * 走廊模式是否可用（MR-017）。
 *
 * **手機採「接受降級」而非「退回網格」**（待討論 #5，用戶拍板）：同一套程式碼跑到底，
 * 窄螢幕只把走廊收窄、作品放大，一次看一件。代價是體驗明顯較差（見知識檔限制 2），
 * 換到的是不必維護第二套窄螢幕版面與第二組 E2E。
 *
 * 唯一的排除條件是**減少動態**（限制 5）：走廊的價值全在位移補間，
 * 開了減少動態就該直接不提供，而不是給一個瞬移版本。
 */
const canHall = computed(() => !reducedMotion.value)

/** 條件消失時（縮窗、系統改設定）自動退回牆面，不留在一個已經不該存在的模式裡 */
const showHall = computed(() => layout.value === 'hall' && canHall.value)

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
  <div
    class="app"
    :class="{ 'app--hall': showHall }"
  >
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
      :layout="layout"
      :can-hall="canHall"
      @select="setCategory"
      @select-mode="setMode"
      @select-layout="setLayout"
      @select-exhibition="setExhibition"
    />

    <main class="app__main">
      <p
        v-if="viewMode === 'exhibition' && activeExhibition?.preface"
        class="app__preface"
      >
        {{ activeExhibition.preface }}
      </p>
      <GalleryHall
        v-if="showHall"
        :works="filteredWorks"
        :view-key="railKey"
        @open="openWork"
      />
      <WorkRail
        v-else
        :works="filteredWorks"
        :view-key="railKey"
        @open="openWork"
      />
    </main>

    <footer class="app__footer">
      <p class="app__hint">
        {{
          showHall
            ? '方向鍵、橫向滑動或下方按鈕往前走 · 點擊作品看細節'
            : '拖曳或滾動走過長廊 · 方向鍵逐件停留 · 點擊作品看細節'
        }}
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

    <!--
      只接離場。進場是 `WorkDetail` 自己的 `fade-in`／`panel-in`（本來就有），
      離場沒人管——`v-if` 一解除就整塊消失，關掉詳情像斷電。
      這裡不定義 enter 類別，進場那半仍由元件自己負責，兩邊不會疊在一起跑。
    -->
    <Transition name="detail">
      <WorkDetail
        v-if="selectedWork"
        :work="selectedWork"
        @close="closeWork"
        @step="stepWork"
      />
    </Transition>

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
/**
 * ⚠️ **`dvh` 是 WALK ON 在手機上按不到的解**（同一個病也發生在開場的跳過鈕）。
 *
 * iOS Safari 的 `100vh` ＝ **large viewport**（工具列收起後的高度），
 * 不是當下看得到的高度。iPhone 12 實測：版面被排成 790 高，可見區只有 664。
 * 走廊模式沒有可捲的內容，整頁就是一屏——於是站在版面底部的走廊 HUD
 * （⇤ START／← BACK／WALK ON →）落在 668～721，**整條在可見區外**，
 * 被 Safari 工具列蓋掉。使用者按下去等於按在瀏覽器上，讀起來就是「按鈕失效」。
 *
 * `100dvh` 取當下實際可見的高度，HUD 就回到畫面內。上面那行 `100vh` 是舊瀏覽器的
 * 退路，順序不能顛倒（後宣告的才會覆蓋）。
 * `main.css` 的 `#app` 與 `--rail-h`、`IntroSequence` 的 `.intro` 是同一組，
 * 改一處就要一起改，不然只有部分版面跟著縮。
 */
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
}

/**
 * 走廊模式讓開站頭與頁尾的兩條 accent 橫線。
 *
 * 那兩條線是 MR-008 的「強調色貫穿站頭底線與頁尾」，在牆面模式下是對的；
 * 但走廊是一個往上下延伸的空間，兩條滿版橫線加上走廊自己的邊界，
 * 會把它框成畫面中間的一個長方形盒子。這裡只在走廊模式下把它們化掉，
 * 牆面模式完全不受影響。
 */
.app--hall :deep(.header) {
  border-bottom-color: transparent;
}

/* 頁尾那條 accent 線**保留**：使用者要的是「中間不要有框」，
   不是「整頁沒有邊」——最下方那條線是站台的收邊，走廊延伸到它為止 */

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

/**
 * 詳情頁離場：背景與面板一起退，面板往下沉一點——與進場的 `panel-in`（往上升）
 * 互為反向，開與關讀起來是同一個動作的來回。
 *
 * 240ms 比進場的 320ms 短：關閉是使用者已經決定好的事，慢慢演只會擋路。
 */
.detail-leave-active {
  transition: opacity 240ms var(--ease);
}

.detail-leave-active :deep(.detail__panel) {
  transition: transform 240ms var(--ease);
}

.detail-leave-to {
  opacity: 0;
}

.detail-leave-to :deep(.detail__panel) {
  transform: translateY(1.2rem);
}
</style>
