import { computed, onBeforeUnmount, ref, type Ref } from 'vue'

/**
 * 詳情頁的放大與平移（MR-015）。
 *
 * 桌機：滾輪／觸控板縮放（以游標為錨）、雙擊在 fit ↔ 上限之間切換、放大後拖移。
 * 手機：雙指縮放；單指在未放大時仍然捲動面板，放大後才改由這裡接管拖移
 * ——面板本身是 `overflow-y: auto`，單指若一律吃掉，作品的文字區就捲不到了。
 *
 * 拖曳刻意用 mouse 事件而非 `setPointerCapture`：MR-014 在長廊踩過，
 * 指標捕獲會把後續 click 改派給捕獲元素，作品全部點不開。滑鼠與觸控分兩套處理，
 * 從結構上就不會再碰到那個陷阱。
 *
 * 放大上限＝原圖像素 1:1。詳情用圖長邊 1800px（`utils/image.ts`），
 * 超過 1:1 只是在放大 JPEG 的壓縮痕跡，不會多出任何筆觸。
 */

/** 上限的保險絲：小圖（或還沒載完的圖）不該被放到破格 */
const SCALE_CAP = 8

/** 低於此倍率就當作「這張圖不值得放大」——游標不變、手勢完全不接管 */
const MIN_ZOOMABLE = 1.05

/** 拖曳的死區：低於此像素數視為點擊而非拖移 */
const DRAG_SLOP = 4

/** 滾輪一格轉成縮放倍率的靈敏度。deltaMode 為「行」時另外換算 */
const WHEEL_SENSITIVITY = 0.002
const LINE_HEIGHT_PX = 16

/** 原圖像素 ÷ 版面上的顯示尺寸＝還能放大幾倍。算不出來時回 1（＝不給放大） */
export function maxScaleFor(naturalSize: number, renderedSize: number): number {
  if (naturalSize <= 0 || renderedSize <= 0) return 1
  return Math.min(SCALE_CAP, Math.max(1, naturalSize / renderedSize))
}

export function clampScale(scale: number, max: number): number {
  return Math.min(Math.max(scale, 1), Math.max(1, max))
}

/**
 * 平移的可動範圍：圖放大後溢出視窗的那一半就是能拖的距離。
 * 沒溢出（例如直式圖的左右）則鎖在中央，避免把作品拖出畫面外變成空白。
 */
export function clampOffset(offset: number, scaledSize: number, viewportSize: number): number {
  const slack = Math.max(0, (scaledSize - viewportSize) / 2)
  return Math.min(Math.max(offset, -slack), slack)
}

/**
 * 以指標為錨的縮放：讓指標底下的那一點在縮放前後停在原地。
 * `pointer` 與 `offset` 都以視窗中心為原點，`ratio` 為新舊倍率之比。
 */
export function anchorOffset(offset: number, pointer: number, ratio: number): number {
  return pointer - (pointer - offset) * ratio
}

interface Point {
  x: number
  y: number
}

