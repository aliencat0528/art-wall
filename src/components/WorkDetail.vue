<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Work } from '@/types'
import { categoryOf } from '@/data/categories'
import { useLibrary } from '@/composables/useLibrary'
import { useImageZoom } from '@/composables/useImageZoom'

/**
 * 作品詳情。
 *
 * 這裡才載原圖（`work.src`），且圖仍受比例與 60vh 高度上限約束——
 * 牆上看不到全圖的問題在這一層解決，而不是把牆上的縮圖放大。
 * 要看筆觸則再往下一層：在這個框內放大與平移（MR-015，見 `useImageZoom`）。
 */

const props = defineProps<{ work: Work }>()
const emit = defineEmits<{ close: []; step: [delta: number] }>()

const panel = ref<HTMLElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
const viewport = ref<HTMLElement | null>(null)
const image = ref<HTMLImageElement | null>(null)

const {
  scale,
  offset,
  zoomable,
  zoomed,
  dragging,
  measure,
  reset: resetZoom,
  onWheel,
  onDoubleClick,
  onMouseDown,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
} = useImageZoom(viewport, image)

const imageStyle = computed(() => ({
  transform: `translate3d(${offset.value.x}px, ${offset.value.y}px, 0) scale(${scale.value})`,
}))

// 切到上／下一件就回到 fit：留著上一件的縮放位置，新作品會從某個角落開場
watch(() => props.work.id, resetZoom)

/**
 * 上／下一件的**方向**，只為了轉場：+1 往後、-1 往前、0＝剛開啟。
 *
 * 方向必須在這裡記，不能從 `work` 的變化反推——`stepWork` 是循環的
 * （最後一件的下一件是第一件），單看索引從大跳到小會把「往後繞一圈」讀成「往前」。
 *
 * 0 是刻意的第三態：剛開啟時沒有「從哪個方向來」，滑進來會跟面板自己的升起打架，
 * 這時只淡入。
 */
const stepDir = ref(0)

function step(delta: number): void {
  stepDir.value = delta
  emit('step', delta)
}

const { categories } = useLibrary()
const category = computed(() => categoryOf(props.work.category, categories.value))

function focusableItems(): HTMLElement[] {
  if (!panel.value) return []
  return Array.from(
    panel.value.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])'),
  ).filter((el) => !el.hasAttribute('disabled'))
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close')
    return
  }
  if (event.key === 'ArrowRight') {
    step(1)
    return
  }
  if (event.key === 'ArrowLeft') {
    step(-1)
    return
  }
  if (event.key !== 'Tab') return

  // 焦點鎖在面板內，避免 Tab 跑到底下的作品牆
  const items = focusableItems()
  if (items.length === 0) return
  const first = items[0]
  const last = items[items.length - 1]
  const current = document.activeElement as HTMLElement | null

  if (event.shiftKey && (current === first || !panel.value?.contains(current))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && current === last) {
    event.preventDefault()
    first.focus()
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', measure)
  document.body.style.overflow = 'hidden'
  closeButton.value?.focus()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', measure)
  document.body.style.overflow = ''
})
</script>

