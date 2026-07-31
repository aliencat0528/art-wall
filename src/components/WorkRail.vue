<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Work } from '@/types'
import WorkCard from '@/components/WorkCard.vue'
import { useIsWide, usePrefersReducedMotion } from '@/composables/useMediaQuery'
import { lerp, misregFor } from '@/utils/motion'

/**
 * 作品牆本體。
 *
 * 寬螢幕＝水平長廊：固定軌道高度、卡片以 aspect-ratio 決定寬度、上中下交叉懸掛。
 * 因為軌道高度固定且每張卡片都 ≤ 軌道高，交叉排列不可能把版面推爆。
 * 窄螢幕＝垂直網格：手機上水平捲動會和頁面捲動打架，直接降級。
 *
 * 長廊景深（MR-014）：每張卡片依「距軌道中心的距離」拿到一個 `--focus`（0～1），
 * 中心＝1、邊緣＝0。牆面偏轉、退遠、變暗全部由這一個值驅動——
 * 走到誰面前誰就轉正、亮起來，這是「在長廊裡走動」與「看一排縮圖」的差別。
 */

const props = defineProps<{ works: Work[]; viewKey: string }>()
const emit = defineEmits<{ open: [id: string] }>()

const isWide = useIsWide()
const reducedMotion = usePrefersReducedMotion()
const rail = ref<HTMLElement | null>(null)
const progress = ref(0)
/** 目前站在誰面前（`--focus` 最大的那件），給計數器與鍵盤逐件瀏覽用 */
const focusIndex = ref(0)
let frame = 0

/** 切換分類或展覽時換掉 key，讓卡片重新播放漸入並把長廊捲回起點 */
const listKey = computed(() => props.viewKey)

/**
 * 量一次：進度條 + 每張卡片的 `--focus`。
 * 兩件事都要讀 layout，合併成同一次以免捲動時來回觸發 reflow。
 */
function measure(): void {
  const el = rail.value
  if (!el) return
  const max = el.scrollWidth - el.clientWidth
  progress.value = max > 0 ? el.scrollLeft / max : 0

  // 網格模式沒有「中心」可言，`--focus` 也沒有樣式在吃，直接跳過
  if (!isWide.value) return
  const box = el.getBoundingClientRect()
  const centre = box.left + box.width / 2
  const span = box.width / 2 || 1
  let best = 0
  let bestFocus = -1
  const items = Array.from(el.children) as HTMLElement[]
  items.forEach((item, index) => {
    const rect = item.getBoundingClientRect()
    const offset = Math.abs(rect.left + rect.width / 2 - centre) / span
    const focus = 1 - Math.min(offset, 1)
    item.style.setProperty('--focus', focus.toFixed(3))
    if (focus > bestFocus) {
      bestFocus = focus
      best = index
    }
  })
  focusIndex.value = best
}

/** 把第 n 件捲到正前方。逐件瀏覽與鍵盤操作都走這裡，行為才一致 */
function centreOn(index: number): void {
  const el = rail.value
  if (!el) return
  const items = Array.from(el.children) as HTMLElement[]
  const target = items[Math.max(0, Math.min(index, items.length - 1))]
  if (!target) return
  const left = target.offsetLeft + target.offsetWidth / 2 - el.clientWidth / 2
  el.scrollTo({ left, behavior: 'smooth' })
}

/**
 * 鍵盤逐件瀏覽。
 *
 * 不沿用瀏覽器對捲動容器的原生方向鍵行為：原生是「捲固定像素」，
 * 在長廊裡會停在兩件作品中間，等於永遠沒有站在任何一件的正前方。
 */
function onKeydown(event: KeyboardEvent): void {
  if (!isWide.value) return
  const total = props.works.length
  if (total === 0) return

  switch (event.key) {
    case 'ArrowRight':
      centreOn(focusIndex.value + 1)
      break
    case 'ArrowLeft':
      centreOn(focusIndex.value - 1)
      break
    case 'Home':
      centreOn(0)
      break
    case 'End':
      centreOn(total - 1)
      break
    default:
      return
  }
  event.preventDefault()
}

