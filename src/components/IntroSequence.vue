<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * 開場序列：3.4 秒的幾何動畫後自動進站。
 *
 * 三條硬規則（MR-008）：Skip 永遠在、只播一次（localStorage）、
 * 系統設定為減少動態時完全不播（由 App 判斷，根本不掛載本元件）。
 * 作品牆在底下已經渲染完成，開場只是覆蓋層，不擋 LCP。
 */

const emit = defineEmits<{ done: [] }>()

/**
 * `DURATION` 是幾何動畫本身，`LEAVE` 是之後的開門。
 *
 * 從 3400 收到 2900：開門比原本的淡出長（520 → 900），不縮的話整段會從 3.9 秒
 * 變成 4.3 秒，等於為了轉場多擋使用者半秒。2900 剛好落在標題動畫結束（2850）之後，
 * 沒有截掉任何一段編排。現在全長 3.8 秒，比改之前還短一點。
 */
const DURATION = 2900
const LEAVE = 900
const leaving = ref(false)
const skipButton = ref<HTMLButtonElement | null>(null)
let autoTimer: number | undefined
let leaveTimer: number | undefined

/**
 * 消散的光點：沿門縫（主對角線）灑一排，離場時往垂直於門縫的方向散開。
 *
 * **每顆的 `delay + dur` 必須 ≤ `LEAVE`**。這是本專案已經踩過兩次的同一個坑
 * （走廊行進光帶、抵達脈衝）：整層在 `LEAVE` 之後就被卸載，動畫沒播完就
 * 連元素一起消失——讀起來是「粒子憑空不見」，不是「散掉」。
 * 現值最慢的一顆是 90 + 800 = 890ms，貼著 900 但不會被切到。
 */
const MOTE_COUNT = 24

const motes = Array.from({ length: MOTE_COUNT }, (_, index) => {
  // 沿對角線的位置，加一點抖動——等距排列會讀成一條虛線而不是灑出來的光。
  // 夾在 0～100：抖動會讓頭尾兩顆掉到畫面外（實測 -0.34vw），白灑一顆
  const jitter = (index + 0.5) / MOTE_COUNT + (Math.random() - 0.5) * 0.05
  const along = Math.min(Math.max(jitter, 0), 1) * 100
  // 兩側交替：一側跟著 A 門的方向 (1,-1)，另一側跟著 B 門 (-1,1)，顏色也分兩色。
  // 這樣粒子散開的方向跟門讓開的方向是同一組，看起來是被門「推出去」的
  const side = index % 2 === 0 ? 1 : -1
  const spread = 16 + Math.random() * 40
  return {
    x: `${along.toFixed(2)}vw`,
    y: `${along.toFixed(2)}vh`,
    dx: `${(side * spread).toFixed(2)}vw`,
    dy: `${(-side * spread).toFixed(2)}vh`,
    size: `${(2 + Math.random() * 5).toFixed(1)}px`,
    delay: `${Math.round(Math.random() * 90)}ms`,
    dur: `${Math.round(540 + Math.random() * 260)}ms`,
    tint: side > 0 ? 'var(--accent)' : 'var(--counter)',
  }
})

function finish() {
  if (leaving.value) return
  leaving.value = true
  leaveTimer = window.setTimeout(() => emit('done'), LEAVE)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') finish()
}

/**
 * **整層都可以點掉，不只那顆 Skip 按鈕。**
 *
 * 手機上那顆鈕只有 122×40，而開場覆蓋整個畫面——使用者的直覺是「點畫面跳過」，
 * 點在鈕以外的地方沒有反應，讀起來就是「跳過沒作用」。
 * 用 `pointerdown` 而不是 `click`：手機上 click 有延遲，而且若手指有些微移動
 * 會被判成拖曳而不觸發。
 */

onMounted(() => {
  autoTimer = window.setTimeout(finish, DURATION)
  window.addEventListener('keydown', onKeydown)
  skipButton.value?.focus()
})

