<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Work } from '@/types'
import { categoryOf } from '@/data/categories'
import { useLibrary } from '@/composables/useLibrary'
import {
  cameraZ,
  clampStep,
  isNear,
  isPassed,
  isVisible,
  slotFor,
} from '@/utils/hall'

/**
 * 走進展場：第一人稱走廊（MR-017，Phase G）。
 *
 * 暗場，不是參考圖的白盒明場——站台自 MR-014 起只有一套光，走廊也吃同一套。
 * 代價是牆面必須自帶光，否則中性牆在暗底會整片沉掉（同 MR-014 站頭的處理）。
 *
 * **這個元件是獨立的第三種瀏覽模式，不疊在 `WorkRail` 裡。**
 * 理由是 Safari 的 `preserve-3d` 一遇到祖先 `overflow` 就會把整個 3D 壓平，
 * 而長廊本體是 `overflow-x: auto`（知識檔限制 1）。
 *
 * 三條硬要求對應到的結構（用戶指定，見 MR-017）：
 *
 * 1. **不卡住**——相機位移走 CSS transition（合成層），不寫 rAF 迴圈；
 *    地板流動是 `transform` 動畫不是 `background-position`（後者每帧重繪，
 *    而地板是全場最大的一塊平面）。減少動態時整個模式不提供。
 * 2. **不跑版**——裁切用的 `overflow: hidden` 放在 `.hall`，而 `perspective`
 *    在它的子層 `.hall__viewport`。裁切元素落在 3D 脈絡之外，才不觸發上述壓平。
 *    窄螢幕採**接受降級**（只收窄走廊與作品，幾何不動），見檔末的降級段。
 * 3. **點得開**——所有裝飾層一律 `pointer-events: none`，只有 `.piece` 是按鈕；
 *    走動不用拖曳，因此**完全不碰 `setPointerCapture`**（MR-014 的教訓：
 *    指標捕獲會把後續 click 改派給容器，作品全部點不開）。
 */

const props = defineProps<{ works: Work[]; viewKey: string }>()
const emit = defineEmits<{ open: [id: string] }>()

const { categories } = useLibrary()

const step = ref(0)
const hall = ref<HTMLElement | null>(null)
/** 走動中：只用來把地板流速拉快一下，不影響任何位置計算 */
const walking = ref(false)
/** 剛抵達：讓「站到面前」那一件亮一下，是「我確實換到下一件了」最直接的回饋 */
const arriving = ref(false)
let walkTimer = 0
let arriveTimer = 0

const total = computed(() => props.works.length)
const camera = computed(() => cameraZ(step.value))

/** 現在站在誰面前。清單縮短的那一帧可能還沒夾回來，故取值要能接受 undefined */
const current = computed<Work | undefined>(() => props.works[step.value])

/** 只渲染窗口內的作品——遠處那些一個像素都看不到，卻要進 3D 合成 */
const pieces = computed(() =>
  props.works
    .map((work, index) => ({
      work,
      index,
      slot: slotFor(index),
      passed: isPassed(index, step.value),
    }))
    .filter((item) => isVisible(item.index, step.value)),
)

function walk(delta: number): void {
  const next = clampStep(step.value + delta, total.value)
  if (next === step.value) return
  step.value = next
  walking.value = true
  window.clearTimeout(walkTimer)
  window.clearTimeout(arriveTimer)
  arriving.value = false

  /**
   * 兩個時窗，長度刻意不同：
   *
   * - `walking` **1700ms**——地板加速與兩道行進光帶（`.hall__pulse`、
   *   `.hall__wall::after`）都靠它。先前設 820ms，比動畫本身（1.05～1.15s）還短，
   *   於是光帶跑到一半就被移除、憑空消失。**那正是「感受不到連接動畫」的主因**：
   *   不是不夠亮，是根本沒播完。
   * - `arriving` 在 **760ms** 觸發，也就是相機補間（720ms）剛停的那一刻。
   *   它要對齊「到了」這件事，不能跟著 `walking` 一起拖到 1700ms。
   *   持續 **1900ms**——這個數字**必須等於** `piece-arrive` 的動畫長度（見該段 CSS）。
   *   短了就是同一個坑的翻版：class 先被拔掉，閃爍還沒播完就憑空消失。
   */
  walkTimer = window.setTimeout(() => {
    walking.value = false
  }, 1700)
  arriveTimer = window.setTimeout(() => {
    arriving.value = true
    arriveTimer = window.setTimeout(() => {
      arriving.value = false
    }, 1900)
  }, 760)
}

/**
 * 近景換大圖：縮圖只有 800px（`THUMB_MAX_EDGE`），走廊裡最近那件會佔到
 * 半個畫面寬，800px 撐不住（限制 4）。`src` 即 1800px 那張（`VIEW_MAX_EDGE`）。
 * 遠處維持縮圖，否則一次要載十幾張 1800px。
 */
function sourceFor(work: Work, index: number): string {
  return isNear(index, step.value) ? work.src : work.thumb
}

const currentLabel = computed(() =>
  current.value ? categoryOf(current.value.category, categories.value).label : '',
)

/**
 * 方向鍵掛在 **window** 上，**不靠 `.focus()` 把焦點搶過來**。
 *
 * 原本是掛載時呼叫 `hall.focus()`，讓方向鍵不必先點畫面就能用。代價是
 * Chrome 把那次程式化 focus 判成 `:focus-visible`，於是 `.hall` 被畫上整圈
 * 2px 的 accent 外框——**那就是一直被回報的「很明顯的長方形框」**。
 * 它在部分擷取條件下不會出現（`matches(':focus-visible')` 回 false），
 * 所以查了好幾輪才抓到。
 *
 * 改掛 window 之後：方向鍵照樣立刻可用、不搶焦點、也不畫框。
 * `tabindex="0"` 與 `:focus-visible` 樣式保留給真正用 Tab 鍵聚焦的人。
 */