/** rAF 節流：捲動事件每秒可上百次，實際只需每一帧量一次 */
function schedule(): void {
  if (frame) return
  frame = requestAnimationFrame(() => {
    frame = 0
    measure()
  })
}

/**
 * 直向滾輪映射為水平捲動。
 * 只在長廊模式、且使用者確實是直向滾動時接管；橫向滾輪／觸控板手勢交還原生行為。
 */
function onWheel(event: WheelEvent) {
  const el = rail.value
  if (!el || !isWide.value) return
  if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
  const max = el.scrollWidth - el.clientWidth
  if (max <= 0) return
  event.preventDefault()
  el.scrollLeft += event.deltaY
}

/**
 * 按住拖曳長廊——在展場裡「走過去」最直覺的操作，也是桌機水平捲動最缺的一塊
 * （沒有橫向滾輪的滑鼠只能靠上面那層滾輪映射）。
 *
 * 只接管滑鼠：觸控與觸控板的原生慣性捲動比任何手寫實作都順，接管只會變差。
 */
const DRAG_THRESHOLD = 6
let dragFrom = 0
let dragScroll = 0
let dragging = false
let moved = false

/**
 * 拖曳速度 → 套色錯位（MR-016）。拖得越快，卡片上那兩塊疊印光版分得越開，
 * 放手才收回去——Risograph 走紙越快套色偏得越多，這裡借的是同一件事。
 *
 * 值寫在軌道上讓卡片繼承（`--misreg`），理由同 `--focus`：吃這個值的是每一張
 * 卡片的兩個偽層，用 props 串下去等於為了一個數字改穿三層元件。
 */
let lastMoveAt = 0
let lastMoveX = 0
let misreg = 1
let decayFrame = 0

function writeMisreg(value: number): void {
  misreg = value
  rail.value?.style.setProperty('--misreg', value.toFixed(2))
}

/** 停住不動時速度必須自己掉回來——沒有事件會來通知「手停了」 */
function decay(): void {
  if (!dragging) return
  const next = lerp(misreg, 1, 0.12)
  // 收尾直接歸位：lerp 只會無限逼近，而 toFixed(2) 會讓它卡在 1.01 永遠不動
  writeMisreg(next - 1 < 0.02 ? 1 : next)
  decayFrame = requestAnimationFrame(decay)
}

function onPointerDown(event: PointerEvent): void {
  const el = rail.value
  if (!el || !isWide.value || event.pointerType !== 'mouse' || event.button !== 0) return
  dragging = true
  moved = false
  dragFrom = event.clientX
  dragScroll = el.scrollLeft
  lastMoveAt = event.timeStamp
  lastMoveX = event.clientX
  if (!reducedMotion.value) {
    el.classList.add('wall__track--dragging')
    decayFrame = requestAnimationFrame(decay)
  }
  // 拖到長廊外（甚至視窗外）也要收得到，故監聽掛在 window 上。
  //
  // **不要改用 `setPointerCapture`**：指標捕獲會把後續的 `click` 一起改派給
  // 捕獲元素（這條軌道），卡片內層的 click 永遠收不到，作品就再也點不開了。
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('pointerup', onPointerUp)
}

function onPointerMove(event: PointerEvent): void {
  const el = rail.value
  if (!dragging || !el) return
  const dx = event.clientX - dragFrom
  // 過門檻前不動：手抖幾個 px 不該讓整條長廊跟著漂
  if (!moved && Math.abs(dx) < DRAG_THRESHOLD) return
  moved = true
  el.scrollLeft = dragScroll - dx

  if (reducedMotion.value) return
  const elapsed = event.timeStamp - lastMoveAt
  // 同一帧內的第二個事件會讓 elapsed 為 0，除下去是 Infinity
  if (elapsed > 0) {
    const velocity = (event.clientX - lastMoveX) / elapsed
    writeMisreg(Math.max(misreg, misregFor(velocity)))
    lastMoveAt = event.timeStamp
    lastMoveX = event.clientX
  }
}

