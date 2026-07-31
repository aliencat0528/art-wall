import { computed, ref } from 'vue'
import type { Exhibition, FilterId, Work } from '@/types'
import { useLibrary } from '@/composables/useLibrary'

/**
 * 作品牆狀態：兩種瀏覽模式（依媒材＝分類篩選、依展覽＝有序策展），
 * 詳情頁選取，並與網址同步。
 *
 * 網址帶狀態的理由：分類、展覽與單件作品都要能被分享（招募端可直接連到某一類或某個
 * 展覽動線），且開啟詳情頁走 pushState，瀏覽器上一頁＝關閉詳情，符合直覺。
 *
 * 兩模式正交（MR-012 ①）：分類是無序篩選（帶主題口音），展覽是有序動線（前言 + workIds
 * 順序）。進展覽模式時 activeCategory 設回 all，外觀層（useAppearance）自然回中性——
 * 展覽跨媒材，不綁單一分類的顏色。
 */

type ViewMode = 'category' | 'exhibition'

/**
 * 版面：牆面（長廊／網格）或走廊（第一人稱，MR-017）。
 *
 * **與 `viewMode` 正交，不是第三個 viewMode**——走廊裡照樣可以是依媒材或依展覽，
 * 篩選與呈現是兩件事。合成一個列舉會逼出「走廊＋展覽」這種答不出的組合。
 * UI 上三顆鈕並排只是視覺分組，狀態上是兩個軸。
 */
type Layout = 'wall' | 'hall'

const viewMode = ref<ViewMode>('category')
const layout = ref<Layout>('wall')
const activeCategory = ref<FilterId>('all')
const activeExhibitionId = ref<string | null>(null)
const selectedId = ref<string | null>(null)

const { allWorks, categories, exhibitions } = useLibrary()

const activeExhibition = computed<Exhibition | null>(
  () => exhibitions.value.find((exhibition) => exhibition.id === activeExhibitionId.value) ?? null,
)

const filteredWorks = computed<Work[]>(() => {
  if (viewMode.value === 'exhibition') {
    const exhibition = activeExhibition.value
    if (!exhibition) return []
    // 依 workIds 順序取作品；已刪除的 id 直接略過，不留空洞
    return exhibition.workIds
      .map((id) => allWorks.value.find((work) => work.id === id))
      .filter((work): work is Work => Boolean(work))
  }
  return activeCategory.value === 'all'
    ? allWorks.value
    : allWorks.value.filter((work) => work.category === activeCategory.value)
})

// 找不到就是 null——自訂作品的深連結在 IndexedDB 載完前會短暫落在這裡，屬正常
const selectedWork = computed<Work | null>(
  () => allWorks.value.find((work) => work.id === selectedId.value) ?? null,
)

/** 詳情頁的上／下一件，範圍限定在目前篩選（或展覽動線）內 */
const selectedIndex = computed(() =>
  filteredWorks.value.findIndex((work) => work.id === selectedId.value),
)

/** 換卡片重播動畫用的 key：模式 + 當前分類／展覽 */
const railKey = computed(() =>
  viewMode.value === 'exhibition' ? `ex:${activeExhibitionId.value ?? ''}` : `cat:${activeCategory.value}`,
)

function buildUrl(): string {
  const params = new URLSearchParams()
  if (viewMode.value === 'exhibition') {
    params.set('m', 'ex')
    if (activeExhibitionId.value) params.set('ex', activeExhibitionId.value)
  } else if (activeCategory.value !== 'all') {
    params.set('c', activeCategory.value)
  }
  if (layout.value === 'hall') params.set('v', 'hall')
  if (selectedId.value) params.set('w', selectedId.value)
  // `intro` 不屬於瀏覽狀態，但要跟著留在網址上——否則進站關掉開場後，
  // 切一次分類就把旗標洗掉，下次 reload 開場又冒出來（E2E 與現場展示都會踩到）
  const intro = new URLSearchParams(window.location.search).get('intro')
  if (intro !== null) params.set('intro', intro)
  const query = params.toString()
  return `${window.location.pathname}${query ? `?${query}` : ''}`
}

