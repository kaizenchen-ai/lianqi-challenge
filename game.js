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
    ana: { name: 'Girl(Anna)', avatar: '👧', desc: '靈活機智・穩扎穩打', level: 2 },
    michelle: { name: 'Mother(Mom)', avatar: '👩', desc: '細心縝密・高手挑戰', level: 3 },
    davis: { name: 'Father(Dad)', avatar: '👨', desc: '沉著老練・頂尖棋藝', level: 4 }
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
  let isActionLocked = false;
  let currentMatchMoves = 0;
  let currentMatchMaxCombo = 0;
  let lastCalculatedScore = 0;

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
    renderStatsUI();
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
      if (pnlSingle) pnlSingle.style.display = 'flex';
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
    isActionLocked = false;
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
    if (isGameOver || isActionLocked) return;
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
    cell.revealing = true;
    selectedPos = null;
    validTargets = [];
    consecutiveNoCapture = 0;
    playSynthSfx('flip');

    if (currentTurn === 'player' || currentTurn === 'p1') {
      currentMatchMoves++;
    }

    if (playerColor === null) {
      playerColor = cell.piece.color;
      opponentColor = (playerColor === 'red') ? 'black' : 'red';
    }

    updateUIHeader();
    renderBoard();
    updateStatusTip(`✨ 翻開了！這是一顆【${cell.piece.color === 'red' ? '紅' : '黑'}・${cell.piece.name}】！`);
    
    setTimeout(() => {
      cell.revealing = false;
    }, 600);

    endTurn();
  }

  function executeCaptureOrMove(fromR, fromC, action) {
    const fromCell = board[fromR][fromC];
    const toCell = board[action.r][action.c];
    const attacker = fromCell.piece;

    selectedPos = null;
    validTargets = [];

    if (currentTurn === 'player' || currentTurn === 'p1') {
      currentMatchMoves++;
    }

    if (action.type === 'move') {
      toCell.piece = attacker;
      toCell.revealed = true;
      fromCell.piece = null;
      consecutiveNoCapture++;
      playSynthSfx('move');
      renderBoard();
      updateStatusTip(`走子：${attacker.name} 移動至新位置。`);

      if (consecutiveNoCapture >= 100) {
        triggerGameOver('draw', '雙方連續 100 回合未發生吃子，依規則判定和棋！');
        return;
      }

      endTurn();
      return;
    }

    // 盲吃 / 衝暗棋 (先播放揭曉翻牌動畫，看清棋子後再執行吃子)
    if (action.type === 'blind_capture') {
      isActionLocked = true;
      toCell.revealed = true;
      toCell.revealing = true;
      const targetPiece = toCell.piece;
      consecutiveNoCapture = 0;
      playSynthSfx('flip');
      renderBoard();

      updateStatusTip(`✨ 衝暗棋揭曉！翻出了【${targetPiece.color === 'red' ? '紅' : '黑'}・${targetPiece.name}】！`);

      setTimeout(() => {
        toCell.revealing = false;

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
          isActionLocked = false;
          checkComboOrEndTurn(action.r, action.c);
        } else if (targetPiece.color === attacker.color) {
          // 翻出同陣營友軍 -> 揭曉成功，但不能吃，結束連吃
          updateStatusTip(`🛡️ 衝暗棋翻出自己人的【${targetPiece.color === 'red' ? '紅' : '黑'}・${targetPiece.name}】！無法吃子，揭曉成功，換對方行動。`);
          isActionLocked = false;
          renderBoard();
          renderGraveyards();
          finishCombo();
        } else {
          // 翻出敵方但吃不下 (例如士翻出帥、或馬翻出車、或帥翻出兵)
          updateStatusTip(`⚠️ 衝暗棋翻出比自己大的【${targetPiece.color === 'red' ? '紅' : '黑'}・${targetPiece.name}】！【${attacker.name}】吃不下，揭曉成功，換對方行動。`);
          isActionLocked = false;
          renderBoard();
          renderGraveyards();
          finishCombo();
        }
      }, 700);

      return;
    }

    // 炮跳打暗棋 (先翻開揭曉動畫，再判定擊殺或友軍返回)
    if (action.type === 'cannon_unrevealed') {
      isActionLocked = true;
      toCell.revealed = true;
      toCell.revealing = true;
      const targetPiece = toCell.piece;
      consecutiveNoCapture = 0;
      playSynthSfx('flip');
      renderBoard();

      updateStatusTip(`💥 炮翻山跳向暗棋！翻出了【${targetPiece.color === 'red' ? '紅' : '黑'}・${targetPiece.name}】！`);

      setTimeout(() => {
        toCell.revealing = false;

        if (targetPiece.color !== attacker.color) {
          deadPieces[targetPiece.color].push(targetPiece.name);
          toCell.piece = attacker;
          fromCell.piece = null;
          playSynthSfx('capture');
          updateStatusTip(`💥 炮翻山跳吃！成功擊殺敵方【${targetPiece.color === 'red' ? '紅' : '黑'}・${targetPiece.name}】！`);
          isActionLocked = false;
          checkComboOrEndTurn(action.r, action.c);
        } else {
          updateStatusTip(`🛡️ 炮跳過去揭曉發現是自己人的【${targetPiece.name}】！無法吃子，揭曉成功，炮返回原位。`);
          isActionLocked = false;
          renderBoard();
          renderGraveyards();
          finishCombo();
        }
      }, 700);

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
      currentMatchMaxCombo = Math.max(currentMatchMaxCombo, comboCount);
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
    if (isActionLocked) return;
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

  // --- 棋子價值評估輔助 ---
  function getPieceRankValue(piece) {
    if (!piece) return 0;
    if (piece.isCannon) return 38;
    switch (piece.rank) {
      case 7: return 100; // 將/帥
      case 6: return 50;  // 士/仕
      case 5: return 32;  // 象/相
      case 4: return 45;  // 車/俥
      case 3: return 28;  // 馬/傌
      case 1: return 16;  // 卒/兵
      default: return 20;
    }
  }

  // 檢查某座標 (r, c) 若放置指定棋子，是否正受敵方明棋直接威脅
  function isSquareThreatenedByEnemy(r, c, attackerColor, rank, isCannon) {
    const enemyColor = (attackerColor === 'red') ? 'black' : 'red';
    const fakePiece = { color: attackerColor, rank: rank, isCannon: isCannon };

    // 檢查相鄰 4 格敵方普通棋子
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
        const cell = board[nr][nc];
        if (cell.revealed && cell.piece && cell.piece.color === enemyColor && !cell.piece.isCannon) {
          if (canCapture(cell.piece, fakePiece)) {
            return { threatened: true, attackerPiece: cell.piece, fromR: nr, fromC: nc };
          }
        }
      }
    }

    // 檢查敵方炮翻山跳吃威脅 (沿橫向、直向搜尋跳板)
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const cell = board[row][col];
        if (cell.revealed && cell.piece && cell.piece.color === enemyColor && cell.piece.isCannon) {
          if (row === r || col === c) {
            let screenCount = 0;
            if (row === r) {
              const minC = Math.min(col, c);
              const maxC = Math.max(col, c);
              for (let scanC = minC + 1; scanC < maxC; scanC++) {
                if (board[r][scanC].piece) screenCount++;
              }
            } else {
              const minR = Math.min(row, r);
              const maxR = Math.max(row, r);
              for (let scanR = minR + 1; scanR < maxR; scanR++) {
                if (board[scanR][c].piece) screenCount++;
              }
            }
            if (screenCount === 1) {
              return { threatened: true, attackerPiece: cell.piece, fromR: row, fromC: col };
            }
          }
        }
      }
    }

    return { threatened: false };
  }

  // --- 電腦 AI 行動決策 (4 級智慧評估引擎) ---
  function executeAiTurn() {
    if (isGameOver || currentTurn !== 'opponent') return;

    const aiColor = opponentColor;
    const aiLevel = OPPONENT_PROFILES[opponentKey].level; // 1: Boy, 2: Girl, 3: Mother, 4: Father

    // 收集所有未翻開的暗棋格子
    const unrevealedCells = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!board[r][c].revealed) {
          unrevealedCells.push({ r, c });
        }
      }
    }

    // 收集 AI 所有合法行動
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

    // 分類
    const captures = allActions.filter(x => x.action.type === 'capture');
    const blindCaptures = allActions.filter(x => x.action.type === 'blind_capture');
    const cannonUnrevealed = allActions.filter(x => x.action.type === 'cannon_unrevealed');
    const normalMoves = allActions.filter(x => x.action.type === 'move');

    // === LEVEL 1: Boy (Kevin) - 最弱 / 入門級 ===
    if (aiLevel === 1) {
      if (unrevealedCells.length > 0 && Math.random() < 0.55) {
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

    // === LEVEL 2: Girl (Anna) - 中等 / 進階級 ===
    if (aiLevel === 2) {
      if (captures.length > 0) {
        captures.sort((a, b) => {
          const targetA = board[a.action.r][a.action.c].piece;
          const targetB = board[b.action.r][b.action.c].piece;
          return getPieceRankValue(targetB) - getPieceRankValue(targetA);
        });
        executeCaptureOrMove(captures[0].fromR, captures[0].fromC, captures[0].action);
        return;
      }

      // 帥/將被威脅時優先逃跑
      const threatenedGenerals = allActions.filter(x => x.piece.rank === 7 && isSquareThreatenedByEnemy(x.fromR, x.fromC, aiColor, 7, false).threatened);
      if (threatenedGenerals.length > 0) {
        const safeEscapes = threatenedGenerals.filter(x => !isSquareThreatenedByEnemy(x.action.r, x.action.c, aiColor, 7, false).threatened);
        if (safeEscapes.length > 0) {
          executeCaptureOrMove(safeEscapes[0].fromR, safeEscapes[0].fromC, safeEscapes[0].action);
          return;
        }
      }

      if (cannonUnrevealed.length > 0 && Math.random() < 0.5) {
        const pick = cannonUnrevealed[Math.floor(Math.random() * cannonUnrevealed.length)];
        executeCaptureOrMove(pick.fromR, pick.fromC, pick.action);
        return;
      }

      if (blindCaptures.length > 0 && Math.random() < 0.6) {
        const highRank = blindCaptures.filter(x => x.piece.rank >= 4);
        const pool = highRank.length > 0 ? highRank : blindCaptures;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        executeCaptureOrMove(pick.fromR, pick.fromC, pick.action);
        return;
      }

      if (unrevealedCells.length > 0 && Math.random() < 0.45) {
        const pick = unrevealedCells[Math.floor(Math.random() * unrevealedCells.length)];
        executeFlip(pick.r, pick.c);
        return;
      }

      if (normalMoves.length > 0) {
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

    // === LEVEL 3 (Mother / 難) & LEVEL 4 (Father / 最難) 深度啟發評估 ===
    const evaluatedMoves = [];

    // ─── 棋盤快照與走步模擬（供 Level 4 1-ply Minimax 深度前瞻） ───
    function copyBoardSnap() {
      const snap = [];
      for (let r = 0; r < ROWS; r++) {
        snap[r] = [];
        for (let c = 0; c < COLS; c++) {
          const cell = board[r][c];
          snap[r][c] = { revealed: cell.revealed, piece: cell.piece ? { ...cell.piece } : null };
        }
      }
      return snap;
    }

    function applyMoveOnSnap(snap, fromR, fromC, toR, toC) {
      const piece = snap[fromR][fromC].piece;
      snap[toR][toC].piece = piece;
      snap[toR][toC].revealed = true;
      snap[fromR][fromC].piece = null;
    }

    // 模擬：AI 走完後，玩家最佳反擊能吃到的最高價值（全盤搜尋，防止任何失誤或掛棋）
    function bestOpponentResponseOnSnap(snap) {
      const pColor = playerColor;
      if (!pColor) return 0;
      let best = 0;
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = snap[r][c];
          if (!cell.revealed || !cell.piece || cell.piece.color !== pColor) continue;
          const p = cell.piece;
          for (const [dr, dc] of dirs) {
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
            const tgt = snap[nr][nc];
            if (tgt.revealed && tgt.piece && tgt.piece.color !== pColor && canCapture(p, tgt.piece)) {
              best = Math.max(best, getPieceRankValue(tgt.piece));
            }
          }
          if (p.isCannon) {
            for (const [dr, dc] of dirs) {
              let step = 1, cnt = 0;
              while (true) {
                const nr = r + dr * step, nc = c + dc * step;
                if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
                const t = snap[nr][nc];
                if (t.piece) {
                  cnt++;
                  if (cnt === 2) {
                    if (t.revealed && t.piece.color !== pColor) best = Math.max(best, getPieceRankValue(t.piece));
                    break;
                  }
                }
                step++;
              }
            }
          }
        }
      }
      return best;
    }

    // ─── 檢查 AI 是否能在走完某步後，形成下一步的連吃或多重威脅（叉殺） ───
    function countForkThreats(toR, toC, piece) {
      let threats = 0;
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      dirs.forEach(([dr, dc]) => {
        const nr = toR + dr;
        const nc = toC + dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
          const adj = board[nr][nc];
          if (adj.revealed && adj.piece && adj.piece.color !== aiColor) {
            if (canCapture(piece, adj.piece)) threats++;
          } else if (!adj.revealed) {
            threats += 0.4; // 未翻開暗棋視為潛在威脅目標
          }
        }
      });
      // 炮的長程威脅額外加成
      if (piece.isCannon) {
        const dirs2 = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        dirs2.forEach(([dr, dc]) => {
          let step = 1, screenCount = 0;
          while (true) {
            const nr = toR + dr * step;
            const nc = toC + dc * step;
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
            const c2 = board[nr][nc];
            if (c2.piece) {
              screenCount++;
              if (screenCount === 2 && c2.piece.color !== aiColor) {
                threats += 1.5;
                break;
              }
              if (screenCount >= 2) break;
            }
            step++;
          }
        });
      }
      return threats;
    }

    // ─── 炮是否在該位置形成「跳吃線」（砲台已架好） ───
    function calcCannonBatteryBonus(toR, toC, piece) {
      if (!piece.isCannon) return 0;
      let bonus = 0;
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of dirs) {
        let step = 1, cnt = 0;
        while (true) {
          const nr = toR + dr * step, nc = toC + dc * step;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
          const t = board[nr][nc];
          if (t.piece) {
            cnt++;
            if (cnt === 2) {
              bonus += (t.revealed && t.piece.color !== aiColor) ? 75 : 40;
              break;
            }
          }
          step++;
        }
      }
      return bonus;
    }

    // ─── Level 4 專用：架炮台獎勵（移動普通棋子作為 AI 炮的跳板） ───
    function calcScreenSetupBonus(toR, toC) {
      if (aiLevel < 4 || !playerColor) return 0;
      let bonus = 0;
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of dirs) {
        for (let step = 1; step < 8; step++) {
          const cr = toR - dr * step, cc = toC - dc * step;
          if (cr < 0 || cr >= ROWS || cc < 0 || cc >= COLS) break;
          const cCell = board[cr][cc];
          if (cCell.piece) {
            if (cCell.revealed && cCell.piece.color === aiColor && cCell.piece.isCannon) {
              // 找到後方的友方炮，再看前方是否有敵方目標
              for (let fStep = 1; fStep < 8; fStep++) {
                const tr = toR + dr * fStep, tc = toC + dc * fStep;
                if (tr < 0 || tr >= ROWS || tc < 0 || tc >= COLS) break;
                const tCell = board[tr][tc];
                if (tCell.piece) {
                  if (tCell.revealed && tCell.piece.color === playerColor) {
                    bonus += 50; // 成功架設砲台跳板！
                  }
                  break;
                }
              }
            }
            break;
          }
        }
      }
      return bonus;
    }

    // ─── Level 4 專用：獵殺與圍剿玩家高價值棋子 (Alpha Hunter) ───
    function calcHuntingBonus(toR, toC, piece) {
      if (aiLevel < 4 || !playerColor) return 0;
      let bonus = 0;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = board[r][c];
          if (cell.revealed && cell.piece && cell.piece.color === playerColor && cell.piece.rank >= 4) {
            if (canCapture(piece, cell.piece)) {
              const dist = Math.abs(toR - r) + Math.abs(toC - c);
              bonus += Math.max(0, 6 - dist) * 12; // 逼近玩家大棋，壓制其活動空間
            }
          }
        }
      }
      return bonus;
    }

    // ─── 計算玩家可威脅到 AI 棋子的總危機分 ───
    function calcTotalVulnerability() {
      let danger = 0;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = board[r][c];
          if (cell.revealed && cell.piece && cell.piece.color === aiColor) {
            const threat = isSquareThreatenedByEnemy(r, c, aiColor, cell.piece.rank, cell.piece.isCannon);
            if (threat.threatened) {
              danger += getPieceRankValue(cell.piece);
            }
          }
        }
      }
      return danger;
    }

    // ─── 計算 AI / 玩家 棋子總兵力值 ───
    function calcTotalAiPieceValue() {
      let total = 0;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = board[r][c];
          if (cell.revealed && cell.piece && cell.piece.color === aiColor) {
            total += getPieceRankValue(cell.piece);
          }
        }
      }
      return total;
    }

    function calcTotalPlayerPieceValue() {
      let total = 0;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = board[r][c];
          if (cell.revealed && cell.piece && cell.piece.color === playerColor) {
            total += getPieceRankValue(cell.piece);
          }
        }
      }
      return total;
    }

    const aiTotalVal = calcTotalAiPieceValue();
    const playerTotalVal = calcTotalPlayerPieceValue();
    const hasAdvantage = (aiTotalVal - playerTotalVal) > 35;

    // (A) 評估吃子行動
    captures.forEach(item => {
      const targetPiece = board[item.action.r][item.action.c].piece;
      const targetVal = getPieceRankValue(targetPiece);
      const attackerVal = getPieceRankValue(item.piece);

      const postThreat = isSquareThreatenedByEnemy(item.action.r, item.action.c, aiColor, item.piece.rank, item.piece.isCannon);
      let score = 200 + targetVal * 3;

      if (postThreat.threatened) {
        const riskLoss = attackerVal;
        if (targetVal < riskLoss) {
          // 零虧本原則：Level 3 與 Level 4 嚴格禁止虧本交易
          score = -600;
        } else if (targetVal === riskLoss) {
          // 等價交換：傾向換高階棋（車/將）；劣勢或殘局時依策略調整
          if (aiLevel === 4 && hasAdvantage) {
            score += 90; // Level 4 優勢殘局：換子簡化局面加速獲勝
          } else {
            score += (targetVal >= 45 ? 80 : -30);
          }
        } else {
          // 獲利交換
          score += (targetVal - riskLoss) * (aiLevel === 4 ? 4 : 3.5);
        }
      } else {
        score += (aiLevel === 4 ? 240 : 220); // 安全吃子大加分
      }

      // 當前位置已受威脅時，吃子逃脫獎勵
      const currThreat = isSquareThreatenedByEnemy(item.fromR, item.fromC, aiColor, item.piece.rank, item.piece.isCannon);
      if (currThreat.threatened) {
        score += attackerVal * (aiLevel === 4 ? 3.5 : 3);
      }

      // 吃完後的叉殺威脅加成 (Level 3 & 4)
      const forkCount = countForkThreats(item.action.r, item.action.c, item.piece);
      score += forkCount * (aiLevel === 4 ? 50 : 45);

      // Level 4 專屬加成：1-ply Minimax + 砲台跳吃線 + 獵殺高階棋
      if (aiLevel === 4) {
        const snap = copyBoardSnap();
        applyMoveOnSnap(snap, item.fromR, item.fromC, item.action.r, item.action.c);
        const oppBest = bestOpponentResponseOnSnap(snap);
        score -= oppBest * 2.8;

        score += calcCannonBatteryBonus(item.action.r, item.action.c, item.piece);
        score += calcHuntingBonus(item.action.r, item.action.c, item.piece);
      }

      evaluatedMoves.push({ type: 'move', fromR: item.fromR, fromC: item.fromC, action: item.action, score });
    });

    // (B) 評估普通走法與躲避威脅
    normalMoves.forEach(item => {
      const attackerVal = getPieceRankValue(item.piece);
      const currThreat = isSquareThreatenedByEnemy(item.fromR, item.fromC, aiColor, item.piece.rank, item.piece.isCannon);
      const postThreat = isSquareThreatenedByEnemy(item.action.r, item.action.c, aiColor, item.piece.rank, item.piece.isCannon);

      let score = 20;

      // 1. 成功逃離危險
      if (currThreat.threatened && !postThreat.threatened) {
        score = 250 + attackerVal * (aiLevel === 4 ? 4 : 3.5);
      } else if (currThreat.threatened && postThreat.threatened) {
        score = 10; // 逃不掉，低分
      } else if (!currThreat.threatened && postThreat.threatened) {
        // 零虧本原則：Level 3 與 Level 4 絕對不主動走入危險區
        score = -1200;
      }

      // 2. 走到新位置能威脅玩家棋子（進攻壓制 / 叉殺佈局）
      if (!postThreat.threatened) {
        const forkCount = countForkThreats(item.action.r, item.action.c, item.piece);
        score += forkCount * (aiLevel === 4 ? 60 : 45);
      }

      // 3. 佔據中心區域控制權
      const distToCenter = Math.abs(item.action.r - 1.5) + Math.abs(item.action.c - 3.5);
      score += (5 - distToCenter) * (aiLevel === 4 ? 4 : 3);

      // 4. 走步後讓友軍形成保護鏈（聚兵協同防守，Level 3 & 4 均具備）
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      let protectBonus = 0;
      dirs.forEach(([dr, dc]) => {
        const nr = item.action.r + dr; const nc = item.action.c + dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
          const adj = board[nr][nc];
          if (adj.revealed && adj.piece && adj.piece.color === aiColor) {
            protectBonus += (aiLevel === 4 ? 22 : 18);
          }
        }
      });
      score += protectBonus;

      // 5. 護衛受威脅友軍（走至受威脅友軍旁支援）
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = board[r][c];
          if (cell.revealed && cell.piece && cell.piece.color === aiColor && !(r === item.fromR && c === item.fromC)) {
            const cellThreat = isSquareThreatenedByEnemy(r, c, aiColor, cell.piece.rank, cell.piece.isCannon);
            if (cellThreat.threatened) {
              const dx = Math.abs(item.action.c - c);
              const dy = Math.abs(item.action.r - r);
              if ((dx === 0 || dy === 0) && dx + dy <= 2) {
                score += (aiLevel === 4 ? 35 : 25);
              }
            }
          }
        }
      }

      // 6. Level 4 專屬加成：Minimax 全盤檢查 + 獵殺追擊 + 架炮台跳板
      if (aiLevel === 4) {
        const snap = copyBoardSnap();
        applyMoveOnSnap(snap, item.fromR, item.fromC, item.action.r, item.action.c);
        const oppBest = bestOpponentResponseOnSnap(snap);
        score -= oppBest * 2.8;

        score += calcHuntingBonus(item.action.r, item.action.c, item.piece);
        score += calcScreenSetupBonus(item.action.r, item.action.c);
        if (item.piece.isCannon) {
          score += calcCannonBatteryBonus(item.action.r, item.action.c, item.piece);
        }
      }

      evaluatedMoves.push({ type: 'move', fromR: item.fromR, fromC: item.fromC, action: item.action, score });
    });

    // (C) 評估炮翻山跳暗棋
    cannonUnrevealed.forEach(item => {
      let score = 95;
      const postThreat = isSquareThreatenedByEnemy(item.action.r, item.action.c, aiColor, item.piece.rank, true);
      if (postThreat.threatened) {
        score = -400; // 炮跳暗棋若有去無回，嚴厲扣分
      } else {
        const forkCount = countForkThreats(item.action.r, item.action.c, item.piece);
        score += forkCount * (aiLevel === 4 ? 65 : 50) + (aiLevel === 4 ? 90 : 60);
      }

      if (aiLevel === 4) {
        const snap = copyBoardSnap();
        applyMoveOnSnap(snap, item.fromR, item.fromC, item.action.r, item.action.c);
        const oppBest = bestOpponentResponseOnSnap(snap);
        score -= oppBest * 2.5;
      }

      evaluatedMoves.push({ type: 'move', fromR: item.fromR, fromC: item.fromC, action: item.action, score });
    });

    // (D) 評估衝暗棋 (Blind Capture)
    blindCaptures.forEach(item => {
      const p = item.piece;
      let score = 50;
      if (p.rank === 7) score = 170;      // 帥/將
      else if (p.rank === 6) score = 130; // 士/仕
      else if (p.rank === 5) score = 100; // 象/相
      else if (p.rank === 4) score = 90;  // 車/俥
      else if (p.rank === 1) score = 70;  // 兵/卒
      else score = 40;

      const postThreat = isSquareThreatenedByEnemy(item.action.r, item.action.c, aiColor, p.rank, p.isCannon);
      if (postThreat.threatened) {
        // 高危盲吃懲罰
        score = p.rank <= 2 ? -50 : -350;
      } else {
        // 安全盲吃後的叉殺加成
        const forkCount = countForkThreats(item.action.r, item.action.c, p);
        score += forkCount * (aiLevel === 4 ? 45 : 35);
      }

      if (aiLevel === 4) {
        const snap = copyBoardSnap();
        applyMoveOnSnap(snap, item.fromR, item.fromC, item.action.r, item.action.c);
        const oppBest = bestOpponentResponseOnSnap(snap);
        score -= oppBest * 2.5;
      }

      evaluatedMoves.push({ type: 'move', fromR: item.fromR, fromC: item.fromC, action: item.action, score });
    });

    // (E) 評估翻開暗棋 (Flip Dark Piece)
    unrevealedCells.forEach(cell => {
      let score = 70;
      let enemyThreatCount = 0;
      let friendlyProtectCount = 0;
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      dirs.forEach(([dr, dc]) => {
        const nr = cell.r + dr;
        const nc = cell.c + dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
          const adj = board[nr][nc];
          if (adj.revealed && adj.piece) {
            if (adj.piece.color !== aiColor) enemyThreatCount++;
            else friendlyProtectCount++;
          }
        }
      });

      if (enemyThreatCount > 0) score -= enemyThreatCount * (aiLevel === 4 ? 35 : 28);
      if (friendlyProtectCount > 0) score += friendlyProtectCount * (aiLevel === 4 ? 20 : 16);

      // 兵力優勢時降低翻棋率（優先吃子打擊與簡化局面）
      if (aiTotalVal > 180 && captures.length > 0) {
        score -= (aiLevel === 4 ? 45 : 30);
      }

      evaluatedMoves.push({ type: 'flip', r: cell.r, c: cell.c, score });
    });

    // 全局危機緊急防守（若有多顆 AI 棋子受威脅，提高安全走步優先級）
    const totalVuln = calcTotalVulnerability();
    if (totalVuln > 80) {
      evaluatedMoves.forEach(m => {
        if (m.type === 'move' && m.action && m.action.type === 'move') {
          const postThreat = isSquareThreatenedByEnemy(m.action.r, m.action.c, aiColor, board[m.fromR][m.fromC]?.piece?.rank || 1, board[m.fromR][m.fromC]?.piece?.isCannon || false);
          if (!postThreat.threatened) {
            m.score += (aiLevel === 4 ? 40 : 30);
          }
        }
      });
    }

    if (evaluatedMoves.length === 0) {
      triggerGameOver('player', '對手已無棋可走（困斃）！你獲勝了！');
      return;
    }

    evaluatedMoves.sort((a, b) => b.score - a.score);

    let bestPick;
    if (aiLevel === 4) {
      // Level 4 Father：極度嚴謹候選窗口（±8分候選），嚴格防失誤，保持頂尖大師水準
      const topCandidates = evaluatedMoves.filter(m => m.score >= evaluatedMoves[0].score - 8);
      bestPick = topCandidates[Math.floor(Math.random() * Math.min(topCandidates.length, 2))];
    } else if (aiLevel === 3) {
      // Level 3 Mother：±15分微量隨機（8% 選次佳），棋路靈活自然且極難對付
      const topCandidates = evaluatedMoves.filter(m => m.score >= evaluatedMoves[0].score - 15);
      if (topCandidates.length > 1 && Math.random() < 0.08) {
        bestPick = topCandidates[1];
      } else {
        bestPick = topCandidates[0];
      }
    } else {
      bestPick = evaluatedMoves[0];
    }

    if (bestPick.type === 'flip') {
      executeFlip(bestPick.r, bestPick.c);
    } else {
      executeCaptureOrMove(bestPick.fromR, bestPick.fromC, bestPick.action);
    }
  }

  function executeAiComboMove() {
    if (!comboActive || !comboPos) return;
    const actions = getLegalActionsForPiece(comboPos.r, comboPos.c);
    const capturable = actions.filter(a => a.type === 'capture' || a.type === 'blind_capture' || a.type === 'cannon_unrevealed');

    if (capturable.length > 0) {
      const aiPiece = board[comboPos.r][comboPos.c].piece;
      const aiLevel = OPPONENT_PROFILES[opponentKey].level;

      // 優先吃已知高價值明棋
      const revealedCaptures = capturable.filter(a => a.type === 'capture');
      if (revealedCaptures.length > 0) {
        if (aiLevel >= 3) {
          // Level 3 & Level 4：選吃後最能形成下一個叉殺威脅的目標
          revealedCaptures.sort((a, b) => {
            const forkWeight = (aiLevel === 4 ? 45 : 30);
            const valA = getPieceRankValue(board[a.r][a.c].piece) * (aiLevel === 4 ? 1.5 : 1) + countForkThreats(a.r, a.c, aiPiece) * forkWeight;
            const valB = getPieceRankValue(board[b.r][b.c].piece) * (aiLevel === 4 ? 1.5 : 1) + countForkThreats(b.r, b.c, aiPiece) * forkWeight;
            return valB - valA;
          });
        } else {
          revealedCaptures.sort((a, b) => {
            const targetA = board[a.r][a.c].piece;
            const targetB = board[b.r][b.c].piece;
            return getPieceRankValue(targetB) - getPieceRankValue(targetA);
          });
        }
        executeCaptureOrMove(comboPos.r, comboPos.c, revealedCaptures[0]);
        return;
      }

      // 若無已知明棋，高等級或大棋子持續衝暗棋盲吃
      const blindTargets = capturable.filter(a => a.type === 'blind_capture' || a.type === 'cannon_unrevealed');
      if (blindTargets.length > 0) {
        if (aiLevel === 4) {
          // Level 4：連吃時絕對 100% 繼續衝暗棋（極限壓制連殺）
          const pick = blindTargets[Math.floor(Math.random() * blindTargets.length)];
          executeCaptureOrMove(comboPos.r, comboPos.c, pick);
          return;
        } else if (aiPiece.rank >= 3 || (aiLevel >= 3 && aiPiece.rank >= 2) || (aiLevel <= 2 && Math.random() < 0.6)) {
          const pick = blindTargets[Math.floor(Math.random() * blindTargets.length)];
          executeCaptureOrMove(comboPos.r, comboPos.c, pick);
          return;
        }
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

  // --- 戰績統計與排行榜資料持久化系統 ---
  const STATS_STORAGE_KEY = 'lianqi_chess_stats_v1';
  const LEADERBOARD_STORAGE_KEY = 'lianqi_leaderboard_v1';

  function getStoredStats() {
    try {
      const raw = localStorage.getItem(STATS_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {
      totalGames: 0,
      totalWins: 0,
      totalLosses: 0,
      currentStreak: 0,
      maxStreak: 0,
      opponents: {
        eric: { games: 0, wins: 0, losses: 0 },
        ana: { games: 0, wins: 0, losses: 0 },
        michelle: { games: 0, wins: 0, losses: 0 },
        davis: { games: 0, wins: 0, losses: 0 }
      }
    };
  }

  function saveStoredStats(stats) {
    try {
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
    } catch (e) {}
  }

  function getStoredLeaderboard() {
    try {
      const raw = localStorage.getItem(LEADERBOARD_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length >= 20) return parsed;
        if (Array.isArray(parsed) && parsed.length > 0) {
          // 若先前只有 10 筆，自動補齊至 20 筆預設資料
          const defaults = getDefault20Leaderboard();
          const merged = [...parsed];
          defaults.forEach(d => {
            if (!merged.find(m => m.name === d.name && m.score === d.score)) {
              merged.push(d);
            }
          });
          merged.sort((a, b) => b.score - a.score);
          return merged.slice(0, 20);
        }
      }
    } catch (e) {}
    return getDefault20Leaderboard();
  }

  function getDefault20Leaderboard() {
    return [
      { name: 'Teacher Kevin', score: 3880, opponent: 'Father(Dad)', mode: '🔥 連棋', date: '2026-09-27' },
      { name: 'Alex', score: 3450, opponent: 'Father(Dad)', mode: '🔥 連棋', date: '2026-09-26' },
      { name: 'Eric', score: 3120, opponent: 'Father(Dad)', mode: '🎯 象棋', date: '2026-09-25' },
      { name: 'Anna', score: 2890, opponent: 'Father(Dad)', mode: '🔥 連棋', date: '2026-09-25' },
      { name: 'Leo', score: 2650, opponent: 'Mother(Mom)', mode: '🔥 連棋', date: '2026-09-24' },
      { name: 'Emma', score: 2480, opponent: 'Mother(Mom)', mode: '🎯 象棋', date: '2026-09-24' },
      { name: 'Lucas', score: 2320, opponent: 'Mother(Mom)', mode: '🔥 連棋', date: '2026-09-23' },
      { name: 'Mia', score: 2160, opponent: 'Mother(Mom)', mode: '🎯 象棋', date: '2026-09-23' },
      { name: 'Ethan', score: 1980, opponent: 'Girl(Anna)', mode: '🔥 連棋', date: '2026-09-22' },
      { name: 'Sophia', score: 1850, opponent: 'Girl(Anna)', mode: '🎯 象棋', date: '2026-09-22' },
      { name: 'Oliver', score: 1720, opponent: 'Girl(Anna)', mode: '🔥 連棋', date: '2026-09-21' },
      { name: 'Ava', score: 1610, opponent: 'Girl(Anna)', mode: '🎯 象棋', date: '2026-09-21' },
      { name: 'Liam', score: 1530, opponent: 'Girl(Anna)', mode: '🔥 連棋', date: '2026-09-20' },
      { name: 'Noah', score: 1420, opponent: 'Boy(Kevin)', mode: '🔥 連棋', date: '2026-09-20' },
      { name: 'Isabella', score: 1350, opponent: 'Boy(Kevin)', mode: '🎯 象棋', date: '2026-09-19' },
      { name: 'Mason', score: 1280, opponent: 'Boy(Kevin)', mode: '🔥 連棋', date: '2026-09-19' },
      { name: 'Charlotte', score: 1190, opponent: 'Boy(Kevin)', mode: '🎯 象棋', date: '2026-09-18' },
      { name: 'James', score: 1110, opponent: 'Boy(Kevin)', mode: '🔥 連棋', date: '2026-09-18' },
      { name: 'Harper', score: 1040, opponent: 'Boy(Kevin)', mode: '🎯 象棋', date: '2026-09-17' },
      { name: 'Benjamin', score: 960, opponent: 'Boy(Kevin)', mode: '🔥 連棋', date: '2026-09-17' }
    ];
  }

  function saveStoredLeaderboard(lb) {
    try {
      localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(lb));
    } catch (e) {}
  }

  function recordMatchResult(isWin, isDraw) {
    if (playType !== 'single') return; // 僅統計單人對戰電腦之戰績

    const stats = getStoredStats();
    stats.totalGames++;

    if (!stats.opponents[opponentKey]) {
      stats.opponents[opponentKey] = { games: 0, wins: 0, losses: 0 };
    }
    stats.opponents[opponentKey].games++;

    if (isWin) {
      stats.totalWins++;
      stats.currentStreak++;
      if (stats.currentStreak > stats.maxStreak) {
        stats.maxStreak = stats.currentStreak;
      }
      stats.opponents[opponentKey].wins++;
    } else if (!isDraw) {
      stats.totalLosses++;
      stats.currentStreak = 0;
      stats.opponents[opponentKey].losses++;
    }

    saveStoredStats(stats);
    renderStatsUI();
  }

  function calculateMatchScore(isWin, isDraw) {
    if (isDraw) return 200;
    if (!isWin) return 100;

    const oppLevel = OPPONENT_PROFILES[opponentKey].level;
    const mult = [1.0, 1.4, 2.0, 3.2][oppLevel - 1];

    let remainingPieces = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = board[r][c];
        if (cell.revealed && cell.piece && cell.piece.color === playerColor) {
          remainingPieces++;
        }
      }
    }

    const base = 800;
    const comboBonus = currentMatchMaxCombo * 130;
    const pieceBonus = remainingPieces * 45;
    const efficiency = Math.max(0, (45 - currentMatchMoves) * 15);
    const score = Math.round((base + comboBonus + pieceBonus + efficiency) * mult);
    return score;
  }

  function renderStatsUI() {
    const stats = getStoredStats();
    const summaryRec = document.getElementById('stats-summary-record');
    const summaryRate = document.getElementById('stats-summary-winrate');
    const summaryStreak = document.getElementById('stats-summary-streak');

    const winRate = stats.totalGames > 0 ? Math.round((stats.totalWins / stats.totalGames) * 100) : 0;
    if (summaryRec) summaryRec.textContent = `${stats.totalGames} 戰 ${stats.totalWins} 勝`;
    if (summaryRate) summaryRate.textContent = `${winRate}%`;
    if (summaryStreak) summaryStreak.textContent = `${stats.maxStreak} 連勝`;

    // 更新各對手卡片勝率徽章
    const keys = ['eric', 'ana', 'michelle', 'davis'];
    keys.forEach(k => {
      const el = document.getElementById(`stat-opp-${k}`);
      if (el && stats.opponents[k]) {
        const op = stats.opponents[k];
        const r = op.games > 0 ? Math.round((op.wins / op.games) * 100) : 0;
        el.textContent = `${op.games} 戰 ${op.wins} 勝 (勝率 ${r}%)`;
      }
    });

    // 更新彈窗內的總體戰況
    const elTotGames = document.getElementById('stat-total-games');
    const elTotWins = document.getElementById('stat-total-wins');
    const elTotLosses = document.getElementById('stat-total-losses');
    const elTotRate = document.getElementById('stat-total-winrate');
    if (elTotGames) elTotGames.textContent = stats.totalGames;
    if (elTotWins) elTotWins.textContent = stats.totalWins;
    if (elTotLosses) elTotLosses.textContent = stats.totalLosses;
    if (elTotRate) elTotRate.textContent = `${winRate}%`;

    const oppList = document.getElementById('opponent-stats-list');
    if (oppList) {
      oppList.innerHTML = keys.map(k => {
        const prof = OPPONENT_PROFILES[k];
        const op = stats.opponents[k] || { games: 0, wins: 0, losses: 0 };
        const r = op.games > 0 ? Math.round((op.wins / op.games) * 100) : 0;
        return `
          <div class="opp-stat-row">
            <div class="opp-stat-header">
              <span class="opp-stat-name">${prof.avatar} ${prof.name} (${prof.desc.split('・')[0]})</span>
              <span class="opp-stat-score">${op.games} 戰 ${op.wins} 勝 ${op.losses} 敗 (勝率 <strong>${r}%</strong>)</span>
            </div>
            <div class="win-rate-bar-bg">
              <div class="win-rate-bar-fill" style="width: ${r}%;"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  function renderLeaderboard() {
    const lb = getStoredLeaderboard();
    const tbody = document.getElementById('leaderboard-tbody');
    if (!tbody) return;
    tbody.innerHTML = lb.map((row, idx) => {
      let rankIcon = `#${idx + 1}`;
      let rankClass = '';
      if (idx === 0) { rankIcon = '🥇 冠軍'; rankClass = 'rank-1'; }
      else if (idx === 1) { rankIcon = '🥈 亞軍'; rankClass = 'rank-2'; }
      else if (idx === 2) { rankIcon = '🥉 季軍'; rankClass = 'rank-3'; }

      return `
        <tr class="${rankClass}">
          <td><strong>${rankIcon}</strong></td>
          <td style="font-weight: bold; color: #fff;">${row.name}</td>
          <td style="color: #ffd54f; font-weight: bold;">${row.score}</td>
          <td>${row.opponent}</td>
          <td>${row.mode}</td>
        </tr>
      `;
    }).join('');
  }

  function openLeaderboard() {
    renderLeaderboard();
    const m = document.getElementById('modal-leaderboard');
    if (m) m.classList.add('active');
  }

  function closeLeaderboard() {
    const m = document.getElementById('modal-leaderboard');
    if (m) m.classList.remove('active');
  }

  function openStatsModal() {
    renderStatsUI();
    const m = document.getElementById('modal-stats');
    if (m) m.classList.add('active');
  }

  function closeStatsModal() {
    const m = document.getElementById('modal-stats');
    if (m) m.classList.remove('active');
  }

  function submitScoreRecord() {
    const input = document.getElementById('input-player-name');
    if (!input) return;
    const name = input.value.trim() || '無名英雄';
    const oppName = OPPONENT_PROFILES[opponentKey].name;
    const modeName = (ruleMode === 'lianqi') ? '🔥 連棋' : '🎯 象棋';

    const lb = getStoredLeaderboard();
    const newEntry = {
      name: name,
      score: lastCalculatedScore,
      opponent: oppName,
      mode: modeName,
      date: new Date().toISOString().split('T')[0]
    };

    lb.push(newEntry);
    lb.sort((a, b) => b.score - a.score);
    const top20 = lb.slice(0, 20);
    saveStoredLeaderboard(top20);

    const inputGroup = document.getElementById('gameover-name-input-group');
    if (inputGroup) {
      inputGroup.innerHTML = `<span style="color: #a5d6a7; font-weight: bold;">✅ 已成功登錄至排行榜！恭喜 ${name}！</span>`;
    }
    renderLeaderboard();
  }

  function triggerGameOver(winnerSide, reasonDesc) {
    isGameOver = true;
    const modal = document.getElementById('modal-gameover');
    const iconEl = document.getElementById('gameover-icon');
    const titleEl = document.getElementById('gameover-title');
    const descEl = document.getElementById('gameover-desc');
    const statusBox = document.getElementById('voice-indicator');

    const isPlayerWin = (playType === 'single' && winnerSide === 'player') || (playType === 'dual' && winnerSide === 'p1');
    const isDraw = winnerSide === 'draw';

    // 紀錄戰績
    recordMatchResult(isPlayerWin, isDraw);

    // 計算本局得分
    lastCalculatedScore = calculateMatchScore(isPlayerWin, isDraw);
    const scoreValEl = document.getElementById('gameover-score-value');
    if (scoreValEl) scoreValEl.textContent = `${lastCalculatedScore} 分`;

    // 排行榜 Top 20 資格判定
    const lb = getStoredLeaderboard();
    const minScore = lb.length < 20 ? 0 : lb[lb.length - 1].score;
    const qualifiesTop20 = (playType === 'single' && isPlayerWin && lastCalculatedScore >= minScore);

    const lbSection = document.getElementById('gameover-leaderboard-section');
    const rankTag = document.getElementById('gameover-rank-tag');
    const nameInputGroup = document.getElementById('gameover-name-input-group');

    if (lbSection) {
      if (qualifiesTop20) {
        lbSection.style.display = 'block';
        if (rankTag) rankTag.style.display = 'inline-block';
        if (nameInputGroup) {
          nameInputGroup.innerHTML = `
            <input type="text" id="input-player-name" placeholder="請輸入大名登上排行榜..." maxlength="12">
            <button class="btn-primary btn-save-record" onclick="GameApp.submitScoreRecord()">儲存紀錄</button>
          `;
        }
      } else {
        if (rankTag) rankTag.style.display = 'none';
        if (nameInputGroup) nameInputGroup.innerHTML = '';
      }
    }

    // 戰況快報
    const matchStatEl = document.getElementById('gameover-match-stat');
    if (matchStatEl && playType === 'single') {
      const stats = getStoredStats();
      const op = stats.opponents[opponentKey] || { games: 0, wins: 0, losses: 0 };
      const r = op.games > 0 ? Math.round((op.wins / op.games) * 100) : 0;
      matchStatEl.textContent = `對【${OPPONENT_PROFILES[opponentKey].name}】戰績：${op.games} 戰 ${op.wins} 勝 ${op.losses} 敗（勝率 ${r}%）`;
    }

    if (isDraw) {
      playSynthSfx('move');
      if (iconEl) iconEl.textContent = '🤝';
      if (titleEl) titleEl.textContent = '雙方握手言和！';
      if (descEl) descEl.textContent = `${reasonDesc} 精彩的攻防大戰！`;
      if (statusBox) statusBox.textContent = '和棋結算完畢';
      if (modal) modal.classList.add('active');
      return;
    }

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
        modeTag.className = 'center-mode-title';
        modeTag.textContent = '🔥 連棋';
      } else {
        modeTag.className = 'center-mode-title classic';
        modeTag.textContent = '🎯 象棋';
      }
    }

    const isP1Turn = (playType === 'single') ? (currentTurn === 'player') : (currentTurn === 'p1');

    const p1ColorStr = playerColor ? (playerColor === 'red' ? '🔴 Red' : '⚫ Black') : '❓ Undecided';
    const p2ColorStr = opponentColor ? (opponentColor === 'red' ? '🔴 Red' : '⚫ Black') : '❓ Undecided';

    if (playType === 'single') {
      const opp = OPPONENT_PROFILES[opponentKey];
      if (p1Badge) p1Badge.textContent = '🧑';
      if (p1Name) p1Name.textContent = 'Player(You)';
      if (p2Badge) p2Badge.textContent = opp.avatar;
      if (p2Name) p2Name.textContent = opp.name;
    } else {
      if (p1Badge) p1Badge.textContent = playerColor === 'black' ? '⚫' : '🔴';
      if (p1Name) p1Name.textContent = 'Player 1';
      if (p2Badge) p2Badge.textContent = opponentColor === 'black' ? '⚫' : '🔴';
      if (p2Name) p2Name.textContent = 'Player 2';
    }

    if (isP1Turn) {
      if (p1Turn) {
        p1Turn.className = 'turn-pill active-turn';
        p1Turn.textContent = `${p1ColorStr} (Active)`;
      }
      if (p2Turn) {
        p2Turn.className = 'turn-pill wait-turn';
        p2Turn.textContent = `${p2ColorStr} (Waiting)`;
      }
    } else {
      if (p1Turn) {
        p1Turn.className = 'turn-pill wait-turn';
        p1Turn.textContent = `${p1ColorStr} (Waiting)`;
      }
      if (p2Turn) {
        p2Turn.className = 'turn-pill active-turn';
        p2Turn.textContent = `${p2ColorStr} (Active)`;
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
            if (cell.revealing) {
              pieceDiv.classList.add('blind-revealing');
            }
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

  // 初始化統計與音效監聽
  window.addEventListener('touchstart', initAudioContext, { once: true, passive: true });
  window.addEventListener('click', initAudioContext, { once: true, passive: true });
  setTimeout(() => renderStatsUI(), 100);

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
    openLeaderboard,
    closeLeaderboard,
    openStatsModal,
    closeStatsModal,
    submitScoreRecord,
    toggleSound,
    restartCurrentGame,
    finishCombo
  };
})();