function onPointerUp(): void {
  dragging = false
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  if (decayFrame) {
    cancelAnimationFrame(decayFrame)
    decayFrame = 0
  }
  // 放手就收回：拿掉 dragging 類別讓 transition 回來，錯位自己彈回原位
  rail.value?.classList.remove('wall__track--dragging')
  writeMisreg(1)
}

/**
 * 拖完放手的那一下會補一個 click，會誤開作品詳情。
 * 在冒泡到卡片之前於捕獲階段吃掉它——`moved` 只可能由 pointerdown 重設，
 * 所以不會殘留到下一次真正的點擊。
 */
function onClickCapture(event: MouseEvent): void {
  if (!moved) return
  moved = false
  event.stopPropagation()
  event.preventDefault()
}

onMounted(() => {
  rail.value?.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('resize', schedule)
  measure()
})

onBeforeUnmount(() => {
  rail.value?.removeEventListener('wheel', onWheel)
  window.removeEventListener('resize', schedule)
  onPointerUp()
  if (frame) cancelAnimationFrame(frame)
})

watch([() => props.works, () => props.viewKey], async () => {
  rail.value?.scrollTo({ left: 0 })
  progress.value = 0
  // 換 key 會整批換掉 <li>，舊的 `--focus` 一起被丟掉，等新的掛上再量
  await nextTick()
  measure()
})
</script>

<template>
  <section
    class="wall"
    :class="isWide ? 'wall--rail' : 'wall--grid'"
    aria-label="作品牆"
  >
    <p
      v-if="works.length === 0"
      class="wall__empty"
    >
      這裡還沒有作品。
    </p>

    <ul
      v-else
      :key="listKey"
      ref="rail"
      class="wall__track"
      tabindex="0"
      aria-label="作品清單，可用方向鍵逐件瀏覽"
      @scroll="schedule"
      @keydown="onKeydown"
      @pointerdown="onPointerDown"
      @click.capture="onClickCapture"
    >
      <li
        v-for="(work, index) in works"
        :key="work.id"
        class="wall__item"
        :class="`is-${work.aspect}`"
        :style="{ '--i': Math.min(index, 12) }"
      >
        <WorkCard
          :work="work"
          @open="emit('open', $event)"
        />
      </li>
    </ul>

    <!-- 地面：長廊的光落在哪裡結束。給出地平線，作品才是「掛在牆上」而不是浮在空中 -->
    <span
      v-if="isWide && works.length > 0"
      class="wall__floor"
      aria-hidden="true"
    />

    <!-- 水平捲動會讓人失去「還有多少」的感覺，補一條進度指示與「現在站在第幾件前面」 -->
    <p
      v-if="isWide && works.length > 0"
      class="wall__counter"
      aria-hidden="true"
    >
      {{ String(focusIndex + 1).padStart(2, '0') }} / {{ String(works.length).padStart(2, '0') }}
    </p>

    <div
      v-if="isWide && works.length > 0"
      class="wall__progress"
      aria-hidden="true"
    >
      <span
        class="wall__progress-bar"
        :style="{ transform: `scaleX(${progress || 0.02})` }"
      />
    </div>
  </section>
</template>

<style scoped>
.wall {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.wall__empty {
  padding: 4rem var(--page-x);
  font-size: 0.9rem;
  color: var(--ink-faint);
}

.wall__track {
  list-style: none;
}

.wall__track:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -4px;
}

.wall__item {
  animation: rise-in 620ms var(--ease) both;
  animation-delay: calc(var(--i) * 55ms);
}

