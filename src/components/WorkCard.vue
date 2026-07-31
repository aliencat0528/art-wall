<script setup lang="ts">
import { computed } from 'vue'
import type { Work } from '@/types'
import { categoryOf } from '@/data/categories'
import { useLibrary } from '@/composables/useLibrary'
import { ASPECT_RATIO } from '@/utils/placeholder'

/**
 * 牆面上的一件作品。
 *
 * 尺寸由 `aspect` 鎖死（aspect-ratio + object-fit: cover），圖片再大也不會撐破版面；
 * 縮圖只載 `thumb`，原圖留給詳情頁。
 *
 * 三層結構（MR-014 為了打燈而加的 `card__mount`）：
 *   `card__mount`（實體面板：外圍光暈、偏轉與退遠的載體）
 *     └ `card__frame`（切圖用，`overflow: hidden`）
 *     └ `card__reg`（疊印框，要能超出圖框外緣，故不能放在 frame 裡）
 *     └ `card__pool`（腳下的光池，同理）
 *
 * 打燈是唯一一套呈現（MR-014 起整站只有暗場光氛），故光學層直接掛在基礎樣式上，
 * 不再依背景旗標開關。
 */

const props = defineProps<{ work: Work }>()
const emit = defineEmits<{ open: [id: string] }>()

const { categories } = useLibrary()
const category = computed(() => categoryOf(props.work.category, categories.value))
const ratio = computed(() => ASPECT_RATIO[props.work.aspect])
</script>

<template>
  <button
    type="button"
    class="card"
    :style="{ '--ar': ratio }"
    :aria-label="`開啟作品：${work.title}`"
    @click="emit('open', work.id)"
  >
    <span class="card__mount">
      <span class="card__frame">
        <img
          class="card__image"
          :src="work.thumb"
          :alt="work.alt"
          :width="work.width"
          :height="work.height"
          loading="lazy"
          decoding="async"
        >
        <!-- 聚光：一道光斜打在作品上，亮部集中在上緣、下緣壓暗，光才有方向 -->
        <span
          class="card__spot"
          aria-hidden="true"
        />
        <span class="card__code">{{ category.code }}</span>
        <span class="card__hover">
          <span class="card__hover-media">{{ work.media.join(' · ') }}</span>
        </span>
      </span>

      <!-- 疊印框：兩道互補色光框往反方向錯位，相交處加成出白光＝沒對準的兩塊光版 -->
      <span
        class="card__reg card__reg--a"
        aria-hidden="true"
      />
      <span
        class="card__reg card__reg--b"
        aria-hidden="true"
      />

      <!-- 光池：腳下的一灘光。不複製作品內容（那是倒影），但一樣把作品放在地上 -->
      <span
        class="card__pool"
        aria-hidden="true"
      />
    </span>

    <span class="card__meta">
      <span class="card__title">{{ work.title }}</span>
      <span class="card__sub">{{ category.label }} · {{ work.year }}</span>
    </span>
  </button>
</template>

<style scoped>
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0;
  text-align: left;
  background: transparent;
  border: none;
  cursor: pointer;
}

/* 實體面板：疊印框與光池的定位基準，也是長廊景深的偏轉載體（transform 覆寫在 WorkRail）。
   外圍的彩色光暈打在這一層——作品圖面本身不覆蓋任何色層 */
.card__mount {
  position: relative;
  display: block;
  width: 100%;
  box-shadow: 0 0 90px -18px var(--accent), 0 34px 64px rgb(0 0 0 / 0.62);
  transition: box-shadow 520ms var(--ease);
}

.card__frame {
  position: relative;
  display: block;
  /* 網格模式：寬度由欄位決定，高度由比例推得。
     長廊模式反過來（高度給定、寬度推得），覆寫在 WorkRail.vue */
  width: 100%;
  overflow: hidden;
  aspect-ratio: var(--ar);
  background: var(--surface);
  /* 圖框自己的線刻意很淡：外框由兩道疊印光框給，三層框並置只會互相打架 */
  border: var(--card-border) solid color-mix(in srgb, var(--accent) 22%, transparent);
  border-radius: var(--card-radius);
  transition: border-color 320ms var(--ease), box-shadow 320ms var(--ease);
}