function onKeydown(event: KeyboardEvent): void {
  // 詳情頁開著時方向鍵屬於它（切上一件／下一件），走廊不能同時吃
  if (document.querySelector('.detail')) return

  switch (event.key) {
    case 'ArrowRight':
      walk(1)
      break
    case 'ArrowLeft':
      walk(-1)
      break
    case 'Home':
      walk(-step.value)
      break
    case 'End':
      walk(total.value - 1 - step.value)
      break
    default:
      return
  }
  event.preventDefault()
}

/** 換分類或展覽時走回入口——留在第 12 件而清單只剩 3 件會直接走出牆外 */
watch(
  () => props.viewKey,
  () => {
    step.value = 0
  },
)

/** 清單縮短（刪作品、切篩選）時把相機夾回範圍內 */
watch(total, (next) => {
  step.value = clampStep(step.value, next)
})

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.clearTimeout(walkTimer)
  window.clearTimeout(arriveTimer)
})
</script>

<template>
  <section
    ref="hall"
    class="hall"
    :class="{ 'is-walking': walking }"
    tabindex="0"
    aria-label="走進展場"
    :style="{ '--cam': `${camera}px` }"
  >
    <p
      v-if="total === 0"
      class="hall__empty"
    >
      這個範圍還沒有作品
    </p>

    <div
      v-else
      class="hall__viewport"
    >
      <div class="hall__scene">
        <span
          class="hall__wall hall__wall--l"
          aria-hidden="true"
        />
        <span
          class="hall__wall hall__wall--r"
          aria-hidden="true"
        />

        <span
          class="hall__ceiling"
          aria-hidden="true"
        />

        <!-- 地板：流動層是獨立子層，動的是 transform 不是背景位置 -->
        <span
          class="hall__floor"
          aria-hidden="true"
        >
          <span class="hall__flow" />
          <span class="hall__ripple" />
          <span
            v-if="walking"
            :key="`pulse-${step}`"
            class="hall__pulse"
          />
        </span>

        <button
          v-for="item in pieces"
          :key="item.work.id"
          type="button"
          class="piece"
          :class="[
            `piece--${item.slot.side}`,
            { 'is-passed': item.passed, 'is-arriving': arriving && item.index === step },
          ]"
          :style="{ '--depth': `${item.slot.depth}px`, zIndex: total - item.index }"
          :data-index="item.index"
          :aria-label="`開啟作品：${item.work.title}`"
          @click="emit('open', item.work.id)"
        >
          <span class="piece__mat">
            <img
              class="piece__image"
              :src="sourceFor(item.work, item.index)"
              :alt="item.work.alt"
              decoding="async"
            >

            <!-- 疊印框：與牆面同一套語彙（WorkCard 的 card__reg），兩道互補色光框
                 往反方向錯位，相交處加成出白光 -->
            <span
              class="piece__reg piece__reg--a"
              aria-hidden="true"
            />
            <span
              class="piece__reg piece__reg--b"
              aria-hidden="true"
            />
          </span>
          <span class="piece__plate">{{ item.work.title }}</span>
        </button>
      </div>
    </div>

    <div
      v-if="total > 0"
      class="hall__hud"
    >
      <button
        type="button"
        class="hall__step hall__step--start"
        :disabled="step === 0"
        title="回到入口"
        @click="walk(-step)"
      >
        <span class="hall__step-label">⇤ START</span>
        <span class="hall__step-icon">⇤</span>
      </button>
      <button
        type="button"
        class="hall__step"
        :disabled="step === 0"
        @click="walk(-1)"
      >
        ← BACK
      </button>
      <p class="hall__pos">
        <span class="hall__pos-label">{{ currentLabel }} · </span>第 {{ step + 1 }} / {{ total }} 件
      </p>
      <button
        type="button"
        class="hall__step"
        :disabled="step >= total - 1"
        @click="walk(1)"
      >
        WALK ON →
      </button>
    </div>
  </section>
</template>

<style scoped>
/**
 * 裁切層。**不要在這一層加 transform-style**——它是 3D 脈絡的外側，
 * `overflow` 才不會把裡面的 preserve-3d 壓平（限制 1）。
 *
 * 底色是實心的，**這一條同時解掉了第八條限制**：走廊不透光，
 * `body::after` 的顆粒與光氛層的疊印色場在這裡看不到，
 * 也就不存在「固定紋理當參考系、把場景移動讀成圖片縮放」的錯覺（MR-017）。
 * 實體展場的走廊本來就是封閉的，看得到外面的環境光才奇怪。
 */