@keyframes rise-in {
  from {
    opacity: 0;
    transform: translateY(1.4rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ---- 長廊模式（≥900px）---- */
.wall--rail .wall__track {
  display: flex;
  align-items: stretch;
  gap: var(--wall-gap);
  height: var(--rail-h);
  /* 景深的舞台。1500px 是實測值：再短會把邊緣的卡片扭成魚眼，
     再長就等於沒有透視。origin 抬到 42% 而非正中，視線高度才像站著看展 */
  perspective: 1500px;
  perspective-origin: 50% 42%;
  /* 下方留 3.5rem：卡片說明文字絕對定位在圖片下緣，靠底懸掛的卡片要有地方放 */
  padding: 2.5rem var(--page-x) 4rem;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x proximity;
  overscroll-behavior-x: contain;
  /* 藏掉原生水平捲軸——它會橫過畫面中段壓住作品說明。
     方位感改由下方的進度指示提供，滾輪／方向鍵／拖曳皆照常 */
  scrollbar-width: none;
  /* 可拖曳的表面就要長得像可以抓。拖曳中的 grabbing 由 :active 給 */
  cursor: grab;
  /* 拖曳時不要順手把作品說明選成藍色一片 */
  user-select: none;
}

.wall--rail .wall__track:active {
  cursor: grabbing;
}

/* 長廊往兩端沉進暗處：走道要有「還沒走到」的盡頭，
   而不是被視窗邊界一刀切斷。這比再加一層透視線更省、也更像展場 */
.wall--rail .wall__track {
  mask-image: linear-gradient(to right, transparent, #000 7%, #000 93%, transparent);
}

.wall--rail .wall__track::-webkit-scrollbar {
  display: none;
}

.wall--rail .wall__item {
  flex: 0 0 auto;
  height: 84%;
  scroll-snap-align: center;
  transform-style: preserve-3d;
}

/* 牆面偏轉：三張一循環，左牆／正牆／右牆。
   偏轉量乘上 `1 - --focus`，所以走到正前方時自動轉正——
   轉正這件事不需要 hover，捲動本身就是「走過去」 */
/* `--light` 一起換：整排的聚光角度略有差異，燈才像一盞一盞打的，不是影印出來的 */
.wall--rail .wall__item:nth-child(3n + 1) {
  --yaw: 7deg;
  --depth: -30px;
  --light: 156deg;
}

.wall--rail .wall__item:nth-child(3n + 2) {
  --yaw: 0deg;
  --depth: 10px;
  --light: 172deg;
}

.wall--rail .wall__item:nth-child(3n) {
  --yaw: -7deg;
  --depth: -30px;
  --light: 188deg;
}

/* 各版位的高度差，讓長廊有起伏而非一條齊平的帶子 */
.wall--rail .wall__item.is-portrait {
  height: 100%;
}

.wall--rail .wall__item.is-landscape {
  height: 78%;
}

.wall--rail .wall__item.is-video {
  height: 74%;
}

/* 交叉懸掛：上／中／下輪替。卡片高度皆 ≤ 軌道高，故不會溢出 */
.wall--rail .wall__item:nth-child(3n + 1) {
  align-self: flex-start;
}

.wall--rail .wall__item:nth-child(3n + 2) {
  align-self: center;
}

.wall--rail .wall__item:nth-child(3n) {
  align-self: flex-end;
}

/* 長廊模式的尺寸來源：軌道高 → 卡片高 → 圖框高 → 由 aspect-ratio 反推圖框寬。
   卡片寬度因此完全由圖框決定，說明文字絕對定位、不參與寬度計算，
   標題再長也不會把卡片撐寬。 */
.wall--rail :deep(.card) {
  align-items: flex-start;
  height: 100%;
}

.wall--rail :deep(.card__mount) {
  width: auto;
  height: 100%;
  /* 偏轉與退遠都吃 `--focus`（由 measure() 每帧寫在 <li> 上，自動繼承到這裡）。
     刻意不給 transform 轉場：值本來就跟著捲動連續變化，再加轉場只會讓牆面拖在後面 */
  transform: rotateY(calc(var(--yaw, 0deg) * (1 - var(--focus, 1))))
    translateZ(calc(var(--depth, 0px) + var(--focus, 1) * 36px));
  /* 遠處的作品退進空氣裡。門檻留在 0.74——再低就從「有距離」變成「髒掉」，
     實測 0.58 會讓兩側的作品看起來像蒙了一層灰，不是離得比較遠 */
  opacity: calc(0.74 + var(--focus, 1) * 0.26);
  /* 180ms：短到跟得上捲動（值本來就每帧在變），長到 hover 轉正不會硬切 */
  transition: transform 180ms var(--ease), opacity 180ms var(--ease),
    box-shadow 520ms var(--ease);
  will-change: transform;
}

/* hover＝走到作品正前方：轉正、往前一步，光也跟著更亮（光暈在 WorkCard） */
.wall--rail .wall__item:hover :deep(.card__mount) {
  transform: rotateY(0deg)
    translateZ(calc(var(--depth, 0px) + var(--focus, 1) * 36px + 46px));
  opacity: 1;
}

.wall--rail :deep(.card__frame) {
  width: auto;
  height: 100%;
}

.wall--rail :deep(.card__meta) {
  position: absolute;
  /* 1.4rem 是讓給光池的位置：光池貼著圖框下緣散開，標示要在它之後才讀得清楚 */
  top: calc(100% + 1.4rem);
  left: 0;
  /* 只有正對觀者的那件作品標示得清楚，其餘退成背景資訊 */
  opacity: calc(0.35 + var(--focus, 1) * 0.65);
}

/* 光池與聚光都跟著 `--focus` 走——燈打在你正在看的那件上。
   這是長廊最關鍵的一條：光跟著人走，而不是每件作品各自亮著 */
.wall--rail :deep(.card__pool) {
  display: block;
  opacity: calc(0.32 + var(--focus, 1) * 0.53);
}

/* 拖曳中把疊印框的過渡關掉：`--misreg` 每帧都在變，留著 320ms 過渡等於
   永遠追不上手，錯位會慢半拍。放手時類別移除、過渡回來，自然變成彈回 */
.wall__track--dragging :deep(.card__reg) {
  transition: none;
}

.wall--rail :deep(.card__spot) {
  opacity: calc(0.55 + var(--focus, 1) * 0.45);
}


/* 地面：一條被光帶到的地平線 + 往上散開的光。
   z-index -1 讓它待在卡片之後——卡片是 position: relative，永遠畫在負層之上 */
.wall--rail .wall__floor {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: -1;
  display: block;
  height: 9rem;
  background:
    linear-gradient(to top, color-mix(in srgb, var(--accent) 16%, transparent), transparent 72%),
    linear-gradient(to top, rgb(236 233 242 / 0.05), transparent 44%);
  border-top: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
  pointer-events: none;
}

.wall__counter {
  position: absolute;
  right: var(--page-x);
  bottom: 0.9rem;
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  color: var(--accent);
  text-shadow: 0 0 16px color-mix(in srgb, var(--accent) 60%, transparent);
}


.wall__progress {
  position: absolute;
  right: var(--page-x);
  bottom: 0.3rem;
  left: var(--page-x);
  height: 1px;
  background: var(--line);
}

.wall__progress-bar {
  display: block;
  height: 100%;
  background: var(--accent);
  /* 進度條也是一道光，不是一條印刷線 */
  box-shadow: 0 0 14px -2px var(--accent);
  transform-origin: left center;
  transition: transform 120ms linear;
}


/* ---- 網格模式（<900px）---- */
/* 平板（600–899px）三欄：兩欄在這個寬度會讓單張圖大到要捲動才看得完 */
.wall--grid .wall__track {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--wall-gap);
  padding: 1.5rem var(--page-x) 3rem;
}

@media (max-width: 599px) {
  .wall--grid .wall__track {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* 橫幅與影片佔滿兩欄，其餘各佔一欄——固定規則，不用 dense 重排，閱讀順序才不會亂 */
.wall--grid .wall__item.is-landscape,
.wall--grid .wall__item.is-video {
  grid-column: span 2;
}

@media (max-width: 460px) {
  .wall--grid .wall__track {
    grid-template-columns: minmax(0, 1fr);
  }

  .wall--grid .wall__item.is-landscape,
  .wall--grid .wall__item.is-video {
    grid-column: span 1;
  }
}
</style>
