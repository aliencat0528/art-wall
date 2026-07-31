<script setup lang="ts">
/**
 * 暗場光氛層（MR-014，源自原型方案 F）。
 *
 * 一句話：**亮度全部由「光源」給，不由底色給**。底色近黑（`--bg: #08080d`），
 * 這一層負責把光打進空間，光才發得出來。
 *
 * 六個要素各自對應一種真實展場的光學現象，都是純 CSS：
 *   1. 主光暈 `beam`——頂部的環境光，色相取自分類 accent，極緩慢呼吸
 *   2. 體積光 `shaft`——斜切的光柱（丁達爾效應）。重點是光「有邊界」，故 blur 給得保守
 *   3. 浮塵 `dust`——兩層不同磚距與速度的亮點，差速才讀成「空氣有厚度」
 *   4. 低處霧氣 `fog`——貼著地面堆積，作品下半沉進去
 *   5. 掃描光 `sweep`——切換分類時掃一次，之後定時再掃，維持「這個空間是活的」
 *   6. 暗角 `vignette`——壓下邊緣，視線自然收到中間的作品
 *
 * MR-016 再加兩種，兩者都是 Risograph 疊印的機制而非裝飾：
 *   7. 疊印色場 `ink`——三顆半透明色圓各自漂移，重疊處自己混出第三個顏色
 *   8. 游標殘像 `trail`——兩顆不同色、不同延遲的色圓追著游標，停下就散開
 *
 * 為什麼暗場不違反 D-003／MR-008 的中性定調：美術館暗展廳本來就這樣做。
 * 關鍵是**光打在作品上、不打在背景上**——彩色光暈只出現在作品外圍與站頭，
 * 圖面本身不覆蓋任何色層。真正會吃掉作品顏色的是「背景鋪滿彩色」，不是「背景很暗」。
 *
 * 由 `App.vue` 常駐掛載（整站只有這一套呈現，MR-014）；游標視差吃 :root 的
 * `--mx` / `--my`（見 `usePointerParallax`），減少動態時那兩個值恆為 0，
 * 動畫另由 main.css 全域關掉。
 */

/** 切換分類／展覽時換掉 key，讓掃描光重播一次——等於重新打一次燈 */
defineProps<{ viewKey: string }>()

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

// 模組層級算一次就好：磚是固定的，跟分類與捲動位置都無關
const DUST_NEAR = dust('near', 340, 26, 1.5)
const DUST_FAR = dust('far', 220, 34, 0.8)
</script>

<template>
  <div
    :key="viewKey"
    class="atmo"
    :style="{ '--dust-near': DUST_NEAR, '--dust-far': DUST_FAR }"
    aria-hidden="true"
  >
    <span class="atmo__beam" />
    <span class="atmo__ink atmo__ink--a" />
    <span class="atmo__ink atmo__ink--b" />
    <span class="atmo__ink atmo__ink--c" />
    <span class="atmo__shaft atmo__shaft--a" />
    <span class="atmo__shaft atmo__shaft--b" />
    <span class="atmo__shaft atmo__shaft--c" />
    <span class="atmo__dust atmo__dust--far" />
    <span class="atmo__dust atmo__dust--near" />
    <span class="atmo__fog" />
    <span class="atmo__sweep atmo__sweep--cut" />
    <span class="atmo__sweep atmo__sweep--amb" />
    <span class="atmo__trail atmo__trail--b" />
    <span class="atmo__trail atmo__trail--a" />
    <span class="atmo__vignette" />
  </div>
</template>

<style scoped>
/* 整層鋪滿視窗且不吃事件。z-index -1：body 背景永遠畫在最底，
   負值子層仍在它之上、卻在所有內容之下——與 main.css 的紋理層同一招 */
.atmo {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}

.atmo__beam,
.atmo__dust,
.atmo__sweep,
.atmo__vignette {
  position: absolute;
  inset: 0;
}

/* 主光暈：頂部一道主光加兩道副光，色相取自分類 accent */
.atmo__beam {
  background:
    radial-gradient(
      70% 52% at 50% -8%,
      color-mix(in srgb, var(--accent) 46%, transparent),
      transparent 68%
    ),
    radial-gradient(
      46% 40% at 12% 8%,
      color-mix(in srgb, var(--accent) 22%, transparent),
      transparent 72%
    ),
    radial-gradient(58% 46% at 88% 22%, rgb(160 120 255 / 0.14), transparent 72%);
  transform: translate3d(calc(var(--mx, 0) * -26px), calc(var(--my, 0) * -16px), 0);
  transition: transform 320ms cubic-bezier(0.22, 1, 0.36, 1), background 620ms var(--ease);
  /* 呼吸：色相在 accent 附近極緩慢漂移。幅度壓在 ±20 度——再大就認不出
     這是哪個分類的顏色，分類識別會被氛圍吃掉（選這個效果時就知道的代價） */
  animation: atmo-breathe 26s ease-in-out infinite;
}

