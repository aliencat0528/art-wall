import { onBeforeUnmount, watch } from 'vue'
import { usePrefersReducedMotion } from '@/composables/useMediaQuery'

/**
 * 游標視差（MR-014）：把游標位置正規化成 `--mx` / `--my`（皆為 -1～1）寫進 :root。
 *
 * 為什麼寫 CSS 變數而不傳 props：吃這兩個值的有光氛層、長廊、卡片三處，
 * 用 props 串下去等於為了兩個數字把三層元件的介面都改掉；而視差本來就是
 * 「整個空間一起偏」的效果，放在根節點才對得上它的語意。
 *
 * 光與塵反向走、作品微幅偏轉，兩者差速才讀得出空氣有厚度（見各元件的 transform）。
 */
export function usePointerParallax(): void {
  const reducedMotion = usePrefersReducedMotion()
  let frame = 0

  function write(x: number, y: number): void {
    const root = document.documentElement.style
    root.setProperty('--mx', x.toFixed(3))
    root.setProperty('--my', y.toFixed(3))
  }

  /** rAF 節流：mousemove 每秒可上百次，實際只需每一帧算一次 */
  function onMove(event: MouseEvent): void {
    const x = (event.clientX / window.innerWidth) * 2 - 1
    const y = (event.clientY / window.innerHeight) * 2 - 1
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      write(x, y)
    })
  }

  function onLeave(): void {
    write(0, 0)
  }

  function unbind(): void {
    window.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseleave', onLeave)
    if (frame) {
      cancelAnimationFrame(frame)
      frame = 0
    }
    // 歸零，否則整個空間會停在最後一次偏移的姿勢
    write(0, 0)
  }

  // 系統要求減少動態時完全不掛監聽（不是掛了再忽略）——那是最省的做法，
  // 而且設定可能在瀏覽中途改變，故用 watch 而非只在掛載時判斷一次
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
