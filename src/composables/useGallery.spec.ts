import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
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
      const { useLibrary } = await import('@/composables/useLibrary')
      gallery.syncFromUrl()
      // 對帳刻意等到持久層載完才判定「不存在」——分類可自訂，載完前的清單不算數
      await useLibrary().init()

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
    /**
     * **先 `init()` 再新增展覽**：`useGallery` 的對帳只在 `ready` 之後才判定
     * 「這個展覽不存在」（否則 IndexedDB 還沒載完就會把所有展覽深連結誤殺）。
     * 少了這一步，刪除與深連結那幾條都測不到真正的行為。
     */
    async function withExhibition(workIds: string[], id = 'ex-1') {
      const gallery = await freshGallery()
      const { useLibrary } = await import('@/composables/useLibrary')
      const library = useLibrary()
      await library.init()
      library.addExhibition({ id, title: '首展', preface: '開場白', workIds })
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

    it('深連結到不存在的展覽 id 會接到還在的第一個展覽，不停在空畫面', async () => {
      const gallery = await withExhibition(['acr-001'])
      window.history.replaceState(null, '', '/?m=ex&ex=nope')
      gallery.syncFromUrl()

      expect(gallery.viewMode.value).toBe('exhibition')
      expect(gallery.activeExhibitionId.value).toBe('ex-1')
      expect(gallery.filteredWorks.value.map((w) => w.id)).toEqual(['acr-001'])
      // 壞掉的 id 也要從網址上抹掉，否則分享出去的還是同一個壞連結
      expect(query()).toBe('?m=ex&ex=ex-1')
    })

    /**
     * 這條擋的是「展覽連結過不了重新整理」：`syncFromUrl` 在 IndexedDB 載完前跑，
     * 那時展覽清單還是空的。舊版在這裡就拿清單驗 id，於是**每一個**展覽連結
     * 都被判成無效而清掉；載完之後也接不回來。
     */
    it('展覽深連結在持久層載完前不被清掉，載完就接得回來', async () => {
      await withExhibition(['acr-001'])

      // 模擬重新整理：狀態全部重來，且 syncFromUrl 早於 init（App.vue 的真實順序）
      const reloaded = await freshGallery('?m=ex&ex=ex-1')
      const library = (await import('@/composables/useLibrary')).useLibrary()
      reloaded.syncFromUrl()
      // 載完之前 id 必須原封不動留著，這一行就是舊版掉連結的地方
      expect(reloaded.activeExhibitionId.value).toBe('ex-1')

      await library.init()
      expect(reloaded.filteredWorks.value.map((w) => w.id)).toEqual(['acr-001'])
    })

    it('刪掉正在看的展覽後接到下一個，不會停在空畫面', async () => {
      const gallery = await withExhibition(['acr-001'])
      const { useLibrary } = await import('@/composables/useLibrary')
      const library = useLibrary()
      library.addExhibition({ id: 'ex-2', title: '二展', preface: '', workIds: ['wtc-001'] })
      gallery.setExhibition('ex-1')

      library.removeExhibition('ex-1')
      // 對帳走 watch，是非同步 flush 的——真實畫面上就是下一個 tick 修正
      await nextTick()

      expect(gallery.activeExhibitionId.value).toBe('ex-2')
      expect(gallery.filteredWorks.value.map((w) => w.id)).toEqual(['wtc-001'])
    })

    /**
     * 最後一個展覽被刪掉時**一定要退回依媒材**：站頭那排「依媒材／依展覽」是
     * `v-if="exhibitions.length > 0"`，展覽歸零時按鈕本身也消失。
     * 若還留在展覽模式，畫面上就沒有任何回得去的出口，而網址還帶著 `m=ex`，
     * 重新整理也是同一個空畫面——那是走不出去的死路。
     */
    it('刪掉最後一個展覽會退回依媒材，並清掉網址上的展覽參數', async () => {
      const gallery = await withExhibition(['acr-001'])
      const { useLibrary } = await import('@/composables/useLibrary')
      gallery.setMode('exhibition')
      expect(query()).toBe('?m=ex&ex=ex-1')

      useLibrary().removeExhibition('ex-1')
      await nextTick()

      expect(gallery.viewMode.value).toBe('category')
      expect(gallery.activeExhibitionId.value).toBeNull()
      expect(gallery.activeCategory.value).toBe('all')
      expect(gallery.filteredWorks.value.length).toBeGreaterThan(0)
      expect(query()).toBe('')
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
