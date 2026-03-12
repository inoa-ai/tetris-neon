// ============================================
// テトリス — ネオンエディション ゲームロジック
// ============================================

(() => {
    'use strict';

    // --- 定数 ---
    const COLS = 10;
    const ROWS = 20;
    const HIDDEN_ROWS = 2; // 上部の非表示行
    const TOTAL_ROWS = ROWS + HIDDEN_ROWS;

    // テトリミノ定義 (色, 形状)
    const PIECES = {
        I: { color: '#00f0f0', glow: 'rgba(0,240,240,0.5)',  shapes: [
            [[0,0],[1,0],[2,0],[3,0]], [[0,0],[0,1],[0,2],[0,3]],
            [[0,0],[1,0],[2,0],[3,0]], [[0,0],[0,1],[0,2],[0,3]]
        ]},
        O: { color: '#f0f000', glow: 'rgba(240,240,0,0.5)', shapes: [
            [[0,0],[1,0],[0,1],[1,1]], [[0,0],[1,0],[0,1],[1,1]],
            [[0,0],[1,0],[0,1],[1,1]], [[0,0],[1,0],[0,1],[1,1]]
        ]},
        T: { color: '#a000f0', glow: 'rgba(160,0,240,0.5)', shapes: [
            [[0,0],[1,0],[2,0],[1,1]], [[0,0],[0,1],[0,2],[1,1]],
            [[1,0],[0,1],[1,1],[2,1]], [[1,0],[1,1],[1,2],[0,1]]
        ]},
        S: { color: '#00f000', glow: 'rgba(0,240,0,0.5)', shapes: [
            [[1,0],[2,0],[0,1],[1,1]], [[0,0],[0,1],[1,1],[1,2]],
            [[1,0],[2,0],[0,1],[1,1]], [[0,0],[0,1],[1,1],[1,2]]
        ]},
        Z: { color: '#f00000', glow: 'rgba(240,0,0,0.5)', shapes: [
            [[0,0],[1,0],[1,1],[2,1]], [[1,0],[0,1],[1,1],[0,2]],
            [[0,0],[1,0],[1,1],[2,1]], [[1,0],[0,1],[1,1],[0,2]]
        ]},
        J: { color: '#0000f0', glow: 'rgba(0,0,240,0.5)', shapes: [
            [[0,0],[0,1],[1,1],[2,1]], [[0,0],[1,0],[0,1],[0,2]],
            [[0,0],[1,0],[2,0],[2,1]], [[1,0],[1,1],[0,2],[1,2]]
        ]},
        L: { color: '#f0a000', glow: 'rgba(240,160,0,0.5)', shapes: [
            [[2,0],[0,1],[1,1],[2,1]], [[0,0],[0,1],[0,2],[1,2]],
            [[0,0],[1,0],[2,0],[0,1]], [[0,0],[1,0],[1,1],[1,2]]
        ]}
    };

    const PIECE_NAMES = Object.keys(PIECES);

    // スコア定義
    const LINE_SCORES = [0, 100, 300, 500, 800];
    const SOFT_DROP_SCORE = 1;
    const HARD_DROP_SCORE = 2;

    // 速度 (ms) レベルごとの落下間隔
    function getDropInterval(level) {
        // レベル1 = 1000ms, レベル毎に70ms短縮、最低80ms
        return Math.max(80, 1000 - (level - 1) * 70);
    }

    // --- DOM要素 ---
    const startScreen     = document.getElementById('start-screen');
    const gameScreen      = document.getElementById('game-screen');
    const gameCanvas      = document.getElementById('game-canvas');
    const ctx             = gameCanvas.getContext('2d');
    const nextCanvas      = document.getElementById('next-canvas');
    const nextCtx         = nextCanvas.getContext('2d');
    const holdCanvas      = document.getElementById('hold-canvas');
    const holdCtx         = holdCanvas.getContext('2d');
    const mobileNextCanvas = document.getElementById('mobile-next-canvas');
    const mobileNextCtx    = mobileNextCanvas.getContext('2d');
    const mobileHoldCanvas = document.getElementById('mobile-hold-canvas');
    const mobileHoldCtx    = mobileHoldCanvas.getContext('2d');

    const scoreEl    = document.getElementById('score');
    const levelEl    = document.getElementById('level');
    const linesEl    = document.getElementById('lines');
    const finalScoreEl = document.getElementById('final-score');
    const finalHighScoreEl = document.getElementById('final-high-score');
    const newRecordEl = document.getElementById('new-record');
    const highScoreEl = document.getElementById('high-score');
    const titleHighScoreEl = document.getElementById('title-high-score');

    const gameOverOverlay = document.getElementById('game-over-overlay');
    const pauseOverlay    = document.getElementById('pause-overlay');

    // ボタン
    const btnStart       = document.getElementById('btn-start');
    const btnRestart     = document.getElementById('btn-restart');
    const btnResume      = document.getElementById('btn-resume');
    const btnLeft        = document.getElementById('btn-left');
    const btnRight       = document.getElementById('btn-right');
    const btnDown        = document.getElementById('btn-down');
    const btnRotateLeft  = document.getElementById('btn-rotate-left');
    const btnRotateRight = document.getElementById('btn-rotate-right');
    const btnHardDrop    = document.getElementById('btn-hard-drop');
    const btnHold        = document.getElementById('btn-hold');
    const btnPause       = document.getElementById('btn-pause');
    const btnTitleGameover = document.getElementById('btn-title-gameover');
    const btnTitlePause    = document.getElementById('btn-title-pause');

    // --- ゲーム状態 ---
    let board = [];
    let currentPiece = null;
    let currentType = '';
    let currentRotation = 0;
    let currentX = 0;
    let currentY = 0;
    let nextQueue = [];
    let holdType = null;
    let canHold = true;
    let score = 0;
    let level = 1;
    let totalLines = 0;
    let gameOver = false;
    let paused = false;
    let lastDrop = 0;
    let animationId = null;
    let cellSize = 30;
    let lineClearAnimating = false;
    let clearingRows = [];
    let clearAnimStart = 0;
    const CLEAR_ANIM_DURATION = 300;

    // ハイスコア
    let highScore = 0;
    const HIGH_SCORE_KEY = 'tetris_neon_high_score';

    // 繰り返し入力用
    let repeatTimers = {};

    // --- 7-bag ランダマイザ ---
    let bag = [];
    function refillBag() {
        bag = [...PIECE_NAMES];
        // Fisher-Yates シャッフル
        for (let i = bag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [bag[i], bag[j]] = [bag[j], bag[i]];
        }
    }
    function nextPieceType() {
        if (bag.length === 0) refillBag();
        return bag.pop();
    }

    // --- ボード管理 ---
    function createBoard() {
        board = [];
        for (let r = 0; r < TOTAL_ROWS; r++) {
            board.push(new Array(COLS).fill(null));
        }
    }

    // --- キャンバスサイズ調整 ---
    function resizeCanvas() {
        const isMobile = window.innerWidth <= 768;
        const maxH = isMobile
            ? window.innerHeight * 0.48
            : window.innerHeight - 80;
        const maxW = isMobile
            ? window.innerWidth - 20
            : 300;

        cellSize = Math.floor(Math.min(maxW / COLS, maxH / ROWS));
        cellSize = Math.max(cellSize, 14); // 最小セルサイズ

        gameCanvas.width  = cellSize * COLS;
        gameCanvas.height = cellSize * ROWS;
    }

    // --- 描画 ---
    function drawBlock(context, x, y, size, color, glow) {
        // メインブロック
        context.fillStyle = color;
        context.fillRect(x + 1, y + 1, size - 2, size - 2);

        // グローエフェクト
        context.shadowColor = glow || color;
        context.shadowBlur = 6;
        context.fillStyle = color;
        context.fillRect(x + 1, y + 1, size - 2, size - 2);
        context.shadowBlur = 0;

        // ハイライト (上・左)
        context.fillStyle = 'rgba(255,255,255,0.18)';
        context.fillRect(x + 1, y + 1, size - 2, 3);
        context.fillRect(x + 1, y + 1, 3, size - 2);

        // シャドウ (下・右)
        context.fillStyle = 'rgba(0,0,0,0.25)';
        context.fillRect(x + 1, y + size - 4, size - 2, 3);
        context.fillRect(x + size - 4, y + 1, 3, size - 2);
    }

    function drawBoard() {
        ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

        // グリッド線
        ctx.strokeStyle = 'rgba(50, 50, 100, 0.3)';
        ctx.lineWidth = 0.5;
        for (let r = 0; r <= ROWS; r++) {
            ctx.beginPath();
            ctx.moveTo(0, r * cellSize);
            ctx.lineTo(COLS * cellSize, r * cellSize);
            ctx.stroke();
        }
        for (let c = 0; c <= COLS; c++) {
            ctx.beginPath();
            ctx.moveTo(c * cellSize, 0);
            ctx.lineTo(c * cellSize, ROWS * cellSize);
            ctx.stroke();
        }

        // 固定ブロック描画
        for (let r = HIDDEN_ROWS; r < TOTAL_ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (board[r][c]) {
                    const piece = PIECES[board[r][c]];
                    const drawY = (r - HIDDEN_ROWS) * cellSize;
                    // ライン消去アニメーション中のフラッシュ
                    if (lineClearAnimating && clearingRows.includes(r)) {
                        const elapsed = performance.now() - clearAnimStart;
                        const progress = Math.min(elapsed / CLEAR_ANIM_DURATION, 1);
                        ctx.globalAlpha = 1 - progress;
                        drawBlock(ctx, c * cellSize, drawY, cellSize, '#ffffff', 'rgba(255,255,255,0.8)');
                        ctx.globalAlpha = 1;
                    } else {
                        drawBlock(ctx, c * cellSize, drawY, cellSize, piece.color, piece.glow);
                    }
                }
            }
        }

        // ゴーストピース描画を削除（ユーザー要望）

        // 現在のピース描画
        if (currentPiece && !gameOver && !lineClearAnimating) {
            const piece = PIECES[currentType];
            const shape = piece.shapes[currentRotation];
            shape.forEach(([bx, by]) => {
                const drawRow = currentY + by;
                if (drawRow >= HIDDEN_ROWS) {
                    drawBlock(ctx,
                        (currentX + bx) * cellSize,
                        (drawRow - HIDDEN_ROWS) * cellSize,
                        cellSize,
                        piece.color,
                        piece.glow
                    );
                }
            });
        }
    }

    function drawPreview(context, canvas, type) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        if (!type) return;

        const piece = PIECES[type];
        const shape = piece.shapes[0];
        const previewSize = Math.min(canvas.width, canvas.height) / 5;

        // ピースの範囲を計算してセンタリング
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        shape.forEach(([bx, by]) => {
            minX = Math.min(minX, bx);
            maxX = Math.max(maxX, bx);
            minY = Math.min(minY, by);
            maxY = Math.max(maxY, by);
        });
        const pw = (maxX - minX + 1) * previewSize;
        const ph = (maxY - minY + 1) * previewSize;
        const offsetX = (canvas.width - pw) / 2 - minX * previewSize;
        const offsetY = (canvas.height - ph) / 2 - minY * previewSize;

        shape.forEach(([bx, by]) => {
            drawBlock(context,
                offsetX + bx * previewSize,
                offsetY + by * previewSize,
                previewSize,
                piece.color,
                piece.glow
            );
        });
    }

    function updatePreviews() {
        // ネクスト
        drawPreview(nextCtx, nextCanvas, nextQueue[0]);
        drawPreview(mobileNextCtx, mobileNextCanvas, nextQueue[0]);
        // ホールド
        drawPreview(holdCtx, holdCanvas, holdType);
        drawPreview(mobileHoldCtx, mobileHoldCanvas, holdType);
    }

    function updateUI() {
        scoreEl.textContent = score.toLocaleString();
        levelEl.textContent = level;
        linesEl.textContent = totalLines;
    }

    // --- ピース操作 ---
    function getShape(type, rotation) {
        return PIECES[type].shapes[rotation];
    }

    function collides(type, rotation, x, y) {
        const shape = getShape(type, rotation, x, y);
        return shape.some(([bx, by]) => {
            const nx = x + bx;
            const ny = y + by;
            return nx < 0 || nx >= COLS || ny >= TOTAL_ROWS || (ny >= 0 && board[ny][nx]);
        });
    }

    function spawnPiece() {
        if (nextQueue.length < 4) {
            while (nextQueue.length < 7) nextQueue.push(nextPieceType());
        }

        currentType = nextQueue.shift();
        nextQueue.push(nextPieceType());
        currentRotation = 0;
        currentPiece = PIECES[currentType];

        // スポーン位置
        const shape = getShape(currentType, 0);
        let minX = Infinity, maxX = -Infinity;
        shape.forEach(([bx]) => { minX = Math.min(minX, bx); maxX = Math.max(maxX, bx); });
        currentX = Math.floor((COLS - (maxX - minX + 1)) / 2) - minX;
        currentY = 0;

        canHold = true;

        if (collides(currentType, currentRotation, currentX, currentY)) {
            gameOver = true;
            // ハイスコア判定
            const isNewRecord = score > highScore;
            if (isNewRecord) {
                highScore = score;
                saveHighScore();
            }
            finalScoreEl.textContent = score.toLocaleString();
            finalHighScoreEl.textContent = highScore.toLocaleString();
            newRecordEl.classList.toggle('hidden', !isNewRecord);
            gameOverOverlay.classList.remove('hidden');
            SoundEngine.stopBGM();
            SoundEngine.playGameOver();
            updateHighScoreDisplay();
        }

        updatePreviews();
    }

    function lockPiece() {
        const shape = getShape(currentType, currentRotation);
        shape.forEach(([bx, by]) => {
            const nx = currentX + bx;
            const ny = currentY + by;
            if (ny >= 0 && ny < TOTAL_ROWS) {
                board[ny][nx] = currentType;
            }
        });

        // ライン消去チェック
        checkLines();
    }

    function checkLines() {
        clearingRows = [];
        for (let r = TOTAL_ROWS - 1; r >= 0; r--) {
            if (board[r].every(cell => cell !== null)) {
                clearingRows.push(r);
            }
        }

        if (clearingRows.length > 0) {
            // アニメーション開始
            lineClearAnimating = true;
            clearAnimStart = performance.now();
            SoundEngine.playLineClear(clearingRows.length);

            setTimeout(() => {
                // 行を削除して新行を追加
                clearingRows.sort((a, b) => b - a).forEach(r => {
                    board.splice(r, 1);
                    board.unshift(new Array(COLS).fill(null));
                });

                // スコア加算
                const linesCleared = clearingRows.length;
                totalLines += linesCleared;
                score += LINE_SCORES[linesCleared] * level;
                const oldLevel = level;
                level = Math.floor(totalLines / 10) + 1;

                // レベルアップ判定
                if (level > oldLevel) {
                    SoundEngine.playLevelUp();
                    SoundEngine.setBGMSpeed(level);
                }

                lineClearAnimating = false;
                clearingRows = [];
                updateUI();
                spawnPiece();
            }, CLEAR_ANIM_DURATION);
        } else {
            SoundEngine.playLock();
            spawnPiece();
        }
    }

    function getGhostY() {
        let ghostY = currentY;
        while (!collides(currentType, currentRotation, currentX, ghostY + 1)) {
            ghostY++;
        }
        return ghostY;
    }

    // --- 入力アクション ---
    function moveLeft() {
        if (gameOver || paused || lineClearAnimating) return;
        if (!collides(currentType, currentRotation, currentX - 1, currentY)) {
            currentX--;
            SoundEngine.playMove();
        }
    }

    function moveRight() {
        if (gameOver || paused || lineClearAnimating) return;
        if (!collides(currentType, currentRotation, currentX + 1, currentY)) {
            currentX++;
            SoundEngine.playMove();
        }
    }

    function moveDown() {
        if (gameOver || paused || lineClearAnimating) return;
        if (!collides(currentType, currentRotation, currentX, currentY + 1)) {
            currentY++;
            score += SOFT_DROP_SCORE;
            updateUI();
            return true;
        }
        return false;
    }

    function hardDrop() {
        if (gameOver || paused || lineClearAnimating) return;
        let dropped = 0;
        while (!collides(currentType, currentRotation, currentX, currentY + 1)) {
            currentY++;
            dropped++;
        }
        score += dropped * HARD_DROP_SCORE;
        updateUI();
        SoundEngine.playHardDrop();
        lockPiece();
        lastDrop = performance.now();
    }

    function rotate(dir) {
        if (gameOver || paused || lineClearAnimating) return;
        const newRot = (currentRotation + dir + 4) % 4;
        // 基本回転
        if (!collides(currentType, newRot, currentX, currentY)) {
            currentRotation = newRot;
            SoundEngine.playRotate();
            return;
        }
        // 壁蹴り (簡易SRS)
        const kicks = [[-1,0],[1,0],[0,-1],[-1,-1],[1,-1],[0,-2],[-2,0],[2,0]];
        for (const [kx, ky] of kicks) {
            if (!collides(currentType, newRot, currentX + kx, currentY + ky)) {
                currentX += kx;
                currentY += ky;
                currentRotation = newRot;
                SoundEngine.playRotate();
                return;
            }
        }
    }

    function holdPiece() {
        if (gameOver || paused || !canHold || lineClearAnimating) return;
        canHold = false;
        SoundEngine.playHold();
        if (holdType === null) {
            holdType = currentType;
            spawnPiece();
        } else {
            const tmp = holdType;
            holdType = currentType;
            currentType = tmp;
            currentRotation = 0;
            currentPiece = PIECES[currentType];
            const shape = getShape(currentType, 0);
            let minX = Infinity, maxX = -Infinity;
            shape.forEach(([bx]) => { minX = Math.min(minX, bx); maxX = Math.max(maxX, bx); });
            currentX = Math.floor((COLS - (maxX - minX + 1)) / 2) - minX;
            currentY = 0;
        }
        updatePreviews();
    }

    function togglePause() {
        if (gameOver) return;
        paused = !paused;
        if (paused) {
            pauseOverlay.classList.remove('hidden');
            SoundEngine.playPause();
            SoundEngine.pauseBGM();
        } else {
            pauseOverlay.classList.add('hidden');
            lastDrop = performance.now();
            SoundEngine.playResume();
            SoundEngine.resumeBGM();
        }
    }

    // --- キーボード入力 ---
    const keyActions = {
        ArrowLeft:  () => moveLeft(),
        ArrowRight: () => moveRight(),
        ArrowDown:  () => moveDown(),
        ArrowUp:    () => rotate(1),
        z:          () => rotate(-1),
        Z:          () => rotate(-1),
        x:          () => rotate(1),
        X:          () => rotate(1),
        ' ':        () => hardDrop(),
        c:          () => holdPiece(),
        C:          () => holdPiece(),
        Shift:      () => holdPiece(),
        p:          () => togglePause(),
        P:          () => togglePause(),
        Escape:     () => togglePause(),
    };

    // 繰り返し可能なキー
    const repeatableKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowDown']);
    const REPEAT_DELAY = 170;
    const REPEAT_INTERVAL = 50;

    document.addEventListener('keydown', (e) => {
        const action = keyActions[e.key];
        if (!action) return;
        e.preventDefault();

        if (repeatableKeys.has(e.key)) {
            if (!repeatTimers[e.key]) {
                action();
                repeatTimers[e.key] = {
                    timeout: setTimeout(() => {
                        repeatTimers[e.key].interval = setInterval(action, REPEAT_INTERVAL);
                    }, REPEAT_DELAY)
                };
            }
        } else {
            action();
        }
    });

    document.addEventListener('keyup', (e) => {
        if (repeatTimers[e.key]) {
            clearTimeout(repeatTimers[e.key].timeout);
            clearInterval(repeatTimers[e.key].interval);
            delete repeatTimers[e.key];
        }
    });

    // --- タッチ入力 (スワイプ) ---
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let touchMoved = false;
    let swipeHandled = false;

    const SWIPE_THRESHOLD = 30;

    gameCanvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const t = e.touches[0];
        touchStartX = t.clientX;
        touchStartY = t.clientY;
        touchStartTime = Date.now();
        touchMoved = false;
        swipeHandled = false;
    }, { passive: false });

    gameCanvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (swipeHandled) return;

        const t = e.touches[0];
        const dx = t.clientX - touchStartX;
        const dy = t.clientY - touchStartY;

        if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) moveRight(); else moveLeft();
            touchStartX = t.clientX;
            touchMoved = true;
        } else if (dy > SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
            moveDown();
            touchStartY = t.clientY;
            touchMoved = true;
        } else if (dy < -SWIPE_THRESHOLD * 2 && Math.abs(dy) > Math.abs(dx)) {
            hardDrop();
            swipeHandled = true;
            touchMoved = true;
        }
    }, { passive: false });

    gameCanvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (!touchMoved && Date.now() - touchStartTime < 300) {
            // タップ＝回転
            rotate(1);
        }
    }, { passive: false });

    // --- ボタン入力 ---
    function addBtnListener(btn, action) {
        let timer = null;
        let interval = null;

        const start = (e) => {
            e.preventDefault();
            action();
            timer = setTimeout(() => {
                interval = setInterval(action, REPEAT_INTERVAL);
            }, REPEAT_DELAY);
        };
        const stop = (e) => {
            e.preventDefault();
            clearTimeout(timer);
            clearInterval(interval);
        };

        btn.addEventListener('touchstart', start, { passive: false });
        btn.addEventListener('touchend', stop, { passive: false });
        btn.addEventListener('touchcancel', stop, { passive: false });
        btn.addEventListener('mousedown', start);
        btn.addEventListener('mouseup', stop);
        btn.addEventListener('mouseleave', stop);
    }

    addBtnListener(btnLeft, moveLeft);
    addBtnListener(btnRight, moveRight);
    addBtnListener(btnDown, moveDown);

    // 繰り返し不要なボタン
    function addSingleBtnListener(btn, action) {
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); action(); }, { passive: false });
        btn.addEventListener('mousedown', (e) => { e.preventDefault(); action(); });
    }

    addSingleBtnListener(btnRotateLeft, () => rotate(-1));
    addSingleBtnListener(btnRotateRight, () => rotate(1));
    addSingleBtnListener(btnHardDrop, hardDrop);
    addSingleBtnListener(btnHold, holdPiece);
    addSingleBtnListener(btnPause, togglePause);

    // --- ゲームループ ---
    function gameLoop(now) {
        animationId = requestAnimationFrame(gameLoop);

        if (gameOver || paused || lineClearAnimating) {
            drawBoard();
            return;
        }

        const interval = getDropInterval(level);
        if (now - lastDrop >= interval) {
            if (!moveDown()) {
                // 着地
                lockPiece();
            }
            lastDrop = now;
        }

        drawBoard();
    }

    // --- ゲーム開始・リスタート ---
    function startGame() {
        SoundEngine.init();
        startScreen.classList.remove('active');
        gameScreen.classList.add('active');
        initGame();
    }

    function initGame() {
        createBoard();
        bag = [];
        nextQueue = [];
        holdType = null;
        canHold = true;
        score = 0;
        level = 1;
        totalLines = 0;
        gameOver = false;
        paused = false;
        lineClearAnimating = false;
        clearingRows = [];

        gameOverOverlay.classList.add('hidden');
        pauseOverlay.classList.add('hidden');

        resizeCanvas();
        updateUI();
        spawnPiece();

        lastDrop = performance.now();
        if (animationId) cancelAnimationFrame(animationId);
        animationId = requestAnimationFrame(gameLoop);

        // BGM開始
        SoundEngine.stopBGM();
        SoundEngine.setBGMSpeed(1);
        SoundEngine.startBGM();
    }

    // --- ハイスコア管理 ---
    function loadHighScore() {
        try {
            const saved = localStorage.getItem(HIGH_SCORE_KEY);
            highScore = saved ? parseInt(saved, 10) : 0;
        } catch (e) {
            highScore = 0;
        }
        updateHighScoreDisplay();
    }

    function saveHighScore() {
        try {
            localStorage.setItem(HIGH_SCORE_KEY, highScore.toString());
        } catch (e) {
            // localStorage使用不可時は無視
        }
    }

    function updateHighScoreDisplay() {
        const formatted = highScore.toLocaleString();
        highScoreEl.textContent = formatted;
        titleHighScoreEl.textContent = formatted;
    }

    // --- タイトルに戻る ---
    function backToTitle() {
        // ゲーム停止
        if (animationId) cancelAnimationFrame(animationId);
        animationId = null;
        SoundEngine.stopBGM();
        gameOver = false;
        paused = false;

        // オーバーレイ非表示
        gameOverOverlay.classList.add('hidden');
        pauseOverlay.classList.add('hidden');

        // 画面切替
        gameScreen.classList.remove('active');
        startScreen.classList.add('active');

        // タイトル画面のハイスコア更新
        updateHighScoreDisplay();
    }

    // --- イベントリスナー ---
    btnStart.addEventListener('click', startGame);
    btnRestart.addEventListener('click', initGame);
    btnResume.addEventListener('click', togglePause);
    btnTitleGameover.addEventListener('click', backToTitle);
    btnTitlePause.addEventListener('click', backToTitle);

    // 初期ハイスコア読み込み
    loadHighScore();

    window.addEventListener('resize', () => {
        resizeCanvas();
        drawBoard();
    });

    // ページ非表示時に一時停止
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && !gameOver && !paused) {
            togglePause();
        }
    });

})();
