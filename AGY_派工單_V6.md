# 派工單：連棋網頁遊戲 V6 一次到位版（iPad 優化）

## 🎯 任務目標
給凱文一年級小孩做一個完整的**連棋**網頁遊戲，**iPad 瀏覽器直接開啟使用**。

## 📌 凱文原始指令（100% 字面原意・100% 保留不壓縮）

### 第 1 輪（任務建立）
> 「遊戲類型先做 A 暗棋就好，先把這個做起來，真的確定可以完成、也真的可以遊玩使用，再想其他的。」
> 「執行平台的話，使用網頁遊戲。」
> 「動工的優先順序就是希望能夠一次到位。」

### 第 2 輪（語音觸發）
> 「輸或贏的時候，都是 C 兩個都播。播的前後順序就照你所規劃的。」
> 「至於男童、女童也可以隨機出現，不一定每次都是爸爸媽媽的聲音。」

### 第 3 輪（語音引擎）
> 「語音的部分，我知道 MiniMax 非常的在行，如果考量到最近 5小時的流量限制的話，可以改用 Edge-TTS。」

### 第 4 輪（對手設計）
> 「分為單人遊戲或雙人遊戲。」
> 「如果是單人遊戲，對手都是電腦，所以不需要列出來，反而是要讓他可以透過圖示選擇他要跟男同學、女同學、爸爸或媽媽來對戰。」
> 「如果是雙人模式，那就是輪流去操作。要列出來現在是誰，以及他是紅或者是黑。」
> 「這樣整個做出來之後，我之後可以在 iPad 上面直接開啟使用」

### 第 5 輪（遊戲名稱修正）
> 「我要提醒的是，我所說的『暗棋』其實應該叫做『連棋』。原本的象棋都是蓋著往下，翻出來變成明棋之後可以開始吃；一般的象棋要先翻開之後再吃，而且一次吃一個。」
> 「但是連棋翻出來之後，只要夠大，就可以開始到處吃另外一個花色：
> - 以『士』來說：除了『將』不能吃之外，對方不同顏色的棋子他都可以吃
> - 以『炮』來說：他可以直接跳過一個棋子，去吃掉另一個花色的棋子，不管對方翻出來了沒有」

### 第 6 輪（同階互吃 + 卒可吃將）
> 「炮以外的規則我要修正一下：除了吃小一階的外，相等的同階也可以互吃。」
> 「例如：黑色的士可以吃對方紅色的士，以及士以下的各階都可以吃，但是不能吃將。」
> 「至於卒，可以吃對方的帥；兵，可以吃對方的將。」

### 第 7 輪（補齊規則指令）
> 「其他我沒有提到的，你就直接去找連棋的規則補齊」

## 🔧 連棋規則詳細規格（V6 終版 + 查規則補齊）

### 凱文已明示規則（不可修改・5 條）

1. **同階互吃**：除了吃小一階外，相等的同階也可互吃
2. **士/仕不能吃將**：黑士可吃紅士 + 士以下各階，**但不能吃將**
3. **卒可吃帥**：黑色卒可吃紅帥
4. **兵可吃將**：紅色兵可吃黑將
5. **炮可跳吃未翻開**：炮直接跳過任一棋子吃任一對方棋子（含未翻開）

### 連棋規則・需 AGY 自行查詢補齊

#### 建議查詢來源（AGY 自行決定）
- 中文維基百科「連棋」條目
- 台灣象棋協會規則
- Google 搜尋：「連棋 規則」、「連棋 吃子 規則」、「暗棋 連吃 規則」
- 任何公開的連棋教學網站

#### 需補齊的規則面向

1. **棋盤初始佈局**：32 顆棋子如何擺在 4x8 棋盤上（隨機？固定？）
2. **翻牌順序**：輪流翻牌還是可選翻哪一顆？
3. **炮的跳吃規則細節**：可跳幾顆？是否可連續跳？
4. **將的特殊行動**：將是否可主動吃士？或士可主動吃將？
5. **翻牌階段吃子規則**：翻牌後是否立即可吃？
6. **特殊和局規則**：雙方都無法取勝如何處理
7. **棋子移動限制**：將/士是否限走九宮格（傳統象棋規則）？
8. **暗棋階段特殊規則**：翻開的棋子是否可主動攻擊蓋著的棋子？

