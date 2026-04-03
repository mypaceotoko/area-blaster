/**
 * AREA BLASTER - game.js
 * ブラウザで動く2D陣取りアクションゲーム
 *
 * ファイル構成:
 *   1. 定数・ステージ設定
 *   2. ゲーム状態管理
 *   3. グリッド管理
 *   4. プレイヤー管理
 *   5. 敵AI管理
 *   6. 線描画・領域塗りつぶし
 *   7. 接触判定
 *   8. クリア・ゲームオーバー判定
 *   9. 描画（レンダリング）
 *  10. エフェクト・演出
 *  11. HUD更新
 *  12. 入力管理
 *  13. 画面遷移・オーバーレイ
 *  14. メインループ
 *  15. 初期化・起動
 *
 * 拡張ポイント:
 *  - STAGES 配列にエントリを追加するだけでステージ追加可能
 *  - assets/images/ にキャラ画像を配置するだけで差し替え可能
 *  - SE を追加する場合は playSound() 関数を実装して各イベントで呼ぶ
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
 * 拡張する場合はここにオブジェクトを追加するだけ。
 * charaImage に画像パスを指定するとキャラが表示される。
 */
const STAGES = [
  {
    id:          1,
    label:       'STAGE 1',
    clearRate:   0.75,          // クリアに必要な塗りつぶし率
    enemyCount:  2,             // 敵の数
    enemySpeed:  1.6,           // 敵の移動速度（px/frame）
    bgColor:     '#0d1b2a',     // 背景色（ステージごとに変更可能）
    bgAccent:    '#1a3a5c',
    filledColor: 'rgba(0, 120, 200, 0.55)',
    borderColor: 'rgba(0, 229, 255, 0.8)',
    trailColor:  '#ffd740',
    charaImage:  'assets/images/chara_stage1.png',  // 差し替え用
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
  },
];

/**
 * 難易度設定テーブル
 * enemySpeedMult : ステージの enemySpeed に掛ける倍率
 * timeLimitSec   : ステージごとの制限時間（秒）。null = 無制限
 * 新しい難易度を追加する場合はここにエントリを追加するだけ。
 */
const DIFFICULTY_SETTINGS = {
  easy: {
    label:          'EASY',
    enemySpeedMult: 1.0,
    timeLimitSec:   null,
  },
  normal: {
    label:          'NORMAL',
    enemySpeedMult: 1.15,
    timeLimitSec:   60,
  },
  hard: {
    label:          'HARD',
    enemySpeedMult: 1.35,
    timeLimitSec:   45,
  },
  veryHard: {
    label:          'VERY HARD',
    enemySpeedMult: 1.7,
    timeLimitSec:   35,
    giantEnemy:     true,   // 巨大敵を出現させる
    giantCount:     1,      // 巨大敵の数
    giantScale:     4.0,    // 通常敵サイズに対する半径倍率
  },
};

/* VERY HARD 解放管理 */
const VH_UNLOCK_KEY = 'areaBlaster_vhUnlocked';

function isVeryHardUnlocked() {
  try { return localStorage.getItem(VH_UNLOCK_KEY) === '1'; } catch (e) { return false; }
}

function unlockVeryHard() {
  try { localStorage.setItem(VH_UNLOCK_KEY, '1'); } catch (e) {}
  refreshVeryHardUI();
  showUnlockNotice();
}

function refreshVeryHardUI() {
  const btn = document.getElementById('diff-veryhard');
  if (btn && isVeryHardUnlocked()) btn.style.display = '';
}

function showUnlockNotice() {
  const el = document.getElementById('unlock-notice');
  if (!el) return;
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 3500);
}

/* グリッドの論理サイズ */
const GRID_COLS = 40;
const GRID_ROWS = 30;

/* プレイヤー設定 */
const PLAYER_SPEED_CELLS = 9;   // セル/秒
const INITIAL_LIVES      = 3;
const INVINCIBLE_FRAMES  = 150; // ミス後の無敵フレーム数（2.5秒相当）

/* スコア設定 */
const SCORE_PER_CELL   = 10;
const SCORE_BONUS_RATE = 500;

/* ============================================================
   2. ゲーム状態管理
   ============================================================ */

const Game = {
  state:           STATE.TITLE,
  stageIndex:      0,
  score:           0,
  hiScore:         0,
  lives:           INITIAL_LIVES,
  invincible:      0,
  lastTime:        0,
  animId:          null,
  fillFlashTimer:  0,
  fillFlashCells:  null,   // Set<number>
  missLock:        false,  // ミス処理中の二重発火防止
  charaImages:     [],     // ステージ別キャラ画像キャッシュ
  charaAlpha:      0,      // キャラ表示透明度（0〜1）
  charaReveal:     0,      // 塗りつぶし率に応じた表示量（0〜1）
  difficulty:      'easy', // 選択中の難易度キー
  timer:           null,   // 残り時間(ms)。null = 無制限
};

/** ステージキャラ画像を事前ロード */
function preloadCharaImages() {
  STAGES.forEach((stage, i) => {
    const img = new Image();
    img.onload = () => { Game.charaImages[i] = img; };
    img.onerror = () => { Game.charaImages[i] = null; };
    img.src = stage.charaImage;
  });
}

/* ============================================================
   3. グリッド管理
   ============================================================ */

let grid = new Uint8Array(GRID_COLS * GRID_ROWS);

/** グリッドを初期化（外周BORDER、内部EMPTY） */
function initGrid() {
  grid.fill(CELL.EMPTY);
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (r === 0 || r === GRID_ROWS - 1 || c === 0 || c === GRID_COLS - 1) {
        grid[r * GRID_COLS + c] = CELL.BORDER;
      }
    }
  }
}

function getCell(c, r) {
  if (c < 0 || c >= GRID_COLS || r < 0 || r >= GRID_ROWS) return CELL.BORDER;
  return grid[r * GRID_COLS + c];
}

function setCell(c, r, val) {
  if (c < 0 || c >= GRID_COLS || r < 0 || r >= GRID_ROWS) return;
  grid[r * GRID_COLS + c] = val;
}

/** 内部セルのうちFILLEDの数を返す */
function countFilledInner() {
  let n = 0;
  for (let r = 1; r < GRID_ROWS - 1; r++) {
    for (let c = 1; c < GRID_COLS - 1; c++) {
      if (grid[r * GRID_COLS + c] === CELL.FILLED) n++;
    }
  }
  return n;
}

/** 内部セルの総数 */
function totalInnerCells() {
  return (GRID_COLS - 2) * (GRID_ROWS - 2);
}

/** 現在の塗りつぶし率（0〜1） */
function getFillRate() {
  return countFilledInner() / totalInnerCells();
}

/* ============================================================
   4. プレイヤー管理
   ============================================================ */

