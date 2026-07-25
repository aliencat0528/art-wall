<script setup lang="ts">
import { computed } from 'vue'
import type { SchemeProps } from './scheme'
import { ASPECT_RATIO } from '@/utils/placeholder'

/**
 * 方案 A — 網格外露（參考 Stedelijk／Wim Crouwel）。
 *
 * 對照組：刻意不做框。作品的邊界由「對齊」與「留白」界定，
 * 唯一的裝飾是那層本來看不見的模組網格線——把結構本身當視覺。
 * 強調色只出現在分類代碼那幾個字，面積小到不可能吃作品顏色。
 */

const props = defineProps<SchemeProps>()

/** 換分類時重掛整面牆，讓逐格滑入的進場動畫重播 */
const wallKey = computed(() => props.category?.id ?? 'all')
</script>

<template>
  <section
    class="gridnik"
    :style="{ '--accent': accent }"
  >
    <header class="gridnik__head">
      <h1 class="gridnik__title">
        作品牆
      </h1>
      <p class="gridnik__meta">
        <span class="gridnik__code">{{ category?.code ?? 'ALL' }}</span>
        <span>{{ category?.label ?? '全部作品' }}</span>
        <span>{{ works.length }} 件</span>
      </p>
    </header>

    <div
      :key="wallKey"
      class="gridnik__wall"
    >
      <figure
        v-for="(work, i) in works"
        :key="work.id"
        class="gridnik__item"
        :style="{ '--ar': ASPECT_RATIO[work.aspect], '--i': i }"
      >
        <img
          class="gridnik__img"
          :src="work.thumb"
          :alt="work.alt"
          loading="lazy"
        >
        <figcaption class="gridnik__cap">
          <span class="gridnik__cap-title">{{ work.title }}</span>
          <span class="gridnik__cap-sub">{{ work.media.join(' / ') }} — {{ work.year }}</span>
        </figcaption>
      </figure>
    </div>
  </section>
</template>

<style scoped>
.gridnik {
  --col: 12;
  --module: calc(100% / var(--col));

  min-height: 100%;
  padding: 4rem clamp(1.5rem, 5vw, 5rem) 6rem;
  background: #f7f6f3;
  transition: background-color 520ms cubic-bezier(0.22, 1, 0.36, 1);
}

.gridnik__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem 2rem;
  padding-bottom: 1.2rem;
  /* 唯一的一條線：基線。其餘結構交給網格 */
  border-bottom: 1px solid #1c1c1a;
}

.gridnik__title {
  /* 緊排大字是瑞士學派的聲音，不靠裝飾靠字級 */
  font-size: clamp(2.4rem, 7vw, 5.5rem);
  font-weight: 700;
  letter-spacing: -0.045em;
  line-height: 0.86;
  color: #1c1c1a;
}

.gridnik__meta {
  display: flex;
  gap: 1.4rem;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #55534d;
}

.gridnik__code {
  color: var(--accent);
  transition: color 520ms cubic-bezier(0.22, 1, 0.36, 1);
}

/* 模組網格：本來是排版工具，這裡把它顯影成畫面的一部分 */
.gridnik__wall {
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--col), 1fr);
  gap: 3.5rem 1.5rem;
  padding-top: 3.5rem;
}

.gridnik__wall::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image: repeating-linear-gradient(
    to right,
    rgb(28 28 26 / 0.07) 0 1px,
    transparent 1px var(--module)
  );
}

.gridnik__item {
  position: relative;
  z-index: 1;
  /* 版位寬度用 span 分配，高度由比例推得——不讓圖片固有尺寸參與版面計算 */
  grid-column: span 4;
  animation: gridnik-in 640ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: calc(var(--i) * 55ms);
}

/* 錯落：每三件裡有一件放大成 5 欄並下沉，破掉整齊到無聊的節奏 */
.gridnik__item:nth-child(3n + 2) {
  grid-column: span 5;
  margin-top: 3.5rem;
}

.gridnik__item:nth-child(4n + 1) {
  grid-column: span 3;
}

.gridnik__img {
  display: block;
  width: 100%;
  max-height: 62vh;
  aspect-ratio: var(--ar);
  object-fit: cover;
  /* 無框、無圓角、無陰影——這是本方案的主張 */
}

.gridnik__cap {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding-top: 0.7rem;
}

.gridnik__cap-title {
  font-size: 0.82rem;
  color: #1c1c1a;
}

.gridnik__cap-sub {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #8c8981;
}

/* 進場：沿基線由下滑入，一格一格數上來 */
@keyframes gridnik-in {
  from {
    opacity: 0;
    transform: translateY(26px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@media (max-width: 899px) {
  .gridnik {
    --col: 6;
  }

  .gridnik__item,
  .gridnik__item:nth-child(3n + 2),
  .gridnik__item:nth-child(4n + 1) {
    grid-column: span 6;
    margin-top: 0;
  }
}
</style>