onBeforeUnmount(() => {
  window.clearTimeout(autoTimer)
  window.clearTimeout(leaveTimer)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div
    class="intro"
    :class="{ 'is-leaving': leaving }"
    role="presentation"
    @pointerdown="finish"
  >
    <!--
      兩片門。**必須排在最前面**：底下所有元素都是 `z-index: auto` 的定位元素，
      疊放順序就是 DOM 順序，門排前面才會在幾何動畫與標題的下層。
      刻意不用 z-index——`.intro__title` 的 `mix-blend-mode` 需要跟門在同一個
      堆疊脈絡裡才混得到，給任何一層 z-index 都會切出新脈絡而讓混色失效。
    -->
    <span
      class="door door--a"
      aria-hidden="true"
    />
    <span
      class="door door--b"
      aria-hidden="true"
    />

    <!--
      門縫的兩道色光。**排在門之後**才會疊在門上（同樣靠 DOM 順序，不用 z-index）。
      兩道往相反方向退開＝同一道白光分成兩色，這就是「光分」；
      顏色沿用全站的 accent／counter 兩色套印語彙，不另開一組色。
    -->
    <span
      class="seam seam--a"
      aria-hidden="true"
    />
    <span
      class="seam seam--b"
      aria-hidden="true"
    />

    <span
      v-for="(mote, index) in motes"
      :key="`mote-${index}`"
      class="mote"
      aria-hidden="true"
      :style="{
        '--mote-x': mote.x,
        '--mote-y': mote.y,
        '--mote-dx': mote.dx,
        '--mote-dy': mote.dy,
        '--mote-s': mote.size,
        '--mote-delay': mote.delay,
        '--mote-dur': mote.dur,
        '--mote-tint': mote.tint,
      }"
    />

    <div
      class="intro__stage"
      aria-hidden="true"
    >
      <span class="rule rule--h" />
      <span class="rule rule--v" />
      <span class="frame frame--outer" />
      <span class="frame frame--inner" />
      <span class="dot" />
    </div>

    <div class="intro__title">
      <p class="intro__code">
        ART WALL
      </p>
      <p class="intro__label">
        作品牆
      </p>
    </div>

    <button
      ref="skipButton"
      type="button"
      class="intro__skip"
      @click="finish"
    >
      跳過開場
      <span class="intro__skip-key">ESC</span>
    </button>
  </div>
</template>

<style scoped>
.intro {
  position: fixed;
  inset: 0;
  /**
   * ⚠️ **`dvh` 不是可有可無的美化**——沒有它，跳過鈕在 iPhone 上按不到。
   *
   * iOS Safari 的 fixed 容器吃的是 **large viewport**（工具列收起時的高度），
   * 但畫面上實際看得到的是 small viewport。iPhone 12 實測差 126px，
   * 而跳過鈕貼在容器下緣往上 16px——算下來鈕的底邊落在可見區**下方 110px**，
   * 整顆藏在 Safari 的工具列底下。使用者按到的是瀏覽器，不是這顆鈕，
   * 於是「跳過開場沒有反應」。桌機一路都正常，所以先前查不出來。
   *
   * `100dvh` 取的是**當下真的看得到**的高度。`100vh` 那行留著給不支援 dvh 的舊瀏覽器。
   * 這一層跟 `App.vue`／`main.css` 的 `min-height` 是同一個病，要一起改。
   */
  height: 100vh;
  height: 100dvh;
  z-index: 100;
  display: grid;
  place-items: center;
  /* 底色搬到兩片門上——`.intro` 自己要是透明的，門滑開後才看得到底下的作品牆。
     兩片合起來就是原本那整面底色，開場期間看不出被切開 */
  background: transparent;
}

.intro.is-leaving {
  pointer-events: none;
}

/**
 * 斜對角開門。
 *
 * 沿**主對角線**（左上→右下）把整面底色切成兩個三角形，離場時各自往**另一條
 * 對角線**的兩端退開。往哪個方向移是唯一有意義的選擇：沿著切線推只是平移，
 * 縫不會變寬；垂直於切線推才會裂開，那個「兩扇門往兩邊讓開」的讀法就是從這裡來的。
 *
 * 90vw/90vh 是「保證退乾淨」的量：三角形最遠的角退到畫面外之後，
 * 任何長寬比下都不會有殘留（實測 430×932 與 1512×807 兩端都乾淨）。
 */
.door {
  position: absolute;
  /* 多出來的 1px 蓋掉視窗邊緣的抗鋸齒縫 */
  inset: -1px;
  background: var(--bg);
  transition: transform 740ms cubic-bezier(0.7, 0, 0.3, 1);
  will-change: transform;
}

/**
 * 兩片門各帶一色，不再是兩片一樣的黑。
 *
 * 疊層順序是「色光在上、`var(--bg)` 在下」：底那層必須留著且不透明，
 * 門是遮住作品牆的簾子，透了就在開場就先劇透整面牆。
 *
 * 漸層方向用 `to top right`：CSS 對這個關鍵字的定義會讓等色線平行於
 * **左上→右下**那條對角線，也就是門縫本身。所以光是沿著縫發亮的，
 * 不是隨便打一片顏色——縫在哪，色就在哪。
 */
.door--a {
  clip-path: polygon(0 0, 100% 0, 100% 100%);
  background:
    linear-gradient(
      to top right,
      color-mix(in srgb, var(--accent) 20%, transparent) 42%,
      transparent 64%
    ),
    var(--bg);
}

.door--b {
  clip-path: polygon(0 0, 100% 100%, 0 100%);
  background:
    linear-gradient(
      to bottom left,
      color-mix(in srgb, var(--counter) 18%, transparent) 42%,
      transparent 64%
    ),
    var(--bg);
}

/**
 * ── 光分 ───────────────────────────────────────────────
 *
 * 兩道貼著門縫的細光帶，離場時往**兩片門各自的方向**退開。
 * 一道白光被稜鏡分成兩色、兩色再分開——這是整段離場的主視覺，
 * 門讓開只是它的載體。
 *
 * `screen` 而不是實心色：暗場裡光是加成的，實心色會變成兩條貼紙。
 * 820ms < LEAVE(900)，同上：不能被卸載切掉。
 */
.seam {
  position: absolute;
  inset: 0;
  opacity: 0;
  mix-blend-mode: screen;
  pointer-events: none;
}

.seam--a {
  --seam-dx: 15vw;
  --seam-dy: -15vh;

  background: linear-gradient(
    to top right,
    transparent 46%,
    color-mix(in srgb, var(--accent) 78%, transparent) 50%,
    transparent 54%
  );
}

.seam--b {
  --seam-dx: -15vw;
  --seam-dy: 15vh;

  background: linear-gradient(
    to top right,
    transparent 46%,
    color-mix(in srgb, var(--counter) 72%, transparent) 50%,
    transparent 54%
  );
}

.intro.is-leaving .seam {
  animation: seam-split 820ms cubic-bezier(0.7, 0, 0.3, 1) forwards;
}

@keyframes seam-split {
  0% {
    opacity: 0;
    transform: translate(0, 0);
  }
  20% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(var(--seam-dx), var(--seam-dy));
  }
}