function readUrl(): void {
  const params = new URLSearchParams(window.location.search)
  if (params.get('m') === 'ex') {
    viewMode.value = 'exhibition'
    const exhibition = params.get('ex')
    activeExhibitionId.value =
      exhibition && exhibitions.value.some((item) => item.id === exhibition) ? exhibition : null
    activeCategory.value = 'all'
  } else {
    viewMode.value = 'category'
    activeExhibitionId.value = null
    const category = params.get('c')
    // 分類已可自訂，改以合併清單即時驗證，而非寫死的集合
    const known = !!category && categories.value.some((item) => item.id === category)
    activeCategory.value = known ? (category as FilterId) : 'all'
  }
  layout.value = params.get('v') === 'hall' ? 'hall' : 'wall'
  selectedId.value = params.get('w')
}

export function useGallery() {
  function setCategory(id: FilterId): void {
    if (viewMode.value === 'category' && activeCategory.value === id) return
    viewMode.value = 'category'
    activeExhibitionId.value = null
    activeCategory.value = id
    // 切換時關閉詳情，避免停在一件不屬於新範圍的作品上
    selectedId.value = null
    window.history.replaceState(null, '', buildUrl())
  }

  /** 切換「依媒材／依展覽」。進展覽模式時，沒有選定展覽就自動選第一個 */
  function setMode(mode: ViewMode): void {
    if (viewMode.value === mode) return
    viewMode.value = mode
    selectedId.value = null
    if (mode === 'exhibition') {
      activeCategory.value = 'all'
      if (!activeExhibitionId.value && exhibitions.value.length > 0) {
        activeExhibitionId.value = exhibitions.value[0].id
      }
    } else {
      activeExhibitionId.value = null
    }
    window.history.replaceState(null, '', buildUrl())
  }

  /**
   * 切牆面／走廊。**篩選狀態一律保留**——切呈現方式不該把使用者選的分類洗掉，
   * 這與 `setMode`（切篩選軸，要清掉另一軸）刻意不同。
   */
  function setLayout(next: Layout): void {
    if (layout.value === next) return
    layout.value = next
    // 詳情頁關掉：走廊與牆面的「上一件／下一件」是同一份清單，但停在詳情頁上切版面
    // 會讓使用者切完看不到任何變化，誤以為沒作用
    selectedId.value = null
    window.history.replaceState(null, '', buildUrl())
  }

  function setExhibition(id: string): void {
    viewMode.value = 'exhibition'
    activeCategory.value = 'all'
    activeExhibitionId.value = id
    selectedId.value = null
    window.history.replaceState(null, '', buildUrl())
  }

  function openWork(id: string): void {
    selectedId.value = id
    window.history.pushState(null, '', buildUrl())
  }

  function closeWork(): void {
    if (!selectedId.value) return
    // 交給 popstate 收尾，讓「關閉」與瀏覽器上一頁是同一件事
    window.history.back()
  }

  /** step 為 +1／-1，在目前範圍（分類篩選或展覽動線）內循環 */
  function stepWork(step: number): void {
    const list = filteredWorks.value
    if (list.length === 0 || selectedIndex.value < 0) return
    const next = (selectedIndex.value + step + list.length) % list.length
    selectedId.value = list[next].id
    window.history.replaceState(null, '', buildUrl())
  }

  return {
    categories,
    exhibitions,
    viewMode,
    layout,
    activeCategory,
    activeExhibitionId,
    activeExhibition,
    filteredWorks,
    selectedWork,
    railKey,
    setCategory,
    setMode,
    setLayout,
    setExhibition,
    openWork,
    closeWork,
    stepWork,
    syncFromUrl: readUrl,
  }
}
