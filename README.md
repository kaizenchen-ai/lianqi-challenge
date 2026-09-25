# 🎲 連棋大挑戰（Lianqi Challenge）V6 一次到位版

> **專為凱文國小一年級小朋友量身打造・iPad 瀏覽器直接開啟遊玩・極致流暢純前端體驗**

---

## 📖 專案簡介
本遊戲依據凱文 2026-09-24 派工需求全新開發，打造正宗台灣**連棋（暗棋連吃模式）**網頁版。  
具備超大觸控棋格、仿真木紋棋盤、3D 立體象棋質感、同階互吃、炮翻山跳吃暗棋、連吃 Combo 機制，以及 8 Voice 美式/台灣真人語音陪伴（先媽媽後爸爸、隨機穿插同學語音）。

---

## 🎮 核心特色

1. **凱文 5 大明示規則 100% 貫徹**：
   - ⚔️ **同階互吃**：士吃士、車吃車、象吃象、馬吃馬、炮吃炮、兵吃兵！
   - 🛡️ **士不能吃將**：仕/士可吃相車馬炮兵，**但絕對不能吃將/帥**！
   - 👑 **卒可吃帥、兵可吃將**：小卒立大功，相剋反撲！
   - 💣 **炮跳吃暗棋**：炮隔一子跳吃，**未翻開之暗棋亦可直接跳吃揭殺**！
   - 🔥 **連吃 Combo**：吃子後若相鄰仍有合法敵棋，可不限次數連續吃子，爽度破表！

2. **iPad 與大螢幕平板最佳化**：
   - 防誤觸縮放（`touch-action: manipulation`）。
   - 60~90px 超大觸控目標與醒目楷體大字。
   - 支援 Safari「加入主畫面」（PWA 全螢幕模式）。

3. **兩種遊玩模式**：
   - 🤖 **單人模式（VS 電腦）**：可自選 4 大個性化對手：
     - 👦 **男同學 (Eric)**：活潑開朗、入門好夥伴（Level 1）
     - 👧 **女同學 (Ana)**：機智靈活、穩健防守（Level 2）
     - 👨 **爸爸 (Davis)**：沉著老練、車馬炮連鎖進攻（Level 3）
     - 👩 **媽媽 (Michelle)**：細心縝密、高手深謀遠慮（Level 4）
   - 👥 **雙人模式（輪流操作）**：面對面對弈，即時指示「當前輪到：🔴 紅方 / ⚫ 黑方」。

4. **8 Voice 雙語音揭曉矩陣（Edge-TTS Azure Neural）**：
   - 輸贏揭曉時依規格觸發：**先媽媽（Michelle）鼓勵 → 後爸爸（Davis）複盤引導**。
   - 隨機穿插 **男同學（Eric）** 或 **女同學（Ana）** 的熱情歡呼！
   - Web Audio 原生合成木質敲擊、落子、吃子、Combo 音階等零延遲即時反饋。

---

## 📱 iPad 快速啟動指南

### 方式一：Mac 本地區網直接連線（推薦，最順暢）

1. 在 Mac 終端機執行本機靜態伺服器：
   ```bash
   cd "/Volumes/仁家Drive1T/06_Skills_Automation/連棋_2026-09-24"
   python3 -m http.server 8080
   ```
2. 查詢 Mac 的區域 IP（例如 `192.168.1.100`）：
   ```bash
   ipconfig getifaddr en0
   ```
3. 在 iPad 打開 Safari 或 Chrome 瀏覽器，網址輸入：
   ```text
   http://192.168.1.100:8080
   ```
4. **全螢幕遊玩（強烈推薦）**：在 Safari 點擊「分享按鈕 (箭頭向上)」→ 選擇「加入主畫面」，iPad 桌面就會出現「連棋大挑戰」圖示，點開就像原生 App 一樣全螢幕遊玩！

---

## 📂 檔案目錄結構

```text
/Volumes/仁家Drive1T/06_Skills_Automation/連棋_2026-09-24/
├── index.html            # 遊戲主頁面（首頁、對手選單、4x8棋盤、結算彈窗）
├── style.css             # 專屬 iPad 樣式表（木紋、3D圓形棋子、連吃光環）
├── game.js               # 遊戲核心引擎（連棋規則、Combo判定、4級AI、音效系統）
├── RULES.md              # 連棋完整規則與規格書（凱文 5 條 + 補齊 8 條）
├── README.md             # 本說明文件
└── audio/                # Edge-TTS 8 Voice 語音音檔 (MP3)
    ├── hsiaochen_intro.mp3  # 台灣中文女聲導讀
    ├── jenny_intro.mp3      # 美式女青年
    ├── guy_intro.mp3        # 美式男青年
    ├── aria_ready.mp3       # 美式考官
    ├── eric_win.mp3         # 男同學贏局讚揚
    ├── eric_lose.mp3        # 男同學安慰
    ├── ana_win.mp3          # 女同學贏局讚揚
    ├── ana_lose.mp3         # 女同學安慰
    ├── michelle_win.mp3     # 媽媽贏局讚美 ("Wow! You're amazing!")
    ├── michelle_lose.mp3    # 媽媽輸局安慰 ("It's okay, you can try again!")
    ├── davis_win.mp3        # 爸爸複盤引導 ("How did you win? Tell daddy!")
    └── davis_lose.mp3       # 爸爸思考提點 ("Think about your next move.")
```

---

## ☁️ Google Drive 雲端鏡像
- 雲端路徑：`gdrive-kaizenchen:06_Skills_Automation/連棋_2026-09-24/`
- 權限設定：`anyone:reader` 公開可讀

---

## ⚖️ 智慧財產與授權
本遊戲為凱文家庭專屬教育遊戲工具，整合純前端 HTML5 / Web Audio API 與 Edge-TTS 語音技術。
