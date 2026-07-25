<script setup lang="ts">
import { computed } from 'vue'
import type { SchemeProps } from './scheme'
import { ASPECT_RATIO } from '@/utils/placeholder'

/**
 * 方案 E — 點陣顯影（用戶指定的混合方案）。
 *
 * 組成：B 的站頭（色帶 + ON VIEW + 疊印面板 + 緊排粗體標題）
 *     ＋ C 的作品呈現（襯紙裱框 + 偏移第二色版 + 置中襯線展籤）
 *     ＋ 點陣顆粒背景（參考圖）
 *     ＋ 景深（透視傾斜 + 浮離牆面的投影）
 *
 * 顆粒的做法：參考圖是 **halftone／dither**——方形網點、大小隨明度調變、
 * 無彩高對比，不是雜訊貼圖。所以用三層不同間距的網點陣列疊起來，
 * 各自套不同遮罩造成疏密漸變，模擬網點的大小分級。
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

/** 一格一個方點。`size` 是網點間距，`dot` 是點的邊長——大小分級靠這兩個數 */
function dots(size: number, dot: number, opacity: number): string {
  const offset = (size - dot) / 2
  return tile(
    size,
    `<rect x="${offset}" y="${offset}" width="${dot}" height="${dot}" ` +
      `fill="#000" fill-opacity="${opacity}" />`,
  )
}

/** 數位線條：細網格 + 交點十字標，像製圖紙而非裝飾紋理 */
const RULE = tile(
  120,
  '<path d="M0 0h120M0 0v120" stroke="#000" stroke-opacity="0.08" stroke-width="1" />' +
    '<path d="M56 60h8M60 56v8" stroke="#000" stroke-opacity="0.16" stroke-width="1" />',
)

// 點要夠大夠黑才有參考圖那種「方塊點陣」的量感——淡網點只會變成雜訊底。
// 三層間距 18／9／4 是二倍遞減，疊起來才像網點的大小分級而不是三張獨立紋理。
const LAYERS = {
  '--dot-lg': dots(18, 8, 0.72),
  '--dot-md': dots(9, 3.4, 0.5),
  '--dot-sm': dots(4, 1.2, 0.3),
  '--rule': RULE,
}

const wallKey = computed(() => props.category?.id ?? 'all')

const style = computed(() => ({ ...LAYERS, '--accent': props.accent }))
</script>

<template>
  <section
    class="dit"
    :style="style"
  >
    <!-- 三層網點 + 製圖線。跟著分類一起重掛，切換時整片重新「顯影」 -->
    <div
      :key="wallKey"
      class="dit__field"
      aria-hidden="true"
    >
      <span class="dit__layer dit__layer--lg" />
      <span class="dit__layer dit__layer--md" />
      <span class="dit__layer dit__layer--sm" />
      <span class="dit__rule" />
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
          <!-- 點陣描邊：只在框帶露出網點，其餘遮掉 -->
          <span
            class="dit__frame"
            aria-hidden="true"
          />
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

/* ── 點陣場：三層網點分級 + 製圖線 ─────────────────────── */

.dit__field {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.dit__layer,
.dit__rule {
  position: absolute;
  inset: 0;
}

/* 大點集中在左上、往右下散開——參考圖那種由密到疏的分級。
   遮罩範圍刻意收窄：大點鋪滿會變成吵雜的格子布，聚成一團才有「意象」 */
.dit__layer--lg {
  background-image: var(--dot-lg);
  mask-image: radial-gradient(78% 62% at 6% -4%, #000 0%, transparent 70%);
  animation: dit-develop 1100ms steps(7) both;
}

.dit__layer--md {
  background-image: var(--dot-md);
  mask-image: radial-gradient(115% 95% at 26% 4%, #000 8%, transparent 76%);
  animation: dit-develop 1100ms steps(7) 80ms both;
}

/* 最細那層鋪滿，負責整體的顆粒底 */
.dit__layer--sm {
  background-image: var(--dot-sm);
  mask-image: linear-gradient(160deg, #000 0%, rgb(0 0 0 / 0.35) 70%, transparent 100%);
  animation: dit-develop 1100ms steps(7) 160ms both;
}

.dit__rule {
  background-image: var(--rule);
}

/* 顯影：階梯式淡入，模擬點陣一階一階被解出來 */
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
  background: var(--accent);
  /* 色帶上也鋪網點：色彩與顆粒是同一套語言，不是兩件事 */
  background-image: var(--dot-md);
  background-blend-mode: multiply;
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
  transform: rotateY(var(--tilt, 0deg)) translateZ(var(--depth, 0px));
  transition: transform 520ms cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 520ms cubic-bezier(0.16, 1, 0.3, 1);
}

.dit__item:nth-child(3n + 1) .dit__mount {
  --tilt: 3.2deg;
  --depth: -30px;
}

.dit__item:nth-child(3n + 2) .dit__mount {
  --depth: 10px;
}

.dit__item:nth-child(3n) .dit__mount {
  --tilt: -3.2deg;
  --depth: -30px;
}

.dit__item:hover .dit__mount {
  --tilt: 0deg;
  --depth: 46px;

  box-shadow: 0 30px 60px rgb(20 19 16 / 0.3);
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

/* 點陣描邊：四條邊各自鋪一帶網點，中間不鋪。
   原本用 mask-composite: exclude 挖空中間，實測 Chrome 沒生效，
   兩層 mask 變成聯集，整片網點蓋到作品圖上——改用四條背景帶不依賴合成模式。
   帶寬與 background-size 都對齊 --dot-md 的 9px 間距，網點才不會被縮放變形 */
.dit__frame {
  position: absolute;
  inset: -9px;
  background-image: var(--dot-md), var(--dot-md), var(--dot-md), var(--dot-md);
  background-repeat: repeat-x, repeat-x, repeat-y, repeat-y;
  background-position: left top, left bottom, left top, right top;
  background-size: auto 9px, auto 9px, 9px auto, 9px auto;
  pointer-events: none;
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
