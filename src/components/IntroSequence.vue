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

.door--a {
  clip-path: polygon(0 0, 100% 0, 100% 100%);
}

.door--b {
  clip-path: polygon(0 0, 100% 100%, 0 100%);
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

.intro__title {
  position: relative;
  text-align: center;
  mix-blend-mode: multiply;
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