const Player = {
  col:       0,      // グリッド列
  row:       0,      // グリッド行
  px:        0,      // 描画用ピクセルX
  py:        0,      // 描画用ピクセルY
  dx:        0,      // 現在の移動方向X（-1/0/1）
  dy:        0,      // 現在の移動方向Y（-1/0/1）
  nextDx:    0,      // 次フレームの入力方向X
  nextDy:    0,      // 次フレームの入力方向Y
  isDrawing: false,  // 線を引いている最中か
  trail:     [],     // 軌跡（{c, r}の配列）
  moveAccum: 0,      // 移動蓄積量（サブセル）
};

/** プレイヤーをスタート位置に初期化 */
function initPlayer() {
  Player.col       = Math.floor(GRID_COLS / 2);
  Player.row       = GRID_ROWS - 1;
  Player.dx        = 0;
  Player.dy        = 0;
  Player.nextDx    = 0;
  Player.nextDy    = 0;
  Player.isDrawing = false;
  Player.trail     = [];
  Player.moveAccum = 0;
  syncPlayerPx();
}

/** グリッド座標からピクセル座標を同期 */
function syncPlayerPx() {
  Player.px = (Player.col + 0.5) * cellW();
  Player.py = (Player.row + 0.5) * cellH();
}

/** プレイヤーを1フレーム更新 */
function updatePlayer(dt) {
  if (Game.state !== STATE.PLAYING) return;

  // 入力方向を適用
  const ndx = Player.nextDx;
  const ndy = Player.nextDy;
  if (ndx !== 0 || ndy !== 0) {
    Player.dx = ndx;
    Player.dy = ndy;
  }

  if (Player.dx === 0 && Player.dy === 0) {
    // 停止中はグリッドに吸着
    syncPlayerPx();
    return;
  }

  // セル移動量を蓄積
  Player.moveAccum += PLAYER_SPEED_CELLS * dt;

  let moved = false;
  while (Player.moveAccum >= 1) {
    Player.moveAccum -= 1;
    const ok = stepPlayer();
    if (!ok) {
      Player.moveAccum = 0;
      break;
    }
    moved = true;
  }

  // 描画用ピクセルをグリッド座標に完全同期（スムーズ補間を廃止して接触判定と描画位置のズレをなくす）
  Player.px = (Player.col + 0.5) * cellW();
  Player.py = (Player.row + 0.5) * cellH();
}

/**
 * プレイヤーを1セル進める。
 * 移動できた場合 true、できなかった場合 false を返す。
 */
function stepPlayer() {
  const nc = Player.col + Player.dx;
  const nr = Player.row + Player.dy;

  if (nc < 0 || nc >= GRID_COLS || nr < 0 || nr >= GRID_ROWS) return false;

  const curCell  = getCell(Player.col, Player.row);
  const nextCell = getCell(nc, nr);

  /* --- 安全地帯（BORDER / FILLED）にいる場合 --- */
  if (curCell === CELL.BORDER || curCell === CELL.FILLED) {
    if (nextCell === CELL.EMPTY) {
      // 内部へ侵入 → 線描画開始
      Player.isDrawing = true;
      Player.trail = [{ c: Player.col, r: Player.row }];
      setCell(nc, nr, CELL.TRAIL);
      Player.trail.push({ c: nc, r: nr });
      Player.col = nc;
      Player.row = nr;
      SoundEngine.seTrailStart();
    } else if (nextCell === CELL.BORDER || nextCell === CELL.FILLED) {
      // 安全地帯内を移動
      Player.col = nc;
      Player.row = nr;
    }
    // TRAIL には入れない（安全地帯から直接TRAILへは移動不可）
    return true;
  }

  /* --- 線描画中（TRAIL上）の場合 --- */
  if (curCell === CELL.TRAIL) {
    if (nextCell === CELL.EMPTY) {
      // 線を伸ばす
      setCell(nc, nr, CELL.TRAIL);
      Player.trail.push({ c: nc, r: nr });
      Player.col = nc;
      Player.row = nr;
    } else if (nextCell === CELL.BORDER || nextCell === CELL.FILLED) {
      // 安全地帯に戻った → 領域を閉じる
      Player.col = nc;
      Player.row = nr;
      closeArea();
    } else if (nextCell === CELL.TRAIL) {
      // 自分の線を踏んだ → ミス（2セル以上描いている場合のみ）
      // trail[0]は出発地点なので、それ以外のセルを踏んだ場合に限定
      if (Player.trail.length > 2) {
        triggerMiss();
      }
    }
    return true;
  }

  return false;
}

/* ============================================================
   5. 敵AI管理
   ============================================================ */

let enemies = [];

/** 敵を初期化 */
function initEnemies(stage) {
  enemies = [];
  const diff = DIFFICULTY_SETTINGS[Game.difficulty];
  const spd  = stage.enemySpeed * diff.enemySpeedMult;

  // 通常敵
  for (let i = 0; i < stage.enemyCount; i++) {
    let c, r, tries = 0;
    do {
      c = 3 + Math.floor(Math.random() * (GRID_COLS - 6));
      r = 3 + Math.floor(Math.random() * (GRID_ROWS - 6));
      tries++;
    } while (getCell(c, r) !== CELL.EMPTY && tries < 300);

    const angle = Math.random() * Math.PI * 2;
    enemies.push({
      px: (c + 0.5) * cellW(), py: (r + 0.5) * cellH(),
      vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
      speed: spd,
    });
  }

  // VERY HARD 専用：巨大敵
  if (diff.giantEnemy) {
    const giantCount = diff.giantCount || 1;
    const giantScale = diff.giantScale || 4.0;
    const gSpd       = spd * 0.62; // 巨大なので遅め
    for (let g = 0; g < giantCount; g++) {
      let c, r, tries = 0;
      do {
        c = 6 + Math.floor(Math.random() * (GRID_COLS - 12));
        r = 6 + Math.floor(Math.random() * (GRID_ROWS - 12));
        tries++;
      } while (getCell(c, r) !== CELL.EMPTY && tries < 300);
      const angle = Math.random() * Math.PI * 2;
      enemies.push({
        px: (c + 0.5) * cellW(), py: (r + 0.5) * cellH(),
        vx: Math.cos(angle) * gSpd, vy: Math.sin(angle) * gSpd,
        speed: gSpd,
        isGiant: true,
        scale:   giantScale,
      });
    }
  }
}