/**
 * ── 粒子消散 ────────────────────────────────────────────
 *
 * 位置與散開方向都由 JS 灑好寫進自訂屬性（見 script 的 `motes`），
 * 這裡只負責怎麼動。`margin` 收半個尺寸是把 `--mote-x/y` 當成**中心點**用，
 * 不然小顆與大顆會各自對齊左上角、排不到同一條縫上。
 */
.mote {
  position: absolute;
  top: 0;
  left: 0;
  width: var(--mote-s);
  height: var(--mote-s);
  margin: calc(var(--mote-s) / -2);
  border-radius: 50%;
  background: var(--mote-tint);
  opacity: 0;
  mix-blend-mode: screen;
  pointer-events: none;
}

.intro.is-leaving .mote {
  animation: mote-scatter var(--mote-dur) cubic-bezier(0.2, 0.6, 0.3, 1)
    var(--mote-delay) forwards;
}

@keyframes mote-scatter {
  0% {
    opacity: 0;
    transform: translate3d(var(--mote-x), var(--mote-y), 0) scale(0.3);
  }
  18% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate3d(
        calc(var(--mote-x) + var(--mote-dx)),
        calc(var(--mote-y) + var(--mote-dy)),
        0
      )
      scale(1);
  }
}

.intro.is-leaving .door--a {
  transform: translate(90vw, -90vh);
}

.intro.is-leaving .door--b {
  transform: translate(-90vw, 90vh);
}

/* 門一開始退，畫面上的東西就先讓開——幾何動畫與標題留在原地會擋住剛露出的作品牆 */
.intro.is-leaving .intro__stage,
.intro.is-leaving .intro__title,
.intro.is-leaving .intro__skip {
  opacity: 0;
  transition: opacity 200ms ease;
}