.hall {
  /* 牆面離中軸的距離＝走廊半寬。手機收窄（見檔末的降級段） */
  /**
   * 這三個值有一條**必須成立的不等式**：
   *   --lateral + --piece-max-w / 2  <  --half
   * 現值 380 + 260 = 640 < 760；手機 190 + 130 = 320 < 380
   *（作品已無裱框 padding，見 `.piece__mat`）
   * 看板是平行螢幕的平面、牆是縱深平面，兩者一定會相交——作品只要橫向超出牆的位置，
   * 靠近相機的那半就跑到牆外，被牆斜切掉一角（實測畫面：左右兩件各缺一個角）。
   * 改任何一個都要重算這條，不然就會再看到切角。
   */
  --half: 760px;
  /**
   * **380 → 300：兩邊都往內靠。**
   *
   * 380 有兩個實測問題，都只在「走到那一件面前」才看得到（當前那件被放大 1.32 倍）：
   *   1280×720 下直幅離左緣只剩 23px，貼著畫面邊
   *   橫幅走到它面前時右緣是 **-109px**——當前那件直接被切掉一角
   * 兩者同源：螢幕上的橫向位移是 `--lateral × 縮放`，縮放只作用在當前那件身上，
   * 所以站遠看都正常，走到面前才穿幫。
   *
   * 代價要說清楚：MR-018 記過「近距離感主要來自橫向被推出畫面」，往內靠會削掉一些。
   * 但「作品被切掉」不是風格取捨，是壞掉——留白讓步給完整度。
   *
   * **收到 250 而不是 300，是為了光暈**：300 時 1440×900 的橫幅右緣只剩 20px、
   * 1280×720 只剩 29px，圖沒被切但外圍那圈光（mat 的 78px ＋ 疊印框的 34px）
   * 整個貼在畫面邊上，讀起來還是「頂到邊」。留白要留給光，不是只留給圖。
   *
   * **決定值的是 1280×720，不是最大的那個螢幕**：橫向留白＝`螢幕半寬 −
   * lateral × 縮放 − 作品半寬`，螢幕越窄留白越少，而作品尺寸吃的是 `36vh`
   * 不是螢幕寬——寬度縮、高度不縮，最窄的桌機寬度必然是最緊的那一個。
   */
  --lateral: 250px;
  --piece-max-w: 520px;
  /**
   * 高度上限受**走廊淨高**約束，而且**要把透視縮放算進去**（這是踩過的坑）：
   *
   *   --piece-max-h × 縮放 + 展籤 × 縮放  <  走廊淨高
   *   縮放 = perspective / (perspective + HALL_LEAD) = 620 / 470 ≈ 1.32
   *   240 × 1.32 + 20 × 1.32 = 343 < 446 ✓
   *
   * 還有一條：**作品上緣必須落在 mask 的淡出區之外**（`.hall__viewport` 上下各
   * 淡出 8%），否則作品頂端會被淡掉，看起來就是「頂到上面」。
   *
   * 只算 CSS 尺寸不算縮放，就會像先前那樣「圖碰到上面頂端」——
   * 390 看起來安全（390 + 20 < 424），乘上 1.17 之後是 480，早就穿出去了。
   *
   * **這也是「再更近一點」的天花板**：LEAD 越負縮放越大，可用的 `--piece-max-h`
   * 就越小。近距離感其實主要來自**橫向被推出畫面**（`--lateral` × 縮放），
   * 不是靠把作品撐高——撐高只會撞到天花板。
   * 超過就會穿出地板，被地板平面斜切掉一條（實測：作品底部多一條灰帶）。
   * 現值 390 + 20 = 410 < 424（1440×900 下淨高約 424px）。
   *
   * **這個值決定直幅作品的存在感**：橫幅（3:2）被 `--piece-max-w` 封住，
   * 直幅（2:3）則一路被高度封住。
   */
  /**
   * **必須跟著視窗高走**。走廊高度＝`.app__main` 的剩餘空間，視窗越矮它越矮；
   * 寫死 px 在 1280×720 實測作品上緣是 **-3.1%**，整個頭被切掉。
   * `36vh` 在 900 高時是 324、720 高時收到 259，兩邊都塞得下（實測上緣仍 > 8%）。
   */
  /**
   * **px 上限 370 → 430，`36vh` 不動**——直幅放大，但只放在放得下的螢幕上。
   *
   * 兩個上限各擋一種螢幕，動錯一個就出事：`36vh` 擋矮螢幕，1280×720 下實測作品
   * 上緣只剩 **9.7%**，已經貼著 mask 的 8% 淡出區，再放大就是「圖被淡掉的頭」；
   * px 上限擋高螢幕，1080 高時 `36vh` 是 389 卻被 370 硬壓下來，白白浪費一段高度。
   * 所以只鬆 px 這一邊：矮螢幕仍由 `36vh` 接管，維持原尺寸不受影響。
   */
  --piece-max-h: min(430px, 36vh);

  position: relative;
  /**
   * **吃滿 `.app__main` 的剩餘空間**，不用 `--rail-h`。
   *
   * `--rail-h` 是為長廊的「一排卡片＋上下留白」設計的帶狀區；走廊用它會在上下
   * 各留一段空白，下方的延展感就斷在那裡，地板也接不到頁尾那條收邊線。
   *
   * 曾試過寫死 `clamp(420px, 72vh, 720px)`，**退回了**：1280×720 下
   * 走廊 518 + 站頭 138 + 頁尾 69 = 725 > 720 冒出垂直捲軸，捲軸吃掉寬度後
   * 光氛層那些 `100vw` 固定層又撐出水平捲軸，兩條「不跑版」E2E 立刻變紅。
   * `flex: 1` 沒有這個問題——它拿的是**剩下的**空間，本質上不可能超出。
   */
  flex: 1;
  min-height: 0;
  overflow: hidden;
  outline: none;
}

/**
 * 走廊的暗底**放在 `::before` 並且跟著淡出**，不能直接掛在 `.hall` 上。
 *
 * 掛在 `.hall` 上時它不吃 `.hall__viewport` 的 mask，於是「有壓暗」與「沒壓暗」
 * 在走廊上下緣突然切換——明暗突變會被眼睛讀成一條橫線，也就是那個
 * 「上下黑色框線的邊界感」。實測把光氛層整個隱藏，那條線就消失，
 * 證明它不是任何元素的 border，是這個對比邊。
 *
 * 中心較透＝消失點發亮，這是最便宜的一條縱深線索。
 */
.hall::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: radial-gradient(
    128% 96% at 50% 38%,
    rgb(9 9 17 / 0.02),
    rgb(4 4 9 / 0.2) 78%
  );
  mask-image: linear-gradient(
    to bottom,
    transparent 0,
    #000 8%,
    /* 下緣不淡出：光波與網格要一路延伸到畫面最下方，
       淡出會讓地板在半路收掉，下方就沒有延伸感了 */
    #000 100%
  );
}

.hall:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

/**
 * 3D 脈絡整條不吃指標，只有 `.piece` 收得到點擊。
 *
 * **這不是防禦性寫法，是實測踩到的**：viewport 是 `inset: 0` 的滿版元素，
 * 走動之後點作品會被它攔下（Playwright 直接報 `.hall__viewport intercepts
 * pointer events`），作品完全打不開——正是 MR-014 那個坑的另一種長相。
 * 裝飾層各自標 `pointer-events: none` 不夠，因為攔下點擊的是這兩層容器本身。
 */
