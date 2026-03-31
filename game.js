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
 * 拡張ポイント
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
          clearChara:  'clear_chara_1.png',
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
          clearChara:  'clear_chara_2.png',
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
          clearChara:  'clear_chara_3.png',
          clearMsg:    'ふーん、少しは骨があるみたいね。',
          charaName:   'シオン'
   },
   ];

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
     for (let i = 0; i < stage.enemyCount; i++) {
            let c, r, tries = 0;
            do {
                     c = 3 + Math.floor(Math.random() * (GRID_COLS - 6));
                     r = 3 + Math.floor(Math.random() * (GRID_ROWS - 6));
                     tries++;
            } while (getCell(c, r) !== CELL.EMPTY && tries < 300);

       const angle = Math.random() * Math.PI * 2;
            enemies.push({
                     px:    (c + 0.5) * cellW(),
                     py:    (r + 0.5) * cellH(),
                     vx:    Math.cos(angle) * stage.enemySpeed,
                     vy:    Math.sin(angle) * stage.enemySpeed,
                     speed: stage.enemySpeed,
            });
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
  }
}

/* ============================================================
   6. 線描画・領域塗りつぶし
   ============================================================ */

/**
 * プレイヤーが安全地帯に戻ったときに、描いた線で囲まれた領域を塗りつぶす
 */
function closeArea() {
     if (!Player.isDrawing || Player.trail.length < 3) {
            // 線が短すぎる場合はミス
       triggerMiss();
            return;
     }

  // 線を全てTRAILからFILLEDに変更
  const filledCells = new Set();
     for (const cell of Player.trail) {
            setCell(cell.c, cell.r, CELL.FILLED);
            filledCells.add(cell.r * GRID_COLS + cell.c);
     }

  // 線で囲まれた領域をFlood Fillで塗りつぶす
  const startC = Player.col;
     const startR = Player.row;
     floodFill(startC, startR, CELL.FILLED);

  // 塗りつぶしたセルをハイライト
  Game.fillFlashCells = filledCells;
     Game.fillFlashTimer = 0.3;

  // 線描画を終了
  Player.isDrawing = false;
     Player.trail = [];

  // スコア計算
  const filledCount = countFilledInner();
     const score = filledCount * SCORE_PER_CELL;
     Game.score += score;
     if (Game.score > Game.hiScore) Game.hiScore = Game.score;

  // クリア判定
  const fillRate = getFillRate();
     if (fillRate >= STAGES[Game.stageIndex].clearRate) {
            triggerClear();
     }
}

/**
 * Flood Fill: (c, r) から始まる連続した EMPTY セルを val に変更
 */
function floodFill(c, r, val) {
     const queue = [];
     const visited = new Set();

  queue.push({ c, r });
     visited.add(r * GRID_COLS + c);

  while (queue.length > 0) {
         const { c: cc, r: rr } = queue.shift();

       if (getCell(cc, rr) !== CELL.EMPTY) continue;
         setCell(cc, rr, val);

       // 上下左右をチェック
       for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
                const nc = cc + dc;
                const nr = rr + dr;
                const idx = nr * GRID_COLS + nc;

           if (!visited.has(idx) && getCell(nc, nr) === CELL.EMPTY) {
                      visited.add(idx);
                      queue.push({ c: nc, r: nr });
           }
       }
  }
}

/* ============================================================
   7. 接触判定
   ============================================================ */

/**
 * プレイヤーと敵の衝突判定
 */
function checkPlayerEnemyCollision() {
     if (Game.state !== STATE.PLAYING || Game.invincible > 0) return;

  const px = Player.px;
     const py = Player.py;
     const pr = 8; // プレイヤーの衝突半径

  for (const e of enemies) {
         const dx = e.px - px;
         const dy = e.py - py;
         const dist = Math.sqrt(dx * dx + dy * dy);

       if (dist < pr + 8) {
                // 衝突
           if (Player.isDrawing) {
                      // 線描画中 → ミス
                  triggerMiss();
           } else {
                      // 安全地帯 → ミス
                  triggerMiss();
           }
                return;
       }
  }
}

/* ============================================================
   8. クリア・ゲームオーバー判定
   ============================================================ */

