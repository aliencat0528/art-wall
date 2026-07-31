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
  // 720ms 是相機的補間長度，多留一點才不會在還在走的時候就把流速收回去
  window.clearTimeout(arriveTimer)
  arriving.value = false
  walkTimer = window.setTimeout(() => {
    walking.value = false
    // 相機停下的那一刻才亮——早於此會和位移混在一起，讀不出是「到了」
    arriving.value = true
    arriveTimer = window.setTimeout(() => {
      arriving.value = false
    }, 760)
  }, 820)
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

function onKeydown(event: KeyboardEvent): void {
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
  // 進走廊就把焦點交給它，方向鍵才立刻能走（不必先點一下畫面）
  hall.value?.focus()
})

onBeforeUnmount(() => {
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
    @keydown="onKeydown"
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
          :style="{ '--depth': `${item.slot.depth}px` }"
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
  --lateral: 380px;
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
  --piece-max-h: 240px;

  position: relative;
  height: var(--rail-h);
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
    118% 78% at 50% 42%,
    rgb(9 9 17 / 0.04),
    rgb(4 4 9 / 0.38) 74%
  );
  mask-image: linear-gradient(
    to bottom,
    transparent 0,
    #000 8%,
    #000 86%,
    transparent 100%
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
  /* 視點略高於畫面中線＝站著看的高度，與參考圖同 */
  perspective-origin: 50% 44%;

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
    #000 86%,
    transparent 100%
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
  --ground: 80%;
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
    linear-gradient(to bottom, rgb(6 6 11 / 0.18), rgb(6 6 11 / 0.03));
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
  animation: hall-pulse 1.15s var(--ease) both;
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
  top: 44%;
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
 * 所以 padding 直接歸零：圖片邊緣就是邊界，外面只有一條 accent 細線與光暈。
 * 這與 MR-014「色彩只落在光與外框」是同一條原則——界定邊界的是光，不是色塊。
 */
.piece__mat {
  display: block;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  box-shadow:
    0 0 78px -6px color-mix(in srgb, var(--accent) 55%, transparent),
    0 20px 46px rgb(0 0 0 / 0.42);
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
.piece.is-arriving .piece__mat {
  animation: piece-arrive 760ms var(--ease);
}

@keyframes piece-arrive {
  30% {
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
  padding: 0.9rem var(--page-x);
  background: linear-gradient(to top, rgb(8 8 13 / 0.9), transparent);
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
    /* 同樣要滿足上面那條不等式：190 + (260+28)/2 = 334 < 380 */
    --half: 380px;
    --lateral: 190px;
    --piece-max-w: 260px;
    --piece-max-h: 200px;
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
  .hall__pulse {
    animation: none;
  }
}
</style>
