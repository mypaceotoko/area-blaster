/**
 * AREA BLASTER - game.js
 * ブラウザで動く2D陣取りアクションゲーム
 */

'use strict';

/* ============================================================
   1. 定数・ステージ設定
   ============================================================ */

/** セルの種類 */
const CELL = Object.freeze({
  EMPTY:  0,  // 未塗り（敵が動ける）
  FILLED: 1,  // 自分の領域（塗りつぶし済み）
  TRAIL:  2,  // 描画中の線
  BORDER: 3,  // 外周（常に安全地帯）
});

/** ゲーム状態 */
const STATE = Object.freeze({
  TITLE:    'title',
  PLAYING:  'playing',
  PAUSED:   'paused',
  MISS:     'miss',
  CLEAR:    'clear',
  GAMEOVER: 'gameover',
});

/**
 * ステージ定義
 */
const STAGES = [
  {
    id:          1,
    label:       'STAGE 1',
    clearRate:   0.75,
    enemyCount:  2,
    enemySpeed:  1.6,
    bgColor:     '#0d1b2a',
    bgAccent:    '#1a3a5c',
    filledColor: 'rgba(0, 120, 200, 0.55)',
    borderColor: 'rgba(0, 229, 255, 0.8)',
    trailColor:  '#ffd740',
    charaImage:  'assets/images/chara_stage1.png',
    clearChara:  'https://mypaceotoko.github.io/area-blaster/clear_chara_1.png',
    clearMsg:    'やるじゃない、見直したわ！',
    charaName:   'アイリス'
  },
  {
    id:          2,
    label:       'STAGE 2',
    clearRate:   0.80,
    enemyCount:  3,
    enemySpeed:  2.0,
    bgColor:     '#1a0d2a',
    bgAccent:    '#3a1a5c',
    filledColor: 'rgba(120, 0, 200, 0.55)',
    borderColor: 'rgba(200, 100, 255, 0.8)',
    trailColor:  '#ff80ab',
    charaImage:  'assets/images/chara_stage2.png',
    clearChara:  'https://mypaceotoko.github.io/area-blaster/clear_chara_2.png',
    clearMsg:    'すごーい！君って天才かも！？',
    charaName:   'モモ'
  },
  {
    id:          3,
    label:       'STAGE 3',
    clearRate:   0.85,
    enemyCount:  4,
    enemySpeed:  2.5,
    bgColor:     '#0d1a0d',
    bgAccent:    '#1a3a1a',
    filledColor: 'rgba(0, 180, 80, 0.55)',
    borderColor: 'rgba(100, 255, 150, 0.8)',
    trailColor:  '#69f0ae',
    charaImage:  'assets/images/chara_stage3.png',
    clearChara:  'https://mypaceotoko.github.io/area-blaster/clear_chara_3.png',
    clearMsg:    'ふーん、少しは骨があるみたいね。',
    charaName:   'シオン'
  },
];

// ... (残りのコードは既存のものを維持しつつ、showClearOverlayを修正)