/* 疊印色場（MR-016）：三顆半透明色圓，各自不同週期地漂移與呼吸。
   screen＝光愈疊愈亮（暗場版的 multiply 疊印）；圓與圓重疊處自己混出第三個顏色，
   這就是 Risograph 兩色套印的機制。整層在 z-index -1，永遠在作品之下 */
.atmo__ink {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  mix-blend-mode: screen;
  will-change: transform;
}

.atmo__ink--a {
  top: -14%;
  left: -8%;
  width: 46vw;
  height: 46vw;
  background: radial-gradient(
    circle at 50% 50%,
    color-mix(in srgb, var(--accent) 34%, transparent),
    transparent 68%
  );
  transform: translate3d(calc(var(--mx, 0) * -30px), calc(var(--my, 0) * -18px), 0);
  animation: atmo-ink-a 34s ease-in-out infinite alternate;
}

/* 第二版刻意偏移一點：套色沒對準才是疊印，對齊了就只是一團光 */
.atmo__ink--b {
  top: -6%;
  left: 2%;
  width: 38vw;
  height: 38vw;
  background: radial-gradient(
    circle at 50% 50%,
    color-mix(in srgb, var(--counter) 30%, transparent),
    transparent 66%
  );
  transform: translate3d(calc(var(--mx, 0) * -18px), calc(var(--my, 0) * -10px), 0);
  animation: atmo-ink-b 41s ease-in-out infinite alternate;
}

.atmo__ink--c {
  right: -12%;
  bottom: -18%;
  width: 52vw;
  height: 52vw;
  background: radial-gradient(
    circle at 50% 50%,
    color-mix(in srgb, var(--accent) 22%, transparent),
    transparent 70%
  );
  transform: translate3d(calc(var(--mx, 0) * 24px), calc(var(--my, 0) * 14px), 0);
  animation: atmo-ink-c 47s ease-in-out infinite alternate;
}

/* 游標殘像：兩顆不同色、不同延遲的色圓（座標由 usePointerAfterimage 寫成 CSS 變數）。
   `--trail-on` 在游標停住 0.7 秒後歸零，色圓淡出——殘像本來就該散掉 */
.atmo__trail {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: 50%;
  opacity: calc(var(--trail-on, 0) * 1);
  filter: blur(42px);
  mix-blend-mode: screen;
  transition: opacity 620ms ease;
  will-change: transform;
}

.atmo__trail--a {
  width: 17rem;
  height: 17rem;
  background: radial-gradient(
    circle at 50% 50%,
    color-mix(in srgb, var(--accent) 40%, transparent),
    transparent 64%
  );
  transform: translate3d(
    calc(var(--trail-ax, 50vw) - 8.5rem),
    calc(var(--trail-ay, 50vh) - 8.5rem),
    0
  );
}

.atmo__trail--b {
  width: 21rem;
  height: 21rem;
  background: radial-gradient(
    circle at 50% 50%,
    color-mix(in srgb, var(--counter) 32%, transparent),
    transparent 66%
  );
  transform: translate3d(
    calc(var(--trail-bx, 50vw) - 10.5rem),
    calc(var(--trail-by, 50vh) - 10.5rem),
    0
  );
}

/* 體積光：柱體本身要看得見輪廓，不能整片糊掉 */
.atmo__shaft {
  position: absolute;
  top: -30%;
  height: 150%;
  background: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--accent) 34%, transparent),
    color-mix(in srgb, var(--accent) 10%, transparent) 42%,
    transparent 78%
  );
  filter: blur(22px);
  mix-blend-mode: screen;
  transition: background 620ms ease;
}

.atmo__shaft--a {
  left: 4%;
  width: 15vw;
  opacity: 0.72;
  transform: skewX(-15deg) translate3d(calc(var(--mx, 0) * -34px), 0, 0);
  animation: atmo-shaft 13s ease-in-out infinite;
}

.atmo__shaft--b {
  left: 38%;
  width: 22vw;
  opacity: 0.5;
  transform: skewX(9deg) translate3d(calc(var(--mx, 0) * -22px), 0, 0);
  animation: atmo-shaft 17s ease-in-out 2s infinite;
}

.atmo__shaft--c {
  right: 8%;
  width: 12vw;
  opacity: 0.4;
  transform: skewX(-22deg) translate3d(calc(var(--mx, 0) * -42px), 0, 0);
  animation: atmo-shaft 21s ease-in-out 5s infinite;
}