<template>
  <div
    class="detail"
    role="dialog"
    aria-modal="true"
    :aria-label="work.title"
  >
    <div
      class="detail__backdrop"
      @click="emit('close')"
    />

    <article
      ref="panel"
      class="detail__panel"
    >
      <header class="detail__bar">
        <span class="detail__code">{{ category.code }} / {{ work.year }}</span>
        <span class="detail__nav">
          <button
            type="button"
            class="icon-button"
            aria-label="上一件"
            @click="step(-1)"
          >
            ←
          </button>
          <button
            type="button"
            class="icon-button"
            aria-label="下一件"
            @click="step(1)"
          >
            →
          </button>
          <button
            ref="closeButton"
            type="button"
            class="icon-button icon-button--close"
            aria-label="關閉"
            @click="emit('close')"
          >
            ✕
          </button>
        </span>
      </header>

      <!--
        `key` 綁作品 id：換件時整塊重新掛載，進場動畫才會重播。
        用重新掛載而不是 `<Transition>` 交叉淡出——兩件作品同時存在時，
        圖片與文字的高度不同會把面板撐動，讀起來是跳動不是轉場。
      -->
      <div
        :key="work.id"
        class="detail__body"
        :class="{ 'is-next': stepDir > 0, 'is-prev': stepDir < 0 }"
      >
        <figure class="detail__figure">
          <div
            ref="viewport"
            class="detail__viewport"
            :class="{
              'detail__viewport--zoomable': zoomable,
              'detail__viewport--zoomed': zoomed,
              'detail__viewport--dragging': dragging,
            }"
            @wheel="onWheel"
            @dblclick="onDoubleClick"
            @mousedown="onMouseDown"
            @touchstart="onTouchStart"
            @touchmove="onTouchMove"
            @touchend="onTouchEnd"
            @touchcancel="onTouchEnd"
          >
            <img
              ref="image"
              class="detail__image"
              :src="work.src"
              :alt="work.alt"
              :width="work.width"
              :height="work.height"
              :style="imageStyle"
              draggable="false"
              decoding="async"
              @load="measure"
            >
          </div>
          <figcaption
            v-if="zoomable"
            class="detail__zoomhint"
          >
            {{ zoomed ? '拖曳移動 · 雙擊還原' : '雙擊或滾輪放大' }}
          </figcaption>
        </figure>

        <div class="detail__text">
          <h2 class="detail__title">
            {{ work.title }}
          </h2>

          <ul
            class="tags"
            aria-label="分類與媒材"
          >
            <li class="tag tag--category">
              {{ category.label }}
            </li>
            <li
              v-for="medium in work.media"
              :key="medium"
              class="tag"
            >
              {{ medium }}
            </li>
          </ul>

          <p class="detail__description">
            {{ work.description }}
          </p>

          <dl class="detail__facts">
            <dt>角色／貢獻</dt>
            <dd>{{ work.role }}</dd>
            <dt>年份</dt>
            <dd>{{ work.year }}</dd>
          </dl>

          <ul
            v-if="work.links.length > 0"
            class="detail__links"
          >
            <li
              v-for="link in work.links"
              :key="link.url"
            >
              <a
                :href="link.url"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ link.label }}
                <span aria-hidden="true">↗</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </article>
  </div>
</template>

<style scoped>
.detail {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: clamp(0.75rem, 3vw, 2rem);
}

.detail__backdrop {
  position: absolute;
  inset: 0;
  background: rgb(28 28 26 / 0.42);
  backdrop-filter: blur(3px);
  animation: fade-in 240ms ease both;
}

.detail__panel {
  position: relative;
  width: min(1080px, 100%);
  max-height: 100%;
  overflow-y: auto;
  background: var(--bg);
  border: 1px solid var(--line-strong);
  border-radius: var(--card-radius);
  animation: panel-in 320ms var(--ease) both;
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
}

@keyframes panel-in {
  from {
    opacity: 0;
    transform: translateY(1.2rem);
  }
}

.detail__bar {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.75rem;
  background: var(--bg);
  border-bottom: 1px solid var(--line);
}

