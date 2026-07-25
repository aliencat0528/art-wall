<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SchemeProps } from './scheme'
import { usePrefersReducedMotion } from '@/composables/useMediaQuery'
import { ASPECT_RATIO } from '@/utils/placeholder'

/**
 * 方案 F — 暗場光氛（參考 theroomlife.com 那篇文章裡的展場照片）。
 *
 * 重要前提：用戶指的參考是**文章內的展覽攝影**，不是那個網站的版型
 * （網站本身是白底側欄的標準部落格）。喜歡的是《UNIQUE 史萊姆夜光實驗室》
 * 那種暗場霓虹的氛圍，所以這支翻譯的是**燈光**，不是版面。
 *
 * 把那批照片的氛圍逐項歸因，會得到四個可純 CSS 實作的要素：
 *   1. 暗場——底色近黑，一切亮度都由「光源」給，不是由底色給
 *   2. 聚光——每件作品被一束光打亮，離開光就暗下去（暗角）
 *   3. 浮塵——空氣中的細微光點緩慢飄移，光才有體積
 *   4. 反射地面——濕亮地板的倒影。這是那些照片裡最強的立體線索，
 *      比透視更有效，因為倒影同時給出「作品離地多高」與「地面在哪」
 *
 * 為什麼暗場反而保護作品（與 D-003 不衝突）：美術館暗展廳本來就是這樣做的。
 * 關鍵是**光打在作品上、不打在背景上**——彩色光暈只出現在作品外圍與站頭，
 * 圖面本身不覆蓋任何色層。真正會吃作品顏色的是「背景鋪滿彩色」，不是「背景很暗」。
 */

const props = defineProps<SchemeProps>()

/** FNV-1a + mulberry32：讓浮塵的分布固定，不會每次重整亂跳 */
function seeded(seed: string): () => number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  let state = h >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 一片浮塵：`count` 顆亮點散在 `size` 見方的磚上，可重複鋪滿 */
function dust(seed: string, size: number, count: number, scale: number): string {
  const random = seeded(seed)
  let marks = ''
  for (let i = 0; i < count; i += 1) {
    const cx = (random() * size).toFixed(1)
    const cy = (random() * size).toFixed(1)
    const r = (0.5 + random() * scale).toFixed(2)
    const o = (0.18 + random() * 0.5).toFixed(2)
    marks += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" fill-opacity="${o}" />`
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="0 0 ${size} ${size}">${marks}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

// 兩層浮塵、不同磚距與飄移速度——差速才會讀成「空氣有厚度」而不是貼圖
const DUST_NEAR = dust('near', 340, 26, 1.5)
const DUST_FAR = dust('far', 220, 34, 0.8)

/** 「全部」的中性 accent 在暗場霓虹裡是一坨死灰，改用青藍當預設光色 */
const glow = computed(() => (props.category ? props.accent : '#4fd6e8'))

const wallKey = computed(() => props.category?.id ?? 'all')

/** 游標視差：光與塵反向走，作品微幅偏轉 */
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
  '--accent': props.accent,
  '--glow': glow.value,
  '--dust-near': DUST_NEAR,
  '--dust-far': DUST_FAR,
  '--mx': String(mx.value),
  '--my': String(my.value),
}))
</script>

<template>
  <section
    class="glo"
    :style="style"
    @mousemove="trackPointer"
    @mouseleave="releasePointer"
  >
    <div
      :key="wallKey"
      class="glo__air"
      aria-hidden="true"
    >
      <span class="glo__beam" />
      <span class="glo__dust glo__dust--far" />
      <span class="glo__dust glo__dust--near" />
      <span class="glo__vignette" />
    </div>

    <header class="glo__head">
      <span class="glo__onview">ON VIEW</span>
      <h1 class="glo__title">
        {{ category?.label ?? '全部作品' }}
      </h1>
      <p class="glo__sub">
        {{ category?.code ?? 'ALL' }} — {{ works.length }} WORKS
      </p>
      <span class="glo__rule" />
    </header>

    <div
      :key="`wall-${wallKey}`"
      class="glo__wall"
    >
      <figure
        v-for="(work, i) in works"
        :key="work.id"
        class="glo__item"
        :style="{ '--ar': ASPECT_RATIO[work.aspect], '--i': i }"
      >
        <div class="glo__mount">
          <img
            class="glo__img"
            :src="work.thumb"
            :alt="work.alt"
            loading="lazy"
          >
        </div>

        <!-- 濕亮地板的倒影：整支方案最強的立體線索 -->
        <span
          class="glo__mirror"
          aria-hidden="true"
        >
          <img
            class="glo__mirror-img"
            :src="work.thumb"
            alt=""
            loading="lazy"
          >
        </span>

        <figcaption class="glo__cap">
          <span class="glo__cap-title">{{ work.title }}</span>
          <span class="glo__cap-sub">{{ work.media.join('、') }} / {{ work.year }}</span>
        </figcaption>
      </figure>
    </div>
  </section>