/** 敵を1フレーム更新 */
function updateEnemies(dt) {
  if (Game.state !== STATE.PLAYING) return;

  const cw = cellW();
  const ch = cellH();
  // 内部の移動可能範囲（外周ボーダーの内側ピクセル境界）
  const minX = cw + 0.5;
  const minY = ch + 0.5;
  const maxX = (GRID_COLS - 1) * cw - 0.5;
  const maxY = (GRID_ROWS - 1) * ch - 0.5;

  for (const e of enemies) {
    // --- X軸移動 ---
    e.px += e.vx;

    // 外壁X反射
    if (e.px <= minX) { e.px = minX; e.vx =  Math.abs(e.vx); }
    if (e.px >= maxX) { e.px = maxX; e.vx = -Math.abs(e.vx); }

    // FILLEDセルX反射（X方向のみ戻す）
    const ecx = Math.floor(e.px / cw);
    const ery = Math.floor(e.py / ch);
    if (getCell(ecx, ery) === CELL.FILLED || getCell(ecx, ery) === CELL.BORDER) {
      e.vx = -e.vx;
      // セル境界の外まで確実に押し出す
      e.px = (e.vx > 0)
        ? (ecx + 1) * cw + 0.5
        : ecx * cw - 0.5;
    }

    // --- Y軸移動 ---
    e.py += e.vy;

    // 外壁Y反射
    if (e.py <= minY) { e.py = minY; e.vy =  Math.abs(e.vy); }
    if (e.py >= maxY) { e.py = maxY; e.vy = -Math.abs(e.vy); }

    // FILLEDセルY反射（Y方向のみ戻す）
    const ecx2 = Math.floor(e.px / cw);
    const ery2 = Math.floor(e.py / ch);
    if (getCell(ecx2, ery2) === CELL.FILLED || getCell(ecx2, ery2) === CELL.BORDER) {
      e.vy = -e.vy;
      // セル境界の外まで確実に押し出す
      e.py = (e.vy > 0)
        ? (ery2 + 1) * ch + 0.5
        : ery2 * ch - 0.5;
    }

    // --- 速度が0になった場合の保護（止まり防止） ---
    if (Math.abs(e.vx) < 0.1 && Math.abs(e.vy) < 0.1) {
      const angle = Math.random() * Math.PI * 2;
      e.vx = Math.cos(angle) * e.speed;
      e.vy = Math.sin(angle) * e.speed;
    }

    // --- 速度の正規化（スピードを一定に保つ） ---
    const spd = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
    if (spd > 0) {
      e.vx = (e.vx / spd) * e.speed;
      e.vy = (e.vy / spd) * e.speed;
    }
  }
}

/* ============================================================
   6. 線描画・領域塗りつぶし
   ============================================================ */

/**
 * 線が閉じたときに呼ばれる。
 * 敵がいない側の領域をFILLEDに塗りつぶす。
 */
function closeArea() {
  if (Player.trail.length < 2) {
    clearTrail();
    return;
  }

  // TRAILをFILLEDに変換
  for (const pt of Player.trail) {
    if (getCell(pt.c, pt.r) === CELL.TRAIL) {
      setCell(pt.c, pt.r, CELL.FILLED);
    }
  }
  Player.trail     = [];
  Player.isDrawing = false;

  // 敵がいない側をフラッドフィルで塗りつぶす
  const gained = floodFillSafe();

  // スコア加算
  const pts = gained * SCORE_PER_CELL;
  Game.score += pts;
  if (Game.score > Game.hiScore) Game.hiScore = Game.score;

  // 塗りつぶしフラッシュ演出
  triggerFillFlash();

  // スコアポップアップ
  if (pts > 0) {
    spawnScorePopup(Player.px, Player.py, '+' + pts);
  }

  if (gained > 0) SoundEngine.seFill();

  // クリア判定
  checkClear();
  updateHUD();
}

/**
 * フラッドフィルで「敵がいない」EMPTYグループをFILLEDにする。
 * 塗りつぶしたセル数を返す。
 */
function floodFillSafe() {
  const cw = cellW();
  const ch = cellH();

  // 敵のグリッド座標セット
  const enemySet = new Set();
  for (const e of enemies) {
    const ec = Math.floor(e.px / cw);
    const er = Math.floor(e.py / ch);
    enemySet.add(er * GRID_COLS + ec);
  }

  const visited = new Uint8Array(GRID_COLS * GRID_ROWS);
  let totalGained = 0;

  for (let r = 1; r < GRID_ROWS - 1; r++) {
    for (let c = 1; c < GRID_COLS - 1; c++) {
      const idx = r * GRID_COLS + c;
      if (grid[idx] !== CELL.EMPTY || visited[idx]) continue;

      // BFSでグループ収集
      const group    = [];
      let   hasEnemy = false;
      const queue    = [idx];
      visited[idx]   = 1;

      while (queue.length > 0) {
        const cur = queue.shift();
        group.push(cur);
        if (enemySet.has(cur)) hasEnemy = true;

        const cr = Math.floor(cur / GRID_COLS);
        const cc = cur % GRID_COLS;
        const neighbors = [
          (cr - 1) * GRID_COLS + cc,
          (cr + 1) * GRID_COLS + cc,
          cr * GRID_COLS + (cc - 1),
          cr * GRID_COLS + (cc + 1),
        ];
        for (const ni of neighbors) {
          const nr2 = Math.floor(ni / GRID_COLS);
          const nc2 = ni % GRID_COLS;
          if (nc2 <= 0 || nc2 >= GRID_COLS - 1 || nr2 <= 0 || nr2 >= GRID_ROWS - 1) continue;
          if (visited[ni] || grid[ni] !== CELL.EMPTY) continue;
          visited[ni] = 1;
          queue.push(ni);
        }
      }

      // 敵がいないグループをFILLEDに
      if (!hasEnemy) {
        for (const idx2 of group) {
          grid[idx2] = CELL.FILLED;
        }
        totalGained += group.length;
      }
    }
  }
  return totalGained;
}

/** TRAILをEMPTYに戻す */
function clearTrail() {
  for (const pt of Player.trail) {
    if (getCell(pt.c, pt.r) === CELL.TRAIL) {
      setCell(pt.c, pt.r, CELL.EMPTY);
    }
  }
  Player.trail     = [];
  Player.isDrawing = false;
}

/* ============================================================
   7. 接触判定
   ============================================================ */