function triggerMiss() {
     if (Game.missLock) return;
     Game.missLock = true;

  // 線をリセット
  if (Player.isDrawing) {
         for (const cell of Player.trail) {
                  setCell(cell.c, cell.r, CELL.EMPTY);
         }
         Player.isDrawing = false;
         Player.trail = [];
  }

  // ライフ減少
  Game.lives--;

  if (Game.lives <= 0) {
         Game.state = STATE.GAMEOVER;
  } else {
         Game.state = STATE.MISS;
         Game.invincible = INVINCIBLE_FRAMES;
         setTimeout(() => {
                  Game.state = STATE.PLAYING;
                  Game.missLock = false;
         }, 1000);
  }
}

function triggerClear() {
     Game.state = STATE.CLEAR;
     showClearOverlay();
}

/* ============================================================
   9. 描画（レンダリング）
   ============================================================ */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function cellW() {
     return canvas.width / GRID_COLS;
}

function cellH() {
     return canvas.height / GRID_ROWS;
}

/**
 * メイン描画関数
 */
function render() {
     const cw = cellW();
     const ch = cellH();
     const stage = STAGES[Game.stageIndex];

  // 背景
  ctx.fillStyle = stage.bgColor;
     ctx.fillRect(0, 0, canvas.width, canvas.height);

  // グリッド背景（オプション）
  ctx.strokeStyle = stage.bgAccent;
     ctx.lineWidth = 0.5;
     for (let c = 0; c <= GRID_COLS; c++) {
            ctx.beginPath();
            ctx.moveTo(c * cw, 0);
            ctx.lineTo(c * cw, canvas.height);
            ctx.stroke();
     }
     for (let r = 0; r <= GRID_ROWS; r++) {
            ctx.beginPath();
            ctx.moveTo(0, r * ch);
            ctx.lineTo(canvas.width, r * ch);
            ctx.stroke();
     }

  // グリッド描画
  for (let r = 0; r < GRID_ROWS; r++) {
         for (let c = 0; c < GRID_COLS; c++) {
                  const cell = getCell(c, r);

           if (cell === CELL.FILLED) {
                      ctx.fillStyle = stage.filledColor;
                      ctx.fillRect(c * cw, r * ch, cw, ch);
           } else if (cell === CELL.TRAIL) {
                      ctx.fillStyle = stage.trailColor;
                      ctx.fillRect(c * cw, r * ch, cw, ch);
           } else if (cell === CELL.BORDER) {
                      ctx.fillStyle = stage.borderColor;
                      ctx.fillRect(c * cw, r * ch, cw, ch);
           }

           // フラッシュ効果
           if (Game.fillFlashCells && Game.fillFlashCells.has(r * GRID_COLS + c)) {
                      const alpha = Math.sin(Game.fillFlashTimer * Math.PI * 4) * 0.5 + 0.5;
                      ctx.fillStyle = `rgba(255, 255, 0, ${alpha * 0.3})`;
                      ctx.fillRect(c * cw, r * ch, cw, ch);
           }
         }
  }

  // プレイヤー描画
  ctx.fillStyle = '#00ffff';
     ctx.beginPath();
     ctx.arc(Player.px, Player.py, 6, 0, Math.PI * 2);
     ctx.fill();

  // 敵描画
  ctx.fillStyle = '#ff6b6b';
     for (const e of enemies) {
            ctx.beginPath();
            ctx.arc(e.px, e.py, 6, 0, Math.PI * 2);
            ctx.fill();
     }

  // キャラ描画（ゲーム中）
  if (Game.state === STATE.PLAYING && Game.charaImages[Game.stageIndex]) {
         const img = Game.charaImages[Game.stageIndex];
         const alpha = Game.charaAlpha;
         ctx.globalAlpha = alpha;
         ctx.drawImage(img, canvas.width - 150, 50, 120, 200);
         ctx.globalAlpha = 1;
  }
}

/* ============================================================
   10. エフェクト・演出
   ============================================================ */

/**
 * ステージクリア時のオーバーレイを表示
 */
function showClearOverlay() {
     const overlay = document.getElementById('clearOverlay');
     const stage = STAGES[Game.stageIndex];

  // キャラ名とメッセージを設定
  document.getElementById('clear-chara-name').textContent = stage.charaName;
     document.getElementById('clear-chara-speech').textContent = stage.clearMsg;

  // クリア画像を表示
  const charaImg = document.getElementById('clear-chara-img');
     charaImg.src = stage.clearChara;
     charaImg.style.display = 'block';

  overlay.style.display = 'flex';
}

/**
 * ステージクリア時のオーバーレイを非表示
 */
