import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'

/**
 * useGallery 的狀態同樣是模組層 singleton，且它在載入時就抓了 useLibrary，
 * 所以要一起 resetModules。這裡不上傳圖片，維持內建作品即可。
 */
vi.mock('@/utils/image', () => ({
  processImage: vi.fn(),
  blobToDataUrl: vi.fn(),
  dataUrlToBlob: vi.fn(),
}))

async function freshGallery(search = '') {
  globalThis.indexedDB = new IDBFactory()
  window.history.replaceState(null, '', `/${search}`)
  vi.resetModules()
  const { useGallery } = await import('@/composables/useGallery')
  return useGallery()
}

const query = () => window.location.search

describe('useGallery', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory()
  })

  describe('分類篩選', () => {
    it('預設是 all，顯示全部作品', async () => {
      const gallery = await freshGallery()

      expect(gallery.activeCategory.value).toBe('all')
      expect(gallery.filteredWorks.value.length).toBeGreaterThan(0)
    })

    it('切分類後只剩該分類的作品', async () => {
      const gallery = await freshGallery()
      gallery.setCategory('watercolor')

      expect(gallery.filteredWorks.value.length).toBeGreaterThan(0)
      expect(gallery.filteredWorks.value.every((w) => w.category === 'watercolor')).toBe(true)
    })

    it('切分類會把網址帶上 ?c=，切回 all 則清掉', async () => {
      const gallery = await freshGallery()

      gallery.setCategory('sculpture')
      expect(query()).toBe('?c=sculpture')

      gallery.setCategory('all')
      expect(query()).toBe('')
    })

    it('切到已經在的分類不做事——避免無謂的 history 寫入', async () => {
      const gallery = await freshGallery()
      gallery.setCategory('animation')
      gallery.openWork('anm-001')
      expect(gallery.selectedWork.value?.id).toBe('anm-001')

      gallery.setCategory('animation')
      expect(gallery.selectedWork.value?.id).toBe('anm-001')
    })

    it('切分類會關掉詳情——避免停在不屬於新分類的作品上', async () => {
      const gallery = await freshGallery()
      gallery.openWork('acr-001')
      gallery.setCategory('watercolor')

      expect(gallery.selectedWork.value).toBeNull()
      expect(query()).toBe('?c=watercolor')
    })
  })

  describe('詳情頁選取', () => {
    it('開啟作品會把 id 寫進網址', async () => {
      const gallery = await freshGallery()
      gallery.openWork('cal-001')

      expect(gallery.selectedWork.value?.id).toBe('cal-001')
      expect(query()).toBe('?w=cal-001')
    })

    it('分類與作品可以同時出現在網址上', async () => {
      const gallery = await freshGallery()
      gallery.setCategory('calligraphy')
      gallery.openWork('cal-002')

      expect(query()).toBe('?c=calligraphy&w=cal-002')
    })

    it('選到不存在的 id 時回傳 null，不丟例外', async () => {
      const gallery = await freshGallery()
      gallery.openWork('does-not-exist')

      expect(gallery.selectedWork.value).toBeNull()
    })
  })

  describe('上一件／下一件', () => {
    it('在目前篩選結果內移動，不會跑到別的分類', async () => {
      const gallery = await freshGallery()
      gallery.setCategory('watercolor')
      const list = gallery.filteredWorks.value
      gallery.openWork(list[0].id)

      gallery.stepWork(1)
      expect(gallery.selectedWork.value?.id).toBe(list[1].id)
      expect(gallery.selectedWork.value?.category).toBe('watercolor')
    })

    it('走到最後一件再往下會回到第一件', async () => {
      const gallery = await freshGallery()
      gallery.setCategory('watercolor')
      const list = gallery.filteredWorks.value
      gallery.openWork(list[list.length - 1].id)

      gallery.stepWork(1)
      expect(gallery.selectedWork.value?.id).toBe(list[0].id)
    })

    it('第一件再往上會回到最後一件', async () => {
      const gallery = await freshGallery()
      gallery.setCategory('watercolor')
      const list = gallery.filteredWorks.value
      gallery.openWork(list[0].id)

      gallery.stepWork(-1)
      expect(gallery.selectedWork.value?.id).toBe(list[list.length - 1].id)
    })

    it('沒開詳情時 stepWork 不做事', async () => {
      const gallery = await freshGallery()
      gallery.stepWork(1)

      expect(gallery.selectedWork.value).toBeNull()
    })
  })

  describe('從網址還原狀態（深連結）', () => {
    it('讀得回分類與作品', async () => {
      const gallery = await freshGallery('?c=sculpture&w=scp-002')
      gallery.syncFromUrl()

      expect(gallery.activeCategory.value).toBe('sculpture')
      expect(gallery.selectedWork.value?.id).toBe('scp-002')
    })

    it('分類代號不合法時退回 all，不是留著壞值', async () => {
      const gallery = await freshGallery('?c=不存在的分類')
      gallery.syncFromUrl()

      expect(gallery.activeCategory.value).toBe('all')
      expect(gallery.filteredWorks.value.length).toBeGreaterThan(0)
    })

    it('沒有參數時是全部作品、無選取', async () => {
      const gallery = await freshGallery()
      gallery.syncFromUrl()

      expect(gallery.activeCategory.value).toBe('all')
      expect(gallery.selectedWork.value).toBeNull()
    })
  })

  describe('展覽模式（依展覽）', () => {
    async function withExhibition(workIds: string[], id = 'ex-1') {
      const gallery = await freshGallery()
      const { useLibrary } = await import('@/composables/useLibrary')
      useLibrary().addExhibition({ id, title: '首展', preface: '開場白', workIds })
      return gallery
    }

    it('依展覽顯示作品，且順序照 workIds 而非自然序', async () => {
      const gallery = await withExhibition(['wtc-001', 'acr-001', 'anm-002'])
      gallery.setMode('exhibition')

      expect(gallery.filteredWorks.value.map((w) => w.id)).toEqual(['wtc-001', 'acr-001', 'anm-002'])
    })

    it('動線裡已刪除的作品 id 會被略過，不留空洞', async () => {
      const gallery = await withExhibition(['acr-001', 'does-not-exist', 'wtc-001'])
      gallery.setMode('exhibition')

      expect(gallery.filteredWorks.value.map((w) => w.id)).toEqual(['acr-001', 'wtc-001'])
    })

    it('切到展覽模式把網址帶上 ?m=ex&ex=，且自動選第一個展覽', async () => {
      const gallery = await withExhibition(['acr-001'])
      gallery.setMode('exhibition')

      expect(gallery.activeExhibitionId.value).toBe('ex-1')
      expect(query()).toBe('?m=ex&ex=ex-1')
    })

    it('上一件／下一件走展覽動線的順序', async () => {
      const gallery = await withExhibition(['anm-002', 'acr-001'])
      gallery.setMode('exhibition')
      gallery.openWork('anm-002')

      gallery.stepWork(1)
      expect(gallery.selectedWork.value?.id).toBe('acr-001')
    })

    it('切回依媒材模式清掉展覽狀態與網址', async () => {
      const gallery = await withExhibition(['acr-001'])
      gallery.setMode('exhibition')
      gallery.setMode('category')

      expect(gallery.viewMode.value).toBe('category')
      expect(gallery.activeExhibitionId.value).toBeNull()
      expect(query()).toBe('')
    })

    it('深連結 ?m=ex&ex= 還原展覽模式與動線', async () => {
      const gallery = await withExhibition(['acr-001', 'wtc-001'])
      window.history.replaceState(null, '', '/?m=ex&ex=ex-1')
      gallery.syncFromUrl()

      expect(gallery.viewMode.value).toBe('exhibition')
      expect(gallery.activeExhibitionId.value).toBe('ex-1')
      expect(gallery.filteredWorks.value.map((w) => w.id)).toEqual(['acr-001', 'wtc-001'])
    })

    it('深連結到不存在的展覽 id 退回無選定，不留壞值', async () => {
      const gallery = await withExhibition(['acr-001'])
      window.history.replaceState(null, '', '/?m=ex&ex=nope')
      gallery.syncFromUrl()

      expect(gallery.viewMode.value).toBe('exhibition')
      expect(gallery.activeExhibitionId.value).toBeNull()
      expect(gallery.filteredWorks.value).toEqual([])
    })
  })

  describe('版面切換：牆面／走廊（MR-017）', () => {
    it('預設是牆面，網址不帶 v', async () => {
      const gallery = await freshGallery()

      expect(gallery.layout.value).toBe('wall')
      expect(query()).not.toContain('v=')
    })

    it('切走廊會寫進網址，切回牆面則移除', async () => {
      const gallery = await freshGallery()

      gallery.setLayout('hall')
      expect(gallery.layout.value).toBe('hall')
      expect(query()).toContain('v=hall')

      gallery.setLayout('wall')
      expect(query()).not.toContain('v=hall')
    })

    /** 版面與篩選是兩個軸——切呈現方式不該把使用者選的分類洗掉 */
    it('切版面時保留分類篩選', async () => {
      const gallery = await freshGallery()
      gallery.setCategory('watercolor')

      gallery.setLayout('hall')

      expect(gallery.activeCategory.value).toBe('watercolor')
      expect(query()).toContain('c=watercolor')
      expect(query()).toContain('v=hall')
    })

    it('切版面時關閉詳情頁——否則切完看不到變化，會以為沒作用', async () => {
      const gallery = await freshGallery()
      gallery.openWork('acr-001')
      expect(gallery.selectedWork.value?.id).toBe('acr-001')

      gallery.setLayout('hall')

      expect(gallery.selectedWork.value).toBeNull()
      expect(query()).not.toContain('w=')
    })

    it('走廊可與展覽模式並存——兩者正交，不是三選一', async () => {
      const gallery = await freshGallery()
      const { useLibrary } = await import('@/composables/useLibrary')
      useLibrary().addExhibition({
        id: 'ex-1',
        title: '首展',
        preface: '開場白',
        workIds: ['acr-001', 'wtc-001'],
      })
      gallery.setExhibition('ex-1')

      gallery.setLayout('hall')

      expect(gallery.viewMode.value).toBe('exhibition')
      expect(gallery.layout.value).toBe('hall')
      expect(gallery.filteredWorks.value.map((w) => w.id)).toEqual(['acr-001', 'wtc-001'])
    })

    it('深連結 ?v=hall 還原成走廊', async () => {
      const gallery = await freshGallery('?v=hall')
      gallery.syncFromUrl()

      expect(gallery.layout.value).toBe('hall')
    })

    it('v 帶垃圾值退回牆面，不留壞狀態', async () => {
      const gallery = await freshGallery('?v=nope')
      gallery.syncFromUrl()

      expect(gallery.layout.value).toBe('wall')
    })
  })
})