/* 霧要慢到幾乎察覺不到在動，一快就變成煙霧特效 */
.atmo__fog {
  position: absolute;
  inset: auto 0 0 0;
  height: 52%;
  background:
    radial-gradient(
      64% 100% at 18% 108%,
      color-mix(in srgb, var(--accent) 26%, transparent),
      transparent 72%
    ),
    radial-gradient(52% 100% at 74% 112%, rgb(174 156 255 / 0.16), transparent 74%),
    linear-gradient(to top, rgb(236 233 242 / 0.07), transparent 68%);
  filter: blur(34px);
  mix-blend-mode: screen;
  animation: atmo-fog 38s ease-in-out infinite alternate;
}

.atmo__sweep {
  background: linear-gradient(
    100deg,
    transparent 42%,
    color-mix(in srgb, var(--accent) 30%, rgb(255 255 255 / 0.22)) 50%,
    transparent 58%
  );
  filter: blur(3px);
  mix-blend-mode: screen;
}

/* 切換分類時掃一次——整層跟著 viewKey 重掛，動畫自然重播 */
.atmo__sweep--cut {
  animation: atmo-sweep 1250ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.atmo__sweep--amb {
  opacity: 0.5;
  animation: atmo-sweep 9s cubic-bezier(0.45, 0, 0.55, 1) 6s infinite;
}

/* 浮塵兩層：遠的細而慢，近的大而快 */
.atmo__dust--far {
  background-image: var(--dust-far);
  opacity: 0.5;
  transform: translate3d(calc(var(--mx, 0) * -10px), calc(var(--my, 0) * -6px), 0);
  animation: atmo-drift-far 46s linear infinite;
}

.atmo__dust--near {
  background-image: var(--dust-near);
  opacity: 0.62;
  transform: translate3d(calc(var(--mx, 0) * -22px), calc(var(--my, 0) * -14px), 0);
  animation: atmo-drift-near 28s linear infinite;
}

.atmo__vignette {
  background: radial-gradient(88% 70% at 50% 42%, transparent 34%, rgb(4 4 8 / 0.82) 100%);
}

/* 呼吸：亮度與色相一起走，只有亮度變化會像燈壞了，加上色相才像燈在調光 */
@keyframes atmo-breathe {
  0%,
  100% {
    opacity: 0.84;
    filter: blur(12px) hue-rotate(-20deg);
  }

  50% {
    opacity: 1;
    filter: blur(12px) hue-rotate(20deg);
  }
}

/* 色場漂移：位移幅度都在 6vw 以內，慢到像空間本身在呼吸而不是有東西在動。
   動的是 `translate` 這個獨立屬性而非 `transform`——元素上的 `transform` 要留給
   游標視差，寫進同一個屬性會被動畫整個蓋掉，視差就失效了。

   呼吸用 opacity 不用 scale：這幾層帶 60px 模糊，縮放會逼瀏覽器每帧重新光柵化
   整片模糊，位移與透明度則只是合成，成本差一個數量級 */
@keyframes atmo-ink-a {
  from {
    opacity: 0.82;
    translate: -3vw -2vh;
  }

  to {
    opacity: 1;
    translate: 4vw 3vh;
  }
}

@keyframes atmo-ink-b {
  from {
    opacity: 1;
    translate: 3vw 2vh;
  }

  to {
    opacity: 0.78;
    translate: -4vw -3vh;
  }
}

@keyframes atmo-ink-c {
  from {
    opacity: 0.9;
    translate: 2vw 3vh;
  }

  to {
    opacity: 1;
    translate: -5vw -2vh;
  }
}

@keyframes atmo-shaft {
  0%,
  100% {
    opacity: 0.32;
  }

  50% {
    opacity: 0.78;
  }
}

@keyframes atmo-fog {
  from {
    transform: translate3d(-4%, 0, 0);
  }

  to {
    transform: translate3d(4%, 0, 0);
  }
}

@keyframes atmo-sweep {
  from {
    transform: translate3d(-115%, 0, 0);
  }

  to {
    transform: translate3d(115%, 0, 0);
  }
}

@keyframes atmo-drift-far {
  from {
    background-position: 0 0;
  }

  to {
    background-position: 220px -220px;
  }
}

@keyframes atmo-drift-near {
  from {
    background-position: 0 0;
  }

  to {
    background-position: -340px -340px;
  }
}

/* 手機：光柱與浮塵在小螢幕上只剩雜訊，且是最耗 GPU 的兩層，直接關掉。
   主光暈、霧氣與暗角留著——氛圍的八成在這三層 */
@media (max-width: 599px) {
  .atmo__shaft,
  .atmo__dust,
  .atmo__sweep--amb,
  .atmo__ink--c {
    display: none;
  }
}

/* 殘像只在有游標的裝置出現。觸控裝置根本不會收到 mousemove，這條是保險：
   萬一有筆／滑鼠混用的裝置給了假事件，也不會在手機上多出兩顆常駐色圓 */
@media (hover: none) {
  .atmo__trail {
    display: none;
  }
}
</style>