.hall__viewport {
  position: absolute;
  inset: 0;
  pointer-events: none;
  perspective: 620px;
  /**
   * 視點高度。44% ＝站著看；往下移會讓消失點下降、地板露得更多、
   * 整條走廊在畫面上更靠下——「延展感」主要由這個值給，不是靠加大元素。
   */
  perspective-origin: 50% 52%;

  /**
   * 上下邊緣淡出，走廊才不會讀成**畫面中間一個明顯的長方形框**。
   *
   * `overflow: hidden` 給的是硬邊，加上站頭與頁尾各自的橫線，三條邊界疊在一起
   * 就框出一個盒子。淡出之後走廊是「往上下延伸出去」而不是「裱在框裡」。
   * 左右不淡出——那兩側本來就該被畫面切掉。
   *
   * **mask 掛在這一層而不是 `.hall`**：掛在 `.hall` 會把底下的 HUD
   * （BACK／WALK ON／件數）一起淡掉，按鈕會糊成半透明。這一層只有 3D 場景。
   */
  mask-image: linear-gradient(
    to bottom,
    transparent 0,
    #000 8%,
    /* 下緣不淡出：光波與網格要一路延伸到畫面最下方，
       淡出會讓地板在半路收掉，下方就沒有延伸感了 */
    #000 100%
  );
}

.hall__scene {
  position: absolute;
  inset: 0;
  pointer-events: none;
  transform-style: preserve-3d;
  /* 相機推進。transform 直接吃 --cam，走的是合成層，不觸發 layout */
  transform: translateZ(var(--cam));
  transition: transform 720ms var(--ease);
}

/**
 * ── 房間的四個面 ───────────────────────────────────────
 *
 * 垂直尺度是一組必須對齊的常數，改一個就要改全部，否則會出現縫：
 *   天花板 = `--ceil`（4%）／牆 = 從 `--ceil` 到 `--ground`／地板 = `--ground`（68%）
 *
 * 第一版把牆設成 `top: -60%; height: 220%`，結果牆底穿到地板以下，
 * 在地板外側露出一塊黑色梯形——牆與地板沒有共用同一條地平線就會這樣。
 *
 * **房間跟著相機走**（每個面都前置 `translateZ(calc(var(--cam) * -1))` 抵銷場景位移）。
 * 這條不是效能優化，是**正確性**：
 *
 * 第一版讓房間跟著場景一起後退，長度依件數算到 9250px。走到第 14 件時相機推進 5980，
 * 四個面同時**橫跨相機平面**（z = perspective = 620），而 CSS 3D **沒有近平面裁切**——
 * 元素只要跨越相機平面，整塊的投影就壞掉。實測畫面是地板、天花板、兩道牆全部消失，
 * 只剩一件作品飄在暗處（光波在地板上，地板沒了自然也沒了）。
 *
 * 房間跟著相機之後：長度固定、近端永遠在相機前方，不可能跨越。
 * 走廊沿長度是均勻重複的紋理，所以看不出它沒有後退；
 * **移動感本來就由作品位移與地板光波提供**，不是由牆面提供。
 *
 * `--near` 要略小於 `perspective`（620）：560 時放大約 10 倍，足以填滿畫面四角，
 * 又不會碰到相機平面。
 */
.hall__viewport {
  /* 天地拉到最開，走廊淨高 76% × --rail-h ≈ 424px，作品才放得下 */
  --ceil: 0%;
  --ground: 94%;
  /* 房間近端離相機多遠。必須 < perspective(620)，否則跨越相機平面整塊爆掉 */
  --near: 560px;
  /* 房間長度。跟著相機走之後就是固定值，不必再依件數算 */
  --depth-span: 5200px;
}

/* 暗場裡中性牆會整片沉掉，所以牆自帶一道由近而遠衰減的光。
   這與 MR-014「站頭的線與字都要自帶光暈」是同一個問題 */
.hall__wall {
  position: absolute;
  top: var(--ceil);
  height: calc(var(--ground) - var(--ceil));
  width: var(--depth-span);
  pointer-events: none;
  /**
   * 牆是**半透明疊加**，不是實心板。
   *
   * `to right` 對牆而言就是「由近到遠」（`rotateY(90deg)` 之後 local +X ＝往深處），
   * 所以遠端 alpha 收到 0.16——消失點附近讓背景光氛透出來，深度靠亮度差讀出來，
   * 不是靠再畫一層更黑的東西。這也讓走廊和站台其他部分是同一個空間，
   * 而不是嵌在畫面上的一個盒子。
   */
  background:
    linear-gradient(
      to right,
      color-mix(in srgb, var(--accent) 11%, transparent),
      transparent 42%
    ),
    linear-gradient(
      to right,
      rgb(17 17 27 / 0.52) 0%,
      rgb(11 11 20 / 0.26) 52%,
      rgb(8 8 15 / 0.06) 100%
    ),
    linear-gradient(to bottom, rgb(22 22 33 / 0.2), rgb(8 8 14 / 0.26));
}

/**
 * ── 掛畫線：把所有作品串成一條 ──────────────────────────
 *
 * 牆是 `rotateY(90deg)` 的，**局部的 Y 仍然是螢幕的 Y**，所以在牆上畫一條水平線，
 * 在畫面上就是一條沿走廊縱深、收向消失點的線——它穿過每一件作品的中心高度，
 * 視覺上把它們串起來。這是「連結」最直接的畫法：
 * 先前只有地板波前與抵達脈衝，那兩個都是**事件**，事件結束就沒了，
 * 沒有任何東西表示「這些作品屬於同一條動線」。
 *
 * 高度對齊 `.piece` 的 `top: 44%`。
 */
.hall__wall::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    transparent 43.7%,
    color-mix(in srgb, var(--accent) 30%, transparent) 44%,
    transparent 44.3%
  );
}

/**
 * 延續感：走動時，一段亮光沿著那條線往深處跑。
 *
 * 這一段跑的方向與距離就是「往前一件」——它從腳邊出發、越過下一件作品，
 * 所以看得到的是「從這一件連到下一件」，而不只是「有東西亮了一下」。
 */
.hall__wall::after {
  content: '';
  position: absolute;
  top: 43.4%;
  height: 1.2%;
  width: 900px;
  opacity: 0;
  background: linear-gradient(
    to right,
    transparent,
    color-mix(in srgb, var(--accent) 92%, transparent) 45%,
    color-mix(in srgb, var(--ink) 70%, transparent) 55%,
    transparent
  );
}

.hall.is-walking .hall__wall::after {
  animation: wall-run 1.55s cubic-bezier(0.33, 1, 0.68, 1);
}