function checkCollisions() {
  if (Game.state !== STATE.PLAYING) return;
  if (Game.invincible > 0) {
    Game.invincible--;
    return;
  }

  const cw    = cellW();
  const ch    = cellH();
  const baseR = Math.min(cw, ch) * 0.38; // 通常敵ヒット半径

  const playerOnSafe = (() => {
    const pc = getCell(Player.col, Player.row);
    return pc === CELL.BORDER || pc === CELL.FILLED;
  })();

  for (const e of enemies) {
    // 巨大敵は実際のサイズに合わせた当たり判定（少し寛大に0.8倍）
    const eR = e.isGiant ? Math.max(10, baseR * (e.scale || 4.0)) * 0.8 : baseR;

    // --- プレイヤー本体との距離判定 ---
    if (!playerOnSafe) {
      const dx = e.px - Player.px;
      const dy = e.py - Player.py;
      if (dx * dx + dy * dy < eR * eR) {
        triggerMiss();
        return;
      }
    }

    // --- 線描画中のTRAIL接触判定 ---
    if (Player.isDrawing) {
      if (e.isGiant) {
        // 巨大敵：半径内のセルをすべてチェック
        const cellRadius = Math.ceil(eR / Math.min(cw, ch));
        const gc = Math.floor(e.px / cw);
        const gr = Math.floor(e.py / ch);
        for (let dr = -cellRadius; dr <= cellRadius; dr++) {
          for (let dc = -cellRadius; dc <= cellRadius; dc++) {
            const cc = gc + dc; const cr = gr + dr;
            if (cc < 0 || cr < 0 || cc >= GRID_COLS || cr >= GRID_ROWS) continue;
            if (getCell(cc, cr) === CELL.TRAIL) {
              triggerMiss(); return;
            }
          }
        }
      } else {
        // 通常敵：中心セルのみチェック
        const ec = Math.floor(e.px / cw);
        const er = Math.floor(e.py / ch);
        if (getCell(ec, er) === CELL.TRAIL) {
          const tx  = (ec + 0.5) * cw;
          const ty  = (er + 0.5) * ch;
          const ddx = e.px - tx;
          const ddy = e.py - ty;
          const trailHitR = Math.min(cw, ch) * 0.5;
          if (ddx * ddx + ddy * ddy < trailHitR * trailHitR) {
            triggerMiss(); return;
          }
        }
      }
    }
  }
}

/* ============================================================
   8. クリア・ゲームオーバー判定
   ============================================================ */

/** クリア判定 */
/**
 * ステージクリア時の美少女フルスクリーン演出を表示
 */
function showClearPerformance(rate, bonus) {
  const stage = STAGES[Game.stageIndex];
  const overlay = document.getElementById('clear-overlay');
  const charaImg = document.getElementById('clear-chara-img');
  const charaName = document.getElementById('clear-chara-name');
  const speech = document.getElementById('clear-chara-speech');
  const nextBtn = document.getElementById('btn-clear-next');

  // キャラクター設定（ステージごとに変更）
  const charaData = [
    { name: 'アイリス', img: 'clear_chara_1.png', speeches: ['クリア、おめでとう！', 'やるじゃない、見直したわ！'] },
    { name: 'サクラ', img: 'clear_chara_2.png', speeches: ['ここまで来るなんて、やるじゃない！', 'えへへ、君ならできると思ってたよ！'] },
    { name: 'ルナ', img: 'clear_chara_3.png', speeches: ['次のステージも、私と一緒に勝とうね。', 'まだまだ先は長いよ、油断しないでね。'] }
  ];
  
  const currentChara = charaData[Game.stageIndex % charaData.length];
  const randomSpeech = currentChara.speeches[Math.floor(Math.random() * currentChara.speeches.length)];

  // データのセット
  charaImg.src = currentChara.img;
  charaName.textContent = currentChara.name;
  speech.textContent = ''; // 一旦空にする（タイピング演出用）
  
  document.getElementById('clear-stat-area').textContent = `${Math.floor(rate * 100)}%`;
  document.getElementById('clear-stat-bonus').textContent = `+${bonus.toLocaleString()}`;
  document.getElementById('clear-stat-score').textContent = Game.score.toLocaleString();

  const hasNext = Game.stageIndex + 1 < STAGES.length;
  nextBtn.textContent = hasNext ? 'NEXT STAGE ▶' : 'BACK TO TITLE';
  
  // ボタンクリックイベントの再設定
  const nextAction = () => {
    overlay.classList.remove('active');
    setTimeout(() => {
      overlay.classList.add('hidden');
      if (hasNext) {
        nextStage();
      } else {
        goTitle();
      }
    }, 500);
  };
  
  nextBtn.onclick = nextAction;

  // 演出開始
  overlay.classList.remove('hidden');
  // リフロー強制
  overlay.offsetWidth;
  overlay.classList.add('active');

  // セリフのタイピング演出
  let i = 0;
  const typeWriter = () => {
    if (i < randomSpeech.length) {
      speech.textContent += randomSpeech.charAt(i);
      i++;
      setTimeout(typeWriter, 50);
    }
  };
  setTimeout(typeWriter, 1000); // キャラ登場後に開始
}

function checkClear() {
  const stage = STAGES[Game.stageIndex];
  const rate  = getFillRate();
  if (rate < stage.clearRate) return;

  const bonus = Math.floor(rate * 100) * SCORE_BONUS_RATE;
  Game.score += bonus;
  if (Game.score > Game.hiScore) Game.hiScore = Game.score;
  updateHUD();

  // HARD で最終ステージをクリアしたら VERY HARD を解放
  const isLastStage = Game.stageIndex >= STAGES.length - 1;
  if (isLastStage && Game.difficulty === 'hard' && !isVeryHardUnlocked()) {
    setTimeout(unlockVeryHard, 1500);
  }

  Game.state = STATE.CLEAR;
  SoundEngine.stopBGM();
  SoundEngine.seClear();

  // 標準のオーバーレイの代わりにリッチな演出を表示
  showClearPerformance(rate, bonus);
}

/** ミス処理 */
function triggerMiss() {
  if (Game.state !== STATE.PLAYING || Game.missLock) return;
  Game.missLock = true;
  Game.state    = STATE.MISS;

  clearTrail();
  Game.lives--;
  updateHUD();
  flashCanvas();
  SoundEngine.stopBGM();
  SoundEngine.seMiss();

  const delay = 900;
  if (Game.lives <= 0) {
    setTimeout(() => {
      Game.state    = STATE.GAMEOVER;
      Game.missLock = false;
      SoundEngine.seGameOver();
      showOverlay('GAME OVER', `SCORE: ${Game.score.toLocaleString()}`, [
        { label: 'もう一度',   action: restartGame },
        { label: 'タイトルへ', action: goTitle     },
      ]);
    }, delay);
  } else {
    setTimeout(() => {
      initPlayer();
      Game.state      = STATE.PLAYING;
      Game.invincible = INVINCIBLE_FRAMES;
      Game.missLock   = false;
      // 難易度に時間制限がある場合、残機消費後にタイマーをリセット
      const diff = DIFFICULTY_SETTINGS[Game.difficulty];
      if (diff.timeLimitSec !== null) {
        Game.timer = diff.timeLimitSec * 1000;
      }
      SoundEngine.startBGM();
    }, delay);
  }
}

/** 次のステージへ */
function nextStage() {
  hideOverlay();
  Game.stageIndex++;
  if (Game.stageIndex >= STAGES.length) {
    Game.stageIndex = STAGES.length - 1;
    showOverlay('ALL CLEAR!', `全ステージクリア！\nFINAL SCORE: ${Game.score.toLocaleString()}`, [
      { label: 'もう一度',   action: restartGame },
      { label: 'タイトルへ', action: goTitle     },
    ]);
    return;
  }
  startStage(Game.stageIndex);
}

/** ゲームリスタート */
function restartGame() {
  hideOverlay();
  Game.score      = 0;
  Game.lives      = INITIAL_LIVES;
  Game.stageIndex = 0;
  Game.missLock   = false;
  startStage(0);
}

