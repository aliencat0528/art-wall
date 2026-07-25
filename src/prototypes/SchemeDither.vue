<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SchemeProps } from './scheme'
import { usePrefersReducedMotion } from '@/composables/useMediaQuery'
import { ASPECT_RATIO } from '@/utils/placeholder'

/**
 * 方案 E — 數位展場（用戶指定的混合方案）。
 *
 * 組成：B 的站頭（色帶 + ON VIEW + 疊印面板 + 緊排粗體標題）
 *     ＋ C 的作品呈現（襯紙裱框 + 偏移第二色版 + 置中襯線展籤）
 *     ＋ 線框展場背景（牆面製圖網格 + 透視地板 + 掃描線 + 邊緣刻度 + 投射光）
 *     ＋ 景深（卡片透視傾斜 + 浮離牆面的投影）
 *
 * 網點沿革（兩次收斂，最後全數移除）：
 *   初版鋪滿 halftone 網點 → 太吵，顆粒變壁紙把作品壓下去，故背景改線框空間；
 *   網點退守色帶與框線 → 仍然太花，因為線框地板本身已經是一套密集的重複圖案，
 *   再疊網點等於同一畫面有兩套重複紋理在互相打架。故網點完全移除。
 * 結論：這支的視覺重量全部押在**空間**（線框地板 + 傾斜 + 投影 + 倒影般的厚度），
 * 表面一律留白——重複圖案一套就夠。
 *
 * 作品因此改為無框：襯紙、側面厚度與投影已經足以界定邊界，
 * 再加框線只是把剛清掉的雜訊換個形式加回來。
 *
 * 與 C 的一處刻意分歧：框線改成**點陣描邊**而非 C 的手繪抖線。
 * 理由是這支的整個概念是「數位／點陣」，手繪抖線是相反的語彙，
 * 兩者並置會互相抵消。要換回抖線只需把 `.dit__frame` 的 mask 改成
 * SchemeRiso 的 SVG rect + feDisplacementMap。
 */

const props = defineProps<SchemeProps>()

