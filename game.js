/**
 * 連棋大挑戰 (Lianqi Challenge) - V6.2 完整規則精準版
 * 專為一年級學童與家長量身打造・iPad 觸控流暢優化
 * 核心特色：
 * 1. 凱文 5 大明示規則（同階互吃、士不吃將、兵卒吃將帥、炮隔子跳吃暗棋、連吃Combo）
 * 2. 8 大面向完整暗棋規則（困斃判定、30步無吃子和棋、陣營動態判定、雙向切換選取、點擊自棋結束連吃）
 * 3. 4 大個性 AI (Eric, Ana, Davis, Michelle) + 雙人對戰模式
 * 4. 8 Voice 雙語音揭曉 (先媽媽鼓勵 -> 後爸爸複盤引導)
 */

const GameApp = (() => {
  // --- 棋子階級設定 ---
  // 階級 (Rank): 7: 帥/將, 6: 仕/士, 5: 相/象, 4: 俥/車, 3: 傌/馬, 2: 炮/包, 1: 兵/卒
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
    eric: { name: '男同學 (Eric)', avatar: '👦', desc: '活潑開朗・入門練習', level: 1 },
    ana: { name: '女同學 (Ana)', avatar: '👧', desc: '機智靈活・穩健防守', level: 2 },
    davis: { name: '爸爸 (Davis)', avatar: '👨', desc: '沉著老練・車馬炮佈局', level: 3 },
    michelle: { name: '媽媽 (Michelle)', avatar: '👩', desc: '細心縝密・高手挑戰', level: 4 }
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

  let mode = 'single'; // 'single' | 'dual'
  let opponentKey = 'eric';

  const ROWS = 4;
  const COLS = 8;
  let board = []; // [ROWS][COLS]
  let playerColor = null; // 'red' | 'black' (第一翻決定 P1 / 玩家顏色)
  let opponentColor = null; // 'red' | 'black' (P2 / 電腦顏色)
  let currentTurn = 'player'; // 'player' | 'opponent' (單人) 或 'p1' | 'p2' (雙人)
  let selectedPos = null; // { r, c }
  let validTargets = []; // [{ r, c, type: 'move'|'capture'|'cannon_unrevealed' }]
  let comboActive = false;
  let comboPos = null;
  let comboCount = 0;
  let consecutiveNoCapture = 0; // 連續無吃子回合計數
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
        // 木片翻牌清脆聲
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(340, now);
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.12);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'move') {
        // 落子沉著木質敲擊聲
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.14);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
        osc.start(now);
        osc.stop(now + 0.14);
      } else if (type === 'capture') {
        // 吃子爽快撞擊
        osc.type = 'square';
        osc.frequency.setValueAtTime(480, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.22);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'combo') {
        // 連吃清脆四音階上升
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
        // 勝利大三和弦
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
        // 安慰和弦
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

  // --- 畫面導覽 ---
  function showScreen(screenId) {
    document.querySelectorAll('.view-screen').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
  }

  function showHome() {
    closeModals();
    showScreen('screen-home');
  }

  function showOpponents() {
    closeModals();
    showScreen('screen-opponents');
    playSynthSfx('move');
  }

  function openRules() {
    initAudioContext();
    document.getElementById('modal-rules').classList.add('active');
    playSynthSfx('move');
  }

  function closeRules() {
    document.getElementById('modal-rules').classList.remove('active');
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

  // --- 遊戲初始化 ---
  function selectOpponent(key) {
    mode = 'single';
    opponentKey = key;
    initAudioContext();
    playAudioFile(AUDIO_FILES.ready_aria);
    startNewGame();
  }

  function startDualMode() {
    mode = 'dual';
    initAudioContext();
    playAudioFile(AUDIO_FILES.intro_jenny);
    startNewGame();
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
    currentTurn = (mode === 'single') ? 'player' : 'p1';
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
    updateStatusTip('🎲 遊戲開始！請點擊任意一顆未翻開的暗棋決定陣營！');
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

  // --- 連棋核心走法與吃子判定 ---
  /**
   * 判定 attacker 棋子是否可吃目標 defender（相鄰一格吃子）
   */
  function canCapture(attacker, defender) {
    if (!attacker || !defender) return false;
    if (attacker.color === defender.color) return false; // 同陣營不可互吃

    // 凱文明示規則 2：士/仕不能吃將/帥！
    if (attacker.rank === 6 && defender.rank === 7) {
      return false;
    }

    // 凱文明示規則 3 & 4：卒可吃帥、兵可吃將！
    if (attacker.rank === 1 && defender.rank === 7) {
      return true;
    }

    // 傳統相剋限制：帥將不能吃兵卒
    if (attacker.rank === 7 && defender.rank === 1) {
      return false;
    }

    // 凱文明示規則 1：同階互吃！
    if (attacker.rank === defender.rank) {
      return true;
    }

    // 高階吃低階
    return attacker.rank > defender.rank;
  }

  /**
   * 計算特定棋子在當前盤面上的所有合法移動與吃子
   */
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
            // 空格移動（連吃進行中不可走空格）
            if (!comboActive) {
              actions.push({ r: nr, c: nc, type: 'move' });
            }
          } else if (targetCell.revealed) {
            // 已翻開的敵方棋子
            if (targetCell.piece.color !== p.color && canCapture(p, targetCell.piece)) {
              actions.push({ r: nr, c: nc, type: 'capture' });
            }
          }
          // 普通棋子不可吃未翻開暗棋
        }
      }
    } else {
      // 2. 炮 (包) 的特殊規則
      // 走法：相鄰走 1 格空格 (無吃子，且非連吃中)
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

      // 吃法：同一直線或橫線上，隔恰好 1 顆棋子（炮台）翻山跳吃
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
              // 找到目標棋子！
              if (currCell.revealed) {
                // 已翻開：若是敵方棋子，直接吃！（不限階級，1~7 全可吃）
                if (currCell.piece.color !== p.color) {
                  actions.push({ r: nr, c: nc, type: 'capture' });
                }
              } else {
                // 凱文明示規則 5：炮可隔一子跳吃未翻開暗棋！
                actions.push({ r: nr, c: nc, type: 'cannon_unrevealed' });
              }
              break; // 隔一子只能吃第一顆目標
            }
          }
          step++;
        }
      }
    }

    return actions;
  }

  /**
   * 檢查盤面上特定陣營是否還有任何合法動作（翻暗棋 或 移動/吃子）
   */
  function hasAnyLegalAction(color) {
    if (!color) return true;
    // 1. 是否還有暗棋可翻
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!board[r][c].revealed) return true;
      }
    }
    // 2. 是否有該顏色的明棋可走或可吃
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

  // --- 玩家點擊處理 ---
  function onCellClicked(r, c) {
    if (isGameOver) return;
    initAudioContext();

    // 單人模式若非玩家回合，禁止點擊
    if (mode === 'single' && currentTurn === 'opponent') return;

    const cell = board[r][c];

    // 情況 A：如果目前處於連吃中
    if (comboActive) {
      if (comboPos && comboPos.r === r && comboPos.c === c) {
        // 點擊自身：意即「結束連吃 / 完成回合」
        updateStatusTip('✨ 結束連吃！回合換手。');
        finishCombo();
        return;
      }

      // 檢查是否點擊合法吃子目標
      const match = validTargets.find(t => t.r === r && t.c === c && (t.type === 'capture' || t.type === 'cannon_unrevealed'));
      if (match) {
        executeCaptureOrMove(comboPos.r, comboPos.c, match);
      } else {
        // 點擊其他非攻擊格：也視為結束連吃
        updateStatusTip('✨ 結束連吃！回合換手。');
        finishCombo();
      }
      return;
    }

    // 情況 B：點擊尚未翻開的暗棋
    if (!cell.revealed) {
      // 若當前選取的炮能跳吃該暗棋
      if (selectedPos) {
        const cannonMatch = validTargets.find(t => t.r === r && t.c === c && t.type === 'cannon_unrevealed');
        if (cannonMatch) {
          executeCaptureOrMove(selectedPos.r, selectedPos.c, cannonMatch);
          return;
        }
      }
      // 否則：翻開此暗棋！
      executeFlip(r, c);
      return;
    }

    // 情況 C：點擊已翻開的格子
    const activeColor = getCurrentTurnColor();

    // 若點擊的是合法目標（移動或吃子）
    if (selectedPos) {
      const matchAction = validTargets.find(t => t.r === r && t.c === c);
      if (matchAction) {
        executeCaptureOrMove(selectedPos.r, selectedPos.c, matchAction);
        return;
      }
    }

    // 點擊自己的棋子進行選取（或切換/取消選取）
    if (cell.piece && cell.piece.color === activeColor) {
      if (selectedPos && selectedPos.r === r && selectedPos.c === c) {
        // 再次點擊已選中的自己棋子 ➔ 取消選取 (Toggle Off)
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
        updateStatusTip(`已選取【${cell.piece.name}】，請點擊綠點移動或紅框吃子！`);
      }
      return;
    }

    // 點擊空地或其他無效處：取消選取
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
    consecutiveNoCapture = 0; // 翻牌重置無吃子計數
    playSynthSfx('flip');

    // 若為第一翻：決定陣營
    if (playerColor === null) {
      if (mode === 'single') {
        playerColor = cell.piece.color;
        opponentColor = (playerColor === 'red') ? 'black' : 'red';
      } else {
        // 雙人模式：P1 翻出顏色即為 P1
        playerColor = cell.piece.color;
        opponentColor = (playerColor === 'red') ? 'black' : 'red';
      }
    }

    updateUIHeader();
    renderBoard();
    updateStatusTip(`✨ 翻開了！這是一顆【${cell.piece.color === 'red' ? '紅' : '黑'}・${cell.piece.name}】！`);

    // 翻牌結束此回合
    endTurn();
  }

  function executeCaptureOrMove(fromR, fromC, action) {
    const fromCell = board[fromR][fromC];
    const toCell = board[action.r][action.c];
    const attacker = fromCell.piece;

    selectedPos = null;
    validTargets = [];

    if (action.type === 'move') {
      // 純移動
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

    // 炮跳吃暗棋
    if (action.type === 'cannon_unrevealed') {
      toCell.revealed = true;
      const targetPiece = toCell.piece;
      consecutiveNoCapture = 0;

      if (targetPiece.color !== attacker.color) {
        // 敵方暗棋：擊殺吃掉！
        deadPieces[targetPiece.color].push(targetPiece.name);
        toCell.piece = attacker;
        fromCell.piece = null;
        playSynthSfx('capture');
        updateStatusTip(`💥 炮翻山跳吃！成功擊殺敵方未翻開的【${targetPiece.name}】！`);
        checkComboOrEndTurn(action.r, action.c);
      } else {
        // 己方暗棋：揭曉該己方棋子，炮退回原位（不自殘）
        playSynthSfx('flip');
        updateStatusTip(`🛡️ 炮跳過去揭曉發現是自己人的【${targetPiece.name}】！揭曉成功，炮返回原位。`);
        renderBoard();
        renderGraveyards();
        endTurn();
      }
      return;
    }

    // 一般吃子或炮吃明棋
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

  // --- 連吃 (Combo) 機制 ---
  function checkComboOrEndTurn(newR, newC) {
    renderBoard();
    renderGraveyards();

    if (checkGameOverCondition()) return;

    // 檢查在新位置是否還能繼續連吃
    comboActive = true;
    const nextActions = getLegalActionsForPiece(newR, newC);
    const capturableTargets = nextActions.filter(a => a.type === 'capture' || a.type === 'cannon_unrevealed');

    if (capturableTargets.length > 0) {
      // 觸發連吃！
      comboCount++;
      comboPos = { r: newR, c: newC };
      validTargets = capturableTargets;
      selectedPos = { r: newR, c: newC };

      playSynthSfx('combo');
      showComboBanner(true, comboCount);
      renderBoard();

      if (mode === 'single' && currentTurn === 'opponent') {
        setTimeout(() => executeAiComboMove(), 750);
      } else {
        updateStatusTip(`🔥 連吃 COMBO x${comboCount + 1}！點擊 ⚔️ 繼續吃子，或點選自身棋子/按鈕結束回合！`);
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

    if (mode === 'single') {
      currentTurn = (currentTurn === 'player') ? 'opponent' : 'player';
    } else {
      currentTurn = (currentTurn === 'p1') ? 'p2' : 'p1';
    }

    updateUIHeader();
    renderBoard();

    // 困斃判定：若換手後的行動方無任何暗棋可翻且無任何明棋可動，判定輸局
    const nextTurnColor = getCurrentTurnColor();
    if (nextTurnColor && !hasAnyLegalAction(nextTurnColor)) {
      if (mode === 'single') {
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
    if (mode === 'single' && currentTurn === 'opponent') {
      updateStatusTip(`🤔 ${OPPONENT_PROFILES[opponentKey].name} 正在思考中...`);
      setTimeout(() => executeAiTurn(), 650);
    }
  }

  function getCurrentTurnColor() {
    if (playerColor === null) return null;
    if (mode === 'single') {
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

    // 收集所有未翻開暗棋
    const unrevealedCells = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!board[r][c].revealed) {
          unrevealedCells.push({ r, c });
        }
      }
    }

    // 收集 AI 所有明棋的合法動作
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
    const cannonUnrevealed = allActions.filter(x => x.action.type === 'cannon_unrevealed');
    const normalMoves = allActions.filter(x => x.action.type === 'move');

    // Eric (Level 1): 入門・隨機翻牌與吃子
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

    // Ana (Level 2), Davis (Level 3), Michelle (Level 4): 智慧優先吃高價值目標
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

    // 炮跳打暗棋
    if (cannonUnrevealed.length > 0 && (aiLevel >= 3 || Math.random() < 0.45)) {
      const pick = cannonUnrevealed[Math.floor(Math.random() * cannonUnrevealed.length)];
      executeCaptureOrMove(pick.fromR, pick.fromC, pick.action);
      return;
    }

    // 翻牌
    if (unrevealedCells.length > 0 && (normalMoves.length === 0 || Math.random() < 0.5)) {
      const pick = unrevealedCells[Math.floor(Math.random() * unrevealedCells.length)];
      executeFlip(pick.r, pick.c);
      return;
    }

    // 走子移動
    if (normalMoves.length > 0) {
      const pick = normalMoves[Math.floor(Math.random() * normalMoves.length)];
      executeCaptureOrMove(pick.fromR, pick.fromC, pick.action);
      return;
    }

    // 最後翻牌
    if (unrevealedCells.length > 0) {
      const pick = unrevealedCells[Math.floor(Math.random() * unrevealedCells.length)];
      executeFlip(pick.r, pick.c);
      return;
    }

    // 無處可走 ➔ 困斃
    triggerGameOver('player', '對手已無棋可走（困斃）！你獲勝了！');
  }

  // AI 連吃決策
  function executeAiComboMove() {
    if (!comboActive || !comboPos) return;
    const actions = getLegalActionsForPiece(comboPos.r, comboPos.c);
    const capturable = actions.filter(a => a.type === 'capture' || a.type === 'cannon_unrevealed');

    if (capturable.length > 0) {
      capturable.sort((a, b) => {
        const targetA = board[a.r][a.c].piece;
        const targetB = board[b.r][b.c].piece;
        const valA = targetA ? targetA.rank : 0;
        const valB = targetB ? targetB.rank : 0;
        return valB - valA;
      });
      const pick = capturable[0];
      executeCaptureOrMove(comboPos.r, comboPos.c, pick);
    } else {
      finishCombo();
    }
  }

  // --- 勝負與殘局判定 ---
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

  // --- 遊戲結束結算與雙人語音播報 ---
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

    const isPlayerWin = (mode === 'single' && winnerSide === 'player') || (mode === 'dual' && winnerSide === 'p1');

    if (isPlayerWin) {
      playSynthSfx('win');
      if (iconEl) iconEl.textContent = '🎉';
      if (titleEl) titleEl.textContent = '🎉 你贏了！太棒了！ 🎉';
      if (descEl) descEl.textContent = `${reasonDesc} 你的戰術真是太精彩了！`;

      const seq = [];
      const useChildVoice = Math.random() < 0.35;
      if (useChildVoice) {
        seq.push({ label: '👧 女同學 (Ana)', file: AUDIO_FILES.ana_win });
        seq.push({ label: '👦 男同學 (Eric)', file: AUDIO_FILES.eric_win });
      } else {
        seq.push({ label: '👩 媽媽 (Michelle)', file: AUDIO_FILES.michelle_win });
        seq.push({ label: '👨 爸爸 (Davis)', file: AUDIO_FILES.davis_win });
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
        seq.push({ label: '👦 男同學 (Eric)', file: AUDIO_FILES.eric_lose });
        seq.push({ label: '👧 女同學 (Ana)', file: AUDIO_FILES.ana_lose });
      } else {
        seq.push({ label: '👩 媽媽 (Michelle)', file: AUDIO_FILES.michelle_lose });
        seq.push({ label: '👨 爸爸 (Davis)', file: AUDIO_FILES.davis_lose });
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

    const isP1Turn = (mode === 'single') ? (currentTurn === 'player') : (currentTurn === 'p1');

    const p1ColorStr = playerColor ? (playerColor === 'red' ? '🔴 紅方' : '⚫ 黑方') : '❓ 陣營待定';
    const p2ColorStr = opponentColor ? (opponentColor === 'red' ? '🔴 紅方' : '⚫ 黑方') : '❓ 陣營待定';

    if (mode === 'single') {
      const opp = OPPONENT_PROFILES[opponentKey];
      if (p1Badge) p1Badge.textContent = '🧑';
      if (p1Name) p1Name.textContent = '玩家 (你)';
      if (p2Badge) p2Badge.textContent = opp.avatar;
      if (p2Name) p2Name.textContent = opp.name;
    } else {
      if (p1Badge) p1Badge.textContent = playerColor === 'black' ? '⚫' : '🔴';
      if (p1Name) p1Name.textContent = '玩家 1 (先手)';
      if (p2Badge) p2Badge.textContent = opponentColor === 'black' ? '⚫' : '🔴';
      if (p2Name) p2Name.textContent = '玩家 2 (後手)';
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

        // 標記有效目標
        const validAction = validTargets.find(t => t.r === r && t.c === c);
        if (validAction) {
          if (validAction.type === 'move') {
            cellDiv.classList.add('valid-move');
          } else if (validAction.type === 'capture' || validAction.type === 'cannon_unrevealed') {
            cellDiv.classList.add('valid-capture');
          }
        }

        // 棋子渲染
        if (cell.piece) {
          const pieceDiv = document.createElement('div');
          pieceDiv.className = 'piece';

          if (!cell.revealed) {
            pieceDiv.classList.add('hidden-piece');
          } else {
            pieceDiv.classList.add('revealed', cell.piece.color);
            pieceDiv.textContent = cell.piece.name;
          }

          // 選取高亮
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

  // 頁面初次點擊解鎖音效（相容 iPad Safari AudioContext）
  window.addEventListener('touchstart', initAudioContext, { once: true, passive: true });
  window.addEventListener('click', initAudioContext, { once: true, passive: true });

  return {
    showHome,
    showOpponents,
    openRules,
    closeRules,
    toggleSound,
    selectOpponent,
    startDualMode,
    restartCurrentGame,
    finishCombo
  };
})();