/** タイトルへ */
function goTitle() {
  hideOverlay();
  SoundEngine.stopBGM();
  cancelAnimationFrame(Game.animId);
  Game.animId = null;
  Game.state  = STATE.TITLE;
  showScreen('screen-title');
}

/* ============================================================
   9. オーディオエンジン（Web Audio API チップチューン）
   ============================================================ */

const SoundEngine = (() => {
  let _ctx = null;
  let _master = null;
  let _muted = false;
  let _bgmTimer = null;
  let _bgmStep = 0;

  function _getCtx() {
    if (!_ctx) {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
      _master = _ctx.createGain();
      _master.gain.value = 0.38;
      _master.connect(_ctx.destination);
    }
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  }

  function _note(freq, dur, type = 'square', vol = 0.28, t0 = 0) {
    if (_muted || !freq) return;
    const ac = _getCtx();
    const play = () => {
      if (_muted) return;
      const osc = ac.createOscillator();
      const g   = ac.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const st = ac.currentTime + t0;
      g.gain.setValueAtTime(vol, st);
      g.gain.exponentialRampToValueAtTime(0.001, st + dur);
      osc.connect(g); g.connect(_master);
      osc.start(st); osc.stop(st + dur + 0.05);
    };
    ac.state === 'suspended' ? ac.resume().then(play) : play();
  }

  function _sweep(f1, f2, dur, type = 'sawtooth', vol = 0.28, t0 = 0) {
    if (_muted) return;
    const ac = _getCtx();
    const osc = ac.createOscillator();
    const g   = ac.createGain();
    osc.type = type;
    const st = ac.currentTime + t0;
    osc.frequency.setValueAtTime(f1, st);
    osc.frequency.exponentialRampToValueAtTime(f2, st + dur);
    g.gain.setValueAtTime(vol, st);
    g.gain.exponentialRampToValueAtTime(0.001, st + dur);
    osc.connect(g); g.connect(_master);
    osc.start(st); osc.stop(st + dur + 0.05);
  }

  function _noise(dur, vol = 0.15, t0 = 0) {
    if (_muted) return;
    const ac  = _getCtx();
    const len = Math.ceil(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const g = ac.createGain();
    const st = ac.currentTime + t0;
    g.gain.setValueAtTime(vol, st);
    g.gain.exponentialRampToValueAtTime(0.001, st + dur);
    src.connect(g); g.connect(_master);
    src.start(st); src.stop(st + dur + 0.05);
  }

  /* ---- SE ---- */

  function seTrailStart() {
    _note(880,  0.055, 'square', 0.18);
    _note(1320, 0.055, 'square', 0.13, 0.055);
  }

  function seFill() {
    [523, 659, 784, 1047].forEach((f, i) => _note(f, 0.12, 'square', 0.24, i * 0.065));
    _noise(0.04, 0.1, 0.27);
  }

  function seMiss() {
    _sweep(440, 60, 0.42, 'sawtooth', 0.28);
    _noise(0.28, 0.2);
  }

  function seClear() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => _note(f, 0.14, 'square', 0.28, i * 0.09));
    _note(1319, 0.38, 'square', 0.3, 5 * 0.09);
    [262, 330, 392, 523].forEach((f, i) => _note(f, 0.12, 'triangle', 0.18, i * 0.18));
  }

  function seGameOver() {
    [392, 330, 294, 262, 196].forEach((f, i) => _note(f, 0.22, 'square', 0.28, i * 0.2));
  }

  /* ---- BGM ---- */
  // BPM 138、16分音符単位のシーケンサ
  const _BPM  = 138;
  const _STEP = 60 / _BPM / 4;   // 16th note sec

  // メロディ（E minor風、32ステップループ）
  const _MEL = [
    659, 784, 880, 784,   659, 587, 523, null,
    587, 659, 784, 659,   587, 523, 494, null,
    523, 659, 784, 880,   988, 880, 784, 659,
    784, 880, 988, 1047,  880, 784, 659, null,
  ];

  // ベース（16ステップ、2ステップごと）
  const _BASS = [
    164, null, 196, null,   220, null, 196, null,
    174, null, 196, null,   220, null, 247, null,
  ];

  function _bgmTick() {
    const i = _bgmStep % _MEL.length;
    const b = Math.floor(_bgmStep / 2) % _BASS.length;

    if (_MEL[i])  _note(_MEL[i],  _STEP * 0.82, 'square',   0.16);
    if (_BASS[b] && _bgmStep % 2 === 0)
                  _note(_BASS[b], _STEP * 1.9,  'triangle', 0.11);

    // パーカッション
    if (i % 8 === 0) _noise(0.05, 0.14);        // キック
    if (i % 8 === 4) _noise(0.03, 0.09);        // スネア
    if (i % 2 === 1) _noise(0.012, 0.04);       // ハイハット

    _bgmStep++;
    _bgmTimer = setTimeout(_bgmTick, _STEP * 1000);
  }

  function startBGM() {
    stopBGM();
    if (_muted) return;
    _bgmStep = 0;
    _getCtx().resume().then(() => { if (!_muted && !_bgmTimer) _bgmTick(); });
  }

  function stopBGM() {
    if (_bgmTimer) { clearTimeout(_bgmTimer); _bgmTimer = null; }
  }

  function pauseBGM()  { stopBGM(); }
  function resumeBGM() {
    if (_muted) return;
    _getCtx().resume().then(() => { if (!_muted && !_bgmTimer) _bgmTick(); });
  }

  function toggleMute() {
    _muted = !_muted;
    if (_muted) stopBGM();
    else if (typeof Game !== 'undefined' && Game.state === STATE.PLAYING) resumeBGM();
    return _muted;
  }

  return { seTrailStart, seFill, seMiss, seClear, seGameOver,
           startBGM, stopBGM, pauseBGM, resumeBGM, toggleMute,
           get muted() { return _muted; } };
})();

/* ============================================================
   10. 描画（レンダリング）
   ============================================================ */

const canvas = document.getElementById('game-canvas');
const ctx    = canvas.getContext('2d');

function cellW() { return canvas.width  / GRID_COLS; }
function cellH() { return canvas.height / GRID_ROWS; }

/** キャンバスをウィンドウサイズに合わせてリサイズ */
function resizeCanvas() {
  const wrap     = document.getElementById('canvas-wrap');
  const hudEl    = document.getElementById('hud');
  const touchEl  = document.getElementById('touch-controls');
  const hudH     = hudEl   ? hudEl.offsetHeight   : 52;
  const touchH   = (isTouchDevice() && touchEl) ? touchEl.offsetHeight : 0;
  const availH   = window.innerHeight - hudH - touchH;
  const availW = wrap.clientWidth || window.innerWidth;

  const aspect = GRID_COLS / GRID_ROWS;
  let w = availW;
  let h = w / aspect;
  if (h > availH) { h = availH; w = h * aspect; }

  canvas.width  = Math.floor(w);
  canvas.height = Math.floor(h);
}