@keyframes wall-run {
  from {
    transform: translateX(0);
    opacity: 0;
  }

  18% {
    opacity: 1;
  }

  to {
    transform: translateX(2600px);
    opacity: 0;
  }
}

/* 轉 90 度後局部 +X＝往場景深處，故往觀者延伸是 translateX 負值 */
/* translateZ 必須排在 rotate **之前**——那一步要在未旋轉的座標系裡抵銷相機 */
.hall__wall--l {
  left: calc(50% - var(--half));
  transform-origin: left center;
  transform: translateZ(calc(var(--cam) * -1)) rotateY(90deg) translateX(calc(var(--near) * -1));
}

/**
 * 右牆的 transform 與左牆**完全相同**，只有 `left` 不同。
 *
 * 原本多了一個 `scaleX(-1)` 想把漸層鏡像過來，結果**把後續 `translateX` 的方向
 * 一起反轉**了——右牆不是往觀者延伸 `--near`，而是往深處縮了 `--near`，
 * 近端切面就露在畫面右側，變成一塊有直角邊的長方形。
 * 暗色 accent 下混在暗背景裡看不出來，換到淺色 accent（新媒體）就一眼看到。
 *
 * 拿掉 `scaleX(-1)` 之後，兩道牆的近端位置與漸層方向都一致。
 * 法線朝向確實左右相反，但牆是純漸層、沒有 `backface-visibility`，看不出差別。
 */
.hall__wall--r {
  left: calc(50% + var(--half));
  transform-origin: left center;
  transform: translateZ(calc(var(--cam) * -1)) rotateY(90deg) translateX(calc(var(--near) * -1));
}

/* 天花板：參考圖有，第一版漏了，於是畫面上緣直接穿幫露出背景光氛 */
.hall__ceiling {
  position: absolute;
  left: 50%;
  top: var(--ceil);
  width: calc(var(--half) * 2);
  height: var(--depth-span);
  margin-left: calc(var(--half) * -1);
  pointer-events: none;
  transform-origin: top center;
  transform: translateZ(calc(var(--cam) * -1)) rotateX(-90deg)
    translateY(calc(var(--near) * -1));
  /**
   * to top ＝往深處（`rotateX(-90deg)` 之後）。
   *
   * **近端也只有 0.3 的 alpha**：先前 0.62 讓天花板在畫面上緣讀成一塊實心黑區，
   * 與站頭之間出現一條硬邊。壓到 0.3 之後底下的光氛層透得出來，
   * 天花板變成「暗處的一個面」而不是「貼上去的黑板」。
   * 白色那版試過並退回（`5ecda0c` / `c4f967d`）——問題從來不是顏色，是不透明度。
   */
  background: linear-gradient(to top, rgb(14 14 24 / 0.16), rgb(8 8 14 / 0.02) 54%);
}

.hall__floor {
  position: absolute;
  left: 50%;
  top: var(--ground);
  width: calc(var(--half) * 2);
  height: var(--depth-span);
  margin-left: calc(var(--half) * -1);
  overflow: hidden;
  pointer-events: none;
  transform-origin: top center;
  transform: translateZ(calc(var(--cam) * -1)) rotateX(90deg)
    translateY(calc(var(--near) * -1));
  background:
    repeating-linear-gradient(
      to right,
      color-mix(in srgb, var(--accent) 13%, transparent) 0 1px,
      transparent 1px 150px
    ),
    /* 同天花板：近端從 0.82 壓到 0.34，地板才不是畫面下緣的一塊黑區 */
    linear-gradient(to bottom, rgb(6 6 11 / 0.09), rgb(6 6 11 / 0));
}

/**
 * 光波：一道道沿深度推進的亮帶。
 *
 * 動的是 `transform: translateY`，不是 `background-position`——後者每帧重繪，
 * 而這塊平面是全場最大的一個元素（同 MR-016「色場用 scale 呼吸會逼模糊層
 * 每帧重新光柵化」的教訓）。
 *
 * 因為地板本身已經 `rotateX(90deg)`，往 +Y 走就是往場景深處流，
 * 透視自動給出「近處快、遠處慢」，不需要 JS 每帧算速度。
 */
.hall__flow {
  position: absolute;
  inset: -100% 0 0;
  /**
   * 兩層疊在一起，週期必須是 640 的因數才循環得無縫（160 × 4 = 640）：
   *
   * 1. **密的橫向刻度**（每 160px 一條細線）——垂直於前進方向的線是最強的距離線索。
   *    地板底層只有縱向線（沿深度收向消失點），那條給的是「方向」不是「距離」，
   *    走起來會覺得空間很平。**橫線要放在會流動的這一層**：房間跟著相機走，
   *    畫在地板底層的橫線不會動，等於白畫。
   * 2. 原本的寬亮帶——一道道往深處推進的光波。
   */
  background:
    repeating-linear-gradient(
      to bottom,
      color-mix(in srgb, var(--accent) 16%, transparent) 0 1px,
      transparent 1px 160px
    ),
    repeating-linear-gradient(
      to bottom,
      transparent 0 300px,
      color-mix(in srgb, var(--accent) 13%, transparent) 340px 366px,
      transparent 406px 640px
    );
  animation: hall-flow var(--flow-dur, 7s) linear infinite;
  will-change: transform;
}

/**
 * 第二層流動：**週期與速度都和第一層不同**（900px／11s vs 640px／7s）。
 *
 * 兩層等速等距只會看成「一組線在平移」；錯開之後兩者時而重疊時而錯開，
 * 起伏是自己長出來的，不是畫出來的——水波與銀河那種綿延感來自這裡。
 * 邊界用大範圍的軟漸層（不是硬邊），才不會讀成掃描線。
 */
.hall__ripple {
  position: absolute;
  inset: -100% 0 0;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0 240px,
    color-mix(in srgb, var(--accent) 9%, transparent) 430px 470px,
    transparent 660px 900px
  );
  animation: hall-ripple var(--ripple-dur, 11s) linear infinite;
  will-change: transform;
}

@keyframes hall-ripple {
  from {
    transform: translateY(0);
  }

  to {
    transform: translateY(900px);
  }
}