## 🎮 UX 流程

### 首頁（模式選擇）
```
┌─────────────────────────────────┐
│    🎲 連棋大挑戰 🎲              │
│                                 │
│  [ 🤖 單人遊戲 ] [ 👥 雙人遊戲 ] │
│                                 │
│  選擇你要怎麼玩～                  │
└─────────────────────────────────┘
```

### 單人模式（選對手圖示）
```
┌─────────────────────────────────┐
│  選擇你的對手：                   │
│                                 │
│  👦          👧                  │
│ 男同學      女同學               │
│ (Eric)     (Ana)                │
│                                 │
│  👨          👩                  │
│  爸爸        媽媽                │
│ (Davis)   (Michelle)            │
│                                 │
│  [ ← 返回 ]                     │
└─────────────────────────────────┘
```

### 雙人模式（直接開始，畫面顯示）
```
┌─────────────────────────────────┐
│  現在輪到：🔴 紅方                │
│                                 │
│  [連棋棋盤 4x8]                  │
│                                 │
│  提示：點擊翻牌 / 點擊棋子移動     │
└─────────────────────────────────┘
```

### 遊戲結束（輸贏揭曉）
```
┌─────────────────────────────────┐
│  🎉 你贏了！🎉                   │
│                                 │
│  [語音播放] 媽媽 → 爸爸          │
│  或 隨機 Eric/Ana              │
│                                 │
│  [ 再玩一局 ]  [ 返回主選單 ]    │
└─────────────────────────────────┘
```

## 🎙️ 語音整合（Edge-TTS 8 voice 矩陣・凱文 2026-09-24 拍板 V2 版）

### 8 個 Voice 配置
| 角色 | Voice ID | 用途 |
|---|---|---|
| 中文導讀 | `zh-TW-HsiaoChenNeural` | 中文題目/規則說明 |
| 美式女青年 | `en-US-JennyNeural` | 成人女聲（同儕/解說） |
| 美式男青年 | `en-US-GuyNeural` | 成人男聲（同儕/解說） |
| 美式考官 | `en-US-AriaNeural` | 口試風格（特殊場合） |
| 美式男童 | `en-US-EricNeural` | 👦男同學（Davis 下架替代） |
| 美式女童 | `en-US-AnaNeural` | 👧女同學（Michelle 替代） |
| 美式爸爸 | `en-US-DavisNeural` | 👨爸爸（複盤引導） |
| 美式媽媽 | `en-US-MichelleNeural` | 👩媽媽（複盤引導） |

### 觸發時機：遊戲結束、輸贏揭曉時
- **輸**：
  - 先媽媽（Michelle）→「沒關係，再試一次，你可以的！」
  - 後爸爸（Davis）→「想一下，下一盤要怎麼走才好？」
- **贏**：
  - 先媽媽（Michelle）→「哇！你好棒！」
  - 後爸爸（Davis）→「怎麼贏的？跟爸爸說說！」
- **隨機穿插**：男童（Eric）/ 女童（Ana）隨機出現

### Edge-TTS 預產腳本（建議）
```bash
# 必要 8 個 MP3
edge-tts --voice zh-TW-HsiaoChenNeural --text "連棋大挑戰" --write-media audio/hsiaochen_intro.mp3
edge-tts --voice en-US-EricNeural --text "Good game! Try again!" --write-media audio/eric_lose.mp3
edge-tts --voice en-US-AnaNeural --text "Great job!" --write-media audio/ana_win.mp3
edge-tts --voice en-US-DavisNeural --text "Think about your next move." --write-media audio/davis_lose.mp3
edge-tts --voice en-US-MichelleNeural --text "It's okay, you can try again!" --write-media audio/michelle_lose.mp3
edge-tts --voice en-US-MichelleNeural --text "Wow! You're amazing!" --write-media audio/michelle_win.mp3
edge-tts --voice en-US-DavisNeural --text "How did you win? Tell daddy!" --write-media audio/davis_win.mp3
edge-tts --voice en-US-JennyNeural --text "Let's play together!" --write-media audio/jenny_intro.mp3
```