/** メイン描画 */
function render() {
  const stage = STAGES[Game.stageIndex];
  const cw    = cellW();
  const ch    = cellH();

  // 背景クリア
  ctx.fillStyle = stage.bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // キャラ画像を塗りつぶし率に応じて背景に描画（徐々に見えてくる演出）
  renderCharaBackground(stage);

  // グリッド描画
  renderGrid(cw, ch, stage);

  // 敵描画
  renderEnemies(cw, ch);

  // プレイヤー描画
  renderPlayer(cw, ch);
}

/**
 * キャラ画像をキャンバス背景に描画する。
 * 塗りつぶし率（getFillRate）が上がるにつれて徐々に透明度が増し、
 * クリア直前には鮮明に見えるようになる演出。
 */
function renderCharaBackground(stage) {
  const img = Game.charaImages[Game.stageIndex];
  if (!img) return;

  // 塗りつぶし率に応じて透明度を計算（0% → 0.05, 50% → 0.35, 100% → 0.75）
  const fillRate = getFillRate();
  const targetAlpha = 0.05 + fillRate * 0.70;

  // スムーズに変化させる（イージング）
  Game.charaAlpha += (targetAlpha - Game.charaAlpha) * 0.03;

  if (Game.charaAlpha < 0.02) return;

  ctx.save();
  ctx.globalAlpha = Game.charaAlpha;

  // キャンバス右側にキャラを配置（ゲームの邪魔にならない位置）
  const cw = canvas.width;
  const ch = canvas.height;
  const imgAspect = img.naturalWidth / img.naturalHeight;
  const drawH = ch * 0.85;
  const drawW = drawH * imgAspect;
  const drawX = cw - drawW * 0.85;  // 右端に少しはみ出す形で配置
  const drawY = (ch - drawH) / 2;

  ctx.drawImage(img, drawX, drawY, drawW, drawH);
  ctx.restore();
}

/** グリッドを描画 */
function renderGrid(cw, ch, stage) {
  const flashSet = Game.fillFlashCells;
  const flashOn  = Game.fillFlashTimer > 0;

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const idx  = r * GRID_COLS + c;
      const cell = grid[idx];
      const x    = c * cw;
      const y    = r * ch;

      switch (cell) {
        case CELL.EMPTY:
          // 背景（グリッド線を薄く）
          if (cw > 6) {
            ctx.strokeStyle = 'rgba(255,255,255,0.04)';
            ctx.lineWidth   = 0.5;
            ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
          }
          break;

        case CELL.FILLED: {
          // フラッシュ演出
          if (flashOn && flashSet && flashSet.has(idx)) {
            const a = Game.fillFlashTimer / 14;
            ctx.fillStyle = `rgba(105, 240, 174, ${0.25 + a * 0.55})`;
          } else {
            ctx.fillStyle = stage.filledColor;
          }
          ctx.fillRect(x, y, cw, ch);
          // 境界線
          ctx.strokeStyle = 'rgba(255,255,255,0.1)';
          ctx.lineWidth   = 0.5;
          ctx.strokeRect(x, y, cw, ch);
          break;
        }

        case CELL.BORDER:
          ctx.fillStyle = stage.borderColor;
          ctx.fillRect(x, y, cw, ch);
          break;

        case CELL.TRAIL:
          // 線（グロー付き）
          ctx.shadowColor = stage.trailColor;
          ctx.shadowBlur  = 8;
          ctx.fillStyle   = stage.trailColor;
          ctx.fillRect(x, y, cw, ch);
          ctx.shadowBlur  = 0;
          // 中心ドット
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillRect(x + cw * 0.25, y + ch * 0.25, cw * 0.5, ch * 0.5);
          break;
      }
    }
  }

  // フラッシュタイマー更新
  if (Game.fillFlashTimer > 0) Game.fillFlashTimer--;
}