.intro__stage {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

/* 掃過畫面的細線：數位幾何感的骨架 */
.rule {
  position: absolute;
  background: var(--line-strong);
}

.rule--h {
  top: 50%;
  left: 0;
  width: 100%;
  height: 1px;
  transform: scaleX(0);
  transform-origin: left center;
  animation: sweep-x 900ms cubic-bezier(0.65, 0, 0.35, 1) forwards;
}

.rule--v {
  top: 0;
  left: 50%;
  width: 1px;
  height: 100%;
  transform: scaleY(0);
  transform-origin: center top;
  animation: sweep-y 900ms cubic-bezier(0.65, 0, 0.35, 1) 180ms forwards;
}

@keyframes sweep-x {
  to {
    transform: scaleX(1);
  }
}

@keyframes sweep-y {
  to {
    transform: scaleY(1);
  }
}

.frame {
  position: absolute;
  top: 50%;
  left: 50%;
  border: 1px solid var(--ink);
  opacity: 0;
}

.frame--outer {
  width: min(52vmin, 420px);
  height: min(52vmin, 420px);
  animation: frame-in 1400ms cubic-bezier(0.16, 1, 0.3, 1) 620ms forwards;
}

.frame--inner {
  width: min(26vmin, 210px);
  height: min(26vmin, 210px);
  border-color: var(--accent);
  animation: frame-in 1400ms cubic-bezier(0.16, 1, 0.3, 1) 900ms forwards;
}

@keyframes frame-in {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(-14deg) scale(0.7);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) rotate(0deg) scale(1);
  }
}

.dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 10px;
  height: 10px;
  background: var(--accent);
  transform: translate(-50%, -50%) scale(0);
  animation: dot-in 700ms cubic-bezier(0.34, 1.4, 0.64, 1) 1400ms forwards;
}

@keyframes dot-in {
  to {
    transform: translate(-50%, -50%) scale(1);
  }
}

/**
 * `screen`，不是 `multiply`。
 *
 * **`multiply` 是 bug，不是風格**：那是 v1 白底時期留下來的，MR-014 把站台整個
 * 翻成暗場之後沒有跟著改。近白的 `--ink` 乘上近黑的門色＝黑，於是整組
 * 「ART WALL／作品牆」在暗底上是黑字黑底，**從 MR-014 起就沒有真的顯示過**
 * （截圖裡只剩一點抗鋸齒的灰邊，所以一直沒被當成缺字回報）。
 * 暗場要的是加成：`screen` 讓白字浮在門上，這才是原本想要的效果。
 */
.intro__title {
  position: relative;
  text-align: center;
  mix-blend-mode: screen;
}

.intro__code {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  color: var(--ink-soft);
  opacity: 0;
  animation: title-in 800ms ease 1700ms forwards;
}

.intro__label {
  margin-top: 0.4rem;
  font-size: clamp(1.6rem, 5vw, 2.6rem);
  font-weight: 600;
  letter-spacing: 0.5em;
  text-indent: 0.5em;
  color: var(--ink);
  /* 字自己也分一次色：兩色往左右各偏一點點，跟門縫那道光同一個語彙。
     偏移量只有 0.04em——再大就從「色差」變成「疊字」，字先讀不清楚 */
  text-shadow:
    -0.04em 0 color-mix(in srgb, var(--counter) 55%, transparent),
    0.04em 0 color-mix(in srgb, var(--accent) 55%, transparent);
  opacity: 0;
  animation: title-in 900ms cubic-bezier(0.16, 1, 0.3, 1) 1950ms forwards;
}

@keyframes title-in {
  from {
    opacity: 0;
    transform: translateY(0.6rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.intro__skip {
  position: absolute;
  right: clamp(1rem, 4vw, 2.5rem);
  bottom: clamp(1rem, 4vw, 2.5rem);
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  /* 44px 是可觸控目標的下限（Apple HIG／WCAG 2.5.5）。原本只有 40 高，
     配上「整層都可以點掉」還算勉強，但這顆是唯一有明示的出口，不該讓人按空 */
  min-height: 44px;
  padding: 0.55rem 0.9rem;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  color: var(--ink-soft);
  background: transparent;
  border: 1px solid var(--line-strong);
  cursor: pointer;
  transition: color 200ms var(--ease), border-color 200ms var(--ease);
}

.intro__skip:hover,
.intro__skip:focus-visible {
  color: var(--ink);
  border-color: var(--ink);
}

.intro__skip-key {
  padding: 0.1rem 0.3rem;
  font-size: 0.62rem;
  color: var(--ink-faint);
  border: 1px solid var(--line);
}
</style>
