// ============================================
// テトリス — サウンドエンジン (Web Audio API)
// ============================================

const SoundEngine = (() => {
    'use strict';

    let audioCtx = null;
    let masterGain = null;
    let bgmGain = null;
    let sfxGain = null;
    let bgmPlaying = false;
    let bgmTimeouts = [];
    let bgmLoop = true;

    // AudioContext を初期化（ユーザー操作後に呼ぶ必要あり）
    function init() {
        if (audioCtx) return;
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.6;
        masterGain.connect(audioCtx.destination);

        bgmGain = audioCtx.createGain();
        bgmGain.gain.value = 0.25;
        bgmGain.connect(masterGain);

        sfxGain = audioCtx.createGain();
        sfxGain.gain.value = 0.5;
        sfxGain.connect(masterGain);
    }

    // 安全にノートを再生するヘルパー
    function playTone(freq, duration, type, gainNode, startTime, volume = 1) {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const env = audioCtx.createGain();
        osc.type = type || 'square';
        osc.frequency.value = freq;

        env.gain.setValueAtTime(volume, startTime);
        env.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(env);
        env.connect(gainNode || sfxGain);
        osc.start(startTime);
        osc.stop(startTime + duration + 0.05);
    }

    // --- 効果音 ---

    // 移動音 (軽いクリック)
    function playMove() {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        playTone(300, 0.05, 'square', sfxGain, now, 0.3);
    }

    // 回転音 (シュイン)
    function playRotate() {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const env = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);
        env.gain.setValueAtTime(0.3, now);
        env.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(env);
        env.connect(sfxGain);
        osc.start(now);
        osc.stop(now + 0.12);
    }

    // 着地音 (ドスッ)
    function playLock() {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        playTone(120, 0.12, 'triangle', sfxGain, now, 0.5);
        playTone(80, 0.15, 'sine', sfxGain, now + 0.02, 0.4);
    }

    // ハードドロップ音 (ガシャン)
    function playHardDrop() {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        // ノイズ風 + 重低音
        playTone(60, 0.18, 'sawtooth', sfxGain, now, 0.5);
        playTone(150, 0.08, 'square', sfxGain, now, 0.4);
        playTone(90, 0.15, 'triangle', sfxGain, now + 0.03, 0.3);
    }

    // ライン消去音 (キラキラ上昇音)
    function playLineClear(lineCount) {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const baseFreqs = [523, 659, 784, 1047]; // C5, E5, G5, C6
        const count = Math.min(lineCount, 4);
        for (let i = 0; i < count; i++) {
            playTone(baseFreqs[i], 0.2, 'sine', sfxGain, now + i * 0.06, 0.4);
            playTone(baseFreqs[i] * 1.5, 0.15, 'triangle', sfxGain, now + i * 0.06 + 0.02, 0.2);
        }
        // 4ライン(テトリス)の場合は追加のファンファーレ
        if (lineCount >= 4) {
            playTone(1319, 0.3, 'sine', sfxGain, now + 0.3, 0.35);
            playTone(1568, 0.4, 'sine', sfxGain, now + 0.45, 0.3);
        }
    }

    // ホールド音
    function playHold() {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        playTone(440, 0.06, 'sine', sfxGain, now, 0.25);
        playTone(554, 0.06, 'sine', sfxGain, now + 0.06, 0.25);
    }

    // レベルアップ音 (ファンファーレ)
    function playLevelUp() {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
            playTone(freq, 0.15, 'square', sfxGain, now + i * 0.1, 0.3);
            playTone(freq * 2, 0.12, 'sine', sfxGain, now + i * 0.1, 0.15);
        });
    }

    // ゲームオーバー音 (下降音)
    function playGameOver() {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const notes = [523, 494, 440, 392, 349, 330, 262, 196];
        notes.forEach((freq, i) => {
            playTone(freq, 0.25, 'square', sfxGain, now + i * 0.18, 0.3);
            playTone(freq * 0.5, 0.3, 'triangle', sfxGain, now + i * 0.18, 0.2);
        });
    }

    // 一時停止音
    function playPause() {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        playTone(330, 0.1, 'square', sfxGain, now, 0.2);
        playTone(262, 0.15, 'square', sfxGain, now + 0.1, 0.2);
    }

    // 再開音
    function playResume() {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        playTone(262, 0.1, 'square', sfxGain, now, 0.2);
        playTone(330, 0.15, 'square', sfxGain, now + 0.1, 0.2);
    }

    // --- BGM (チップチューン風テトリス風メロディ) ---

    // テトリス風メロディ（コロブチカ風）
    const BGM_MELODY = [
        // メロディ: [音階(Hz), 拍の長さ(倍率)]
        // パートA
        [659, 1], [494, 0.5], [523, 0.5], [587, 1], [523, 0.5], [494, 0.5],
        [440, 1], [440, 0.5], [523, 0.5], [659, 1], [587, 0.5], [523, 0.5],
        [494, 1.5], [523, 0.5], [587, 1], [659, 1],
        [523, 1], [440, 1], [440, 1], [0, 0.5],
        // パートA2
        [0, 0.5], [587, 1], [698, 0.5], [880, 1], [784, 0.5], [698, 0.5],
        [659, 1.5], [523, 0.5], [659, 1], [587, 0.5], [523, 0.5],
        [494, 1], [494, 0.5], [523, 0.5], [587, 1], [659, 1],
        [523, 1], [440, 1], [440, 1], [0, 1],
    ];

    // ベースライン
    const BGM_BASS = [
        // パートA
        [165, 2], [147, 2],
        [131, 2], [131, 1], [165, 1],
        [147, 2], [165, 1], [175, 1],
        [131, 2], [110, 2],
        // パートA2
        [147, 2], [131, 2],
        [165, 2], [147, 2],
        [147, 2], [165, 1], [175, 1],
        [131, 2], [110, 2],
    ];

    let bgmBPM = 140;
    const beatDuration = () => 60 / bgmBPM;

    function scheduleBGM() {
        if (!audioCtx || !bgmLoop) return;

        const startTime = audioCtx.currentTime + 0.1;
        const beat = beatDuration();
        let melodyTime = startTime;
        let bassTime = startTime;
        let totalDuration = 0;

        // メロディ
        BGM_MELODY.forEach(([freq, dur]) => {
            const noteDur = beat * dur;
            if (freq > 0) {
                playTone(freq, noteDur * 0.85, 'square', bgmGain, melodyTime, 0.5);
            }
            melodyTime += noteDur;
        });

        // ベースライン
        BGM_BASS.forEach(([freq, dur]) => {
            const noteDur = beat * dur;
            if (freq > 0) {
                playTone(freq, noteDur * 0.7, 'triangle', bgmGain, bassTime, 0.6);
            }
            bassTime += noteDur;
        });

        // 合計長を計算
        totalDuration = BGM_MELODY.reduce((sum, [, dur]) => sum + beat * dur, 0);

        // ループ
        const loopTimeout = setTimeout(() => {
            if (bgmLoop) scheduleBGM();
        }, totalDuration * 1000);
        bgmTimeouts.push(loopTimeout);
    }

    function startBGM() {
        if (bgmPlaying) return;
        init();
        bgmLoop = true;
        bgmPlaying = true;
        scheduleBGM();
    }

    function stopBGM() {
        bgmLoop = false;
        bgmPlaying = false;
        bgmTimeouts.forEach(t => clearTimeout(t));
        bgmTimeouts = [];
    }

    function pauseBGM() {
        if (!audioCtx) return;
        bgmLoop = false;
        bgmTimeouts.forEach(t => clearTimeout(t));
        bgmTimeouts = [];
        // フェードアウト
        bgmGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
        bgmPlaying = false;
    }

    function resumeBGM() {
        if (!audioCtx) return;
        bgmGain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        bgmLoop = true;
        bgmPlaying = true;
        scheduleBGM();
    }

    function setBGMSpeed(level) {
        // レベルに応じてBGMテンポを上げる
        bgmBPM = Math.min(200, 140 + (level - 1) * 5);
    }

    return {
        init,
        playMove,
        playRotate,
        playLock,
        playHardDrop,
        playLineClear,
        playHold,
        playLevelUp,
        playGameOver,
        playPause,
        playResume,
        startBGM,
        stopBGM,
        pauseBGM,
        resumeBGM,
        setBGMSpeed
    };
})();