.detail__code {
  font-family: var(--font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.12em;
  color: var(--ink-faint);
}

.detail__nav {
  display: flex;
  gap: 0.3rem;
}

.icon-button {
  width: 2rem;
  height: 2rem;
  font-size: 0.85rem;
  color: var(--ink-soft);
  background: transparent;
  border: 1px solid var(--line);
  cursor: pointer;
  transition: color 200ms var(--ease), border-color 200ms var(--ease);
}

.icon-button:hover,
.icon-button:focus-visible {
  color: var(--accent);
  border-color: var(--accent);
}

.detail__body {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  gap: clamp(1rem, 3vw, 2.25rem);
  padding: clamp(1rem, 3vw, 2rem);
  animation: body-in 340ms var(--ease) both;
}

/**
 * 換件轉場：新的那件從**它來的方向**滑進來——按「下一件」從右邊來，
 * 「上一件」從左邊來。方向對得上手勢，才讀得出是往清單的哪一頭走，
 * 不然兩顆鈕的回饋一模一樣，等於沒有方向感。
 *
 * `--dir` 預設 0＝剛開啟，只淡入不滑動（見 `stepDir` 的註解）。
 * 位移刻意只有 2.2rem：作品是主角，轉場要讓人感覺到換了一件，不是自己表演。
 */
.detail__body.is-next {
  --dir: 1;
}

.detail__body.is-prev {
  --dir: -1;
}

@keyframes body-in {
  from {
    opacity: 0;
    transform: translateX(calc(var(--dir, 0) * 2.2rem));
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.detail__figure {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

/* 放大後溢出的部分裁在這個框內。框＝作品的邊界，圖再大也不會蓋到旁邊的文字欄。
   inline-block 讓框貼著圖的實際尺寸收縮，維持「外框緊貼畫面」的原樣 */
.detail__viewport {
  position: relative;
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  line-height: 0;
  background: var(--surface);
  border: 1px solid var(--line);
  /* 未放大時單指要能捲動面板，放大後才由 JS 接管（見 useImageZoom） */
  touch-action: pan-y;
}

.detail__viewport--zoomable {
  cursor: zoom-in;
}

.detail__viewport--zoomed {
  cursor: grab;
  touch-action: none;
}

.detail__viewport--dragging {
  cursor: grabbing;
}

.detail__image {
  /* 中圖：保持圖片固有比例縮進盒內，高度上限 60vh —— 詳情頁也不放巨圖。
     這裡不套 aspect-ratio，否則會蓋掉真圖自己的比例把畫裁歪 */
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 60vh;
  object-fit: contain;
  transform-origin: center center;
  will-change: transform;
}

/* 拖曳中不加過渡，否則圖會一路追在指標後面慢半拍 */
.detail__viewport:not(.detail__viewport--dragging) .detail__image {
  transition: transform 220ms var(--ease);
}

.detail__zoomhint {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  color: var(--ink-faint);
}

.detail__title {
  font-size: clamp(1.2rem, 2.6vw, 1.7rem);
  font-weight: 600;
  letter-spacing: 0.04em;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.75rem;
  list-style: none;
}

.tag {
  padding: 0.2rem 0.5rem;
  font-family: var(--font-mono);
  font-size: 0.64rem;
  letter-spacing: 0.06em;
  color: var(--ink-soft);
  border: 1px solid var(--line-strong);
}

.tag--category {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border-color: var(--accent);
}

.detail__description {
  margin-top: 1.1rem;
  font-size: 0.9rem;
  line-height: 1.85;
  color: var(--ink-soft);
}

.detail__facts {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.4rem 1rem;
  margin-top: 1.4rem;
  padding-top: 1.1rem;
  border-top: 1px solid var(--line);
}

.detail__facts dt {
  font-family: var(--font-mono);
  font-size: 0.64rem;
  letter-spacing: 0.06em;
  color: var(--ink-faint);
}

.detail__facts dd {
  font-size: 0.85rem;
  color: var(--ink);
}

.detail__links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1.4rem;
  list-style: none;
}

.detail__links a {
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;
  padding: 0.45rem 0.8rem;
  font-size: 0.8rem;
  color: var(--ink);
  text-decoration: none;
  border: 1px solid var(--line-strong);
  transition: color 200ms var(--ease), border-color 200ms var(--ease);
}

.detail__links a:hover,
.detail__links a:focus-visible {
  color: var(--accent);
  border-color: var(--accent);
}

@media (max-width: 899px) {
  .detail {
    padding: 0;
  }

  .detail__panel {
    height: 100%;
    max-height: 100%;
    border: none;
    border-radius: 0;
  }

  .detail__body {
    grid-template-columns: minmax(0, 1fr);
  }

  .detail__image {
    max-height: 46vh;
  }
}
</style>
