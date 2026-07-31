<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Work } from '@/types'
import { categoryOf } from '@/data/categories'
import { useLibrary } from '@/composables/useLibrary'
import {
  HALL_HALF_WIDTH,
  HALL_SPACING,
  cameraZ,
  clampStep,
  isNear,
  isPassed,
  isVisible,
  slotFor,
} from '@/utils/hall'

/**
 * 走進展場：第一人稱走廊（MR-017，Phase G）。
 *
 * 暗場，不是參考圖的白盒明場——站台自 MR-014 起只有一套光，走廊也吃同一套。
 * 代價是牆面必須自帶光，否則中性牆在暗底會整片沉掉（同 MR-014 站頭的處理）。
 *
 * **這個元件是獨立的第三種瀏覽模式，不疊在 `WorkRail` 裡。**
 * 理由是 Safari 的 `preserve-3d` 一遇到祖先 `overflow` 就會把整個 3D 壓平，
 * 而長廊本體是 `overflow-x: auto`（知識檔限制 1）。
 *
 * 三條硬要求對應到的結構（用戶指定，見 MR-017）：
 *
 * 1. **不卡住**——相機位移走 CSS transition（合成層），不寫 rAF 迴圈；
 *    地板流動是 `transform` 動畫不是 `background-position`（後者每帧重繪，
 *    而地板是全場最大的一塊平面）。減少動態時整個模式不提供。
 * 2. **不跑版**——裁切用的 `overflow: hidden` 放在 `.hall`，而 `perspective`
 *    在它的子層 `.hall__viewport`。裁切元素落在 3D 脈絡之外，才不觸發上述壓平。
 *    窄螢幕不提供走廊（`useIsWide`），版面規則維持 `ARCHITECTURE.md` 那張表。
 * 3. **點得開**——所有裝飾層一律 `pointer-events: none`，只有 `.piece` 是按鈕；
 *    走動不用拖曳，因此**完全不碰 `setPointerCapture`**（MR-014 的教訓：
 *    指標捕獲會把後續 click 改派給容器，作品全部點不開）。
 */

const props = defineProps<{ works: Work[]; viewKey: string }>()
const emit = defineEmits<{ open: [id: string] }>()

const { categories } = useLibrary()

const step = ref(0)
const hall = ref<HTMLElement | null>(null)
/** 走動中：只用來把地板流速拉快一下，不影響任何位置計算 */
const walking = ref(false)
let walkTimer = 0

const total = computed(() => props.works.length)
const camera = computed(() => cameraZ(step.value))

/** 現在站在誰面前。清單縮短的那一帧可能還沒夾回來，故取值要能接受 undefined */
const current = computed<Work | undefined>(() => props.works[step.value])

/** 只渲染窗口內的作品——遠處那些一個像素都看不到，卻要進 3D 合成 */
const pieces = computed(() =>
  props.works
    .map((work, index) => ({
      work,
      index,
      slot: slotFor(index),
      passed: isPassed(index, step.value),
    }))
    .filter((item) => isVisible(item.index, step.value)),
)

function walk(delta: number): void {
  const next = clampStep(step.value + delta, total.value)
  if (next === step.value) return
  step.value = next
  walking.value = true
  window.clearTimeout(walkTimer)
  // 720ms 是相機的補間長度，多留一點才不會在還在走的時候就把流速收回去
  walkTimer = window.setTimeout(() => {
    walking.value = false
  }, 820)
}

/**
 * 近景換大圖：縮圖只有 800px（`THUMB_MAX_EDGE`），走廊裡最近那件會佔到
 * 半個畫面寬，800px 撐不住（限制 4）。`src` 即 1800px 那張（`VIEW_MAX_EDGE`）。
 * 遠處維持縮圖，否則一次要載十幾張 1800px。
 */
function sourceFor(work: Work, index: number): string {
  return isNear(index, step.value) ? work.src : work.thumb
}

const currentLabel = computed(() =>
  current.value ? categoryOf(current.value.category, categories.value).label : '',
)

function onKeydown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'ArrowRight':
      walk(1)
      break
    case 'ArrowLeft':
      walk(-1)
      break
    case 'Home':
      walk(-step.value)
      break
    case 'End':
      walk(total.value - 1 - step.value)
      break
    default:
      return
  }
  event.preventDefault()
}