/**
 * 走動的波前：**每走一步射出一道往深處推的光帶**。
 *
 * 解的是「有沒有真的換到下一件」這個回饋——相機補間只有 720ms、
 * 且作品之間相似時，光看畫面很難確定自己動了。
 * 這道波前從腳下出發、穿過走廊、在下一件附近散掉，等於把「這一步」畫出來，
 * 也把前後兩件視覺上串起來。
 *
 * 用 `:key="step"` 讓 Vue 每步重建這個元素——CSS 動畫只在元素建立時從頭播，
 * 靠切 class 在連續走動時不會重播（class 還沒被移掉）。
 */
.hall__pulse {
  position: absolute;
  inset: -100% 0 0;
  background: linear-gradient(
    to bottom,
    transparent 0,
    color-mix(in srgb, var(--accent) 72%, transparent) 44%,
    color-mix(in srgb, var(--ink) 46%, transparent) 50%,
    color-mix(in srgb, var(--counter) 44%, transparent) 56%,
    transparent 100%
  );
  background-size: 100% 720px;
  background-repeat: no-repeat;
  background-position: 0 50%;
  animation: hall-pulse 1.6s var(--ease) both;
}

@keyframes hall-pulse {
  from {
    transform: translateY(-260px);
    opacity: 0;
  }

  22% {
    opacity: 1;
  }

  to {
    transform: translateY(1500px);
    opacity: 0;
  }
}

@keyframes hall-flow {
  from {
    transform: translateY(0);
  }

  to {
    transform: translateY(640px);
  }
}

/* 走動時加速：常駐慢流是氛圍，加速才是「我在移動」的回饋。
   兩者同速的話，地板只會被讀成「一直在動的東西」（MR-017）。
   只改變數不重設 animation，動畫才不會在切換的瞬間跳回起點 */
.hall.is-walking .hall__flow {
  --flow-dur: 1.6s;
}

.hall.is-walking .hall__ripple {
  --ripple-dur: 2.6s;
}

/**
 * ── 作品：正對螢幕的看板（MR-018）────────────────────────
 *
 * **不再 `rotateY(±90deg)` 貼在牆面上。** 貼牆的版本走廊感是有的，但作品永遠是
 * 側面——站在它旁邊時被透視壓成一條窄邊，等於為了空間感犧牲掉「看得到作品」，
 * 而作品才是這個站台的主角（D-003／MR-008）。
 *
 * 改為**看板式**：每件仍在 3D 場景裡、仍有深度與透視縮放，但**面永遠平行於螢幕**，
 * 所以任何角度都是完整的正面。深度給空間感、橫向偏移給左右兩列，
 * 走廊本身（牆／地板／天花板）維持不變，空間感照舊由它們提供。
 *
 * 順帶解掉待討論 #6（鎖寬還是鎖高）：正對螢幕之後 width/height 都是真實螢幕尺寸，
 * 直接給一個上限框、比例自己跑就好，不必二選一，也不裁切。
 */
/**
 * `z-index` 由深度倒著給（近的高），寫在 template 的 inline style 上。
 *
 * **畫面本來就是對的，壞的是命中測試**：`.piece__reg` 的 `mix-blend-mode` 會讓
 * 3D 子樹在做 hit-test 時被壓平，於是改用 DOM 順序決定誰先被打到——遠處那件排在
 * 後面就贏了。實測：走到第 2 件時點它，被第 4 件的 `.piece__image` 攔掉
 * （它就落在消失點附近，剛好在當前那件的正中央），而畫面上完全看不出來。
 *
 * 窄螢幕才重現得出來，因為作品接近置中；寬螢幕上兩件的螢幕投影錯得夠開。
 * 給了 z-index 之後命中順序與畫面順序一致，兩邊都不再靠運氣。
 */
.piece {
  position: absolute;
  left: 50%;
  /**
   * 掛畫線。**上下各有一條約束，44% 是同時滿足兩者的位置**（實測掃出來的）：
   *   上緣 > 11%（`.hall__viewport` 的 mask 上下各淡出 8%，落進去就會被淡掉，
   *              看起來就是「頂到上面」）
   *   下緣 < 78%（地平線在 `--ground` 80%，壓過去會被地板切掉）
   * 1440×900 實測：44% + `--piece-max-h: 240` → 上緣 12.3%、下緣 75.7%
   */
  top: 48%;
  padding: 0;
  /* 整條 3D 脈絡都是 none，作品這層要自己收回來 */
  pointer-events: auto;
  background: transparent;
  border: none;
  cursor: pointer;
}

/* 未旋轉的元素，transform 的軸就是螢幕軸：X 往右、Z 往觀者。
   `--depth` 是正值（越大越遠），所以推進畫面深處是負向 */
.piece--left {
  transform: translate3d(calc(-50% - var(--lateral)), -50%, calc(var(--depth) * -1));
}

.piece--right {
  transform: translate3d(calc(-50% + var(--lateral)), -50%, calc(var(--depth) * -1));
}

/**
 * **作品沒有裱框**——邊界只由一條光線界定，用的是牆面同一套語彙。
 *
 * 走過兩版才收斂到這裡：
 *   1. `--ink 12%` 的實心深色面板 → 在暗場裡讀成一塊板子，作品像貼在畫面前
 *   2. 透明底 + 14px padding → **還是黑框**。作品是亮白的，padding 區透出的
 *      牆面再暗一點都會被讀成一圈黑邊，跟背景是什麼顏色無關，是對比造成的
 *
 * 所以 padding 直接歸零：圖片邊緣就是邊界，外面只有光框與光暈。
 * 這與 MR-014「色彩只落在光與外框」是同一條原則——界定邊界的是光，不是色塊。
 */
.piece__mat {
  position: relative;
  display: block;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  box-shadow:
    0 0 78px -6px color-mix(in srgb, var(--accent) 55%, transparent),
    0 20px 46px rgb(0 0 0 / 0.42);
}

