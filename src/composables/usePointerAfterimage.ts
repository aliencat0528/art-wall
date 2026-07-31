import { onBeforeUnmount, watch } from 'vue'
import { usePrefersReducedMotion } from '@/composables/useMediaQuery'
import { lerp } from '@/utils/motion'

/**
 * 游標殘像（MR-016）：兩顆錯位色圓以不同的延遲追著游標，停下來就散開淡出。
 *
 * 為什麼是兩顆而不是一顆：一顆只是「發光的滑鼠」，兩顆不同色、不同延遲才讀成
 * **套色沒對準的殘像**——這是 Risograph 疊印的物理，也是站名 Afterimage 的來源。
 *
 * 與 `usePointerParallax` 同樣寫 CSS 變數而不傳 props（理由見該檔），但寫的是
 * **視窗座標 px** 而非正規化值：殘像要精準黏在游標上，正規化再乘回去只會累積誤差。
 *
 * 只掛 `mousemove`：觸控裝置沒有游標，殘像在那裡沒有意義（也收不到事件）。
 */

/** 兩顆的追隨速度。差距要夠大才看得出是兩層，太接近會糊成一顆 */
const LEAD_EASE = 0.22
const LAG_EASE = 0.1

/** 停止移動多久後淡出。太短會在慢慢移動時一閃一閃 */
const IDLE_MS = 700

export function usePointerAfterimage(): void {
  const reducedMotion = usePrefersReducedMotion()

  let targetX = 0
  let targetY = 0
  let leadX = 0
  let leadY = 0
  let lagX = 0
  let lagY = 0
  let lastMove = 0
  let frame = 0
  let running = false

  function write(name: string, value: string): void {
    document.documentElement.style.setProperty(name, value)
  }

  function tick(): void {
    leadX = lerp(leadX, targetX, LEAD_EASE)
    leadY = lerp(leadY, targetY, LEAD_EASE)
    lagX = lerp(lagX, targetX, LAG_EASE)
    lagY = lerp(lagY, targetY, LAG_EASE)

    write('--trail-ax', `${leadX.toFixed(1)}px`)
    write('--trail-ay', `${leadY.toFixed(1)}px`)
    write('--trail-bx', `${lagX.toFixed(1)}px`)
    write('--trail-by', `${lagY.toFixed(1)}px`)

    const idle = performance.now() - lastMove > IDLE_MS
    write('--trail-on', idle ? '0' : '1')

    // 追上了而且游標已經停著，就把 rAF 收掉——不留常駐迴圈在背景空轉
    const settled = Math.hypot(targetX - lagX, targetY - lagY) < 0.5
    if (idle && settled) {
      running = false
      frame = 0
      return
    }
    frame = requestAnimationFrame(tick)
  }

  function start(): void {
    if (running) return
    running = true
    frame = requestAnimationFrame(tick)
  }

  function onMove(event: MouseEvent): void {
    targetX = event.clientX
    targetY = event.clientY
    lastMove = performance.now()
    start()
  }

  function onLeave(): void {
    lastMove = 0
    start()
  }

  function unbind(): void {
    window.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseleave', onLeave)
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    running = false
    write('--trail-on', '0')
  }

  // 與 usePointerParallax 一致：減少動態時完全不掛監聽，而不是掛了再忽略
  watch(
    () => !reducedMotion.value,
    (on) => {
      if (on) {
        window.addEventListener('mousemove', onMove, { passive: true })
        document.addEventListener('mouseleave', onLeave)
      } else {
        unbind()
      }
    },
    { immediate: true },
  )

  onBeforeUnmount(unbind)
}