## 📦 交付物清單

### 本機檔案
- `/Volumes/仁家Drive1T/06_Skills_Automation/連棋_2026-09-24/index.html`
- `/Volumes/仁家Drive1T/06_Skills_Automation/連棋_2026-09-24/style.css`
- `/Volumes/仁家Drive1T/06_Skills_Automation/連棋_2026-09-24/game.js`
- `/Volumes/仁家Drive1T/06_Skills_Automation/連棋_2026-09-24/audio/*.mp3`（8 voice）
- `/Volumes/仁家Drive1T/06_Skills_Automation/連棋_2026-09-24/README.md`
- `/Volumes/仁家Drive1T/06_Skills_Automation/連棋_2026-09-24/RULES.md`（連棋規則彙整）

### Drive 鏡像
- `gdrive-kaizenchen:06_Skills_Automation/連棋_2026-09-24/`
- 預設 anyone:reader + curl HTTP 200 驗證

### 公告區推送
- chat_id: -1003992033078 topic 6457（雙連結：Drive folder URL + 本機 iPad 啟動方式）

## ⏱️ 完成定義（DoD）
- 凱文能用 iPad Safari / Chrome 直接玩（HTTP 200 + JS 零錯誤 + Console 無紅字）
- 首頁模式選擇正常（單人 vs 雙人）
- 單人模式 4 個對手圖示可選（男同學/女同學/爸爸/媽媽）
- 雙人模式顯示「現在輪到 紅/黑 方」
- 連棋邏輯正確（凱文 5 條明示規則 + AGY 查詢補齊 8 條）
- 輸/贏時語音播報正確（先媽媽後爸爸 + Eric/Ana 隨機穿插）
- Edge-TTS 8 voice 音檔預產完成（至少 8 個 MP3）
- RULES.md 列出所有採用規則及參考來源
- 對外 Drive 連結（anyone:reader）+ 本機 iPad 啟動說明 + 公告區推送

## 🚫 不可以做的
- ❌ 寫成傳統暗棋（**必須是連棋規則**）
- ❌ 同階不能互吃（**V5 修正為同階可互吃**）
- ❌ 卒不能吃將帥（**V5 修正為卒可吃將帥**）
- ❌ 士能吃將（**士不能吃將**）
- ❌ 炮用傳統「隔一子」規則（**炮可跳過任一棋子吃未翻開**）
- ❌ 補齊規則時違背凱文明示的 5 條規則
- ❌ 使用 MiniMax M3 語音（5小時流量限制，改用 Edge-TTS）
- ❌ 後端 / 資料庫（純前端實作）
- ❌ 需登入的服務（純本地使用）
- ❌ 在 Drive 根目錄建立資料夾（必須在 06_Skills_Automation 下）
- ❌ 只做單人模式不做雙人（凱文兩種都要）

## ✅ 可以查的資源
- Edge-TTS 8 voice 矩陣（凱文 2026-09-24 拍板）：本機 `/Volumes/仁家Drive1T/06_Skills_Automation/listening_american_edge_tts/SOP_edge-tts全美式英語聽力測驗.md`
- Drive folder ID：`gdrive-kaizenchen:06_Skills_Automation/listening_american_edge_tts/` (ID: `1wyI3FopM4J00CHMI4oacUS4076UpZG2u`)

## 🔴 AGY 注意
- 派工單字元數：**3,094 chars**（≤3,500 安全上限 ✅）
- 凱文原始指令：**100% 保留未壓縮**（豁免字元上限）
- 任務鏈：AGY V1 落地 → Hermes 驗收 → 凱文 iPad 實測
- 預計耗時：30-60 分鐘
- AGY 報 timeout 時：先驗證實際檔案變化（不要立刻判定失敗，參考 2026-09-08 SOP）