/**
 * 疊印霓虹框，**直接沿用牆面那一套**（`WorkCard.vue` 的 `.card__reg`）：兩道互補色
 * 光框往反方向錯位，`screen` 讓相交處加成出白光＝沒對準的兩塊光版。
 *
 * 走廊原本只有 `.piece__mat` 那一條 accent 細線，界定得出邊界但沒有霓虹感。
 * 沿用同一套而不是另寫一版：牆面與走廊是同一批作品的兩種呈現，
 * 邊框語彙分岔會讀成兩個站台。
 *
 * `--misreg` 是牆面拖曳時寫在軌道上的錯位量（MR-016）；走廊沒有那個手勢，
 * 取預設 1＝靜止時的原始錯位。刻意保留這個變數而不寫死，
 * 兩邊的 fallback 值才不會各自漂移。
 */
.piece__reg {
  position: absolute;
  inset: 0;
  /**
   * **純裝飾，絕不能接指標事件。**
   *
   * 牆面那套不需要這一行，走廊需要——這裡是 3D 場景，遠處那件的光框在螢幕空間
   * 會蓋到近處的作品上。實測：第 3 件的 `.piece__reg--b` 攔掉第 1 件的點擊，
   * 「作品點得開」（MR-017 三條硬要求之一）直接破功，而且只在窄螢幕重現得出來
   * ——寬螢幕上兩件的螢幕投影剛好不重疊。
   */
  pointer-events: none;
  /* 比牆面粗一階。走廊的作品是透視縮放過的，1px 在遠端會細到看不出顏色，
     而霓虹感全靠那兩道有色邊——線不見了就只剩一圈白光暈 */
  border: 2px solid;
  mix-blend-mode: screen;
  transition: transform 320ms var(--ease);
}

.piece__reg--a {
  border-color: var(--accent);
  box-shadow: 0 0 34px -3px var(--accent), inset 0 0 26px -8px var(--accent);
  transform: translate(calc(-9px * var(--misreg, 1)), calc(-8px * var(--misreg, 1)));
}

.piece__reg--b {
  border-color: var(--counter);
  box-shadow: 0 0 34px -3px var(--counter), inset 0 0 26px -8px var(--counter);
  transform: translate(calc(9px * var(--misreg, 1)), calc(8px * var(--misreg, 1)));
}

/**
 * 收攏對準**只給 hover／focus**，不給「當前這一件」。
 *
 * 一度把 `.is-current` 也收攏，那是錯的：走到作品面前正是它最大、最該有霓虹的時候，
 * 一對準兩道有色邊就重疊成一條白線，等於越靠近效果越弱。
 * 錯位是這個效果的本體，不是「還沒對準」的過渡狀態。
 */
.piece:hover .piece__reg,
.piece:focus-visible .piece__reg {
  transform: none;
}

.piece__image {
  display: block;
  /* 上限框：橫幅被寬度限制、直幅被高度限制，比例自己跑，兩種都不裁切 */
  max-width: var(--piece-max-w);
  max-height: var(--piece-max-h);
  width: auto;
  height: auto;
}

/**
 * 已走過的作品在相機側後方，透視會把它撐到極大——實測是一塊佔掉四分之一畫面的板子。
 *
 * 淡到**全透明**而不是留個 0.25：撐爆的尺寸讓任何殘留透明度都還是很顯眼。
 * 但**留在 DOM 裡**（可見窗口後方保 1 件），往回走時 `is-passed` 一解除就淡回來，
 * 不會憑空跳出。順便收回指標——身後的東西不該還能點到。
 */
.piece {
  transition: opacity 620ms var(--ease);
}

.piece.is-passed {
  opacity: 0;
  pointer-events: none;
}

/* 牆面展籤：等寬大寫置中於作品下方，取自參考圖的排版層級 */
.piece__plate {
  display: block;
  padding-top: 0.7rem;
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.16em;
  color: var(--ink-faint);
  text-align: center;
}

/**
 * 抵達脈衝：相機停下的那一刻，站到面前的那一件亮一下再收回去。
 *
 * 地板的波前是「這一步走了多遠」，這一下是「到的是這一件」——兩個回饋指的不是同一件事。
 * 相機補間只有 720ms，作品長得像的時候光看位移很難確定換了沒有。
 *
 * 用 class 切換而不是 `:key` 重建：作品是圖片，重建會重新解碼一次。
 * class 加上去就會從頭播動畫，這裡剛好夠用。
 */
/**
 * 抵達脈衝：**閃四下再收，不是亮一下**（1.9s，原本 1.1s 單次）。
 *
 * 單次脈衝讀起來像「亮度變了一下」，多次閃爍才讀得出是霓虹管點亮——
 * 疊印框已經是霓虹語彙，抵達回饋跟著同一套才不會各說各話。
 *
 * **間隔刻意不等距**（8/20/38/60%，越後面越疏）：等距會讀成機械式的閃爍指示燈，
 * 由密到疏才是「點著了、穩下來」。最後從 60% 收到 100% 有 760ms 慢慢暗回去，
 * 收尾比啟動慢，不然會像被人關掉。
 *
 * ⚠️ **動畫長度改了，JS 那邊的 `arriving` 時窗必須一起改**（見 `walk()` 裡的
 * 1900ms）。兩者不同步就會重演「光帶跑到一半被移除」那個 bug——class 先被拔掉，
 * 動畫還沒播完就憑空消失。
 */
.piece.is-arriving .piece__mat {
  animation: piece-arrive 1.9s var(--ease);
}

@keyframes piece-arrive {
  0%,
  14%,
  26%,
  44%,
  100% {
    border-color: color-mix(in srgb, var(--accent) 30%, transparent);
    box-shadow:
      0 0 78px -6px color-mix(in srgb, var(--accent) 55%, transparent),
      0 20px 46px rgb(0 0 0 / 0.42);
  }

  /* 第二下刻意只亮到一半——四下都全亮會讀成規律閃爍，不是點亮的過程 */
  20% {
    border-color: color-mix(in srgb, var(--accent) 58%, transparent);
    box-shadow:
      0 0 104px -2px color-mix(in srgb, var(--accent) 70%, transparent),
      0 20px 46px rgb(0 0 0 / 0.42);
  }

  8%,
  38%,
  60% {
    border-color: color-mix(in srgb, var(--accent) 85%, transparent);
    box-shadow:
      0 0 132px 2px color-mix(in srgb, var(--accent) 88%, transparent),
      0 20px 46px rgb(0 0 0 / 0.42);
  }
}