/** 換分類或展覽時走回入口——留在第 12 件而清單只剩 3 件會直接走出牆外 */
watch(
  () => props.viewKey,
  () => {
    step.value = 0
  },
)

/** 清單縮短（刪作品、切篩選）時把相機夾回範圍內 */
watch(total, (next) => {
  step.value = clampStep(step.value, next)
})

onMounted(() => {
  // 進走廊就把焦點交給它，方向鍵才立刻能走（不必先點一下畫面）
  hall.value?.focus()
})

onBeforeUnmount(() => {
  window.clearTimeout(walkTimer)
})
</script>

<template>
  <section
    ref="hall"
    class="hall"
    :class="{ 'is-walking': walking }"
    tabindex="0"
    aria-label="走進展場"
    :style="{
      '--cam': `${camera}px`,
      '--half': `${HALL_HALF_WIDTH}px`,
      '--span': `${HALL_SPACING}px`,
    }"
    @keydown="onKeydown"
  >
    <p
      v-if="total === 0"
      class="hall__empty"
    >
      這個範圍還沒有作品
    </p>

    <div
      v-else
      class="hall__viewport"
    >
      <div class="hall__scene">
        <span
          class="hall__wall hall__wall--l"
          aria-hidden="true"
        />
        <span
          class="hall__wall hall__wall--r"
          aria-hidden="true"
        />

        <span
          class="hall__ceiling"
          aria-hidden="true"
        />

        <!-- 地板：流動層是獨立子層，動的是 transform 不是背景位置 -->
        <span
          class="hall__floor"
          aria-hidden="true"
        >
          <span class="hall__flow" />
        </span>

        <button
          v-for="item in pieces"
          :key="item.work.id"
          type="button"
          class="piece"
          :class="[`piece--${item.slot.side}`, { 'is-passed': item.passed }]"
          :style="{ '--depth': `${item.slot.depth}px` }"
          :data-index="item.index"
          :aria-label="`開啟作品：${item.work.title}`"
          @click="emit('open', item.work.id)"
        >
          <span class="piece__mat">
            <img
              class="piece__image"
              :src="sourceFor(item.work, item.index)"
              :alt="item.work.alt"
              decoding="async"
            >
          </span>
          <span class="piece__plate">{{ item.work.title }}</span>
        </button>
      </div>
    </div>

    <div
      v-if="total > 0"
      class="hall__hud"
    >
      <button
        type="button"
        class="hall__step"
        :disabled="step === 0"
        @click="walk(-1)"
      >
        ← BACK
      </button>
      <p class="hall__pos">
        {{ currentLabel }} · 第 {{ step + 1 }} / {{ total }} 件
      </p>
      <button
        type="button"
        class="hall__step"
        :disabled="step >= total - 1"
        @click="walk(1)"
      >
        WALK ON →
      </button>
    </div>
  </section>
</template>

<style scoped>
/**
 * 裁切層。**不要在這一層加 transform-style**——它是 3D 脈絡的外側，
 * `overflow` 才不會把裡面的 preserve-3d 壓平（限制 1）。
 *
 * 底色是實心的，**這一條同時解掉了第八條限制**：走廊不透光，
 * `body::after` 的顆粒與光氛層的疊印色場在這裡看不到，
 * 也就不存在「固定紋理當參考系、把場景移動讀成圖片縮放」的錯覺（MR-017）。
 * 實體展場的走廊本來就是封閉的，看得到外面的環境光才奇怪。
 */
.hall {
  position: relative;
  height: var(--rail-h);
  overflow: hidden;
  outline: none;
  background: #06060b;
}

.hall:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

/**
 * 3D 脈絡整條不吃指標，只有 `.piece` 收得到點擊。
 *
 * **這不是防禦性寫法，是實測踩到的**：viewport 是 `inset: 0` 的滿版元素，
 * 走動之後點作品會被它攔下（Playwright 直接報 `.hall__viewport intercepts
 * pointer events`），作品完全打不開——正是 MR-014 那個坑的另一種長相。
 * 裝飾層各自標 `pointer-events: none` 不夠，因為攔下點擊的是這兩層容器本身。
 */