/** 把一小塊 SVG 磚做成可重複鋪底的 data URI（同 data/categories.ts 的手法） */
function tile(size: number, marks: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="0 0 ${size} ${size}">${marks}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

/** 牆面：細網格 + 交點十字標，像製圖紙而非裝飾紋理 */
const RULE = tile(
  120,
  '<path d="M0 0h120M0 0v120" stroke="#000" stroke-opacity="0.08" stroke-width="1" />' +
    '<path d="M56 60h8M60 56v8" stroke="#000" stroke-opacity="0.16" stroke-width="1" />',
)

/** 邊緣刻度：每 5 格一長刻，量測儀器的節奏 */
const TICKS = tile(
  70,
  '<g stroke="#000" stroke-opacity="0.3" stroke-width="1">' +
    '<path d="M0 0h5M0 14h5M0 28h5M0 42h5M0 56h5" />' +
    '<path d="M0 0h11" stroke-opacity="0.5" />' +
    '</g>',
)

const LAYERS = {
  '--rule': RULE,
  '--ticks': TICKS,
}

const wallKey = computed(() => props.category?.id ?? 'all')

/**
 * 游標視差：背景與作品往相反方向偏移，差速造成深度。
 * 這是所有立體手法裡最便宜的一個——不建 3D 場景、不動版面，只是兩個數字。
 * 系統要求減少動態時整個不掛（main.css 的全域關閉管不到 JS 驅動的 transform）。
 */
const reducedMotion = usePrefersReducedMotion()
const mx = ref(0)
const my = ref(0)

function trackPointer(event: MouseEvent): void {
  if (reducedMotion.value) return
  mx.value = Number(((event.clientX / window.innerWidth) * 2 - 1).toFixed(3))
  my.value = Number(((event.clientY / window.innerHeight) * 2 - 1).toFixed(3))
}

function releasePointer(): void {
  mx.value = 0
  my.value = 0
}

const style = computed(() => ({
  ...LAYERS,
  '--accent': props.accent,
  '--mx': String(mx.value),
  '--my': String(my.value),
}))
</script>

<template>
  <section
    class="dit"
    :style="style"
    @mousemove="trackPointer"
    @mouseleave="releasePointer"
  >
    <!-- 背景＝線框展場：牆面製圖網格 + 透視地板 + 掃描線 + 邊緣刻度 + 投射光。
         跟著分類一起重掛，切換時整個空間重新「顯影」 -->
    <div
      :key="wallKey"
      class="dit__field"
      aria-hidden="true"
    >
      <div class="dit__room">
        <span class="dit__plane dit__plane--wall" />
        <span class="dit__plane dit__plane--floor" />
      </div>
      <span class="dit__ticks" />
      <span class="dit__scan" />
      <span class="dit__light" />
      <span class="dit__coord dit__coord--tl">SECTOR 01 / GRID 56</span>
      <span class="dit__coord dit__coord--br">RENDER — WIREFRAME</span>
    </div>

    <!-- 站頭沿用方案 B：色帶 + ON VIEW + multiply 疊印面板 -->
    <header class="dit__head">
      <div class="dit__band">
        <span class="dit__onview">ON VIEW</span>
        <span class="dit__index">{{ String(works.length).padStart(2, '0') }}</span>
      </div>
      <div class="dit__plaque">
        <h1 class="dit__title">
          {{ category?.label ?? '全部作品' }}
        </h1>
        <p class="dit__sub">
          {{ category?.code ?? 'ALL' }} — {{ works.length }} WORKS
        </p>
      </div>
    </header>

    <div
      :key="`wall-${wallKey}`"
      class="dit__wall"
    >
      <figure
        v-for="(work, i) in works"
        :key="work.id"
        class="dit__item"
        :style="{ '--ar': ASPECT_RATIO[work.aspect], '--i': i }"
      >
        <!-- 作品呈現沿用方案 C：襯紙裱框 + 偏移色版 -->
        <div class="dit__mount">
          <!-- 畫框的側面：傾斜哪一邊，就露出哪一側的厚度 -->
          <span
            class="dit__edge"
            aria-hidden="true"
          />
          <span
            class="dit__plate"
            aria-hidden="true"
          />
          <img
            class="dit__img"
            :src="work.thumb"
            :alt="work.alt"
            loading="lazy"
          >
        </div>
        <figcaption class="dit__cap">
          <span class="dit__cap-title">{{ work.title }}</span>
          <span class="dit__cap-sub">{{ work.media.join('、') }} / {{ work.year }}</span>
        </figcaption>
      </figure>
    </div>
  </section>
</template>

<style scoped>
.dit {
  /* 暖灰紙底：比白盒暗一階，網點才有東西可對比。
     骨架維持無彩，彩度全部留給作品與 accent */
  --paper: #d6d3ca;
  --ink: #141310;

  position: relative;
  min-height: 100%;
  padding-bottom: 7rem;
  background: var(--paper);
  transition: background-color 560ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* ── 背景：線框展場 ───────────────────────────────────── */

.dit__field {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.dit__room {
  position: absolute;
  inset: 0;
  /* 地平線落在 38%：牆與地板在這條線交會，空間才成立 */
  perspective: 460px;
  perspective-origin: 50% 38%;
  /* 視差第一層：背景跟著游標反向走，位移量最大 */
  transform: translate3d(calc(var(--mx, 0) * -18px), calc(var(--my, 0) * -12px), 0);
  transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.dit__ticks,
.dit__scan,
.dit__light {
  position: absolute;
  inset: 0;
}

/* 牆面：製圖網格 + 交點十字標，往地平線淡出 */
.dit__plane--wall {
  position: absolute;
  inset: 0 0 62% 0;
  background-image: var(--rule);
  mask-image: linear-gradient(to bottom, #000 34%, transparent 100%);
  animation: dit-develop 900ms steps(6) both;
}

/* 地板：同一張網格繞 X 軸躺下去，線距自然收斂到消失點。
   這是整支方案的空間來源——比卡片傾斜更能說明「這是一個場」 */
.dit__plane--floor {
  position: absolute;
  top: 38%;
  right: -45%;
  bottom: -55%;
  left: -45%;
  background-image:
    repeating-linear-gradient(to right, rgb(20 19 16 / 0.16) 0 1px, transparent 1px 56px),
    repeating-linear-gradient(to bottom, rgb(20 19 16 / 0.16) 0 1px, transparent 1px 56px);
  mask-image: linear-gradient(to bottom, transparent 0%, #000 22%, #000 100%);
  transform: rotateX(74deg);
  transform-origin: 50% 0%;
  animation: dit-develop 900ms steps(6) 80ms both;
}

/* 邊緣刻度：只鋪左緣與上緣，像量測儀器的邊框而不是滿版紋理 */
.dit__ticks {
  background-image: var(--ticks), var(--ticks);
  background-repeat: repeat-y, repeat-x;
  background-position: left top, left top;
  background-size: 11px auto, auto 11px;
  animation: dit-develop 900ms steps(6) 160ms both;
}

/* 掃描線：3px 一條，淡到只在大面積留白上才察覺得到。
   它負責「這是螢幕不是紙」的那一層暗示 */
.dit__scan {
  background-image: repeating-linear-gradient(
    to bottom,
    rgb(20 19 16 / 0.045) 0 1px,
    transparent 1px 3px
  );
}

/* 展場投射光：頂部一道亮、底部沉下去。
   空間感有相當比例來自光落點與陰影，不是來自透視（見 gallery-depth.md 的歸因表） */
.dit__light {
  background:
    radial-gradient(120% 72% at 50% -14%, rgb(255 253 246 / 0.8), transparent 62%),
    linear-gradient(to bottom, transparent 46%, rgb(28 26 20 / 0.13) 100%);
  animation: dit-develop 900ms steps(6) 120ms both;
}

/* 座標標籤：實驗室感的收尾，等寬小字，不搶戲 */
.dit__coord {
  position: absolute;
  font-family: var(--font-mono);
  font-size: 0.56rem;
  letter-spacing: 0.22em;
  color: rgb(20 19 16 / 0.32);
  animation: dit-develop 900ms steps(6) 200ms both;
}

.dit__coord--tl {
  top: 0.9rem;
  left: 1rem;
}

.dit__coord--br {
  right: 1rem;
  bottom: 0.9rem;
}

/* 顯影：階梯式淡入，讓切換有「一階一階解出來」的數位感 */
@keyframes dit-develop {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

/* ── 站頭（來自方案 B） ────────────────────────────────── */

.dit__head {
  position: relative;
  z-index: 1;
  padding: 0 clamp(1.5rem, 5vw, 5rem);
}

.dit__band {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  height: clamp(120px, 20vh, 200px);
  padding: 1.1rem clamp(0rem, 3vw, 3rem);
  /* 純色帶，不鋪任何紋理——線框地板已經是畫面上唯一的重複圖案 */
  background: var(--accent);
  transition: background-color 560ms cubic-bezier(0.16, 1, 0.3, 1);
}

.dit__onview {
  padding: 0.16rem 0.4rem;
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.2em;
  color: #ffffff;
  background: var(--ink);
}

.dit__index {
  font-family: var(--font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.2em;
  color: var(--ink);
}

.dit__plaque {
  position: relative;
  z-index: 1;
  max-width: 30rem;
  margin-top: -3rem;
  margin-left: clamp(0rem, 3vw, 3rem);
  padding: 1.3rem 1.6rem 1.5rem;
  background: #cecabf;
  mix-blend-mode: multiply;
}

.dit__title {
  font-size: clamp(2rem, 5.5vw, 3.6rem);
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 0.94;
  color: var(--ink);
}

.dit__sub {
  margin-top: 0.5rem;
  font-family: var(--font-mono);
  font-size: 0.64rem;
  letter-spacing: 0.18em;
  color: #4b473f;
}

/* ── 牆面：景深 ───────────────────────────────────────── */

.dit__wall {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4.5rem 3rem;
  margin-top: 4rem;
  padding: 0 clamp(1.5rem, 5vw, 5rem);
  /* 站在展場中央的視點：左右兩欄各自朝內轉，中間那欄正對 */
  perspective: 1600px;
  perspective-origin: 50% 38%;
}

.dit__item {
  transform-style: preserve-3d;
  animation: dit-resolve 760ms steps(6) both;
  animation-delay: calc(var(--i) * 70ms);
}

.dit__mount {
  position: relative;
  padding: 1rem;
  background: #e6e3da;
  /* 浮離牆面：投影比透視更能給出空間感（見 gallery-depth.md 的歸因表） */
  box-shadow: 0 20px 42px rgb(20 19 16 / 0.22);
  /* 視差第二層：作品的偏轉量遠小於背景位移，差速才是深度的來源 */
  transform: rotateY(calc(var(--tilt, 0deg) + var(--mx, 0) * 1.4deg))
    rotateX(calc(var(--my, 0) * -0.9deg))
    translateZ(var(--depth, 0px));
  transition: transform 320ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 520ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* 打光：光從左上來，所以受光面與陰影面跟著傾斜方向換邊，
   單純傾斜不夠——光影不連動的話大腦讀成「圖被壓歪」而不是「板子轉了角度」 */
.dit__mount::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  background: linear-gradient(
    var(--light, 100deg),
    rgb(255 255 255 / 0.3),
    transparent 46%,
    rgb(20 19 16 / 0.09)
  );
  pointer-events: none;
}

/* 畫框側面：一條實邊，給板子厚度。露在傾斜背向的那一側 */
.dit__edge {
  position: absolute;
  top: 3px;
  bottom: -3px;
  width: 7px;
  background: linear-gradient(to bottom, #b8b3a6, #8d887c);
}

.dit__item:nth-child(3n + 1) .dit__mount {
  --tilt: 3.2deg;
  --depth: -30px;
  --light: 108deg;
}

.dit__item:nth-child(3n + 2) .dit__mount {
  --depth: 10px;
  --light: 96deg;
}

.dit__item:nth-child(3n) .dit__mount {
  --tilt: -3.2deg;
  --depth: -30px;
  --light: 78deg;
}

/* 左傾露右側面、右傾露左側面 */
.dit__item:nth-child(3n + 1) .dit__edge {
  right: -7px;
}

.dit__item:nth-child(3n) .dit__edge {
  left: -7px;
}

.dit__item:nth-child(3n + 2) .dit__edge {
  display: none;
}

.dit__item:hover .dit__mount {
  --tilt: 0deg;
  --depth: 56px;

  box-shadow: 0 34px 66px rgb(20 19 16 / 0.32);
}

/* 偏移的第二色版（來自方案 C） */
.dit__plate {
  position: absolute;
  inset: 1rem;
  background: var(--accent);
  opacity: 0.7;
  mix-blend-mode: multiply;
  transform: translate(9px, 10px);
  transition: background-color 560ms cubic-bezier(0.16, 1, 0.3, 1);
}

.dit__img {
  position: relative;
  display: block;
  width: 100%;
  max-height: 56vh;
  aspect-ratio: var(--ar);
  object-fit: cover;
}

.dit__cap {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding-top: 1rem;
  text-align: center;
}

.dit__cap-title {
  font-family: 'Songti TC', 'Noto Serif TC', Georgia, serif;
  font-size: 0.95rem;
  color: var(--ink);
}

.dit__cap-sub {
  font-family: var(--font-mono);
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  color: #6d675c;
}

/* 作品進場：階梯淡入 + 從牆裡浮出來，與網點顯影同一種節奏 */
@keyframes dit-resolve {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.97);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@media (max-width: 1099px) {
  .dit__wall {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 899px) {
  .dit__wall {
    grid-template-columns: 1fr;
    perspective: none;
  }

  .dit__item:nth-child(3n + 1) .dit__mount,
  .dit__item:nth-child(3n + 2) .dit__mount,
  .dit__item:nth-child(3n) .dit__mount {
    --tilt: 0deg;
    --depth: 0px;
  }
}
</style>
