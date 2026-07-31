import { computed, watchEffect, type Ref } from 'vue'
import type { CategoryTheme, FilterId } from '@/types'
import { ALL_THEME, categoryOf } from '@/data/categories'
import { useLibrary } from '@/composables/useLibrary'
import { counterAccent } from '@/utils/color'

/**
 * 把分類主題寫進 :root。
 *
 * 原本這裡有兩層（整體背景 × 分類主題，MR-009）。MR-014 收成一層：
 * 站台一律是暗場光氛，中性層 token 直接是 `styles/main.css` 的 :root 值，
 * 沒有第二套配色要在執行期換。這支因此只剩「分類換口音」這件事：
 *
 *   - `--accent`：分類強調色，一律取 `accentDark`（底永遠是暗的）。同時是光氛的光色
 *   - `--counter`：疊印框的第二個色版，由 accent 推導（見 `counterAccent`）
 *   - `--texture` / `--ease` / `--card-radius` / `--card-border`：紋理與動效組
 */
export function useAppearance(active: Ref<FilterId>): void {
  const { categories } = useLibrary()

  const theme = computed<CategoryTheme>(() =>
    active.value === 'all' ? ALL_THEME : categoryOf(active.value, categories.value).theme,
  )

  watchEffect(() => {
    const root = document.documentElement.style

    // 暗場的光色必須有彩，故一律用 accentDark；六類的值為手工調校（見 categories.ts）
    root.setProperty('--accent', theme.value.accentDark)
    root.setProperty('--counter', counterAccent(theme.value.accentDark))
    root.setProperty('--texture', theme.value.texture)
    root.setProperty('--ease', theme.value.easing)
    root.setProperty('--card-radius', theme.value.radius)
    root.setProperty('--card-border', theme.value.border)
  })
}
