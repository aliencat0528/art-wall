<script setup lang="ts">
import { computed } from 'vue'
import type { SchemeProps } from './scheme'
import { ASPECT_RATIO } from '@/utils/placeholder'

/**
 * 方案 D — 新粗獷（參考 Whitney／Werkleitz／Van Abbemuseum）。
 *
 * 四個方案裡最激烈的一支，也是唯一會推翻既有定調的一支：
 * 大面積實色塊、對角切割、超粗黑框、切角、字壓過框線、內容破格。
 *
 * ⚠️ 這支**故意**違反 D-003（中性白盒）與 MR-008（不換皮，因為會吃作品顏色）。
 * 放進原型不是因為它安全，是因為「氣勢」這件事講不清楚，要看了才知道要不要。
 * 選它就等於選色彩 C 案，必須另立決策覆蓋 D-003／MR-008。
 */

const props = defineProps<SchemeProps>()

const wallKey = computed(() => props.category?.id ?? 'all')
</script>

<template>
  <section
    class="bru"
    :style="{ '--accent': accent }"
  >
    <header class="bru__head">
      <div
        class="bru__slab"
        aria-hidden="true"
      />
      <h1 class="bru__title">
        {{ category?.label ?? '全部作品' }}
      </h1>
      <p class="bru__tag">
        {{ category?.code ?? 'ALL' }} / {{ works.length }}
      </p>
    </header>

    <div
      :key="wallKey"
      class="bru__wall"
    >
      <article
        v-for="(work, i) in works"
        :key="work.id"
        class="bru__item"
        :style="{ '--ar': ASPECT_RATIO[work.aspect], '--i': i }"
      >
        <div class="bru__box">
          <img
            class="bru__img"
            :src="work.thumb"
            :alt="work.alt"
            loading="lazy"
          >
        </div>
        <!-- 標題壓在框線上，difference 讓它在深淺底上都讀得到 -->
        <h2 class="bru__name">
          {{ work.title }}
        </h2>
        <p class="bru__info">
          {{ work.media.join(' / ') }} — {{ work.year }}
        </p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.bru {
  --ink: #14140f;
  --shout: #f2d02c;

  position: relative;
  min-height: 100%;
  padding-bottom: 8rem;
  background: #e4e2da;
  transition: background-color 420ms cubic-bezier(0.83, 0, 0.17, 1);
}

/* ── 站頭：對角切割的大色塊，字直接壓上去 ─────────────── */

.bru__head {
  position: relative;
  padding: 3rem clamp(1.25rem, 4vw, 4rem) 3.5rem;
  overflow: hidden;
}

.bru__slab {
  position: absolute;
  inset: 0;
  background: var(--accent);
  /* 對角切割：色塊不是矩形，這是粗獷風拒絕網格的第一個動作 */
  clip-path: polygon(0 0, 100% 0, 100% 62%, 0 100%);
  transition: background-color 420ms cubic-bezier(0.83, 0, 0.17, 1);
}

.bru__title {
  position: relative;
  font-size: clamp(2.8rem, 12vw, 9rem);
  font-weight: 900;
  letter-spacing: -0.06em;
  line-height: 0.82;
  color: var(--shout);
  mix-blend-mode: difference;
}

.bru__tag {
  position: relative;
  margin-top: 1rem;
  padding: 0.25rem 0.55rem;
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--shout);
  background: var(--ink);
}

/* ── 牆面：破格與掃場 ──────────────────────────────── */

.bru__wall {
  position: relative;
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 3rem 1.6rem;
  padding: 0 clamp(1.25rem, 4vw, 4rem);
}

/* 切換分類時一塊實色橫掃過整面牆——這方案的簽名動作 */
.bru__wall::after {
  content: '';
  position: absolute;
  inset: -2rem 0;
  z-index: 5;
  background: var(--ink);
  pointer-events: none;
  animation: bru-wipe 620ms cubic-bezier(0.83, 0, 0.17, 1) both;
}

.bru__item {
  grid-column: span 4;
  animation: bru-drop 520ms cubic-bezier(0.83, 0, 0.17, 1) both;
  animation-delay: calc(320ms + var(--i) * 45ms);
}

/* 破格：不是每件都乖乖待在欄位裡 */
.bru__item:nth-child(4n + 1) {
  grid-column: span 6;
}

.bru__item:nth-child(4n + 3) {
  grid-column: span 5;
  margin-top: 4rem;
}

.bru__item:nth-child(3n) {
  margin-right: -2.5rem;
}

.bru__box {
  /* 超粗黑框 + 切角：框本身是造型，不只是分隔 */
  border: 8px solid var(--ink);
  clip-path: polygon(0 0, calc(100% - 28px) 0, 100% 28px, 100% 100%, 0 100%);
}

.bru__img {
  display: block;
  width: 100%;
  /* 破格的欄位很寬，直式作品不設上限會一件吃掉整個視窗 */
  max-height: 58vh;
  aspect-ratio: var(--ar);
  object-fit: cover;
}

.bru__name {
  /* 名字往上咬進圖框，字壓過框線。
     實色底而非 difference——difference 在淺灰底上出來的黃太弱讀不到 */
  position: relative;
  z-index: 2;
  display: inline-block;
  margin-top: -1.4rem;
  margin-left: -0.4rem;
  padding: 0.2rem 0.6rem;
  font-size: clamp(1.1rem, 2.6vw, 1.9rem);
  font-weight: 900;
  letter-spacing: -0.03em;
  color: var(--shout);
  background: var(--ink);
}

.bru__info {
  margin-top: 0.6rem;
  font-family: var(--font-mono);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink);
}

@keyframes bru-wipe {
  from {
    transform: translateX(-100%);
  }

  45% {
    transform: none;
  }

  to {
    transform: translateX(100%);
  }
}

@keyframes bru-drop {
  from {
    opacity: 0;
    transform: translateY(34px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@media (max-width: 899px) {
  .bru__wall {
    grid-template-columns: 1fr;
  }

  .bru__item,
  .bru__item:nth-child(4n + 1),
  .bru__item:nth-child(4n + 3),
  .bru__item:nth-child(3n) {
    grid-column: auto;
    margin-top: 0;
    margin-right: 0;
  }
}
</style>
