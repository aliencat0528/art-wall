<script setup lang="ts">
import type { Category, Exhibition, FilterId } from '@/types'

/**
 * 站頭：左為作者資訊，右為瀏覽切換。
 * 分類切換取代原本的顏色切換（MR-008）；當存在展覽時，多一排「依媒材／依展覽」
 * 模式切換（MR-012 ④）——沒有展覽就完全不顯示，主頁面維持原樣。
 */

type ViewMode = 'category' | 'exhibition'

defineProps<{
  categories: Category[]
  active: FilterId
  count: number
  name: string
  statement: string
  viewMode: ViewMode
  exhibitions: Exhibition[]
  activeExhibitionId: string | null
}>()

const emit = defineEmits<{
  select: [id: FilterId]
  selectMode: [mode: ViewMode]
  selectExhibition: [id: string]
}>()
</script>

<template>
  <header class="header">
    <div class="header__identity">
      <h1 class="header__name">
        {{ name }}
      </h1>
      <p class="header__statement">
        {{ statement }}
      </p>
    </div>

    <nav
      class="header__nav"
      aria-label="作品瀏覽"
    >
      <div class="header__controls">
        <!-- 有展覽才顯示模式切換；否則主頁面維持只有分類列 -->
        <div
          v-if="exhibitions.length > 0"
          class="modes"
          role="group"
          aria-label="瀏覽模式"
        >
          <button
            type="button"
            class="mode"
            :class="{ 'is-active': viewMode === 'category' }"
            :aria-pressed="viewMode === 'category'"
            @click="emit('selectMode', 'category')"
          >
            依媒材
          </button>
          <button
            type="button"
            class="mode"
            :class="{ 'is-active': viewMode === 'exhibition' }"
            :aria-pressed="viewMode === 'exhibition'"
            @click="emit('selectMode', 'exhibition')"
          >
            依展覽
          </button>
        </div>

        <ul
          v-if="viewMode === 'exhibition'"
          class="filters"
          aria-label="展覽"
        >
          <li
            v-for="exhibition in exhibitions"
            :key="exhibition.id"
          >
            <button
              type="button"
              class="filter"
              :class="{ 'is-active': activeExhibitionId === exhibition.id }"
              :aria-pressed="activeExhibitionId === exhibition.id"
              @click="emit('selectExhibition', exhibition.id)"
            >
              <span class="filter__code">展</span>
              <span class="filter__label">{{ exhibition.title }}</span>
            </button>
          </li>
        </ul>

        <ul
          v-else
          class="filters"
          aria-label="作品分類"
        >
          <li>
            <button
              type="button"
              class="filter"
              :class="{ 'is-active': active === 'all' }"
              :aria-pressed="active === 'all'"
              @click="emit('select', 'all')"
            >
              <span class="filter__code">ALL</span>
              <span class="filter__label">全部</span>
            </button>
          </li>
          <li
            v-for="category in categories"
            :key="category.id"
          >
            <button
              type="button"
              class="filter"
              :class="{ 'is-active': active === category.id }"
              :aria-pressed="active === category.id"
              @click="emit('select', category.id)"
            >
              <span class="filter__code">{{ category.code }}</span>
              <span class="filter__label">{{ category.label }}</span>
            </button>
          </li>
        </ul>
      </div>

      <p
        class="header__count"
        aria-live="polite"
      >
        {{ count }} 件
      </p>
    </nav>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.25rem 2rem;
  padding: clamp(1.25rem, 3vw, 2rem) var(--page-x) 1rem;
  /* 站頭底線用強調色：切換分類時整條線換色，是最不干擾作品又看得見的訊號。
     暗場裡中性線會整條沉掉，故線本身要發光 */
  border-bottom: 2px solid color-mix(in srgb, var(--accent) 62%, transparent);
  box-shadow: 0 1px 24px -6px var(--accent);
  transition: border-color 320ms var(--ease), box-shadow 320ms var(--ease);
}

.header__name {
  position: relative;
  display: inline-block;
  padding-bottom: 0.3rem;
  font-size: clamp(1.1rem, 2.4vw, 1.5rem);
  font-weight: 600;
  letter-spacing: 0.12em;
  /* 字自己會發光，不靠底色撐 */
  text-shadow: 0 0 32px color-mix(in srgb, var(--accent) 58%, transparent);
}

/* 姓名下的短強調線，跟著分類換色 */
.header__name::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 2.4rem;
  height: 3px;
  background: var(--accent);
  box-shadow: 0 0 16px -1px var(--accent);
  transition: background-color 320ms var(--ease), width 320ms var(--ease);
}

.header__statement {
  max-width: 34ch;
  margin-top: 0.35rem;
  font-size: 0.82rem;
  line-height: 1.6;
  color: var(--ink-soft);
}

.header__nav {
  display: flex;
  align-items: flex-end;
  gap: 1rem;
}

.header__controls {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
  min-width: 0;
}

.modes {
  display: flex;
  gap: 0.3rem;
}

.mode {
  padding: 0.25rem 0.6rem;
  font-family: var(--font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.08em;
  color: var(--ink-faint);
  background: transparent;
  border: 1px solid var(--line);
  border-radius: var(--card-radius);
  cursor: pointer;
  transition: color 200ms var(--ease), border-color 200ms var(--ease);
}

.mode:hover {
  border-color: var(--line-strong);
}

.mode.is-active {
  color: var(--accent);
  border-color: var(--accent);
  box-shadow: 0 0 20px -8px var(--accent);
}

.filters {
  display: flex;
  gap: 0.35rem;
  list-style: none;
  overflow-x: auto;
  scrollbar-width: none;
}

.filters::-webkit-scrollbar {
  display: none;
}

.filter {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  padding: 0.4rem 0.7rem;
  white-space: nowrap;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--card-radius);
  cursor: pointer;
  transition: background-color 220ms var(--ease), border-color 220ms var(--ease),
    color 220ms var(--ease);
}

.filter__code {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.14em;
  color: var(--ink-faint);
  transition: color 220ms var(--ease);
}

.filter__label {
  font-size: 0.82rem;
  color: var(--ink-soft);
  transition: color 220ms var(--ease);
}

.filter:hover {
  border-color: var(--line-strong);
}

/* 選中的分類：強調色外框 + 極淡的同色底（不用固定淺色底，那在暗場會整塊發亮） */
.filter.is-active {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border-color: var(--accent);
  box-shadow: inset 0 -3px 0 var(--accent), 0 0 26px -8px var(--accent);
}

.filter.is-active .filter__code,
.filter.is-active .filter__label {
  color: var(--accent);
}

.filter.is-active .filter__code {
  text-shadow: 0 0 18px color-mix(in srgb, var(--accent) 70%, transparent);
}

.header__count {
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  color: var(--ink-faint);
}

@media (max-width: 899px) {
  .header {
    align-items: stretch;
    padding-bottom: 0.75rem;
  }

  .header__nav {
    width: 100%;
    align-items: center;
    justify-content: space-between;
  }

  .header__controls {
    /* 窄螢幕讓控制列可橫向滑動，不換行擠壓版面 */
    min-width: 0;
    padding-bottom: 0.25rem;
  }
}
</style>
