<script setup lang="ts">
import { computed } from 'vue'
import type { SchemeProps } from './scheme'
import { ASPECT_RATIO } from '@/utils/placeholder'

/**
 * 方案 B — 模組疊層（參考 MoMA 2019 設計系統，Order）。
 *
 * 核心是「模組會疊、疊了會生色」：每件作品住在一個半透明的模組方框裡，
 * 方框以負邊界互相咬合，重疊處靠 alpha 合成出第三個色調。
 * 作品圖本身是不透明且疊在最上層，**不參與混色**——這是本方案能兼顧
 * 「有色彩」與 D-003「中性襯托作品」的關鍵。
 * 站頭那塊 ON VIEW 面板才用 mix-blend-mode: multiply 做真正的疊印，
 * 且刻意只壓在色帶上，不壓作品。
 */

const props = defineProps<SchemeProps>()

const wallKey = computed(() => props.category?.id ?? 'all')
</script>

<template>
  <section
    class="mod"
    :style="{ '--accent': accent }"
  >
    <header class="mod__head">
      <div class="mod__band">
        <!-- 留在色帶上、不進疊印層：multiply 會把它壓成黑塊 -->
        <span class="mod__onview">ON VIEW</span>
      </div>
      <div class="mod__plaque">
        <h1 class="mod__title">
          {{ category?.label ?? '全部作品' }}
        </h1>
        <p class="mod__sub">
          {{ works.length }} WORKS — {{ category?.code ?? 'ALL' }}
        </p>
      </div>
    </header>

    <div
      :key="wallKey"
      class="mod__wall"
    >
      <article
        v-for="(work, i) in works"
        :key="work.id"
        class="mod__panel"
        :style="{ '--ar': ASPECT_RATIO[work.aspect], '--i': i }"
      >
        <div class="mod__body">
          <img
            class="mod__img"
            :src="work.thumb"
            :alt="work.alt"
            loading="lazy"
          >
          <div class="mod__label">
            <span class="mod__label-title">{{ work.title }}</span>
            <span class="mod__label-sub">{{ work.media.join(' · ') }}</span>
            <span class="mod__label-year">{{ work.year }}</span>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.mod {
  --paper: #f2f0ec;
  --tint: color-mix(in srgb, var(--accent) 13%, #ffffff);

  min-height: 100%;
  padding-bottom: 7rem;
  background: var(--paper);
  /* 切換分類時色彩是「流過去」的，不是硬切——這是本次要修的第一件事 */
  transition: background-color 560ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* ── 站頭：色帶 + 疊印面板 ───────────────────────────── */

.mod__head {
  position: relative;
  padding: 0 clamp(1.5rem, 5vw, 5rem);
}

.mod__band {
  display: flex;
  align-items: flex-start;
  height: clamp(120px, 22vh, 220px);
  padding: 1.1rem clamp(0rem, 3vw, 3rem);
  background: var(--accent);
  transition: background-color 560ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* 疊印：面板壓在色帶上，multiply 讓兩層相乘出第三色。
   刻意只壓色帶不壓作品——這是「色彩限定非作品區」的具體位置 */
.mod__plaque {
  position: relative;
  z-index: 1;
  max-width: 30rem;
  margin-top: -3.5rem;
  margin-left: clamp(0rem, 3vw, 3rem);
  padding: 1.4rem 1.6rem 1.6rem;
  background: #e8e4dc;
  mix-blend-mode: multiply;
}

.mod__onview {
  padding: 0.16rem 0.4rem;
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.2em;
  color: #ffffff;
  background: #d32f1e;
}

.mod__title {
  /* MoMA 的主聲音：Bold、左對齊、字距收緊 */
  font-size: clamp(2rem, 5.5vw, 3.6rem);
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 0.94;
  color: #17161a;
}

.mod__sub {
  margin-top: 0.5rem;
  font-family: var(--font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.16em;
  color: #4a4844;
}

/* ── 牆面：模組互相咬合 ─────────────────────────────── */

.mod__wall {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  /* 列距要留夠，否則上一列的展籤會被下一列咬掉 */
  gap: 2.6rem 0;
  align-items: start;
  margin-top: 3.5rem;
  padding: 0 clamp(1.5rem, 5vw, 5rem);
}

.mod__panel {
  position: relative;
  grid-column: span 4;
  padding: 0.9rem;
  /* 半透明：疊到下一塊時，重疊處自然合成出第三個色調 */
  background: color-mix(in srgb, var(--tint) 88%, transparent);
  /* 框線粗細分級——不是每塊都一樣，層級才看得出來 */
  border: 1px solid color-mix(in srgb, var(--accent) 34%, transparent);
  animation: mod-settle 720ms cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(var(--i) * 70ms);
  transition: background-color 560ms cubic-bezier(0.16, 1, 0.3, 1),
    border-color 560ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* 咬合：負邊界讓相鄰模組互相壓住，z-index 決定誰在上。
   咬的深度刻意只略大於 padding（0.9rem）——吃掉的是模組的框邊，
   不是作品也不是展籤。再深就從「疊層」變成「遮擋」了 */
.mod__panel:nth-child(2n) {
  z-index: 2;
  margin-top: 1.5rem;
  margin-left: -1.2rem;
  border-width: 6px;
}

.mod__panel:nth-child(3n) {
  z-index: 3;
  margin-top: -1rem;
}

.mod__panel:nth-child(5n) {
  z-index: 4;
  grid-column: span 5;
  margin-left: -1.2rem;
}

.mod__body {
  position: relative;
  z-index: 1;
}

.mod__img {
  display: block;
  width: 100%;
  /* 直式作品在寬欄位裡會長到一個視窗高，壓上限讓一屏看得到多件 */
  max-height: 60vh;
  aspect-ratio: var(--ar);
  /* 不透明、正常混色、疊在模組之上：作品顏色不被外殼吃掉 */
  object-fit: cover;
  background: #ffffff;
}

.mod__label {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding-top: 0.6rem;
}

.mod__label-title {
  font-size: 0.86rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: #17161a;
}

.mod__label-sub,
.mod__label-year {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  color: #57544e;
}

/* 進場：模組先散在外面，再各自歸位咬合 */
@keyframes mod-settle {
  from {
    opacity: 0;
    transform: translate(-18px, 26px) scale(0.95);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@media (max-width: 899px) {
  .mod__wall {
    grid-template-columns: 1fr;
  }

  .mod__panel,
  .mod__panel:nth-child(2n),
  .mod__panel:nth-child(3n),
  .mod__panel:nth-child(5n) {
    grid-column: auto;
    margin-top: -1rem;
    margin-left: 0;
  }
}
</style>