function hideClearOverlay() {
     const overlay = document.getElementById('clearOverlay');
     overlay.style.display = 'none';
}

/* ============================================================
   11. HUD更新
   ============================================================ */

function updateHUD() {
     document.getElementById('score').textContent = Game.score;
     document.getElementById('hiScore').textContent = Game.hiScore;
     document.getElementById('stage').textContent = Game.stageIndex + 1;
     document.getElementById('lives').textContent = Game.lives;

  const fillRate = getFillRate();
     const fillPercent = Math.floor(fillRate * 100);
     const clearRate = STAGES[Game.stageIndex].clearRate * 100;
     document.getElementById('fillRate').textContent = `${fillPercent}% / ${clearRate}%`;

  // プログレスバー
  const progressBar = document.getElementById('areaProgress');
     progressBar.style.width = (fillPercent / clearRate * 100) + '%';
}

/* ============================================================
   12. 入力管理
   ============================================================ */

const keys = {};

window.addEventListener('keydown', (e) => {
     keys[e.key] = true;

                          if (e.key === ' ') {
                                 e.preventDefault();
                                 if (Game.state === STATE.TITLE) {
                                          startGame();
                                 } else if (Game.state === STATE.CLEAR) {
                                          nextStage();
                                 } else if (Game.state === STATE.GAMEOVER) {
                                          startGame();
                                 }
                          }
});

window.addEventListener('keyup', (e) => {
     keys[e.key] = false;
});

function handleInput() {
     Player.nextDx = 0;
     Player.nextDy = 0;

  if (keys['ArrowUp'] || keys['w'] || keys['W']) Player.nextDy = -1;
     if (keys['ArrowDown'] || keys['s'] || keys['S']) Player.nextDy = 1;
     if (keys['ArrowLeft'] || keys['a'] || keys['A']) Player.nextDx = -1;
     if (keys['ArrowRight'] || keys['d'] || keys['D']) Player.nextDx = 1;
}

/* ============================================================
   13. 画面遷移・オーバーレイ
   ============================================================ */

function startGame() {
     Game.stageIndex = 0;
     Game.score = 0;
     Game.lives = INITIAL_LIVES;
     Game.state = STATE.PLAYING;
     loadStage();
}

function loadStage() {
     const stage = STAGES[Game.stageIndex];
     initGrid();
     initPlayer();
     initEnemies(stage);
     Game.charaAlpha = 0;
     Game.charaReveal = 0;
     hideClearOverlay();
}

function nextStage() {
     Game.stageIndex++;
     if (Game.stageIndex >= STAGES.length) {
            // ゲーム完了
       Game.state = STATE.TITLE;
            alert('ゲーム完了！\nスコア: ' + Game.score);
     } else {
            Game.state = STATE.PLAYING;
            loadStage();
     }
}

/* ============================================================
   14. メインループ
   ============================================================ */

let lastFrameTime = 0;

function gameLoop(currentTime) {
     const dt = Math.min((currentTime - lastFrameTime) / 1000, 0.05);
     lastFrameTime = currentTime;

  // 入力処理
  handleInput();

  // 更新
  if (Game.state === STATE.PLAYING) {
         updatePlayer(dt);
         updateEnemies(dt);
         checkPlayerEnemyCollision();
  }

  // キャラ表示更新
  if (Game.state === STATE.PLAYING) {
         const fillRate = getFillRate();
         Game.charaReveal = Math.min(fillRate / (STAGES[Game.stageIndex].clearRate * 0.5), 1);
         Game.charaAlpha = Game.charaReveal * 0.5;
  }

  // フラッシュタイマー更新
  if (Game.fillFlashTimer > 0) {
         Game.fillFlashTimer -= dt;
  }

  // 無敵時間更新
  if (Game.invincible > 0) {
         Game.invincible -= dt;
  }

  // 描画
  render();
     updateHUD();

  requestAnimationFrame(gameLoop);
}

/* ============================================================
   15. 初期化・起動
   ============================================================ */

window.addEventListener('DOMContentLoaded', () => {
     preloadCharaImages();

                          // タイトル画面を表示
                          Game.state = STATE.TITLE;
     initGrid();
     initPlayer();
     initEnemies(STAGES[0]);

                          // ゲームループ開始
                          requestAnimationFrame(gameLoop);

                          // ボタンイベント
                          document.getElementById('startBtn').addEventListener('click', startGame);
     document.getElementById('nextStageBtn').addEventListener('click', nextStage);
});