/** 敵を描画 */
function renderEnemies(cw, ch) {
  const baseR = Math.max(5, Math.min(cw, ch) * 0.38);

  for (const e of enemies) {
    const r = e.isGiant ? Math.max(10, baseR * (e.scale || 4.0)) : baseR;

    if (e.isGiant) {
      // ---- 巨大敵（VERY HARD専用） ----
      ctx.shadowColor = '#cc00ff';
      ctx.shadowBlur  = r * 0.6;

      const grad = ctx.createRadialGradient(
        e.px - r * 0.3, e.py - r * 0.3, r * 0.05,
        e.px, e.py, r
      );
      grad.addColorStop(0, '#ea80ff');
      grad.addColorStop(0.5, '#7b00b0');
      grad.addColorStop(1, '#2a0040');
      ctx.beginPath();
      ctx.arc(e.px, e.py, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.shadowBlur = 0;

      // 金色の目（凶悪な表情）
      ctx.fillStyle = '#ffdd00';
      ctx.beginPath();
      ctx.arc(e.px - r * 0.28, e.py - r * 0.12, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(e.px + r * 0.28, e.py - r * 0.12, r * 0.2, 0, Math.PI * 2);
      ctx.fill();

      // 縦型の瞳（不気味さを強調）
      ctx.fillStyle = '#0d0020';
      ctx.beginPath();
      ctx.ellipse(e.px - r * 0.26, e.py - r * 0.08, r * 0.07, r * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(e.px + r * 0.26, e.py - r * 0.08, r * 0.07, r * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();

      // 怒り口（下向き弧）
      ctx.strokeStyle = '#ffdd00';
      ctx.lineWidth   = r * 0.055;
      ctx.beginPath();
      ctx.arc(e.px, e.py + r * 0.22, r * 0.28, Math.PI, Math.PI * 2);
      ctx.stroke();

      // ハイライト
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(e.px - r * 0.3, e.py - r * 0.32, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // ---- 通常敵 ----
      ctx.shadowColor = '#ff5252';
      ctx.shadowBlur  = 12;

      const grad = ctx.createRadialGradient(
        e.px - r * 0.3, e.py - r * 0.3, r * 0.05,
        e.px, e.py, r
      );
      grad.addColorStop(0, '#ff8a80');
      grad.addColorStop(1, '#b71c1c');
      ctx.beginPath();
      ctx.arc(e.px, e.py, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(e.px - r * 0.28, e.py - r * 0.18, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(e.px + r * 0.28, e.py - r * 0.18, r * 0.22, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath();
      ctx.arc(e.px - r * 0.26, e.py - r * 0.12, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(e.px + r * 0.26, e.py - r * 0.12, r * 0.12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.arc(e.px - r * 0.3, e.py - r * 0.3, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** プレイヤーを描画 */
function renderPlayer(cw, ch) {
  // 無敵中は点滅
  if (Game.invincible > 0 && Math.floor(Game.invincible / 5) % 2 === 0) return;

  const r = Math.max(5, Math.min(cw, ch) * 0.42);

  ctx.save();
  ctx.translate(Player.px, Player.py);

  // グロー
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur  = 16;

  // 本体
  const grad = ctx.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.05, 0, 0, r);
  grad.addColorStop(0, '#80d8ff');
  grad.addColorStop(0.6, '#0288d1');
  grad.addColorStop(1, '#01579b');
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.shadowBlur = 0;

  // ハイライト
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.arc(-r * 0.28, -r * 0.28, r * 0.28, 0, Math.PI * 2);
  ctx.fill();

  // 方向インジケーター（移動中のみ）
  if (Player.dx !== 0 || Player.dy !== 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(Player.dx * r * 0.45, Player.dy * r * 0.45, r * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/* ============================================================
   10. エフェクト・演出
   ============================================================ */

/** 塗りつぶしフラッシュ演出をセット */
function triggerFillFlash() {
  const cells = new Set();
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === CELL.FILLED) cells.add(i);
  }
  Game.fillFlashCells = cells;
  Game.fillFlashTimer = 14;
}

/** 時間切れ処理（ミス扱い） */
function triggerTimeUp() {
  if (Game.state !== STATE.PLAYING || Game.missLock) return;
  // TIME UP ラベルを短時間表示
  const el = document.getElementById('timeup-label');
  if (el) {
    el.classList.add('visible');
    setTimeout(() => el.classList.remove('visible'), 900);
  }
  triggerMiss();
}

/** キャンバスラッパーを赤くフラッシュ */
function flashCanvas() {
  const wrap = document.getElementById('canvas-wrap');
  wrap.classList.add('miss-flash');
  setTimeout(() => wrap.classList.remove('miss-flash'), 500);
}

/** スコアポップアップ（DOM要素） */
function spawnScorePopup(px, py, text) {
  const wrap  = document.getElementById('canvas-wrap');
  const el    = document.createElement('div');
  el.className   = 'score-popup';
  el.textContent = text;

  const rect  = canvas.getBoundingClientRect();
  const wRect = wrap.getBoundingClientRect();
  el.style.left = (rect.left - wRect.left + px) + 'px';
  el.style.top  = (rect.top  - wRect.top  + py) + 'px';
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

/* ============================================================
   11. HUD更新
   ============================================================ */

function updateHUD() {
  const stage   = STAGES[Game.stageIndex];
  const rate    = getFillRate();
  const pct     = Math.floor(rate * 100);
  const target  = Math.floor(stage.clearRate * 100);

  document.getElementById('hud-score').textContent   = Game.score.toLocaleString();
  document.getElementById('hud-hiscore').textContent = Game.hiScore.toLocaleString();
  document.getElementById('hud-stage').textContent   = stage.id;
  document.getElementById('hud-area').textContent    = `${pct}% / ${target}%`;

  const bar = document.getElementById('area-bar');
  bar.style.width = Math.min(pct, 100) + '%';
  // クリア間近で色を変える
  bar.style.background = pct >= target
    ? 'linear-gradient(90deg, #ffd740, #ff6d00)'
    : 'linear-gradient(90deg, #69f0ae, #00e5ff)';

  // 残機をハートで表示
  const hearts = '❤️'.repeat(Math.max(0, Game.lives))
               + '🖤'.repeat(Math.max(0, INITIAL_LIVES - Game.lives));
  document.getElementById('hud-lives').textContent = hearts;

  // タイマー表示（NORMAL / HARD のみ）
  const timerWrap = document.getElementById('hud-timer-wrap');
  const timerEl   = document.getElementById('hud-timer');
  if (Game.timer !== null && timerWrap && timerEl) {
    timerWrap.style.display = '';
    const secs = Math.max(0, Math.ceil(Game.timer / 1000));
    timerEl.textContent = secs;
    timerEl.style.color = secs <= 10 ? 'var(--color-danger)' : 'var(--color-primary)';
  } else if (timerWrap) {
    timerWrap.style.display = 'none';
  }
}

/* ============================================================
   12. 入力管理
   ============================================================ */

const Keys = { up: false, down: false, left: false, right: false };

window.addEventListener('keydown', (e) => {
  let changed = false;
  switch (e.code) {
    case 'ArrowUp':    case 'KeyW': Keys.up    = true;  changed = true; e.preventDefault(); break;
    case 'ArrowDown':  case 'KeyS': Keys.down  = true;  changed = true; e.preventDefault(); break;
    case 'ArrowLeft':  case 'KeyA': Keys.left  = true;  changed = true; e.preventDefault(); break;
    case 'ArrowRight': case 'KeyD': Keys.right = true;  changed = true; e.preventDefault(); break;
    case 'Space':
      e.preventDefault();
      if (Game.state === STATE.PLAYING || Game.state === STATE.PAUSED) togglePause();
      break;
    case 'KeyR':
      if ([STATE.PLAYING, STATE.PAUSED, STATE.MISS, STATE.GAMEOVER].includes(Game.state)) {
        restartGame();
      }
      break;
  }
  if (changed) applyInput();
});

window.addEventListener('keyup', (e) => {
  let changed = false;
  switch (e.code) {
    case 'ArrowUp':    case 'KeyW': Keys.up    = false; changed = true; break;
    case 'ArrowDown':  case 'KeyS': Keys.down  = false; changed = true; break;
    case 'ArrowLeft':  case 'KeyA': Keys.left  = false; changed = true; break;
    case 'ArrowRight': case 'KeyD': Keys.right = false; changed = true; break;
  }
  if (changed) applyInput();
});

/** 押下中のキーから移動方向を決定（縦優先） */
function applyInput() {
  let dx = 0, dy = 0;
  if (Keys.up)    dy = -1;
  if (Keys.down)  dy =  1;
  if (Keys.left)  dx = -1;
  if (Keys.right) dx =  1;
  if (dy !== 0)   dx =  0; // 縦優先
  Player.nextDx = dx;
  Player.nextDy = dy;
}

/** ポーズ切り替え */
function togglePause() {
  if (Game.state === STATE.PLAYING) {
    Game.state = STATE.PAUSED;
    SoundEngine.pauseBGM();
    showOverlay('PAUSE', 'SPACE キーで再開 / R でリスタート', [
      { label: '▶ 再開',         action: resumeGame  },
      { label: '↺ リスタート',   action: restartGame },
      { label: '⌂ タイトルへ',   action: goTitle     },
    ]);
  } else if (Game.state === STATE.PAUSED) {
    resumeGame();
  }
}

function resumeGame() {
  hideOverlay();
  Game.state = STATE.PLAYING;
  SoundEngine.resumeBGM();
}

/* ---- タッチコントロール ---- */
function setupTouchControls() {
  document.querySelectorAll('.dpad-btn[data-dir]').forEach(btn => {
    const dir = btn.dataset.dir;

    const onStart = (e) => {
      e.preventDefault();
      btn.classList.add('pressed');
      Keys.up    = dir === 'up';
      Keys.down  = dir === 'down';
      Keys.left  = dir === 'left';
      Keys.right = dir === 'right';
      applyInput();
    };
    const onEnd = (e) => {
      e.preventDefault();
      btn.classList.remove('pressed');
      Keys.up = Keys.down = Keys.left = Keys.right = false;
      applyInput();
    };

    btn.addEventListener('touchstart',  onStart, { passive: false });
    btn.addEventListener('touchend',    onEnd,   { passive: false });
    btn.addEventListener('touchcancel', onEnd,   { passive: false });
  });

  const pauseBtn = document.getElementById('dpad-pause');
  if (pauseBtn) {
    pauseBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (Game.state === STATE.PLAYING || Game.state === STATE.PAUSED) togglePause();
    }, { passive: false });
  }
}

/** タッチデバイス判定 */
function isTouchDevice() {
  return window.matchMedia('(pointer: coarse)').matches;
}

/* ============================================================
   13. 画面遷移・オーバーレイ
   ============================================================ */

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function showOverlay(title, msg, buttons) {
  document.getElementById('overlay-title').textContent = title;
  document.getElementById('overlay-msg').textContent   = msg;

  const btnsEl = document.getElementById('overlay-btns');
  btnsEl.innerHTML = '';
  buttons.forEach(b => {
    const btn = document.createElement('button');
    btn.className   = 'menu-btn';
    btn.textContent = b.label;
    btn.addEventListener('click', b.action);
    btnsEl.appendChild(btn);
  });

  document.getElementById('overlay').classList.remove('hidden');
}

function hideOverlay() {
  document.getElementById('overlay').classList.add('hidden');
}

/* ============================================================
   14. メインループ
   ============================================================ */

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - Game.lastTime) / 1000, 0.05);
  Game.lastTime = timestamp;

  if (Game.state === STATE.PLAYING) {
    updatePlayer(dt);
    updateEnemies(dt);
    checkCollisions();
    // タイマーカウントダウン（NORMAL / HARD）
    if (Game.timer !== null) {
      Game.timer -= dt * 1000;
      if (Game.timer <= 0) {
        Game.timer = 0;
        triggerTimeUp();
      }
    }
    updateHUD();
  }

  render();

  Game.animId = requestAnimationFrame(gameLoop);
}

/* ============================================================
   15. 初期化・起動
   ============================================================ */

/** ステージを開始 */
function startStage(index) {
  Game.stageIndex     = index;
  Game.state          = STATE.PLAYING;
  Game.invincible     = INVINCIBLE_FRAMES; // ステージ開始時に無敵付与（開幕即死防止）
  Game.missLock       = false;
  Game.fillFlashTimer = 0;
  Game.fillFlashCells = null;
  Game.charaAlpha     = 0;   // キャラ透明度をリセット（新ステージ開始時）

  // 難易度に応じてタイマーをリセット
  const diff = DIFFICULTY_SETTINGS[Game.difficulty];
  Game.timer = diff.timeLimitSec !== null ? diff.timeLimitSec * 1000 : null;

  initGrid();
  initPlayer();
  initEnemies(STAGES[index]);
  updateHUD();
  hideOverlay();
  SoundEngine.startBGM();
}

/**
 * タイトルキャラ画像の読み込み試行。
 * assets/images/chara_title.png が存在すれば表示、なければプレースホルダーのまま。
 */
function tryLoadTitleChara() {
  const el  = document.getElementById('title-chara');
  const img = new Image();
  img.onload = () => {
    el.innerHTML = '';
    el.appendChild(img);
    el.classList.add('has-image');
  };
  img.onerror = () => { /* プレースホルダーのまま表示 */ };
  img.src = 'assets/images/chara_title.png';
}

/** ゲーム全体の初期化 */
function init() {
  resizeCanvas();

  window.addEventListener('resize', () => {
    resizeCanvas();
    if (Game.state === STATE.PLAYING || Game.state === STATE.PAUSED) {
      syncPlayerPx();
      // 敵のピクセル座標もグリッドに合わせて再スケール（簡易版）
      const cw = cellW();
      const ch = cellH();
      for (const e of enemies) {
        const ec = Math.floor(e.px / cw);
        const er = Math.floor(e.py / ch);
        e.px = (ec + 0.5) * cw;
        e.py = (er + 0.5) * ch;
      }
    }
  });

  setupTouchControls();
  tryLoadTitleChara();
  preloadCharaImages();  // ステージ別キャラ画像を事前ロード

  // VERY HARD 解放チェック（ページ読み込み時）
  refreshVeryHardUI();

  // 難易度選択ボタン
  const DIFF_DESC = {
    easy:     '時間制限なし・通常スピード',
    normal:   '時間制限60秒・スピード+15%',
    hard:     '時間制限45秒・スピード+35%',
    veryHard: '時間制限35秒・スピード+70%・巨大敵出現',
  };
  const diffDescEl = document.getElementById('diff-desc');
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      Game.difficulty = btn.dataset.diff;
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      if (diffDescEl) diffDescEl.textContent = DIFF_DESC[btn.dataset.diff] || '';
    });
  });

  // 裏コマンド：タイトルの秘密タップゾーンを5回で VERY HARD 解放
  let secretTapCount = 0;
  let secretTapTimer = null;
  const secretZone = document.getElementById('secret-tap-zone');
  if (secretZone) {
    secretZone.addEventListener('click', () => {
      if (isVeryHardUnlocked()) return;
      secretTapCount++;
      clearTimeout(secretTapTimer);
      secretTapTimer = setTimeout(() => { secretTapCount = 0; }, 6000);
      if (secretTapCount >= 5) {
        secretTapCount = 0;
        unlockVeryHard();
      }
    });
  }

  // タイトルボタン
  document.getElementById('btn-start').addEventListener('click', () => {
    showScreen('screen-game');
    Game.score      = 0;
    Game.lives      = INITIAL_LIVES;
    Game.stageIndex = 0;
    startStage(0);
    Game.lastTime = performance.now();
    if (Game.animId) cancelAnimationFrame(Game.animId);
    Game.animId = requestAnimationFrame(gameLoop);
    // キャンバスにフォーカスを当ててキーボード入力を確実に受け取る
    setTimeout(() => canvas.focus(), 100);
  });

  // ミュートボタン
  const muteBtn = document.getElementById('btn-mute');
  muteBtn.addEventListener('click', () => {
    const muted = SoundEngine.toggleMute();
    muteBtn.textContent = muted ? '🔇' : '🔊';
    muteBtn.classList.toggle('muted', muted);
  });

  document.getElementById('btn-howto').addEventListener('click', () => {
    showScreen('screen-howto');
  });

  document.getElementById('btn-back-title').addEventListener('click', () => {
    showScreen('screen-title');
  });

  showScreen('screen-title');
}

document.addEventListener('DOMContentLoaded', init);
