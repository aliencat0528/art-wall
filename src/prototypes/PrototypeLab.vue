<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import type { Category, CategoryId } from '@/types'
import { CATEGORIES, categoryOf } from '@/data/categories'
import { WORKS } from '@/data/works'
import SchemeGridnik from './SchemeGridnik.vue'
import SchemeModular from './SchemeModular.vue'
import SchemeRiso from './SchemeRiso.vue'
import SchemeBrutal from './SchemeBrutal.vue'
import SchemeDither from './SchemeDither.vue'

/**
 * 視覺原型實驗室——四個展場感方案並置比較（以 `?lab=1` 進入）。
 *
 * 與主站完全隔離：不碰 WorkRail／WorkCard／useAppearance，不寫 localStorage、
 * 不碰 IndexedDB，由 `main.ts` 動態載入，正式站首包不含這整包程式碼。
 * 定案後只留下選中的那一支，其餘連同本檔一起刪除（見 prepare.md 待討論事項 #2）。
 *
 * 兩層切換各自要驗的東西不同：
 *   - 切「方案」：比較四種語彙的整體氣質
 *   - 切「分類」：驗每個方案的**切換動畫**，也就是這次提出的第一個問題
 */

interface Scheme {
  id: string
  label: string
  source: string
  trait: string
  risk: string
  component: Component
}

const SCHEMES: Scheme[] = [
  {
    id: 'gridnik',
    label: 'A 網格外露',
    source: 'Stedelijk / Wim Crouwel',
    trait: '不做框；模組網格線顯影，結構本身就是裝飾',
    risk: '零衝突，但最接近現況——它的用途是當對照基準',
    component: SchemeGridnik,
  },
  {
    id: 'modular',
    label: 'B 模組疊層',
    source: 'MoMA 2019（Order）',
    trait: '半透明模組互相咬合，重疊處合成第三色；作品圖不參與混色',
    risk: '低——色彩落在模組與站頭，作品區維持中性（＝色彩 B 案）',
    component: SchemeModular,
  },
  {
    id: 'riso',
    label: 'C Riso 疊印',
    source: 'Risograph overprint',
    trait: 'SVG 抖線框、套印偏移的第二色版、紙張顆粒',
    risk: '中——顆粒與色版必須留在作品外側，否則偏移白平衡',
    component: SchemeRiso,
  },
  {
    id: 'brutal',
    label: 'D 新粗獷',
    source: 'Whitney / Werkleitz',
    trait: '對角色塊、超粗框與切角、字壓過框線、內容破格',
    risk: '高——推翻 D-003／MR-008，選它等於選色彩 C 案',
    component: SchemeBrutal,
  },
  {
    id: 'dither',
    label: 'E 點陣顯影',
    source: '用戶指定混合：B 站頭 + C 作品 + halftone 參考圖',
    trait: '三層網點分級、製圖線、透視傾斜與浮離投影；切換時整片階梯顯影',
    risk: '低——骨架無彩高對比，彩度全留給作品與 accent（＝色彩 B 案的強化版）',
    component: SchemeDither,
  },
]

const FILTERS: { id: CategoryId | 'all'; label: string }[] = [
  { id: 'all', label: '全部' },
  ...CATEGORIES.map((category) => ({ id: category.id, label: category.label })),
]

const schemeId = ref('dither')
const activeFilter = ref<CategoryId | 'all'>('all')

const scheme = computed(() => SCHEMES.find((item) => item.id === schemeId.value) ?? SCHEMES[0])

const category = computed<Category | null>(() =>
  activeFilter.value === 'all' ? null : categoryOf(activeFilter.value),
)

// 「全部」沒有分類色。ALL_THEME 的近黑（#1c1c1a）在方案 B／D 的大面積色塊上
// 會變成一整塊黑板，看不出方案在講什麼，故原型改用中性暖灰當佔位。
const accent = computed(() => category.value?.theme.accent ?? '#57534a')

const works = computed(() =>
  activeFilter.value === 'all'
    ? WORKS
    : WORKS.filter((work) => work.category === activeFilter.value),
)
</script>

<template>
  <div class="lab">
    <header class="lab__bar">
      <div class="lab__row">
        <span class="lab__brand">視覺原型 / PROTOTYPE</span>
        <nav
          class="lab__group"
          aria-label="視覺方案"
        >
          <button
            v-for="item in SCHEMES"
            :key="item.id"
            type="button"
            class="lab__btn"
            :class="{ 'lab__btn--on': item.id === schemeId }"
            @click="schemeId = item.id"
          >
            {{ item.label }}
          </button>
        </nav>
      </div>

      <div class="lab__row">
        <span class="lab__brand">分類（看切換動畫）</span>
        <nav
          class="lab__group"
          aria-label="分類篩選"
        >
          <button
            v-for="filter in FILTERS"
            :key="filter.id"
            type="button"
            class="lab__btn"
            :class="{ 'lab__btn--on': filter.id === activeFilter }"
            @click="activeFilter = filter.id"
          >
            {{ filter.label }}
          </button>
        </nav>
      </div>

      <p class="lab__note">
        <span class="lab__note-key">參考</span>{{ scheme.source }}
        <span class="lab__note-key">特徵</span>{{ scheme.trait }}
        <span class="lab__note-key">風險</span>{{ scheme.risk }}
      </p>
    </header>

    <main class="lab__stage">
      <Transition
        name="lab-swap"
        mode="out-in"
      >
        <component
          :is="scheme.component"
          :key="scheme.id"
          :works="works"
          :category="category"
          :accent="accent"
        />
      </Transition>
    </main>
  </div>
</template>

<style scoped>
.lab {
  min-height: 100vh;
  background: #101012;
}

/* 工具列刻意做得中性且安靜——它不是設計的一部分，不該干擾四個方案的比較 */
.lab__bar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem clamp(0.75rem, 3vw, 1.5rem);
  background: #101012;
  border-bottom: 1px solid #2b2b31;
}

.lab__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.9rem;
}

.lab__brand,
.lab__note {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.14em;
  color: #7e7c86;
}

.lab__brand {
  min-width: 9rem;
}

.lab__group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.lab__btn {
  padding: 0.3rem 0.7rem;
  font-family: var(--font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.08em;
  color: #b9b7c0;
  background: transparent;
  border: 1px solid #35353d;
  border-radius: 2px;
  cursor: pointer;
  transition: color 180ms ease, border-color 180ms ease, background-color 180ms ease;
}

/* 排除選中狀態：:hover 的權重比 .lab__btn--on 高，
   不排除的話滑過選中的按鈕會變成白底白字 */
.lab__btn:not(.lab__btn--on):hover {
  color: #f0eff2;
  border-color: #5a5a66;
}

.lab__btn--on {
  color: #101012;
  background: #f0eff2;
  border-color: #f0eff2;
}

.lab__note {
  line-height: 1.9;
}

.lab__note-key {
  margin: 0 0.4rem 0 0.9rem;
  color: #4e4e58;
}

.lab__note-key:first-child {
  margin-left: 0;
}

.lab__stage {
  min-height: 70vh;
}

/* 方案之間用最素的淡出淡入交接，把注意力留給方案自己的進場動畫 */
.lab-swap-enter-active,
.lab-swap-leave-active {
  transition: opacity 200ms ease;
}

.lab-swap-enter-from,
.lab-swap-leave-to {
  opacity: 0;
}
</style>
