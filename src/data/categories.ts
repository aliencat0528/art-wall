import type {
  Category,
  CategoryId,
  CategoryTheme,
  StoredCategory,
  TexturePresetId,
} from '@/types'
import { deriveAccentDark } from '@/utils/color'

/**
 * 分類主題表。
 *
 * 設計約束（見 prepare.md MR-008）：切換分類只換「殼的口音」——強調色、動效曲線、
 * 卡片邊緣、背景紋理。版面與主要背景永遠中性白盒，作品顏色不被外殼吃掉。
 * 紋理一律灰階（不帶色相，否則會偏移作品的白平衡）、不透明度上限 3%。
 *
 * MR-012 ③：紋理個性成組。使用者新增分類只選名稱／顏色／紋理預設，
 * easing／radius／border 隨紋理帶入（見 `TEXTURE_PRESETS`），accentDark 由 accent 自動推導。
 * 內建六類的 accent／accentDark 為手工調校，直接寫死，不走推導。
 */

/** 把一小塊 SVG 磚做成可重複鋪底的 data URI */
function tile(size: number, marks: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${marks}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

interface TexturePreset {
  /** 給編輯面板顯示的名稱 */
  label: string
  /** 背景紋理（SVG data URI） */
  texture: string
  easing: string
  radius: string
  border: string
}

/**
 * 紋理個性預設。內建分類引用它取得紋理與動效組，自訂分類也從這裡選一個。
 * 一處定義，兩邊共用——不再讓紋理與動效散在各分類上。
 */
export const TEXTURE_PRESETS: Record<TexturePresetId, TexturePreset> = {
  // 麻布織紋：厚塗，較重的外框、幾乎不圓角、帶一點回彈
  linen: {
    label: '麻布織紋',
    texture: tile(12, '<path d="M0 6h12M6 0v12" stroke="#000" stroke-opacity="0.03" stroke-width="1.5" />'),
    easing: 'cubic-bezier(0.34, 1.16, 0.64, 1)',
    radius: '2px',
    border: '2px',
  },
  // 紙纖維顆粒：柔邊，大圓角、細框、慢柔曲線
  paper: {
    label: '紙纖維顆粒',
    texture: tile(
      28,
      '<circle cx="6" cy="8" r="1.6" fill="#000" fill-opacity="0.025" /><circle cx="20" cy="18" r="2.2" fill="#000" fill-opacity="0.02" /><circle cx="13" cy="24" r="1.2" fill="#000" fill-opacity="0.03" />',
    ),
    easing: 'cubic-bezier(0.33, 1, 0.68, 1)',
    radius: '14px',
    border: '1px',
  },
  // 宣紙直格：提按，直角、墨色、起收筆的快慢對比
  xuan: {
    label: '宣紙直格',
    texture: tile(
      40,
      '<path d="M0 0v40" stroke="#000" stroke-opacity="0.03" stroke-width="1" /><path d="M20 0v40" stroke="#000" stroke-opacity="0.015" stroke-width="1" />',
    ),
    easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
    radius: '0px',
    border: '1px',
  },
  // 石材細點：量體，小圓角、厚框、沉穩的減速
  stone: {
    label: '石材細點',
    texture: tile(
      10,
      '<circle cx="2" cy="2" r="1" fill="#000" fill-opacity="0.028" /><circle cx="7" cy="6" r="0.8" fill="#000" fill-opacity="0.02" />',
    ),
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    radius: '4px',
    border: '2px',
  },
  // 分鏡方格：現代感，無圓角、細框、快進慢出
  frame: {
    label: '分鏡方格',
    texture: tile(24, '<rect x="0.5" y="0.5" width="23" height="23" fill="none" stroke="#000" stroke-opacity="0.028" stroke-width="1" />'),
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    radius: '0px',
    border: '1px',
  },
  // 數位網格＋對角掃線：硬切曲線、極細框
  grid: {
    label: '數位網格',
    texture: tile(
      16,
      '<path d="M0 0h16M0 0v16" stroke="#000" stroke-opacity="0.03" stroke-width="1" /><path d="M0 16L16 0" stroke="#000" stroke-opacity="0.015" stroke-width="1" />',
    ),
    easing: 'cubic-bezier(0.83, 0, 0.17, 1)',
    radius: '0px',
    border: '1px',
  },
}

/** 內建分類：引用紋理預設取得紋理與動效組，accent／accentDark 手工指定 */
function theme(presetId: TexturePresetId, accent: string, accentDark: string): CategoryTheme {
  const preset = TEXTURE_PRESETS[presetId]
  return { accent, accentDark, texture: preset.texture, easing: preset.easing, radius: preset.radius, border: preset.border }
}

/**
 * 書法／立體改用材料自身的顏色（MR-014）。
 *
 * 原值 `書法 #3d3a35`（墨）與 `立體 #6b6355`（石膏灰）幾乎無彩，在暗場光氛下
 * 「光」根本發不出來——F 的機制（聚光、光池、疊印框）全部建立在有彩 accent 上，
 * 無彩會退化成一團灰霧。改取印泥朱紅與陶土赭：仍是這兩種創作的材料色，
 * 不是外加的裝飾色，故未違反 MR-008「殼只給口音」的原則。
 */
export const CATEGORIES: Category[] = [
  { id: 'acrylic', label: '壓克力畫', code: 'ACR', theme: theme('linen', '#c2410c', '#ff8a4c') },
  { id: 'watercolor', label: '水彩畫', code: 'WTC', theme: theme('paper', '#2563a8', '#6ea8e8') },
  { id: 'calligraphy', label: '書法', code: 'CAL', theme: theme('xuan', '#b7332a', '#e0685c') },
  { id: 'sculpture', label: '立體作品', code: 'SCP', theme: theme('stone', '#a9713d', '#d99a5e') },
  { id: 'animation', label: '動畫', code: 'ANM', theme: theme('frame', '#7c3aed', '#b18aff') },
  { id: 'newmedia', label: '新媒體', code: 'NEW', theme: theme('grid', '#0d8a80', '#3fd6c8') },
]

/**
 * 「全部」不是分類，是篩選狀態，故用中性主題且無紋理。
 *
 * 例外是 `accentDark`（MR-014）：整站底色改為暗場後，近白的 `#f0efec` 當光色
 * 會把整個展場照成無彩的白霧，看不出光有顏色。改用展廳青當「未選分類」的光色。
 * `accent`（明場用的無彩近黑）留著不刪：`resolveCategory`／編輯面板仍以它為使用者
 * 選的顏色，暗底版一律由它推導。
 */
export const ALL_THEME: CategoryTheme = {
  accent: '#1c1c1a',
  accentDark: '#4fd6e8',
  texture: 'none',
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  radius: '2px',
  border: '1px',
}

export const CATEGORY_MAP: Record<CategoryId, Category> = CATEGORIES.reduce(
  (map, category) => {
    map[category.id] = category
    return map
  },
  {} as Record<CategoryId, Category>,
)

/**
 * 把持久化的自訂分類還原成完整 Category：紋理／動效取自預設，
 * accentDark 由 accent 自動推導（MR-012 ③）。
 */
export function resolveCategory(stored: StoredCategory): Category {
  const preset = TEXTURE_PRESETS[stored.texturePresetId] ?? TEXTURE_PRESETS.linen
  return {
    id: stored.id,
    label: stored.label,
    code: stored.code,
    custom: true,
    theme: {
      accent: stored.accent,
      accentDark: deriveAccentDark(stored.accent),
      texture: preset.texture,
      easing: preset.easing,
      radius: preset.radius,
      border: preset.border,
    },
  }
}

/**
 * 依 id 取分類。找不到就回中性 fallback——CategoryId 已為開放字串，
 * 匯入 JSON 可能帶進沒有定義的孤兒分類，直接索引會 runtime 崩，一律走此收口。
 * `categories` 預設為內建六類；需含自訂分類時由呼叫端傳入合併清單。
 */
export function categoryOf(id: CategoryId, categories: Category[] = CATEGORIES): Category {
  return categories.find((category) => category.id === id) ?? { id, label: id, code: '—', theme: ALL_THEME }
}