.hall__viewport {
  position: absolute;
  inset: 0;
  pointer-events: none;
  perspective: 620px;
  /* 視點略高於畫面中線＝站著看的高度，與參考圖同 */
  perspective-origin: 50% 44%;
}

.hall__scene {
  position: absolute;
  inset: 0;
  pointer-events: none;
  transform-style: preserve-3d;
  /* 相機推進。transform 直接吃 --cam，走的是合成層，不觸發 layout */
  transform: translateZ(var(--cam));
  transition: transform 720ms var(--ease);
}

/**
 * ── 房間的六個面 ───────────────────────────────────────
 *
 * 垂直尺度是一組必須對齊的常數，改一個就要改全部，否則會出現縫：
 *   天花板 = `--ceil`（4%）／牆 = 從 `--ceil` 到 `--ground`／地板 = `--ground`（68%）
 *
 * 第一版把牆設成 `top: -60%; height: 220%`，結果牆底穿到地板以下，
 * 在地板外側露出一塊黑色梯形——牆與地板沒有共用同一條地平線就會這樣。
 *
 * 四個面都往**觀者方向多延伸 `--behind`**。少了這一段，房間的近端剛好落在
 * 相機所在平面，畫面四角會露出底下的光氛層——看起來像「站在盒子外面往裡看」
 * 而不是「站在走廊裡」。600px 仍會漏，實測要 1100px 才把四角補滿。
 */
.hall__viewport {
  --ceil: 4%;
  --ground: 68%;
  --behind: 1100px;
  --depth-span: 4200px;
}

/* 暗場裡中性牆會整片沉掉，所以牆自帶一道由近而遠衰減的光。
   這與 MR-014「站頭的線與字都要自帶光暈」是同一個問題 */
