import type { Category, Work } from '@/types'

/**
 * 四個視覺方案共用的 props 契約。
 *
 * 方案只負責「怎麼呈現」，篩選與強調色解析都在 `PrototypeLab.vue` 做完再傳進來——
 * 這樣四支方案彼此完全獨立，砍掉任何一支都不影響其他三支。
 */
export interface SchemeProps {
  /** 已篩選好的作品 */
  works: Work[]
  /** 目前分類；`null` 代表「全部」（不是分類，是篩選狀態） */
  category: Category | null
  /** 已解析好的強調色 */
  accent: string
}
