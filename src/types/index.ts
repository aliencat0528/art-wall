/** 作品牆型別定義 */

/**
 * 分類代號。MR-012 起分類可由使用者編輯，故為開放字串——內建六類仍用語意代號
 * （`acrylic` 等），使用者新增的分類自帶 id。編譯期保證消失，讀分類一律走
 * `categoryOf()`（見 `data/categories.ts`）以擋孤兒分類。
 */
export type CategoryId = string

/** 紋理個性預設代號。使用者選一個，easing/radius/border 隨紋理成組帶入（MR-012 ③） */
export type TexturePresetId = 'linen' | 'paper' | 'xuan' | 'stone' | 'frame' | 'grid'

/** 篩選列用：`all` 只存在於 UI 狀態，不會出現在 Work 上 */
export type FilterId = CategoryId | 'all'

/** 版位比例。卡片一律以此鎖定尺寸，避免圖片撐破版面 */
export type AspectId = 'square' | 'landscape' | 'portrait' | 'video'

/** 分類主題：只影響「殼」——強調色、動效曲線、卡片邊緣、背景紋理 */
export interface CategoryTheme {
  /** 強調色。用於結構線、標籤、外框、focus ring，不鋪大面積 */
  accent: string
  /** 深色背景用的較亮版本。墨色系在暗底上會整個消失，必須另備 */
  accentDark: string
  /** 背景紋理（SVG data URI）。一律灰階、不透明度 ≤ 3%，避免偏移作品白平衡 */
  texture: string
  /** 該分類的動效個性 */
  easing: string
  /** 卡片圓角 */
  radius: string
  /** 卡片外框寬度 */
  border: string
}

export interface Category {
  id: CategoryId
  /** 顯示名稱 */
  label: string
  /** 等寬字代號，用於幾何感標籤 */
  code: string
  theme: CategoryTheme
  /** 使用者新增的分類（內建六類無此旗標） */
  custom?: boolean
}

/**
 * 持久化的分類（只存使用者新增的）。內建分類的 theme 為手工調校（含 accentDark），
 * 不入此結構；自訂分類只存 accent 與紋理預設，完整 theme 由 `resolveCategory` 運算得出。
 */
export interface StoredCategory {
  id: CategoryId
  label: string
  code: string
  /** 使用者選的強調色；accentDark 由此自動推導 */
  accent: string
  texturePresetId: TexturePresetId
  custom: true
}

/**
 * 展覽＝策展層，與分類正交（MR-012 ①）：分類是無序篩選（帶主題），
 * 展覽是有序動線＋前言。一件作品可同時屬於某分類與多個展覽。
 */
export interface Exhibition {
  id: string
  title: string
  /** 展覽前言，顯示在有序作品之前 */
  preface: string
  /** 作品 id，順序即展覽動線 */
  workIds: string[]
}

export interface WorkLink {
  label: string
  url: string
}

export interface Work {
  id: string
  title: string
  category: CategoryId
  /** 媒材標籤，如「壓克力顏料」「麻布」 */
  media: string[]
  /** 年份或日期字串 */
  year: string
  aspect: AspectId
  description: string
  /** 角色／我的貢獻 */
  role: string
  links: WorkLink[]
  /** 詳情頁用的較大圖 */
  src: string
  /** 牆面縮圖。與 src 分離，牆面永遠不載原圖 */
  thumb: string
  alt: string
  /** 原始像素尺寸，供 img width/height 防 CLS */
  width: number
  height: number
  /** 使用者自行新增的作品（圖片存在 IndexedDB，key 見下） */
  custom?: boolean
  /** IndexedDB 中的圖片 key 前綴，實際存兩筆：`${imageKey}-thumb` 與 `${imageKey}-view` */
  imageKey?: string
}

/** 存進持久層的自訂作品：不含 blob URL（那是每次開站重新產生的） */
export type StoredWork = Omit<Work, 'src' | 'thumb'> & { imageKey: string }

/**
 * 持久層單一 document（MR-012 ②）。取代原本散落的 works.v1／overrides.v1／hidden.v1。
 * 帶 `schemaVersion` 讓改版時能安全遷移、舊匯出檔不致靜默讀壞。匯出 JSON 即此結構
 * 加上圖片 base64。圖片本身仍在 IndexedDB，不進此 document。
 */
export interface LibraryDocument {
  schemaVersion: 2
  works: StoredWork[]
  categories: StoredCategory[]
  exhibitions: Exhibition[]
  overrides: Record<string, Partial<Work>>
  hidden: string[]
}

/**
 * 使用者可自訂的站台設定，存在 localStorage。
 *
 * MR-014 移除 `background`：整體背景不再四選一，站台一律是暗場光氛
 * （中性層 token 直接寫死在 `styles/main.css`，見該檔頂部說明）。
 */
export interface SiteSettings {
  /** 瀏覽器分頁標題 */
  siteTitle: string
  name: string
  statement: string
  email: string
}

/** 裝置寬度模式：寬螢幕走水平長廊，窄螢幕降級為垂直網格 */
export type Viewport = 'wide' | 'narrow'