.hall__wall {
  position: absolute;
  top: var(--ceil);
  height: calc(var(--ground) - var(--ceil));
  width: var(--depth-span);
  pointer-events: none;
  background:
    linear-gradient(
      to right,
      color-mix(in srgb, var(--accent) 8%, transparent),
      transparent 46%
    ),
    linear-gradient(to bottom, #12121b, #0e0e16 52%, #08080e);
}

/* 轉 90 度後局部 +X＝往場景深處，故往觀者延伸是 translateX 負值 */
.hall__wall--l {
  left: calc(50% - var(--half));
  transform-origin: left center;
  transform: rotateY(90deg) translateX(calc(var(--behind) * -1));
}

.hall__wall--r {
  left: calc(50% + var(--half));
  transform-origin: left center;
  transform: rotateY(90deg) scaleX(-1) translateX(calc(var(--behind) * -1));
}

/* 天花板：參考圖有，第一版漏了，於是畫面上緣直接穿幫露出背景光氛 */
.hall__ceiling {
  position: absolute;
  left: 50%;
  top: var(--ceil);
  width: calc(var(--half) * 2);
  height: var(--depth-span);
  margin-left: calc(var(--half) * -1);
  pointer-events: none;
  transform-origin: top center;
  transform: rotateX(-90deg) translateY(calc(var(--behind) * -1));
  background: linear-gradient(to top, #0f0f18, #08080e 60%);
}

.hall__floor {
  position: absolute;
  left: 50%;
  top: var(--ground);
  width: calc(var(--half) * 2);
  height: var(--depth-span);
  margin-left: calc(var(--half) * -1);
  overflow: hidden;
  pointer-events: none;
  transform-origin: top center;
  transform: rotateX(90deg) translateY(calc(var(--behind) * -1));
  background:
    repeating-linear-gradient(
      to right,
      color-mix(in srgb, var(--accent) 10%, transparent) 0 1px,
      transparent 1px 150px
    ),
    #06060b;
}

/**
 * 光波：一道道沿深度推進的亮帶。
 *
 * 動的是 `transform: translateY`，不是 `background-position`——後者每帧重繪，
 * 而這塊平面是全場最大的一個元素（同 MR-016「色場用 scale 呼吸會逼模糊層
 * 每帧重新光柵化」的教訓）。
 *
 * 因為地板本身已經 `rotateX(90deg)`，往 +Y 走就是往場景深處流，
 * 透視自動給出「近處快、遠處慢」，不需要 JS 每帧算速度。
 */
.hall__flow {
  position: absolute;
  inset: -100% 0 0;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0 300px,
    color-mix(in srgb, var(--accent) 13%, transparent) 340px 366px,
    transparent 406px 640px
  );
  animation: hall-flow var(--flow-dur, 7s) linear infinite;
  will-change: transform;
}

@keyframes hall-flow {
  from {
    transform: translateY(0);
  }

  to {
    transform: translateY(640px);
  }
}

/* 走動時加速：常駐慢流是氛圍，加速才是「我在移動」的回饋。
   兩者同速的話，地板只會被讀成「一直在動的東西」（MR-017）。
   只改變數不重設 animation，動畫才不會在切換的瞬間跳回起點 */
.hall.is-walking .hall__flow {
  --flow-dur: 1.6s;
}

/* ── 作品 ───────────────────────────────────────────── */
.piece {
  position: absolute;
  /* 掛在視平線略上方＝實體展場的掛畫高度，與 perspective-origin 的 44% 對齊 */
  top: 40%;
  width: 300px;
  padding: 0;
  /* 整條 3D 脈絡都是 none，作品這層要自己收回來 */
  pointer-events: auto;
  background: transparent;
  border: none;
  cursor: pointer;
}

.piece--left {
  left: calc(50% - var(--half));
  transform-origin: left center;
  /* 轉 90 度後局部 +X 就是往場景深處，故深度只用 translateX 帶 */
  transform: rotateY(90deg) translateX(var(--depth)) translateY(-50%);
}

.piece--right {
  left: calc(50% + var(--half));
  transform-origin: left center;
  transform: rotateY(-90deg) translateX(calc(var(--depth) * -1)) translateY(-50%);
}

/* 裱框白邊：作品不直接貼牆。暗場版的「白」是壓到很暗的中性面板，
   否則一塊真白會在暗場裡變成畫面上最亮的東西，把作品壓下去 */
.piece__mat {
  display: block;
  padding: 18px;
  background: color-mix(in srgb, var(--ink) 12%, var(--surface));
  box-shadow:
    0 0 60px -12px var(--accent),
    0 30px 60px rgb(0 0 0 / 0.7);
}

.piece__image {
  display: block;
  width: 100%;
  height: auto;
}

/* 已走過的作品在相機側後方，透視會把它撐到極大。淡掉並收回指標——
   在你身後的東西不該搶視覺重量，也不該還能點（否則會誤觸到看不見的作品） */
.piece.is-passed {
  opacity: 0.25;
  pointer-events: none;
}

/* 牆面展籤：等寬大寫置中於作品下方，取自參考圖的排版層級 */
.piece__plate {
  display: block;
  padding-top: 0.7rem;
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.16em;
  color: var(--ink-faint);
  text-align: center;
}

.piece:hover .piece__mat,
.piece:focus-visible .piece__mat {
  box-shadow:
    0 0 80px -6px var(--accent),
    0 30px 60px rgb(0 0 0 / 0.7);
}

.piece:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 6px;
}

/* ── HUD ────────────────────────────────────────────── */
.hall__hud {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  padding: 0.9rem var(--page-x);
  background: linear-gradient(to top, rgb(8 8 13 / 0.9), transparent);
}

.hall__step {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  color: var(--ink-soft);
  background: rgb(18 18 26 / 0.9);
  border: 1px solid var(--line-strong);
  border-radius: var(--card-radius);
  padding: 0.45rem 0.9rem;
  cursor: pointer;
  transition: color 200ms var(--ease), border-color 200ms var(--ease);
}

.hall__step:hover:not(:disabled),
.hall__step:focus-visible:not(:disabled) {
  color: var(--accent);
  border-color: var(--accent);
}

.hall__step:disabled {
  opacity: 0.4;
  cursor: default;
}

.hall__pos,
.hall__empty {
  font-family: var(--font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.1em;
  color: var(--ink-faint);
}

.hall__empty {
  display: grid;
  place-items: center;
  height: 100%;
}

/* 減少動態時本模式根本不會被提供（見 App.vue），這裡是最後一道保險 */
@media (prefers-reduced-motion: reduce) {
  .hall__scene {
    transition: none;
  }

  .hall__flow {
    animation: none;
  }
}
</style>