export function useImageZoom(
  viewport: Ref<HTMLElement | null>,
  image: Ref<HTMLImageElement | null>,
) {
  const scale = ref(1)
  const offset = ref<Point>({ x: 0, y: 0 })
  const maxScale = ref(1)
  const dragging = ref(false)

  const zoomable = computed(() => maxScale.value >= MIN_ZOOMABLE)
  const zoomed = computed(() => scale.value > 1.001)

  let dragOrigin: Point | null = null
  let dragStart: Point = { x: 0, y: 0 }
  let dragged = false
  let pinchDistance = 0
  let pinchMid: Point | null = null

  /** 版面尺寸。`offsetWidth` 取的是佈局尺寸，不受 transform 影響，所以縮放中仍然可信 */
  function metrics() {
    const box = viewport.value
    const img = image.value
    if (!box || !img) return null
    return {
      viewW: box.clientWidth,
      viewH: box.clientHeight,
      baseW: img.offsetWidth,
      baseH: img.offsetHeight,
    }
  }

  /** 圖載完或視窗改變後重算上限。上限變小時把當前倍率一併收回範圍內 */
  function measure(): void {
    const size = metrics()
    const img = image.value
    if (!size || !img) return
    maxScale.value = maxScaleFor(img.naturalWidth, size.baseW)
    if (scale.value > maxScale.value) applyScale(maxScale.value, { x: 0, y: 0 })
    // 視窗變窄會讓可拖範圍縮小，舊的位移可能已經把作品推到框外
    offset.value = clampBoth(offset.value, scale.value)
  }

  function clampBoth(next: Point, atScale: number): Point {
    const size = metrics()
    if (!size) return next
    return {
      x: clampOffset(next.x, size.baseW * atScale, size.viewW),
      y: clampOffset(next.y, size.baseH * atScale, size.viewH),
    }
  }

  /** 縮放到 `next`，並把 `pointer`（相對視窗中心）底下那一點釘住 */
  function applyScale(next: number, pointer: Point): void {
    const target = clampScale(next, maxScale.value)
    if (target === scale.value) return

    if (target === 1) {
      scale.value = 1
      offset.value = { x: 0, y: 0 }
      return
    }

    const ratio = target / scale.value
    scale.value = target
    offset.value = clampBoth(
      {
        x: anchorOffset(offset.value.x, pointer.x, ratio),
        y: anchorOffset(offset.value.y, pointer.y, ratio),
      },
      target,
    )
  }

  function reset(): void {
    scale.value = 1
    offset.value = { x: 0, y: 0 }
    dragging.value = false
    dragOrigin = null
  }

  /** 把座標換算成「以視窗中心為原點」，縮放的錨點與拖移都吃這個座標系 */
  function toCentre(clientX: number, clientY: number): Point {
    const box = viewport.value
    if (!box) return { x: 0, y: 0 }
    const rect = box.getBoundingClientRect()
    return { x: clientX - (rect.left + rect.width / 2), y: clientY - (rect.top + rect.height / 2) }
  }

  function onWheel(event: WheelEvent): void {
    if (!zoomable.value) return
    // 不擋掉的話，面板（overflow-y: auto）會邊縮放邊捲動
    event.preventDefault()
    const delta = event.deltaMode === 1 ? event.deltaY * LINE_HEIGHT_PX : event.deltaY
    const factor = Math.exp(-delta * WHEEL_SENSITIVITY)
    applyScale(scale.value * factor, toCentre(event.clientX, event.clientY))
  }

  function onDoubleClick(event: MouseEvent): void {
    if (!zoomable.value) return
    event.preventDefault()
    if (zoomed.value) reset()
    else applyScale(maxScale.value, toCentre(event.clientX, event.clientY))
  }

  function onMouseMove(event: MouseEvent): void {
    if (!dragOrigin) return
    const dx = event.clientX - dragOrigin.x
    const dy = event.clientY - dragOrigin.y
    if (!dragged && Math.hypot(dx, dy) < DRAG_SLOP) return
    dragged = true
    dragging.value = true
    offset.value = clampBoth({ x: dragStart.x + dx, y: dragStart.y + dy }, scale.value)
  }

  function onMouseUp(): void {
    dragOrigin = null
    dragging.value = false
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  function onMouseDown(event: MouseEvent): void {
    if (!zoomed.value || event.button !== 0) return
    // 擋掉瀏覽器內建的圖片拖曳（會冒出半透明鬼影並中斷拖移）
    event.preventDefault()
    dragOrigin = { x: event.clientX, y: event.clientY }
    dragStart = { ...offset.value }
    dragged = false
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  function touchMid(touches: TouchList): Point {
    return toCentre(
      (touches[0].clientX + touches[1].clientX) / 2,
      (touches[0].clientY + touches[1].clientY) / 2,
    )
  }

  function touchDistance(touches: TouchList): number {
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY,
    )
  }

  function onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 2 && zoomable.value) {
      pinchDistance = touchDistance(event.touches)
      pinchMid = touchMid(event.touches)
      return
    }
    if (event.touches.length === 1 && zoomed.value) {
      dragOrigin = { x: event.touches[0].clientX, y: event.touches[0].clientY }
      dragStart = { ...offset.value }
    }
  }

  function onTouchMove(event: TouchEvent): void {
    if (event.touches.length === 2 && pinchMid) {
      event.preventDefault()
      const distance = touchDistance(event.touches)
      const mid = touchMid(event.touches)
      if (pinchDistance > 0) applyScale(scale.value * (distance / pinchDistance), mid)
      // 雙指同時平移：中點的位移直接推著圖走
      offset.value = clampBoth(
        { x: offset.value.x + (mid.x - pinchMid.x), y: offset.value.y + (mid.y - pinchMid.y) },
        scale.value,
      )
      pinchDistance = distance
      pinchMid = mid
      return
    }

    if (event.touches.length !== 1 || !dragOrigin) return
    // 未放大時完全不攔截，單指仍然捲動面板（見檔頭）
    if (!zoomed.value) return
    event.preventDefault()
    dragging.value = true
    offset.value = clampBoth(
      {
        x: dragStart.x + (event.touches[0].clientX - dragOrigin.x),
        y: dragStart.y + (event.touches[0].clientY - dragOrigin.y),
      },
      scale.value,
    )
  }

  function onTouchEnd(event: TouchEvent): void {
    if (event.touches.length < 2) {
      pinchDistance = 0
      pinchMid = null
    }
    if (event.touches.length === 0) {
      dragOrigin = null
      dragging.value = false
    }
  }

  onBeforeUnmount(() => {
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  })

  return {
    scale,
    offset,
    zoomable,
    zoomed,
    dragging,
    measure,
    reset,
    onWheel,
    onDoubleClick,
    onMouseDown,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  }
}
