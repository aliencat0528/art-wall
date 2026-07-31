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

const DURATION = 3400
const leaving = ref(false)
const skipButton = ref<HTMLButtonElement | null>(null)
let autoTimer: number | undefined
let leaveTimer: number | undefined

function finish() {
  if (leaving.value) return
  leaving.value = true
  leaveTimer = window.setTimeout(() => emit('done'), 520)
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
  background: var(--bg);
  transition: opacity 480ms ease, transform 480ms ease;
}

.intro.is-leaving {
  opacity: 0;
  transform: translateY(-1.5rem);
  pointer-events: none;
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