.card__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* 被打亮的物件本身要比未打光時亮一點，光才落得到實處 */
  filter: brightness(1.07) contrast(1.05);
  transition: transform 480ms var(--ease);
}

.card__code {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  padding: 0.12rem 0.34rem;
  font-family: var(--font-mono);
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  color: var(--accent);
  background: var(--bg);
  opacity: 0;
  transition: opacity 320ms var(--ease);
}

.card__hover {
  position: absolute;
  inset: auto 0 0 0;
  padding: 1.1rem 0.7rem 0.55rem;
  background: linear-gradient(to top, rgb(20 20 18 / 0.62), transparent);
  opacity: 0;
  transition: opacity 320ms var(--ease);
}

.card__hover-media {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  color: #fff;
}

.card:hover .card__frame,
.card:focus-visible .card__frame {
  border-color: var(--accent);
}

.card:hover .card__image,
.card:focus-visible .card__image {
  transform: scale(1.05);
}

.card:hover .card__code,
.card:focus-visible .card__code,
.card:hover .card__hover,
.card:focus-visible .card__hover {
  opacity: 1;
}

.card:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 6px;
}

.card__meta {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  /* 說明文字寬度跟隨卡片，長標題不會把卡片撐寬 */
  width: 100%;
  min-width: 0;
}

.card__title {
  overflow: hidden;
  font-size: 0.86rem;
  color: var(--ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card__sub {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  color: var(--ink-faint);
}

/* ---- 打燈：聚光、疊印框、光池 ---- */

.card__spot,
.card__reg,
.card__pool {
  pointer-events: none;
}

/* 光池只在長廊模式出現（開關在 WorkRail）：網格模式它會壓在說明文字上 */
.card__pool {
  display: none;
}

.card__spot {
  position: absolute;
  inset: 0;
  z-index: 1;
  background:
    radial-gradient(
      86% 58% at 50% -12%,
      color-mix(in srgb, var(--accent) 26%, rgb(255 255 255 / 0.34)),
      transparent 62%
    ),
    linear-gradient(
      var(--light, 168deg),
      rgb(255 255 255 / 0.1),
      transparent 38%,
      rgb(4 4 8 / 0.42)
    );
  /* screen＝光愈疊愈亮。作品圖本身不被覆蓋任何色層，只被「照亮」 */
  mix-blend-mode: screen;
}

.card__reg {
  position: absolute;
  inset: 0;
  z-index: 2;
  border: 1px solid;
  mix-blend-mode: screen;
  transition: transform 320ms var(--ease), border-color 620ms var(--ease);
}

.card__reg--a {
  border-color: var(--accent);
  box-shadow: 0 0 22px -6px var(--accent), inset 0 0 22px -10px var(--accent);
  transform: translate(-7px, -6px);
}

.card__reg--b {
  border-color: var(--counter);
  box-shadow: 0 0 22px -6px var(--counter), inset 0 0 22px -10px var(--counter);
  transform: translate(7px, 6px);
}

/* hover 時兩塊光版收攏對準——「套印失準 → 對準」的暗場版 */
.card:hover .card__reg,
.card:focus-visible .card__reg {
  transform: none;
}

.card__pool {
  position: absolute;
  inset: 100% 0 auto 0;
  height: 2.8rem;
  background: radial-gradient(
    50% 100% at 50% 0%,
    color-mix(in srgb, var(--accent) 42%, transparent),
    transparent 72%
  );
  filter: blur(7px);
  opacity: 0.75;
}

.card:hover .card__mount,
.card:focus-visible .card__mount {
  box-shadow: 0 0 130px -14px var(--accent), 0 44px 80px rgb(0 0 0 / 0.7);
}
</style>