.piece:hover .piece__mat,
.piece:focus-visible .piece__mat {
  box-shadow:
    0 0 92px -2px color-mix(in srgb, var(--accent) 78%, transparent),
    0 24px 54px rgb(0 0 0 / 0.5);
}

.piece:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 6px;
}

/* ── HUD ────────────────────────────────────────────── */
.hall__hud {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  /* 貼著下緣：走廊已經延伸到頁尾線，HUD 再往上就會壓在地板中央 */
  padding: 0.35rem var(--page-x) 0.25rem;
  /**
   * **沒有底色**。原本是 `linear-gradient(to top, rgb(8 8 13 / 0.9), transparent)`，
   * 想讓按鈕在亮地板上讀得清楚——但它不在 `.hall__viewport` 的 mask 裡，
   * 底部 0.9 的不透明度又切齊走廊下緣，於是在畫面下方壓出一條**硬邊**。
   * 那正是「上下有該色系的線條邊界」裡最明顯的下面那條。
   *
   * 拿掉之後按鈕仍然讀得清楚：它們各自有 `rgb(18 18 26 / 0.9)` 的底，
   * 位置字另加一層文字陰影撐住對比。走廊因此直接延伸到頁尾，沒有斷點。
   */
}

.hall__step {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  color: var(--ink-soft);
  background: rgb(18 18 26 / 0.9);
  border: 1px solid var(--line-strong);
  border-radius: var(--card-radius);
  padding: 0.45rem 0.9rem;
  cursor: pointer;
  transition: color 200ms var(--ease), border-color 200ms var(--ease);
}

.hall__step:hover:not(:disabled),
.hall__step:focus-visible:not(:disabled) {
  color: var(--accent);
  border-color: var(--accent);
}

.hall__step:disabled {
  opacity: 0.4;
  cursor: default;
}

/* 回到入口：走深了之後要一步回到第一件，不必按十幾次 BACK。
   走的是同一個 walk()，所以波前與地板加速一併照舊 */
.hall__step--start {
  letter-spacing: 0.16em;
}

.hall__step-icon {
  display: none;
}

.hall__pos,
.hall__empty {
  font-family: var(--font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.1em;
  color: var(--ink-faint);
}

/* HUD 沒有底色之後，位置字要自己撐住對比——地板亮起來時才不會糊掉 */
.hall__pos {
  text-shadow: 0 1px 10px rgb(4 4 9 / 0.9), 0 0 3px rgb(4 4 9 / 0.8);
}

.hall__empty {
  display: grid;
  place-items: center;
  height: 100%;
}

/**
 * ── 窄螢幕：接受降級（待討論 #5，用戶拍板）─────────────
 *
 * 不另做一套版面，同一份程式碼把走廊收窄、作品放大——一次看一件。
 * 這正是知識檔限制 2 說的「退化成 slideshow」，是**已知且被接受的代價**，
 * 換到的是不必維護第二套窄螢幕版面與第二組 E2E。
 *
 * 只調三個量：走廊半寬、作品寬、HUD 排列。幾何與相機完全不動——
 * 一動就變成兩套要各自驗的東西了。
 */
@media (max-width: 899px) {
  .hall {
    /**
     * ⚠️ **這裡由第三條不等式（作品撞畫面）決定，不是由撞牆那條**（MR-019）。
     *
     * 舊值 `--lateral: 190` / `--piece-max-w: 260` 撞牆那條算得漂亮
     * （190 + 130 = 320 < 380），但 390×844 實測直幅左緣 **−202px**、
     * 橫幅右緣 **−296px**——當前那件有一大半在畫面外。後果不只是難看：
     * 元素中心點落到視窗外，**Playwright 點不到，真人也點不到**，
     * 直接違反 MR-017 自己列的三條硬要求之一「作品點得開」。
     *
     * 手機的算式解不出「既保留左右交錯、作品又夠大」：360 寬時螢幕半寬只有 180，
     * 光是舊的 `--piece-max-w: 260` 換算到螢幕就是 343px（×1.32 透視縮放），
     * 比整個螢幕還寬——**就算 `--lateral` 收到 0 也塞不下**。
     * 所以兩個都得收：作品縮到螢幕的三分之二，左右偏移只留一點暗示。
     *
     * 收完等於「幾乎置中、一次看一件」——這正是 MR-017 講的降級樣貌，
     * 只是先前的值沒有真的收到那個程度。
     *
     * **基準取 360 寬不是 390**：iPhone SE 與多數 Android 是 360，
     * 390 過關但 360 還差 14px，就等於一整批機型仍然踩得到。窄的那個才是要滿足的。
     */
    --half: 380px;
    --lateral: 20px;
    --piece-max-w: 160px;
    --piece-max-h: 190px;
  }

  .hall__viewport {
    --ceil: 0%;
    --ground: 78%;

    perspective: 460px;
  }

  .piece__mat {
    padding: 10px;
  }

  .hall__hud {
    gap: 0.75rem;
    padding: 0.7rem 0.75rem;
  }

  .hall__pos {
    flex: 1;
    text-align: center;
    font-size: 0.6rem;
  }

  /* 分類名太長會把兩顆鈕擠掉，窄螢幕只留「第 n / 共 m」 */
  .hall__pos-label {
    display: none;
  }

  .hall__step {
    padding: 0.4rem 0.55rem;
    font-size: 0.58rem;
  }

  /* 三顆鈕在窄螢幕會擠掉位置字，START 收成純圖示 */
  .hall__step--start {
    font-size: 0.78rem;
    padding: 0.3rem 0.5rem;
  }

  .hall__step-label {
    display: none;
  }

  .hall__step-icon {
    display: inline;
  }
}

/* 減少動態時本模式根本不會被提供（見 App.vue），這裡是最後一道保險 */
@media (prefers-reduced-motion: reduce) {
  .hall__scene {
    transition: none;
  }

  .hall__flow,
  .hall__ripple,
  .hall__pulse,
  .hall__wall::after {
    animation: none;
  }
}
</style>
