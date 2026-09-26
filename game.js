/**
 * 象棋大對決 (Xiangqi Battle) - 連棋與傳統暗棋雙模式版 (V7.0)
 * 支援：
 * 1. 🔥 連棋模式（連吃 Combo 爽快版・支援同階互吃、士不吃將、卒吃帥、炮跳吃暗棋、連吃不限次數）
 * 2. 🎯 傳統暗棋（經典一步棋版・一回合一步、吃子即換手、炮跳吃明棋）
 * 3. 🤖 單人對戰 4 位個性化 AI (Eric, Ana, Davis, Michelle) + 👥 雙人面對面對局
 * 4. 8 Voice 雙語音揭曉 (先媽媽鼓勵 -> 後爸爸複盤引導)
 */

const GameApp = (() => {
  // --- 棋子階級設定 ---
  // Rank: 7: 帥/將, 6: 仕/士, 5: 相/象, 4: 俥/車, 3: 傌/馬, 2: 炮/包, 1: 兵/卒
  const PIECE_DEFS = {
    red: [
      { name: '帥', rank: 7, count: 1, isCannon: false },
      { name: '仕', rank: 6, count: 2, isCannon: false },
      { name: '相', rank: 5, count: 2, isCannon: false },
      { name: '俥', rank: 4, count: 2, isCannon: false },
      { name: '傌', rank: 3, count: 2, isCannon: false },
      { name: '炮', rank: 2, count: 2, isCannon: true },
      { name: '兵', rank: 1, count: 5, isCannon: false }
    ],
    black: [
      { name: '將', rank: 7, count: 1, isCannon: false },
      { name: '士', rank: 6, count: 2, isCannon: false },
      { name: '象', rank: 5, count: 2, isCannon: false },
      { name: '車', rank: 4, count: 2, isCannon: false },
      { name: '馬', rank: 3, count: 2, isCannon: false },
      { name: '包', rank: 2, count: 2, isCannon: true },
      { name: '卒', rank: 1, count: 5, isCannon: false }
    ]
  };

  const OPPONENT_PROFILES = {
    eric: { name: 'Boy(Kevin)', avatar: '👦', desc: '入門練習・活潑開朗', level: 1 },
    ana: { name: 'Girl(Anna)', avatar: '👧', desc: '機智靈活・穩健防守', level: 2 },
    davis: { name: 'Father(Dad)', avatar: '👨', desc: '沉著老練・車馬炮佈局', level: 3 },
    michelle: { name: 'Mother(Mom)', avatar: '👩', desc: '細心縝密・高手挑戰', level: 4 }
  };

  // --- 語音音檔路徑 ---
  const AUDIO_FILES = {
    intro_zh: 'audio/hsiaochen_intro.mp3',
    intro_jenny: 'audio/jenny_intro.mp3',
    intro_guy: 'audio/guy_intro.mp3',
    ready_aria: 'audio/aria_ready.mp3',
    eric_win: 'audio/eric_win.mp3',
    eric_lose: 'audio/eric_lose.mp3',
    ana_win: 'audio/ana_win.mp3',
    ana_lose: 'audio/ana_lose.mp3',
    michelle_win: 'audio/michelle_win.mp3',
    michelle_lose: 'audio/michelle_lose.mp3',
    davis_win: 'audio/davis_win.mp3',
    davis_lose: 'audio/davis_lose.mp3'
  };

  // --- 遊戲狀態 ---
  let soundEnabled = true;
  let audioContext = null;
  let currentAudio = null;

  let ruleMode = 'lianqi'; // 'lianqi' (連棋/連吃) | 'banqi' (傳統暗棋/一步棋)
  let playType = 'single'; // 'single' (單人AI) | 'dual' (雙人)
  let opponentKey = 'eric';

  const ROWS = 4;
  const COLS = 8;
  let board = [];
  let playerColor = null;
  let opponentColor = null;
  let currentTurn = 'player';
  let selectedPos = null;
  let validTargets = [];
  let comboActive = false;
  let comboPos = null;
  let comboCount = 0;
  let consecutiveNoCapture = 0;
  let deadPieces = { red: [], black: [] };
  let isGameOver = false;

  // --- Web Audio 零延遲合成音效 ---
  function initAudioContext() {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
      }
    }
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
    }
  }

  function playSynthSfx(type) {
    if (!soundEnabled) return;
    initAudioContext();
    if (!audioContext) return;

    try {
      const now = audioContext.currentTime;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);

      if (type === 'flip') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(340, now);
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.12);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'move') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.14);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
        osc.start(now);
        osc.stop(now + 0.14);
      } else if (type === 'capture') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(480, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.22);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'combo') {
        const freqs = [350, 440, 560, 700];
        freqs.forEach((freq, idx) => {
          const o = audioContext.createOscillator();
          const g = audioContext.createGain();
          o.connect(g);
          g.connect(audioContext.destination);
          o.type = 'triangle';
          o.frequency.setValueAtTime(freq, now + idx * 0.08);
          g.gain.setValueAtTime(0.35, now + idx * 0.08);
          g.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.08 + 0.16);
          o.start(now + idx * 0.08);
          o.stop(now + idx * 0.08 + 0.16);
        });
      } else if (type === 'win') {
        const notes = [261.63, 329.63, 392.00, 523.25];
        notes.forEach((freq, idx) => {
          const o = audioContext.createOscillator();
          const g = audioContext.createGain();
          o.connect(g);
          g.connect(audioContext.destination);
          o.type = 'sine';
          o.frequency.setValueAtTime(freq, now + idx * 0.1);
          g.gain.setValueAtTime(0.3, now + idx * 0.1);
          g.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.1 + 0.45);
          o.start(now + idx * 0.1);
          o.stop(now + idx * 0.1 + 0.45);
        });
      } else if (type === 'lose') {
        const notes = [392.00, 329.63, 261.63];
        notes.forEach((freq, idx) => {
          const o = audioContext.createOscillator();
          const g = audioContext.createGain();
          o.connect(g);
          g.connect(audioContext.destination);
          o.type = 'sine';
          o.frequency.setValueAtTime(freq, now + idx * 0.15);
          g.gain.setValueAtTime(0.25, now + idx * 0.15);
          g.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.15 + 0.4);
          o.start(now + idx * 0.15);
          o.stop(now + idx * 0.15 + 0.4);
        });
      }
    } catch (e) {
      console.warn('Web Audio error:', e);
    }
  }

  // --- Edge-TTS 雙語音播放 ---
  function playAudioFile(url) {
    if (!soundEnabled) return Promise.resolve();
    return new Promise((resolve) => {
      try {
        if (currentAudio) {
          currentAudio.pause();
          currentAudio = null;
        }
        const audio = new Audio(url);
        currentAudio = audio;
        audio.onended = () => {
          currentAudio = null;
          resolve();
        };
        audio.onerror = () => {
          currentAudio = null;
          resolve();
        };
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => resolve());
        }
      } catch (err) {
        resolve();
      }
    });
  }

  async function playVoiceSequence(fileList, statusCallback) {
    for (let i = 0; i < fileList.length; i++) {
      if (statusCallback) statusCallback(fileList[i].label);
      await playAudioFile(fileList[i].file);
      await new Promise(r => setTimeout(r, 250));
    }
    if (statusCallback) statusCallback('');
  }

  // --- 畫面導覽與模式切換 ---
  function showScreen(screenId) {
    document.querySelectorAll('.view-screen').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
  }

  function showHome() {
    closeModals();
    showScreen('screen-home');
  }

  function chooseRuleMode(mode) {
    ruleMode = mode;
    initAudioContext();
    playSynthSfx('move');
    const indicator = document.getElementById('opponents-rule-indicator');
    if (indicator) {
      indicator.textContent = (ruleMode === 'lianqi') ? '當前玩法：🔥 連棋大挑戰 (連吃版)' : '當前玩法：🎯 傳統經典暗棋 (一步棋版)';
    }
    showOpponents();
  }

  function showOpponents() {
    closeModals();
    showScreen('screen-opponents');
  }

  function setPlayType(type) {
    playType = type;
    initAudioContext();
    playSynthSfx('move');

    const btnSingle = document.getElementById('btn-tab-single');
    const btnDual = document.getElementById('btn-tab-dual');
    const pnlSingle = document.getElementById('panel-single-opponents');
    const pnlDual = document.getElementById('panel-dual-start');

    if (type === 'single') {
      if (btnSingle) btnSingle.classList.add('active');
      if (btnDual) btnDual.classList.remove('active');
      if (pnlSingle) pnlSingle.style.display = 'grid';
      if (pnlDual) pnlDual.style.display = 'none';
    } else {
      if (btnSingle) btnSingle.classList.remove('active');
      if (btnDual) btnDual.classList.add('active');
      if (pnlSingle) pnlSingle.style.display = 'none';
      if (pnlDual) pnlDual.style.display = 'block';
    }
  }

  function selectOpponent(key) {
    playType = 'single';
    opponentKey = key;
    initAudioContext();
    playAudioFile(AUDIO_FILES.ready_aria);
    startNewGame();
  }

  function startDualGameDirect() {
    playType = 'dual';
    initAudioContext();
    playAudioFile(AUDIO_FILES.intro_jenny);
    startNewGame();
  }

  const RULE_TABS = ['lianqi_zh', 'lianqi_en', 'lianqi_zy', 'banqi_zh', 'banqi_en', 'banqi_zy'];

  function openRules() {
    initAudioContext();
    document.getElementById('modal-rules').classList.add('active');
    const initialTab = ruleMode === 'banqi' ? 'banqi_zh' : 'lianqi_zh';
    switchRulesTab(initialTab);
  }

  function closeRules() {
    document.getElementById('modal-rules').classList.remove('active');
    playSynthSfx('move');
  }

  function switchRulesTab(tab) {
    if (tab === 'lianqi') tab = 'lianqi_zh';
    if (tab === 'banqi') tab = 'banqi_zh';

    RULE_TABS.forEach(t => {
      const btn = document.getElementById(`tab-btn-rule-${t}`);
      const content = document.getElementById(`rule-content-${t}`);
      if (btn) {
        if (t === tab) btn.classList.add('active');
        else btn.classList.remove('active');
      }
      if (content) {
        if (t === tab) content.style.display = 'block';
        else content.style.display = 'none';
      }
    });

    const rankBox = document.getElementById('rules-rank-box');
    if (rankBox) {
      if (tab.endsWith('_en')) {
        rankBox.innerHTML = `
          <strong>👑 Piece Rank Hierarchy (Highest to Lowest):</strong><br>
          <div style="margin: 6px 0; font-size: 1rem; color: #ffe082;">
            King (帥/將) ＞ Advisor (仕/士) ＞ Elephant (相/象) ＞ Chariot (俥/車) ＞ Horse (傌/馬) ＞ Cannon (炮/包) ＞ Pawn (兵/卒)
          </div>
          <div style="font-size: 0.85rem; color: #bcaaa4; margin-top: 4px;">
            (King does not capture Pawn; Pawn captures King; Equal ranks capture each other)
          </div>
        `;
      } else if (tab.endsWith('_zy')) {
        rankBox.innerHTML = `
          <strong>👑 <ruby>棋<rt>ㄑㄧˊ</rt>子<rt>ㄗˇ</rt></ruby><ruby>大<rt>ㄉㄚˋ</rt>小<rt>ㄒㄧㄠˇ</rt></ruby><ruby>順<rt>ㄕㄨㄣˋ</rt>序<rt>ㄒㄩˋ</rt></ruby>（<ruby>由<rt>ㄧㄡˊ</rt>大<rt>ㄉㄚˋ</rt>到<rt>ㄉㄠˋ</rt>小<rt>ㄒㄧㄠˇ</rt></ruby>）：</strong><br>
          <div style="margin: 8px 0; font-size: 1.05rem; line-height: 2.2;">
            <ruby>帥<rt>ㄕㄨㄞˋ</rt></ruby>/<ruby>將<rt>ㄐㄧㄤˋ</rt></ruby> ＞ <ruby>仕<rt>ㄕˋ</rt></ruby>/<ruby>士<rt>ㄕˋ</rt></ruby> ＞ <ruby>相<rt>ㄒㄧㄤˋ</rt></ruby>/<ruby>象<rt>ㄒㄧㄤˋ</rt></ruby> ＞ <ruby>俥<rt>ㄐㄩ</rt></ruby>/<ruby>車<rt>ㄐㄩ</rt></ruby> ＞ <ruby>傌<rt>ㄇㄚˇ</rt></ruby>/<ruby>馬<rt>ㄇㄚˇ</rt></ruby> ＞ <ruby>炮<rt>ㄆㄠˋ</rt></ruby>/<ruby>包<rt>ㄅㄠ</rt></ruby> ＞ <ruby>兵<rt>ㄅㄧㄥ</rt></ruby>/<ruby>卒<rt>ㄗㄨˊ</rt></ruby>
          </div>
          <div style="font-size: 0.88rem; color: #bcaaa4; margin-top: 4px; line-height: 2;">
            （<ruby>帥<rt>ㄕㄨㄞˋ</rt>將<rt>ㄐㄧㄤˋ</rt>不<rt>ㄅㄨˋ</rt>吃<rt>ㄔ</rt>兵<rt>ㄅㄧㄥ</rt>卒<rt>ㄗㄨˊ</rt></ruby>；<ruby>兵<rt>ㄅㄧㄥ</rt>卒<rt>ㄗㄨˊ</rt>可<rt>ㄎㄜˇ</rt>吃<rt>ㄔ</rt>帥<rt>ㄕㄨㄞˋ</rt>將<rt>ㄐㄧㄤˋ</rt></ruby>；<ruby>同<rt>ㄊㄨㄥˊ</rt>階<rt>ㄐㄧㄝ</rt>可<rt>ㄎㄜˇ</rt>互<rt>ㄏㄨˋ</rt>吃<rt>ㄔ</rt></ruby>）
          </div>
        `;
      } else {
        rankBox.innerHTML = `
          <strong>👑 棋子大小順序（由大到小）：</strong><br>
          <div style="margin: 6px 0; font-size: 1.05rem; color: #ffe082;">
            帥/將 ＞ 仕/士 ＞ 相/象 ＞ 俥/車 ＞ 傌/馬 ＞ 炮/包 ＞ 兵/卒
          </div>
          <div style="font-size: 0.85rem; color: #bcaaa4; margin-top: 4px;">
            （帥將不吃兵卒；兵卒可吃帥將；同階可互吃）
          </div>
        `;
      }
    }
    playSynthSfx('move');
  }

  function closeModals() {
    document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('active'));
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    const txt = soundEnabled ? '🔊 語音音效：開' : '🔇 語音音效：關';
    const icon = soundEnabled ? '🔊' : '🔇';
    const btn = document.getElementById('btn-toggle-sound');
    if (btn) btn.innerHTML = `<span>${icon}</span> ${txt}`;
    const inGameBtn = document.getElementById('btn-ingame-sound');
    if (inGameBtn) inGameBtn.textContent = icon;
    if (soundEnabled) {
      initAudioContext();
      playSynthSfx('combo');
    }
  }

  function restartCurrentGame() {
    closeModals();
    startNewGame();
  }

  function startNewGame() {
    closeModals();
    isGameOver = false;
    playerColor = null;
    opponentColor = null;
    currentTurn = (playType === 'single') ? 'player' : 'p1';
    selectedPos = null;
    validTargets = [];
    comboActive = false;
    comboPos = null;
    comboCount = 0;
    consecutiveNoCapture = 0;
    deadPieces = { red: [], black: [] };

    createShuffledBoard();
    updateUIHeader();
    renderBoard();
    renderGraveyards();

    const modeName = (ruleMode === 'lianqi') ? '🔥 連棋模式 (連吃版)' : '🎯 傳統暗棋 (一步版)';
    updateStatusTip(`🎲 ${modeName}開始！請點擊任意一顆未翻開的暗棋決定陣營！`);
    showScreen('screen-game');
  }

  // --- 洗牌與 4x8 棋盤鋪設 ---
  function createShuffledBoard() {
    const piecesPool = [];
    ['red', 'black'].forEach(c => {
      PIECE_DEFS[c].forEach(pDef => {
        for (let i = 0; i < pDef.count; i++) {
          piecesPool.push({
            id: `${c}_${pDef.name}_${i}`,
            color: c,
            name: pDef.name,
            rank: pDef.rank,
            isCannon: pDef.isCannon
          });
        }
      });
    });

    // Fisher-Yates 洗牌
    for (let i = piecesPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [piecesPool[i], piecesPool[j]] = [piecesPool[j], piecesPool[i]];
    }

    board = [];
    let idx = 0;
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) {
        row.push({
          r,
          c,
          revealed: false,
          piece: piecesPool[idx++]
        });
      }
      board.push(row);
    }
  }

  // --- 核心吃子與走法判定 ---
  function canCapture(attacker, defender) {
    if (!attacker || !defender) return false;
    if (attacker.color === defender.color) return false;

    // 核心規則：士/仕不能吃將/帥！
    if (attacker.rank === 6 && defender.rank === 7) {
      return false;
    }

    // 核心規則：卒可吃帥、兵可吃將！
    if (attacker.rank === 1 && defender.rank === 7) {
      return true;
    }

    // 帥將不能吃兵卒
    if (attacker.rank === 7 && defender.rank === 1) {
      return false;
    }

    // 同階互吃！
    if (attacker.rank === defender.rank) {
      return true;
    }

    // 高階吃低階
    return attacker.rank > defender.rank;
  }

  function getLegalActionsForPiece(r, c) {
    const cell = board[r][c];
    if (!cell || !cell.revealed || !cell.piece) return [];
    const p = cell.piece;
    const actions = [];
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    if (!p.isCannon) {
      // 1. 普通棋子（將士象車馬兵）
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
          const targetCell = board[nr][nc];
          if (!targetCell.piece) {
            if (!comboActive) {
              actions.push({ r: nr, c: nc, type: 'move' });
            }
          } else if (targetCell.revealed) {
            if (targetCell.piece.color !== p.color && canCapture(p, targetCell.piece)) {
              actions.push({ r: nr, c: nc, type: 'capture' });
            }
          } else {
            // 未翻開暗棋！連棋模式下普通棋子可相鄰「盲吃/衝暗棋」！
            if (ruleMode === 'lianqi') {
              actions.push({ r: nr, c: nc, type: 'blind_capture' });
            }
          }
        }
      }
    } else {
      // 2. 炮 (包)
      if (!comboActive) {
        for (const [dr, dc] of dirs) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
            if (!board[nr][nc].piece) {
              actions.push({ r: nr, c: nc, type: 'move' });
            }
          }
        }
      }

      // 跳吃判定
      for (const [dr, dc] of dirs) {
        let pieceCount = 0;
        let step = 1;
        while (true) {
          const nr = r + dr * step;
          const nc = c + dc * step;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;

          const currCell = board[nr][nc];
          if (currCell.piece) {
            pieceCount++;
            if (pieceCount === 2) {
              if (currCell.revealed) {
                if (currCell.piece.color !== p.color) {
                  actions.push({ r: nr, c: nc, type: 'capture' });
                }
              } else {
                // 連棋模式下：炮可隔一子跳吃未翻開暗棋！傳統暗棋模式下不可跳吃暗棋
                if (ruleMode === 'lianqi') {
                  actions.push({ r: nr, c: nc, type: 'cannon_unrevealed' });
                }
              }
              break;
            }
          }
          step++;
        }
      }
    }

    return actions;
  }

  function hasAnyLegalAction(color) {
    if (!color) return true;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!board[r][c].revealed) return true;
      }
    }
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = board[r][c];
        if (cell.revealed && cell.piece && cell.piece.color === color) {
          const acts = getLegalActionsForPiece(r, c);
          if (acts.length > 0) return true;
        }
      }
    }
    return false;
  }

  // --- 點擊處理 ---
  function onCellClicked(r, c) {
    if (isGameOver) return;
    initAudioContext();

    if (playType === 'single' && currentTurn === 'opponent') return;

    const cell = board[r][c];

    // 連吃進行中
    if (comboActive) {
      // 點擊自身棋子 -> 主動結束連吃
      if (comboPos && comboPos.r === r && comboPos.c === c) {
        updateStatusTip('✨ 結束連吃！換對方行動。');
        finishCombo();
        return;
      }

      // 點擊合法可吃目標（包含明吃、盲吃暗棋、炮跳吃） -> 繼續連吃！
      const match = validTargets.find(t => t.r === r && t.c === c && (t.type === 'capture' || t.type === 'blind_capture' || t.type === 'cannon_unrevealed'));
      if (match) {
        executeCaptureOrMove(comboPos.r, comboPos.c, match);
      } else {
        // 點擊到其他無效位置時：不中斷連吃，給予溫馨提示防誤觸
        const currPiece = board[comboPos.r][comboPos.c].piece;
        const pName = currPiece ? currPiece.name : '棋子';
        updateStatusTip(`🔥 連吃進行中！請點選周圍紅框 ⚔️ 敵棋或暗棋讓【${pName}】繼續連吃，或點自身/「完成連吃」結束！`);
      }
      return;
    }

    // 點擊暗棋
    if (!cell.revealed) {
      if (selectedPos) {
        const blindMatch = validTargets.find(t => t.r === r && t.c === c && (t.type === 'blind_capture' || t.type === 'cannon_unrevealed'));
        if (blindMatch) {
          executeCaptureOrMove(selectedPos.r, selectedPos.c, blindMatch);
          return;
        }
      }
      executeFlip(r, c);
      return;
    }

    // 點擊已翻開棋子
    const activeColor = getCurrentTurnColor();

    if (selectedPos) {
      const matchAction = validTargets.find(t => t.r === r && t.c === c);
      if (matchAction) {
        executeCaptureOrMove(selectedPos.r, selectedPos.c, matchAction);
        return;
      }
    }

    // 選取自己的棋子（支援再次點擊取消選取）
    if (cell.piece && cell.piece.color === activeColor) {
      if (selectedPos && selectedPos.r === r && selectedPos.c === c) {
        selectedPos = null;
        validTargets = [];
        renderBoard();
        updateStatusTip(`已取消選取。請點擊任意暗棋翻開，或點選棋子移動！`);
        return;
      }

      selectedPos = { r, c };
      validTargets = getLegalActionsForPiece(r, c);
      playSynthSfx('move');
      renderBoard();

      if (validTargets.length === 0) {
        updateStatusTip(`【${cell.piece.name}】周圍暫無可移動或可吃子的目標！`);
      } else {
        const hasBlind = validTargets.some(t => t.type === 'blind_capture');
        if (hasBlind) {
          updateStatusTip(`已選取【${cell.piece.name}】，可移動、吃明棋，或直接衝暗棋盲吃！`);
        } else {
          updateStatusTip(`已選取【${cell.piece.name}】，請點擊綠點移動或紅框吃子！`);
        }
      }
      return;
    }

    selectedPos = null;
    validTargets = [];
    renderBoard();
  }

  // --- 動作執行 ---
  function executeFlip(r, c) {
    const cell = board[r][c];
    cell.revealed = true;
    selectedPos = null;
    validTargets = [];
    consecutiveNoCapture = 0;
    playSynthSfx('flip');

    if (playerColor === null) {
      playerColor = cell.piece.color;
      opponentColor = (playerColor === 'red') ? 'black' : 'red';
    }

    updateUIHeader();
    renderBoard();
    updateStatusTip(`✨ 翻開了！這是一顆【${cell.piece.color === 'red' ? '紅' : '黑'}・${cell.piece.name}】！`);
    endTurn();
  }

  function executeCaptureOrMove(fromR, fromC, action) {
    const fromCell = board[fromR][fromC];
    const toCell = board[action.r][action.c];
    const attacker = fromCell.piece;

    selectedPos = null;
    validTargets = [];

    if (action.type === 'move') {
      toCell.piece = attacker;
      toCell.revealed = true;
      fromCell.piece = null;
      consecutiveNoCapture++;
      playSynthSfx('move');
      renderBoard();
      updateStatusTip(`走子：${attacker.name} 移動至新位置。`);

      if (consecutiveNoCapture >= 30) {
        triggerGameOver('draw', '雙方連續 30 回合未發生吃子，依規則判定和棋！');
        return;
      }

      endTurn();
      return;
    }

    // 盲吃 / 衝暗棋 (連棋模式特權：普通棋子相鄰衝暗棋)
    if (action.type === 'blind_capture') {
      toCell.revealed = true;
      const targetPiece = toCell.piece;
      consecutiveNoCapture = 0;

      // 檢查是否為敵方棋子且可吃
      if (targetPiece.color !== attacker.color && canCapture(attacker, targetPiece)) {
        deadPieces[targetPiece.color].push(targetPiece.name);
        toCell.piece = attacker;
        fromCell.piece = null;
        playSynthSfx('capture');

        if (attacker.rank === 1 && targetPiece.rank === 7) {
          updateStatusTip(`💥 太神啦！【${attacker.name}】衝暗棋翻出大帥【${targetPiece.name}】並成功吃下！小卒立大功！`);
        } else if (attacker.rank === targetPiece.rank) {
          updateStatusTip(`⚔️ 衝暗棋同階互吃！【${attacker.name}】翻出並拼掉了【${targetPiece.color === 'red' ? '紅' : '黑'}・${targetPiece.name}】！`);
        } else {
          updateStatusTip(`⚔️ 盲吃成功！【${attacker.name}】衝暗棋翻出並吃掉了【${targetPiece.color === 'red' ? '紅' : '黑'}・${targetPiece.name}】！`);
        }
        checkComboOrEndTurn(action.r, action.c);
      } else if (targetPiece.color === attacker.color) {
        // 翻出同陣營友軍 -> 揭曉成功，但不能吃，結束連吃
        playSynthSfx('flip');
        updateStatusTip(`🛡️ 衝暗棋翻出自己人的【${targetPiece.color === 'red' ? '紅' : '黑'}・${targetPiece.name}】！無法吃子，揭曉成功，換對方行動。`);
        finishCombo();
      } else {
        // 翻出敵方但吃不下 (例如士翻出帥、或馬翻出車、或帥翻出兵)
        playSynthSfx('flip');
        updateStatusTip(`⚠️ 衝暗棋翻出比自己大的【${targetPiece.color === 'red' ? '紅' : '黑'}・${targetPiece.name}】！【${attacker.name}】吃不下，揭曉成功，換對方行動。`);
        finishCombo();
      }
      return;
    }

    // 炮跳打暗棋 (連棋模式特權)
    if (action.type === 'cannon_unrevealed') {
      toCell.revealed = true;
      const targetPiece = toCell.piece;
      consecutiveNoCapture = 0;

      if (targetPiece.color !== attacker.color) {
        deadPieces[targetPiece.color].push(targetPiece.name);
        toCell.piece = attacker;
        fromCell.piece = null;
        playSynthSfx('capture');
        updateStatusTip(`💥 炮翻山跳吃！成功擊殺敵方未翻開的【${targetPiece.name}】！`);
        checkComboOrEndTurn(action.r, action.c);
      } else {
        playSynthSfx('flip');
        updateStatusTip(`🛡️ 炮跳過去揭曉發現是自己人的【${targetPiece.name}】！揭曉成功，炮返回原位。`);
        renderBoard();
        renderGraveyards();
        finishCombo();
      }
      return;
    }

    // 一般明吃
    if (action.type === 'capture') {
      const captured = toCell.piece;
      deadPieces[captured.color].push(captured.name);
      toCell.piece = attacker;
      fromCell.piece = null;
      consecutiveNoCapture = 0;
      playSynthSfx('capture');

      if (attacker.rank === 1 && captured.rank === 7) {
        updateStatusTip(`🌟 太神啦！【${attacker.name}】成功吃了大將【${captured.name}】！小卒立大功！`);
      } else if (attacker.rank === captured.rank) {
        updateStatusTip(`⚔️ 同階互吃！【${attacker.name}】拼掉了對方的【${captured.name}】！`);
      } else {
        updateStatusTip(`⚔️ 吃子！【${attacker.name}】吃掉了【${captured.name}】！`);
      }

      checkComboOrEndTurn(action.r, action.c);
    }
  }

  // --- 連吃檢查（依據玩法模式） ---
  function checkComboOrEndTurn(newR, newC) {
    renderBoard();
    renderGraveyards();

    if (checkGameOverCondition()) return;

    // 若為傳統暗棋模式：吃子後「嚴格不連吃」，直接換手
    if (ruleMode === 'banqi') {
      endTurn();
      return;
    }

    // 連棋模式：檢查是否能連吃（包含周圍已翻開可吃敵棋、未翻開暗棋、以及炮跳吃）
    comboActive = true;
    const nextActions = getLegalActionsForPiece(newR, newC);
    const capturableTargets = nextActions.filter(a => a.type === 'capture' || a.type === 'blind_capture' || a.type === 'cannon_unrevealed');

    if (capturableTargets.length > 0) {
      comboCount++;
      comboPos = { r: newR, c: newC };
      validTargets = capturableTargets;
      selectedPos = { r: newR, c: newC };

      playSynthSfx('combo');
      showComboBanner(true, comboCount);
      renderBoard();

      if (playType === 'single' && currentTurn === 'opponent') {
        setTimeout(() => executeAiComboMove(), 750);
      } else {
        const currPiece = board[newR][newC].piece;
        const pName = currPiece ? currPiece.name : '棋子';
        updateStatusTip(`🔥 連吃 COMBO x${comboCount + 1}！【${pName}】可繼續吃周圍敵棋或衝暗棋，或點選自身/按鈕結束！`);
      }
    } else {
      finishCombo();
    }
  }

  function finishCombo() {
    comboActive = false;
    comboPos = null;
    comboCount = 0;
    selectedPos = null;
    validTargets = [];
    showComboBanner(false);
    renderBoard();
    endTurn();
  }

  function showComboBanner(show, count = 1) {
    const banner = document.getElementById('combo-banner');
    const text = document.getElementById('combo-text');
    if (!banner) return;
    if (show) {
      banner.classList.add('visible');
      if (text) text.textContent = `🔥 連吃 COMBO x${count + 1}！可連續吃相鄰敵棋！`;
    } else {
      banner.classList.remove('visible');
    }
  }

  // --- 回合換手與困斃判定 ---
  function endTurn() {
    selectedPos = null;
    validTargets = [];
    comboActive = false;
    comboPos = null;
    showComboBanner(false);

    if (checkGameOverCondition()) return;

    if (playType === 'single') {
      currentTurn = (currentTurn === 'player') ? 'opponent' : 'player';
    } else {
      currentTurn = (currentTurn === 'p1') ? 'p2' : 'p1';
    }

    updateUIHeader();
    renderBoard();

    // 困斃判定
    const nextTurnColor = getCurrentTurnColor();
    if (nextTurnColor && !hasAnyLegalAction(nextTurnColor)) {
      if (playType === 'single') {
        if (currentTurn === 'opponent') {
          triggerGameOver('player', '對手已無暗棋可翻且無棋可走（困斃）！你獲勝了！');
        } else {
          triggerGameOver('opponent', '你已無暗棋可翻且無棋可走（困斃）！');
        }
      } else {
        const winner = (currentTurn === 'p1') ? 'p2' : 'p1';
        triggerGameOver(winner, '對手已無棋可走（困斃）！');
      }
      return;
    }

    // 單人模式電腦回合
    if (playType === 'single' && currentTurn === 'opponent') {
      updateStatusTip(`🤔 ${OPPONENT_PROFILES[opponentKey].name} 正在思考中...`);
      setTimeout(() => executeAiTurn(), 650);
    }
  }

  function getCurrentTurnColor() {
    if (playerColor === null) return null;
    if (playType === 'single') {
      return (currentTurn === 'player') ? playerColor : opponentColor;
    } else {
      return (currentTurn === 'p1') ? playerColor : opponentColor;
    }
  }

  // --- 電腦 AI 行動決策 ---
  function executeAiTurn() {
    if (isGameOver || currentTurn !== 'opponent') return;

    const aiColor = opponentColor;
    const aiLevel = OPPONENT_PROFILES[opponentKey].level;

    const unrevealedCells = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!board[r][c].revealed) {
          unrevealedCells.push({ r, c });
        }
      }
    }

    const allActions = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = board[r][c];
        if (cell.revealed && cell.piece && cell.piece.color === aiColor) {
          const acts = getLegalActionsForPiece(r, c);
          acts.forEach(a => {
            allActions.push({ fromR: r, fromC: c, action: a, piece: cell.piece });
          });
        }
      }
    }

    const captures = allActions.filter(x => x.action.type === 'capture');
    const blindCaptures = allActions.filter(x => x.action.type === 'blind_capture');
    const cannonUnrevealed = allActions.filter(x => x.action.type === 'cannon_unrevealed');
    const normalMoves = allActions.filter(x => x.action.type === 'move');

    // Level 1 (Eric)
    if (aiLevel === 1) {
      if (unrevealedCells.length > 0 && Math.random() < 0.5) {
        const pick = unrevealedCells[Math.floor(Math.random() * unrevealedCells.length)];
        executeFlip(pick.r, pick.c);
        return;
      }
      if (captures.length > 0) {
        const pick = captures[Math.floor(Math.random() * captures.length)];
        executeCaptureOrMove(pick.fromR, pick.fromC, pick.action);
        return;
      }
      if (blindCaptures.length > 0 && Math.random() < 0.4) {
        const pick = blindCaptures[Math.floor(Math.random() * blindCaptures.length)];
        executeCaptureOrMove(pick.fromR, pick.fromC, pick.action);
        return;
      }
      if (normalMoves.length > 0 && Math.random() < 0.7) {
        const pick = normalMoves[Math.floor(Math.random() * normalMoves.length)];
        executeCaptureOrMove(pick.fromR, pick.fromC, pick.action);
        return;
      }
      if (unrevealedCells.length > 0) {
        const pick = unrevealedCells[Math.floor(Math.random() * unrevealedCells.length)];
        executeFlip(pick.r, pick.c);
        return;
      }
    }

    // Level 2, 3, 4
    if (captures.length > 0) {
      captures.sort((a, b) => {
        const targetA = board[a.action.r][a.action.c].piece;
        const targetB = board[b.action.r][b.action.c].piece;
        const valA = targetA ? targetA.rank : 0;
        const valB = targetB ? targetB.rank : 0;
        return valB - valA;
      });
      const topPick = captures[0];
      executeCaptureOrMove(topPick.fromR, topPick.fromC, topPick.action);
      return;
    }

    if (cannonUnrevealed.length > 0 && (aiLevel >= 3 || Math.random() < 0.45)) {
      const pick = cannonUnrevealed[Math.floor(Math.random() * cannonUnrevealed.length)];
      executeCaptureOrMove(pick.fromR, pick.fromC, pick.action);
      return;
    }

    // 智能衝暗棋：若有較大棋子（將士象車）鄰近暗棋，優先衝暗棋盲吃
    if (blindCaptures.length > 0 && (aiLevel >= 2)) {
      const highRankBlinds = blindCaptures.filter(x => x.piece.rank >= 4);
      if (highRankBlinds.length > 0 && (aiLevel >= 3 || Math.random() < 0.65)) {
        const pick = highRankBlinds[Math.floor(Math.random() * highRankBlinds.length)];
        executeCaptureOrMove(pick.fromR, pick.fromC, pick.action);
        return;
      }
    }

    if (unrevealedCells.length > 0 && (normalMoves.length === 0 || Math.random() < 0.5)) {
      const pick = unrevealedCells[Math.floor(Math.random() * unrevealedCells.length)];
      executeFlip(pick.r, pick.c);
      return;
    }

    if (normalMoves.length > 0) {
      const pick = normalMoves[Math.floor(Math.random() * normalMoves.length)];
      executeCaptureOrMove(pick.fromR, pick.fromC, pick.action);
      return;
    }

    if (blindCaptures.length > 0) {
      const pick = blindCaptures[Math.floor(Math.random() * blindCaptures.length)];
      executeCaptureOrMove(pick.fromR, pick.fromC, pick.action);
      return;
    }

    if (unrevealedCells.length > 0) {
      const pick = unrevealedCells[Math.floor(Math.random() * unrevealedCells.length)];
      executeFlip(pick.r, pick.c);
      return;
    }

    triggerGameOver('player', '對手已無棋可走（困斃）！你獲勝了！');
  }

  function executeAiComboMove() {
    if (!comboActive || !comboPos) return;
    const actions = getLegalActionsForPiece(comboPos.r, comboPos.c);
    const capturable = actions.filter(a => a.type === 'capture' || a.type === 'blind_capture' || a.type === 'cannon_unrevealed');

    if (capturable.length > 0) {
      // 優先吃已知高價值明棋
      const revealedCaptures = capturable.filter(a => a.type === 'capture');
      if (revealedCaptures.length > 0) {
        revealedCaptures.sort((a, b) => {
          const targetA = board[a.r][a.c].piece;
          const targetB = board[b.r][b.c].piece;
          const valA = targetA ? targetA.rank : 0;
          const valB = targetB ? targetB.rank : 0;
          return valB - valA;
        });
        executeCaptureOrMove(comboPos.r, comboPos.c, revealedCaptures[0]);
        return;
      }

      // 若無已知明棋，大棋子（rank >= 4）或較高機率繼續衝暗棋盲吃
      const aiPiece = board[comboPos.r][comboPos.c].piece;
      const blindTargets = capturable.filter(a => a.type === 'blind_capture' || a.type === 'cannon_unrevealed');
      if (blindTargets.length > 0 && (aiPiece.rank >= 4 || Math.random() < 0.65)) {
        const pick = blindTargets[Math.floor(Math.random() * blindTargets.length)];
        executeCaptureOrMove(comboPos.r, comboPos.c, pick);
        return;
      }

      finishCombo();
    } else {
      finishCombo();
    }
  }

  // --- 勝負判定 ---
  function checkGameOverCondition() {
    if (playerColor === null) return false;

    let redCount = 0;
    let blackCount = 0;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = board[r][c];
        if (!cell.revealed) {
          if (cell.piece.color === 'red') redCount++;
          else blackCount++;
        } else if (cell.piece) {
          if (cell.piece.color === 'red') redCount++;
          else blackCount++;
        }
      }
    }

    if (redCount === 0) {
      const winner = (playerColor === 'black') ? 'player' : 'opponent';
      triggerGameOver(winner, '🔴 紅方棋子已被全數吃光！');
      return true;
    }
    if (blackCount === 0) {
      const winner = (playerColor === 'red') ? 'player' : 'opponent';
      triggerGameOver(winner, '⚫ 黑方棋子已被全數吃光！');
      return true;
    }

    return false;
  }

  function triggerGameOver(winnerSide, reasonDesc) {
    isGameOver = true;
    const modal = document.getElementById('modal-gameover');
    const iconEl = document.getElementById('gameover-icon');
    const titleEl = document.getElementById('gameover-title');
    const descEl = document.getElementById('gameover-desc');
    const statusBox = document.getElementById('voice-indicator');

    if (winnerSide === 'draw') {
      playSynthSfx('move');
      if (iconEl) iconEl.textContent = '🤝';
      if (titleEl) titleEl.textContent = '雙方握手言和！';
      if (descEl) descEl.textContent = `${reasonDesc} 精彩的攻防大戰！`;
      if (statusBox) statusBox.textContent = '和棋結算完畢';
      if (modal) modal.classList.add('active');
      return;
    }

    const isPlayerWin = (playType === 'single' && winnerSide === 'player') || (playType === 'dual' && winnerSide === 'p1');

    if (isPlayerWin) {
      playSynthSfx('win');
      if (iconEl) iconEl.textContent = '🎉';
      if (titleEl) titleEl.textContent = '🎉 你贏了！太棒了！ 🎉';
      if (descEl) descEl.textContent = `${reasonDesc} 你的戰術真是太精彩了！`;

      const seq = [];
      const useChildVoice = Math.random() < 0.35;
      if (useChildVoice) {
        seq.push({ label: '👧 Girl(Anna)', file: AUDIO_FILES.ana_win });
        seq.push({ label: '👦 Boy(Kevin)', file: AUDIO_FILES.eric_win });
      } else {
        seq.push({ label: '👩 Mother(Mom)', file: AUDIO_FILES.michelle_win });
        seq.push({ label: '👨 Father(Dad)', file: AUDIO_FILES.davis_win });
      }

      playVoiceSequence(seq, (roleName) => {
        if (statusBox) statusBox.textContent = roleName ? `語音播放：${roleName}` : '語音播放完畢';
      });

    } else {
      playSynthSfx('lose');
      if (iconEl) iconEl.textContent = '💪';
      if (titleEl) titleEl.textContent = '沒關係，再接再厲！';
      if (descEl) descEl.textContent = `${reasonDesc} 下一盤好好思考，你一定可以贏回來的！`;

      const seq = [];
      const useChildVoice = Math.random() < 0.35;
      if (useChildVoice) {
        seq.push({ label: '👦 Boy(Kevin)', file: AUDIO_FILES.eric_lose });
        seq.push({ label: '👧 Girl(Anna)', file: AUDIO_FILES.ana_lose });
      } else {
        seq.push({ label: '👩 Mother(Mom)', file: AUDIO_FILES.michelle_lose });
        seq.push({ label: '👨 Father(Dad)', file: AUDIO_FILES.davis_lose });
      }

      playVoiceSequence(seq, (roleName) => {
        if (statusBox) statusBox.textContent = roleName ? `語音播放：${roleName}` : '語音播放完畢';
      });
    }

    if (modal) modal.classList.add('active');
  }

  // --- UI 渲染函式 ---
  function updateUIHeader() {
    const p1Badge = document.getElementById('badge-p1');
    const p1Name = document.getElementById('name-p1');
    const p1Turn = document.getElementById('turn-p1');

    const p2Badge = document.getElementById('badge-p2');
    const p2Name = document.getElementById('name-p2');
    const p2Turn = document.getElementById('turn-p2');

    const modeTag = document.getElementById('game-active-mode-tag');
    if (modeTag) {
      if (ruleMode === 'lianqi') {
        modeTag.className = 'center-mode-tag';
        modeTag.textContent = '🔥 連棋 (連吃)';
      } else {
        modeTag.className = 'center-mode-tag classic';
        modeTag.textContent = '🎯 暗棋 (傳統)';
      }
    }

    const isP1Turn = (playType === 'single') ? (currentTurn === 'player') : (currentTurn === 'p1');

    const p1ColorStr = playerColor ? (playerColor === 'red' ? '🔴 紅方' : '⚫ 黑方') : '❓ 陣營待定';
    const p2ColorStr = opponentColor ? (opponentColor === 'red' ? '🔴 紅方' : '⚫ 黑方') : '❓ 陣營待定';

    if (playType === 'single') {
      const opp = OPPONENT_PROFILES[opponentKey];
      if (p1Badge) p1Badge.textContent = '🧑';
      if (p1Name) p1Name.textContent = 'Player(You)';
      if (p2Badge) p2Badge.textContent = opp.avatar;
      if (p2Name) p2Name.textContent = opp.name;
    } else {
      if (p1Badge) p1Badge.textContent = playerColor === 'black' ? '⚫' : '🔴';
      if (p1Name) p1Name.textContent = 'Player 1 (先手)';
      if (p2Badge) p2Badge.textContent = opponentColor === 'black' ? '⚫' : '🔴';
      if (p2Name) p2Name.textContent = 'Player 2 (後手)';
    }

    if (isP1Turn) {
      if (p1Turn) {
        p1Turn.className = 'turn-pill active-turn';
        p1Turn.textContent = `${p1ColorStr} (行動中)`;
      }
      if (p2Turn) {
        p2Turn.className = 'turn-pill wait-turn';
        p2Turn.textContent = `${p2ColorStr} (等候)`;
      }
    } else {
      if (p1Turn) {
        p1Turn.className = 'turn-pill wait-turn';
        p1Turn.textContent = `${p1ColorStr} (等候)`;
      }
      if (p2Turn) {
        p2Turn.className = 'turn-pill active-turn';
        p2Turn.textContent = `${p2ColorStr} (行動中)`;
      }
    }
  }

  function updateStatusTip(msg) {
    const tip = document.getElementById('game-status-tip');
    if (tip) tip.textContent = msg;
  }

  function renderBoard() {
    const container = document.getElementById('board-container');
    if (!container) return;
    container.innerHTML = '';

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = board[r][c];
        const cellDiv = document.createElement('div');
        cellDiv.className = 'board-cell';
        cellDiv.dataset.row = r;
        cellDiv.dataset.col = c;
        cellDiv.onclick = () => onCellClicked(r, c);

        const validAction = validTargets.find(t => t.r === r && t.c === c);
        if (validAction) {
          if (validAction.type === 'move') {
            cellDiv.classList.add('valid-move');
          } else if (validAction.type === 'capture' || validAction.type === 'cannon_unrevealed') {
            cellDiv.classList.add('valid-capture');
          } else if (validAction.type === 'blind_capture') {
            cellDiv.classList.add('valid-blind-capture');
          }
        }

        if (cell.piece) {
          const pieceDiv = document.createElement('div');
          pieceDiv.className = 'piece';

          if (!cell.revealed) {
            pieceDiv.classList.add('hidden-piece');
          } else {
            pieceDiv.classList.add('revealed', cell.piece.color);
            pieceDiv.textContent = cell.piece.name;
          }

          if (selectedPos && selectedPos.r === r && selectedPos.c === c) {
            pieceDiv.classList.add('selected');
          }

          cellDiv.appendChild(pieceDiv);
        }

        container.appendChild(cellDiv);
      }
    }
  }

  function renderGraveyards() {
    const redChips = document.getElementById('chips-dead-red');
    const blackChips = document.getElementById('chips-dead-black');
    const redCount = document.getElementById('count-dead-red');
    const blackCount = document.getElementById('count-dead-black');

    if (redCount) redCount.textContent = deadPieces.red.length;
    if (blackCount) blackCount.textContent = deadPieces.black.length;

    if (redChips) {
      redChips.innerHTML = deadPieces.red.map(n => `<span class="dead-chip red">${n}</span>`).join('');
    }
    if (blackChips) {
      blackChips.innerHTML = deadPieces.black.map(n => `<span class="dead-chip black">${n}</span>`).join('');
    }
  }

  window.addEventListener('touchstart', initAudioContext, { once: true, passive: true });
  window.addEventListener('click', initAudioContext, { once: true, passive: true });

  return {
    showHome,
    showOpponents,
    chooseRuleMode,
    setPlayType,
    selectOpponent,
    startDualGameDirect,
    openRules,
    closeRules,
    switchRulesTab,
    toggleSound,
    restartCurrentGame,
    finishCombo
  };
})();
