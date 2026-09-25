/**
 * 連棋大挑戰 (Lianqi Challenge) - V6 一次到位版 (iPad 優化)
 * 專為一年級學童設計：超大觸控、木質棋盤、3D 質感棋子、同階互吃、炮跳吃暗棋、連吃 Combo 與 8 Voice 語音
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
    eric: { name: '男同學 (Eric)', avatar: '👦', desc: '活潑開朗・入門練習', level: 1 },
    ana: { name: '女同學 (Ana)', avatar: '👧', desc: '機智靈活・穩健防守', level: 2 },
    davis: { name: '爸爸 (Davis)', avatar: '👨', desc: '沉著老練・棋藝高超', level: 3 },
    michelle: { name: '媽媽 (Michelle)', avatar: '👩', desc: '細心縝密・高手挑戰', level: 4 }
  };

  // --- 語音音檔設定 ---
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

  // 狀態變數
  let soundEnabled = true;
  let audioContext = null;
  let currentAudio = null;

  let mode = 'single'; // 'single' | 'dual'
  let opponentKey = 'eric';
  
  // 棋局狀態
  const ROWS = 4;
  const COLS = 8;
  let board = []; // [ROWS][COLS]
  let playerColor = null; // 'red' | 'black' (第一翻決定)
  let opponentColor = null;
  let currentTurn = 'player'; // 'player' | 'opponent' (單人模式) 或 'p1' | 'p2' (雙人模式)
  let selectedPos = null; // { r, c }
  let validTargets = []; // [{ r, c, type: 'move'|'capture'|'cannon_unrevealed' }]
  let comboActive = false;
  let comboPos = null;
  let comboCount = 0;
  let consecutiveNoCapture = 0;
  let deadPieces = { red: [], black: [] };
  let isGameOver = false;

  // --- Web Audio 零延遲音效系統 ---
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
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'move') {
        // 落子沉著木音
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'capture') {
        // 吃子爽快撞擊
        osc.type = 'square';
        osc.frequency.setValueAtTime(450, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.2);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'combo') {
        // 連吃清脆上升音階
        const freqs = [330, 440, 550, 660];
        freqs.forEach((freq, idx) => {
          const o = audioContext.createOscillator();
          const g = audioContext.createGain();
          o.connect(g);
          g.connect(audioContext.destination);
          o.type = 'triangle';
          o.frequency.setValueAtTime(freq, now + idx * 0.08);
          g.gain.setValueAtTime(0.3, now + idx * 0.08);
          g.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.08 + 0.15);
          o.start(now + idx * 0.08);
          o.stop(now + idx * 0.08 + 0.15);
        });
      } else if (type === 'win') {
        // 勝利歡樂大三和弦
        const notes = [261.63, 329.63, 392.00, 523.25];
        notes.forEach((freq, idx) => {
          const o = audioContext.createOscillator();
          const g = audioContext.createGain();
          o.connect(g);
          g.connect(audioContext.destination);
          o.type = 'sine';
          o.frequency.setValueAtTime(freq, now + idx * 0.1);
          g.gain.setValueAtTime(0.25, now + idx * 0.1);
          g.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.1 + 0.4);
          o.start(now + idx * 0.1);
          o.stop(now + idx * 0.1 + 0.4);
        });
      } else if (type === 'lose') {
        // 舒緩安慰和弦
        const notes = [392.00, 329.63, 261.63];
        notes.forEach((freq, idx) => {
          const o = audioContext.createOscillator();
          const g = audioContext.createGain();
          o.connect(g);
          g.connect(audioContext.destination);
          o.type = 'sine';
          o.frequency.setValueAtTime(freq, now + idx * 0.15);
          g.gain.setValueAtTime(0.2, now + idx * 0.15);
          g.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.15 + 0.35);
          o.start(now + idx * 0.15);
          o.stop(now + idx * 0.15 + 0.35);
        });
      }
    } catch (e) {
      console.warn('Web Audio error:', e);
    }
  }

  // --- Edge-TTS 語音播放管線 ---
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
          playPromise.catch((err) => {
            console.warn('Audio play restricted by browser:', err);
            resolve();
          });
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
      await new Promise(r => setTimeout(r, 200)); // 句間間隔
    }
    if (statusCallback) statusCallback('');
  }

  // --- 畫面切換 ---
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
    updateStatusTip('🎲 遊戲開始！點擊任意一顆未翻開的暗棋開始第一步！');
    showScreen('screen-game');
  }

  // --- 洗牌與棋盤佈局 ---
  function createShuffledBoard() {
    const piecesPool = [];
    // 生成紅黑各 16 顆
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

  // --- 連棋核心走法與吃子規則判定 ---
  /**
   * 判定 attacker 棋子是否可吃目標 defender
   */
  function canCapture(attacker, defender) {
    if (!attacker || !defender) return false;
    if (attacker.color === defender.color) return false; // 同陣營不可吃

    // 凱文明示核心規則 2：士不能吃將！
    if (attacker.rank === 6 && defender.rank === 7) {
      return false;
    }

    // 凱文明示核心規則 3 & 4：卒可吃帥、兵可吃將！
    if (attacker.rank === 1 && defender.rank === 7) {
      return true;
    }

    // 傳統相剋限制：帥將不能吃兵卒
    if (attacker.rank === 7 && defender.rank === 1) {
      return false;
    }

    // 凱文明示核心規則 1：同階互吃！
    if (attacker.rank === defender.rank) {
      return true;
    }

    // 高階吃低階
    return attacker.rank > defender.rank;
  }

  /**
   * 計算特定棋子在盤面上的所有合法移動與吃子
   */
  function getLegalActionsForPiece(r, c) {
    const cell = board[r][c];
    if (!cell || !cell.revealed || !cell.piece) return [];
    const p = cell.piece;
    const actions = [];

    // 4 個正交方向
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    // 1. 普通相鄰 1 格走動或吃子 (非炮)
    if (!p.isCannon) {
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
          const targetCell = board[nr][nc];
          if (!targetCell.piece) {
            // 空格移動 (連吃過程中不可走空格)
            if (!comboActive) {
              actions.push({ r: nr, c: nc, type: 'move' });
            }
          } else if (targetCell.revealed) {
            // 已翻開的敵方棋子
            if (targetCell.piece.color !== p.color && canCapture(p, targetCell.piece)) {
              actions.push({ r: nr, c: nc, type: 'capture' });
            }
          }
          // 一般棋子不可攻擊蓋著的暗棋 (凱文規則 5 僅炮有特權)
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

      // 吃法：隔一子跳吃 (直線方向無距離限制，中間必須且只能有 1 顆棋子作為炮台)
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
              // 找到目標！
              if (currCell.revealed) {
                // 已翻開：若是敵方棋子，直接吃！(不受階級限制)
                if (currCell.piece.color !== p.color) {
                  actions.push({ r: nr, c: nc, type: 'capture' });
                }
              } else {
                // 凱文明示核心規則 5：炮可直接跳過一個棋子，吃掉敵方棋子，不管對方翻出來了沒有！
                actions.push({ r: nr, c: nc, type: 'cannon_unrevealed' });
              }
              break; // 隔一子只能打第一隻目標
            }
          }
          step++;
        }
      }
    }

    return actions;
  }

  // --- 玩家點擊處理 ---
  function onCellClicked(r, c) {
    if (isGameOver) return;
    initAudioContext();

    // 如果現在不是玩家回合（單人模式電腦思考中），禁止點擊
    if (mode === 'single' && currentTurn === 'opponent') return;

    const cell = board[r][c];

    // 情況 A：如果目前處於連吃中
    if (comboActive) {
      if (comboPos && comboPos.r === r && comboPos.c === c) {
        // 點擊自身：無效
        return;
      }
      // 檢查是否點擊合法吃子目標
      const match = validTargets.find(t => t.r === r && t.c === c && (t.type === 'capture' || t.type === 'cannon_unrevealed'));
      if (match) {
        executeCaptureOrMove(comboPos.r, comboPos.c, match);
      } else {
        updateStatusTip('🔥 連吃進行中！請點擊帶有劍標記 ⚔️ 的敵方棋子，或點擊上方【完成連吃】結束！');
      }
      return;
    }

    // 情況 B：點擊尚未翻開的暗棋
    if (!cell.revealed) {
      // 只有在非選取移動狀態時才能翻牌
      if (selectedPos) {
        // 如果當前選取的炮能跳吃該暗棋
        const cannonMatch = validTargets.find(t => t.r === r && t.c === c && t.type === 'cannon_unrevealed');
        if (cannonMatch) {
          executeCaptureOrMove(selectedPos.r, selectedPos.c, cannonMatch);
          return;
        }
      }
      // 翻牌！
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

    // 點擊自己的棋子進行選取
    if (cell.piece && cell.piece.color === activeColor) {
      selectedPos = { r, c };
      validTargets = getLegalActionsForPiece(r, c);
      playSynthSfx('move');
      renderBoard();
      updateStatusTip(`已選取【${cell.piece.name}】，請點擊綠點移動或紅框吃子！`);
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

    // 翻牌結束回合 (依規則：翻牌為一手，翻完不可立即連動)
    endTurn();
  }

  function executeCaptureOrMove(fromR, fromC, action) {
    const fromCell = board[fromR][fromC];
    const toCell = board[action.r][action.c];
    const attacker = fromCell.piece;
    const isCapture = (action.type === 'capture' || action.type === 'cannon_unrevealed');

    selectedPos = null;
    validTargets = [];

    if (action.type === 'move') {
      // 純移動
      toCell.piece = attacker;
      toCell.revealed = true;
      fromCell.piece = null;
      playSynthSfx('move');
      renderBoard();
      updateStatusTip(`走子：${attacker.name} 移動至新位置。`);
      endTurn();
      return;
    }

    // 吃子或炮打暗棋
    if (action.type === 'cannon_unrevealed') {
      // 炮跳吃暗棋
      toCell.revealed = true;
      const targetPiece = toCell.piece;

      if (targetPiece.color !== attacker.color) {
        // 敵方暗棋：成功吃掉！
        deadPieces[targetPiece.color].push(targetPiece.name);
        toCell.piece = attacker;
        fromCell.piece = null;
        playSynthSfx('capture');
        updateStatusTip(`💥 炮翻山跳吃！成功擊殺敵方未翻開的【${targetPiece.name}】！`);
        checkComboOrEndTurn(action.r, action.c);
      } else {
        // 己方暗棋：揭曉該己方棋子，炮退回原位（不自殘）
        playSynthSfx('flip');
        updateStatusTip(`🛡️ 炮跳過去發現是自己人的【${targetPiece.name}】！揭曉成功，炮返回原位。`);
        renderBoard();
        renderGraveyards();
        endTurn();
      }
      return;
    }

    if (action.type === 'capture') {
      // 一般吃子或炮吃明棋
      const captured = toCell.piece;
      deadPieces[captured.color].push(captured.name);
      toCell.piece = attacker;
      fromCell.piece = null;
      playSynthSfx('capture');

      // 卒吃帥特殊讚賞
      if (attacker.rank === 1 && captured.rank === 7) {
        updateStatusTip(`🌟 太神啦！【${attacker.name}】成功吃了大將【${captured.name}】！立大功！`);
      } else if (attacker.rank === captured.rank) {
        updateStatusTip(`⚔️ 同階互吃！【${attacker.name}】拼掉了對方的【${captured.name}】！`);
      } else {
        updateStatusTip(`⚔️ 吃子！【${attacker.name}】吃掉了【${captured.name}】！`);
      }

      checkComboOrEndTurn(action.r, action.c);
    }
  }

  // --- 連吃 (Combo) 檢查與處理 ---
  function checkComboOrEndTurn(newR, newC) {
    renderBoard();
    renderGraveyards();

    if (checkGameOverCondition()) return;

    // 檢查該棋子在新位置是否還能「連吃」
    comboActive = true; // 暫時開啟以過濾合法吃子目標
    const nextActions = getLegalActionsForPiece(newR, newC);
    const capturableTargets = nextActions.filter(a => a.type === 'capture' || a.type === 'cannon_unrevealed');

    if (capturableTargets.length > 0) {
      // 可以連吃！
      comboCount++;
      comboPos = { r: newR, c: newC };
      validTargets = capturableTargets;
      selectedPos = { r: newR, c: newC };

      playSynthSfx('combo');
      showComboBanner(true, comboCount);
      renderBoard();

      if (mode === 'single' && currentTurn === 'opponent') {
        // AI 的連吃決策
        setTimeout(() => executeAiComboMove(), 800);
      } else {
        updateStatusTip(`🔥 連吃 COMBO x${comboCount + 1}！可點選劍標記 ⚔️ 繼續吃子，或點上方【完成連吃】結束回合！`);
      }
    } else {
      // 無法連吃，正常結束此回合
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

  // --- 回合切換 ---
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

    // 單人模式若換到電腦回合，觸發 AI
    if (mode === 'single' && currentTurn === 'opponent') {
      updateStatusTip(`🤔 ${OPPONENT_PROFILES[opponentKey].name} 正在思考中...`);
      setTimeout(() => executeAiTurn(), 700);
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

  // --- 電腦 AI 行動邏輯 ---
  function executeAiTurn() {
    if (isGameOver || currentTurn !== 'opponent') return;

    const aiColor = opponentColor;
    const aiLevel = OPPONENT_PROFILES[opponentKey].level; // 1: Eric, 2: Ana, 3: Davis, 4: Michelle

    // 收集所有未翻開暗棋
    const unrevealedCells = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!board[r][c].revealed) {
          unrevealedCells.push({ r, c });
        }
      }
    }

    // 收集所有 AI 明棋的合法動作
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

    // 依據角色設定行動機率
    // Eric (Level 1): 喜歡翻棋、偶爾吃子
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

    // Ana (Level 2), Davis (Level 3), Michelle (Level 4): 優先有價值吃子
    if (captures.length > 0) {
      // 依目標階級評分排序
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

    // 炮打暗棋 (中高難度會善用炮突襲暗棋)
    if (cannonUnrevealed.length > 0 && (aiLevel >= 3 || Math.random() < 0.4)) {
      const pick = cannonUnrevealed[Math.floor(Math.random() * cannonUnrevealed.length)];
      executeCaptureOrMove(pick.fromR, pick.fromC, pick.action);
      return;
    }

    // 若有暗棋且隨機策略需要翻牌
    if (unrevealedCells.length > 0 && (normalMoves.length === 0 || Math.random() < 0.5)) {
      const pick = unrevealedCells[Math.floor(Math.random() * unrevealedCells.length)];
      executeFlip(pick.r, pick.c);
      return;
    }

    // 移動走子
    if (normalMoves.length > 0) {
      const pick = normalMoves[Math.floor(Math.random() * normalMoves.length)];
      executeCaptureOrMove(pick.fromR, pick.fromC, pick.action);
      return;
    }

    // 若還有暗棋，最後翻暗棋
    if (unrevealedCells.length > 0) {
      const pick = unrevealedCells[Math.floor(Math.random() * unrevealedCells.length)];
      executeFlip(pick.r, pick.c);
      return;
    }

    // 若完全無處可走：判定輸局
    triggerGameOver('player', '對手已無棋可走！你獲勝了！');
  }

  // AI 連吃決策
  function executeAiComboMove() {
    if (!comboActive || !comboPos) return;
    const actions = getLegalActionsForPiece(comboPos.r, comboPos.c);
    const capturable = actions.filter(a => a.type === 'capture' || a.type === 'cannon_unrevealed');

    if (capturable.length > 0) {
      // 隨機或優先吃大子
      const pick = capturable[0];
      executeCaptureOrMove(comboPos.r, comboPos.c, pick);
    } else {
      finishCombo();
    }
  }

  // --- 勝負判定 ---
  function checkGameOverCondition() {
    if (playerColor === null) return false;

    // 計算雙方盤面上剩餘棋子 (包含暗棋與明棋)
    let redCount = 0;
    let blackCount = 0;
    let unrevealedCount = 0;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = board[r][c];
        if (!cell.revealed) {
          unrevealedCount++;
          if (cell.piece.color === 'red') redCount++;
          else blackCount++;
        } else if (cell.piece) {
          if (cell.piece.color === 'red') redCount++;
          else blackCount++;
        }
      }
    }

    // 某方被吃光
    if (redCount === 0) {
      const winner = (playerColor === 'black') ? 'player' : 'opponent';
      triggerGameOver(winner, '紅方棋子已被全數吃光！');
      return true;
    }
    if (blackCount === 0) {
      const winner = (playerColor === 'red') ? 'player' : 'opponent';
      triggerGameOver(winner, '黑方棋子已被全數吃光！');
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

    const isPlayerWin = (mode === 'single' && winnerSide === 'player') || (mode === 'dual' && winnerSide === 'p1');

    if (isPlayerWin) {
      playSynthSfx('win');
      if (iconEl) iconEl.textContent = '🎉';
      if (titleEl) titleEl.textContent = '🎉 你贏了！太棒了！ 🎉';
      if (descEl) descEl.textContent = `${reasonDesc} 你的戰術真是太精彩了！`;

      // 語音播報：依派工單要求「先媽媽 Michelle → 後爸爸 Davis，隨機穿插 Eric/Ana」
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

      // 輸局語音：先媽媽 Michelle → 後爸爸 Davis，隨機穿插 Eric/Ana
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

    if (mode === 'single') {
      const opp = OPPONENT_PROFILES[opponentKey];
      if (p1Badge) p1Badge.textContent = '🧑';
      if (p1Name) p1Name.textContent = '玩家 (你)';
      if (p2Badge) p2Badge.textContent = opp.avatar;
      if (p2Name) p2Name.textContent = opp.name;
    } else {
      if (p1Badge) p1Badge.textContent = '🔴';
      if (p1Name) p1Name.textContent = '玩家 1 (先手)';
      if (p2Badge) p2Badge.textContent = '⚫';
      if (p2Name) p2Name.textContent = '玩家 2 (後手)';
    }

    const p1ColorStr = playerColor ? (playerColor === 'red' ? '🔴 紅方' : '⚫ 黑方') : '❓ 待定';
    const p2ColorStr = opponentColor ? (opponentColor === 'red' ? '🔴 紅方' : '⚫ 黑方') : '❓ 待定';

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

  // 頁面初次點擊時解鎖音效（支援 iPadOS Safari AudioContext AutoPlay Policy）
  window.addEventListener('touchstart', initAudioContext, { once: true, passive: true });
  window.addEventListener('click', initAudioContext, { once: true, passive: true });

  // 導出公共 API
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