</template>

<style scoped>
.glo {
  --void: #08080d;
  --ink: #ece9f2;

  position: relative;
  min-height: 100%;
  padding-bottom: 8rem;
  background: var(--void);
  transition: background-color 620ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* ── 空氣：光束 + 浮塵 + 暗角 ─────────────────────────── */

.glo__air {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.glo__beam,
.glo__dust,
.glo__vignette {
  position: absolute;
  inset: 0;
}

/* 光束：頂部一道主光加一道副光，色相取自分類。
   亮度全部由這層給——底色本身是死黑，這樣光才「發得出來」 */
.glo__beam {
  background:
    radial-gradient(
      70% 52% at 50% -8%,
      color-mix(in srgb, var(--glow) 46%, transparent),
      transparent 68%
    ),
    radial-gradient(
      46% 40% at 12% 8%,
      color-mix(in srgb, var(--glow) 22%, transparent),
      transparent 72%
    ),
    radial-gradient(58% 46% at 88% 22%, rgb(160 120 255 / 0.14), transparent 72%);
  filter: blur(12px);
  transform: translate3d(calc(var(--mx, 0) * -26px), calc(var(--my, 0) * -16px), 0);
  transition: transform 320ms cubic-bezier(0.22, 1, 0.36, 1),
    background 620ms cubic-bezier(0.16, 1, 0.3, 1);
  animation: glo-breathe 9s ease-in-out infinite;
}

/* 浮塵兩層：遠的細而慢，近的大而快，差速給出空氣厚度 */
.glo__dust--far {
  background-image: var(--dust-far);
  opacity: 0.5;
  transform: translate3d(calc(var(--mx, 0) * -10px), calc(var(--my, 0) * -6px), 0);
  animation: glo-drift-far 46s linear infinite;
}

.glo__dust--near {
  background-image: var(--dust-near);
  opacity: 0.62;
  transform: translate3d(calc(var(--mx, 0) * -22px), calc(var(--my, 0) * -14px), 0);
  animation: glo-drift-near 28s linear infinite;
}

/* 暗角：把邊緣壓下去，視線自然收到中間的作品 */
.glo__vignette {
  background: radial-gradient(88% 70% at 50% 42%, transparent 34%, rgb(4 4 8 / 0.82) 100%);
}

@keyframes glo-breathe {
  0%,
  100% {
    opacity: 0.86;
  }

  50% {
    opacity: 1;
  }
}

@keyframes glo-drift-far {
  from {
    background-position: 0 0;
  }

  to {
    background-position: 220px -220px;
  }
}

@keyframes glo-drift-near {
  from {
    background-position: 0 0;
  }

  to {
    background-position: -340px -340px;
  }
}

/* ── 站頭 ─────────────────────────────────────────────── */

.glo__head {
  position: relative;
  z-index: 1;
  padding: 5rem clamp(1.5rem, 5vw, 5rem) 0;
}

.glo__onview {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.22em;
  color: var(--void);
  background: var(--glow);
  box-shadow: 0 0 26px -4px var(--glow);
  transition: background-color 620ms ease, box-shadow 620ms ease;
}

.glo__title {
  margin-top: 0.9rem;
  font-size: clamp(2.4rem, 6.5vw, 4.6rem);
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 0.94;
  color: var(--ink);
  /* 字自己會發光，不靠底色撐 */
  text-shadow: 0 0 42px color-mix(in srgb, var(--glow) 70%, transparent);
  transition: text-shadow 620ms ease;
}

.glo__sub {
  margin-top: 0.7rem;
  font-family: var(--font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.2em;
  color: color-mix(in srgb, var(--ink) 52%, transparent);
}

.glo__rule {
  display: block;
  height: 1px;
  margin-top: 2.2rem;
  background: linear-gradient(to right, var(--glow), transparent 62%);
  box-shadow: 0 0 18px -2px var(--glow);
  transition: background 620ms ease, box-shadow 620ms ease;
}

/* ── 牆面 ─────────────────────────────────────────────── */

.glo__wall {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5rem 3rem;
  margin-top: 4.5rem;
  padding: 0 clamp(1.5rem, 5vw, 5rem);
  perspective: 1600px;
  perspective-origin: 50% 36%;
}

.glo__item {
  transform-style: preserve-3d;
  animation: glo-rise 900ms cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(var(--i) * 80ms);
}

.glo__mount {
  position: relative;
  /* 作品懸空：彩色光暈打在外圍，圖面本身不蓋任何色層 */
  box-shadow: 0 0 90px -18px var(--glow), 0 34px 64px rgb(0 0 0 / 0.62);
  transform: rotateY(calc(var(--tilt, 0deg) + var(--mx, 0) * 1.6deg))
    rotateX(calc(var(--my, 0) * -1deg))
    translateZ(var(--depth, 0px));
  transition: transform 320ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 520ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* 聚光：光從上方斜下打在作品上，下緣自然暗掉 */
.glo__mount::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    var(--light, 168deg),
    rgb(255 255 255 / 0.13),
    transparent 42%,
    rgb(4 4 8 / 0.34)
  );
  pointer-events: none;
}

.glo__item:nth-child(3n + 1) .glo__mount {
  --tilt: 3deg;
  --depth: -28px;
  --light: 156deg;
}

.glo__item:nth-child(3n + 2) .glo__mount {
  --depth: 12px;
  --light: 172deg;
}

.glo__item:nth-child(3n) .glo__mount {
  --tilt: -3deg;
  --depth: -28px;
  --light: 188deg;
}

.glo__item:hover .glo__mount {
  --tilt: 0deg;
  --depth: 54px;

  box-shadow: 0 0 130px -14px var(--glow), 0 44px 80px rgb(0 0 0 / 0.7);
}

.glo__img {
  display: block;
  width: 100%;
  max-height: 52vh;
  aspect-ratio: var(--ar);
  object-fit: cover;
}

/* 倒影：翻轉後往下淡出。scaleY(-1) 會把 mask 一起翻掉，
   故用 translateY(-100%) 把它推回原位，遮罩才是「由上而下淡出」 */
.glo__mirror {
  display: block;
  height: 42%;
  overflow: hidden;
  opacity: 0.34;
  mask-image: linear-gradient(to bottom, #000 0%, transparent 76%);
  filter: blur(1.4px);
}

.glo__mirror-img {
  display: block;
  width: 100%;
  aspect-ratio: var(--ar);
  object-fit: cover;
  transform: scaleY(-1) translateY(-100%);
  transform-origin: top left;
}

.glo__cap {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding-top: 0.9rem;
  text-align: center;
}

.glo__cap-title {
  font-family: 'Songti TC', 'Noto Serif TC', Georgia, serif;
  font-size: 1rem;
  color: var(--ink);
}

.glo__cap-sub {
  font-family: var(--font-mono);
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  color: color-mix(in srgb, var(--ink) 44%, transparent);
}

/* 進場：從暗處亮起來並往前浮，像燈一盞一盞打開 */
@keyframes glo-rise {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.96);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@media (max-width: 1099px) {
  .glo__wall {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 899px) {
  .glo__wall {
    grid-template-columns: 1fr;
    perspective: none;
  }

  .glo__item:nth-child(3n + 1) .glo__mount,
  .glo__item:nth-child(3n + 2) .glo__mount,
  .glo__item:nth-child(3n) .glo__mount {
    --tilt: 0deg;
    --depth: 0px;
  }
}
</style>
