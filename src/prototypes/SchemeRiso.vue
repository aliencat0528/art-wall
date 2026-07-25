<script setup lang="ts">
import { computed } from 'vue'
import type { SchemeProps } from './scheme'
import { ASPECT_RATIO } from '@/utils/placeholder'

/**
 * 方案 C — Riso 疊印（參考 Risograph overprint）。
 *
 * 這支專門回答「框線不要只有直線」：框不是 border，是一支 SVG rect
 * 掛上 feTurbulence + feDisplacementMap，讓四邊自己抖起來——
 * 同一個 filter 吃遍所有框，不必為每種形狀各寫一套。
 *
 * 另外兩個 Riso 語彙：
 *   - 套印偏移：作品下方壓一塊偏移的色版，模擬沒對準的第二色印版
 *   - 紙張顆粒：fractalNoise 鋪一層 multiply，全站統一的手感底
 * 顆粒層與色版都在作品**下方或外側**，不覆蓋圖面，避免偏移作品白平衡。
 */

const props = defineProps<SchemeProps>()

const wallKey = computed(() => props.category?.id ?? 'all')
</script>

<template>
  <section
    class="riso"
    :style="{ '--accent': accent }"
  >
    <!-- 濾鏡定義：抖線框與紙張顆粒，整支方案共用 -->
    <svg
      class="riso__defs"
      aria-hidden="true"
    >
      <defs>
        <filter id="riso-wobble">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.028"
            numOctaves="3"
            seed="7"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="7"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <filter id="riso-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="4"
            stitchTiles="stitch"
          />
          <feColorMatrix
            type="saturate"
            values="0"
          />
        </filter>
      </defs>
    </svg>

    <div
      class="riso__grain"
      aria-hidden="true"
    >
      <svg
        width="100%"
        height="100%"
      >
        <rect
          width="100%"
          height="100%"
          filter="url(#riso-grain)"
        />
      </svg>
    </div>

    <header class="riso__head">
      <p class="riso__kicker">
        EXHIBITION — 常設展
      </p>
      <h1 class="riso__title">
        {{ category?.label ?? '全部作品' }}
      </h1>
      <p class="riso__meta">
        {{ works.length }} 件 · {{ category?.code ?? 'ALL' }}
      </p>
    </header>

    <div
      :key="wallKey"
      class="riso__wall"
    >
      <figure
        v-for="(work, i) in works"
        :key="work.id"
        class="riso__item"
        :style="{ '--ar': ASPECT_RATIO[work.aspect], '--i': i }"
      >
        <div class="riso__mount">
          <!-- 沒對準的第二色印版 -->
          <span
            class="riso__plate"
            aria-hidden="true"
          />
          <img
            class="riso__img"
            :src="work.thumb"
            :alt="work.alt"
            loading="lazy"
          >
          <!-- 抖線框：不是 border，是被 displacement 扭過的 SVG rect -->
          <svg
            class="riso__frame"
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
            aria-hidden="true"
          >
            <rect
              x="2"
              y="2"
              width="96"
              height="96"
              fill="none"
              stroke="currentColor"
              stroke-width="0.9"
              vector-effect="non-scaling-stroke"
              filter="url(#riso-wobble)"
            />
          </svg>
        </div>
        <figcaption class="riso__cap">
          <span class="riso__cap-title">{{ work.title }}</span>
          <span class="riso__cap-sub">{{ work.media.join('、') }}／{{ work.year }}</span>
        </figcaption>
      </figure>
    </div>
  </section>
</template>

<style scoped>
.riso {
  position: relative;
  min-height: 100%;
  padding: 3.5rem clamp(1.5rem, 5vw, 5rem) 7rem;
  /* 紙色，不是白 */
  background: #f4efe4;
  transition: background-color 620ms cubic-bezier(0.34, 1.16, 0.64, 1);
}

.riso__defs {
  position: absolute;
  width: 0;
  height: 0;
}

/* 紙張顆粒：鋪滿、multiply、不擋點擊 */
.riso__grain {
  position: fixed;
  inset: 0;
  z-index: 3;
  opacity: 0.24;
  mix-blend-mode: multiply;
  pointer-events: none;
}

.riso__head {
  max-width: 42rem;
  margin-bottom: 3.5rem;
}

.riso__kicker {
  font-family: var(--font-mono);
  font-size: 0.64rem;
  letter-spacing: 0.24em;
  color: var(--accent);
  transition: color 620ms cubic-bezier(0.34, 1.16, 0.64, 1);
}

.riso__title {
  margin-top: 0.5rem;
  /* 系統襯線：先不引 web font，這條成本留給定案後再決定 */
  font-family: 'Songti TC', 'Noto Serif TC', Georgia, serif;
  font-size: clamp(2.2rem, 6vw, 4.2rem);
  font-style: italic;
  font-weight: 500;
  line-height: 1.02;
  color: #26211a;
}

.riso__meta {
  margin-top: 0.7rem;
  font-family: var(--font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.14em;
  color: #6f6656;
}

.riso__wall {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(15rem, 100%), 1fr));
  gap: 3.2rem 2.4rem;
}

.riso__item {
  animation: riso-register 760ms cubic-bezier(0.34, 1.16, 0.64, 1) both;
  animation-delay: calc(var(--i) * 65ms);
}

.riso__mount {
  position: relative;
  /* 裱框白邊：作品浮在襯紙上，而不是直接貼牆 */
  padding: 0.85rem;
  background: #fbf8f1;
}

/* 第二色印版：刻意偏移，multiply 讓它與襯紙相乘 */
.riso__plate {
  position: absolute;
  inset: 0.85rem;
  background: var(--accent);
  /* 偏移與濃度都要夠，才看得出這是「沒對準的第二塊色版」而不是陰影 */
  opacity: 0.72;
  mix-blend-mode: multiply;
  transform: translate(9px, 10px);
  transition: background-color 620ms cubic-bezier(0.34, 1.16, 0.64, 1);
}

.riso__img {
  position: relative;
  display: block;
  width: 100%;
  max-height: 56vh;
  aspect-ratio: var(--ar);
  object-fit: cover;
}

.riso__frame {
  position: absolute;
  /* 框比作品大一圈，像手工裱的外框，四邊不等寬 */
  inset: 0.2rem;
  width: auto;
  height: auto;
  color: var(--accent);
  pointer-events: none;
  transition: color 620ms cubic-bezier(0.34, 1.16, 0.64, 1);
}

.riso__cap {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding-top: 0.85rem;
  text-align: center;
}

.riso__cap-title {
  font-family: 'Songti TC', 'Noto Serif TC', Georgia, serif;
  font-size: 0.92rem;
  color: #26211a;
}

.riso__cap-sub {
  font-family: var(--font-mono);
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  color: #857a67;
}

/* 進場：先大幅套印失準，再收攏對準 */
@keyframes riso-register {
  from {
    opacity: 0;
    transform: translate(-14px, -10px);
  }

  60% {
    opacity: 1;
  }

  to {
    opacity: 1;
    transform: none;
  }
}
</style>
