# AREA BLASTER - 陣取りアクション

ブラウザで遊べる、懐かしのアーケード風2D陣取りアクションゲームです。
HTML / CSS / JavaScript のみで実装されており、外部ライブラリを使用していないため、軽量でどこでも動作します。

## 🎮 遊び方

1. **移動**: `矢印キー` または `W` `A` `S` `D` キーでプレイヤーを移動します。
2. **線を引く**: 未塗り領域（暗い部分）の内部に入ると、自動的に線を引き始めます。
3. **領域を囲む**: 線が自分の領域（水色の外周や既に塗られた部分）に繋がると、囲んだ範囲（敵がいない側）が自分の領域として塗りつぶされます。
4. **ミス条件**:
   - 敵キャラにプレイヤーが触れる。
   - 引いている途中の線に敵キャラが触れる。
   - 自分が引いている線に自分で触れてしまう。
5. **クリア条件**: 盤面の指定割合（ステージ1は75%）以上を塗りつぶすとステージクリアです。
6. **その他の操作**:
   - `SPACE` キー: ゲームの一時停止 / 再開
   - `R` キー: リスタート（やり直し）

※スマートフォンなどのタッチデバイスでも、画面下部の仮想Dパッドでプレイ可能です。

## 🎨 キャラクター演出について

このゲームには5種類のオリジナル美少女ギャルキャラクターが登場します。

- **タイトル画面**: 5人全員が集合したグループイラストが表示されます。
- **ゲームプレイ中**: ステージごとに異なるキャラクターが背景に表示されます。塗りつぶし率が上がるにつれて、キャラクターが徐々に鮮明に見えてくる演出があります。

| キャラ | 特徴 | ステージ |
|--------|------|---------|
| ① 金髪ロングの王道ギャル | 明るい笑顔＋ウインク、元気系 | STAGE 1 |
| ② ピンク系インナーカラーのギャル | ポップでやんちゃ、片手ピース | STAGE 2 |
| ③ 黒髪ストレートのクールギャル | 少し挑発的、腕組みスタイル | STAGE 3 |
| ④ ミルクティーベージュ髪の上品ギャル | 落ち着いた雰囲気、振り向きポーズ | 拡張用 |
| ⑤ オレンジ系ヘアのスポーティーギャル | 動きのある元気なポーズ | 拡張用 |

## 📁 ファイル構成

```
territory-game/
├── index.html              # メインHTML（画面構造・HUD）
├── style.css               # スタイルシート（全画面・UI）
├── game.js                 # ゲームロジック全体
├── README.md               # このファイル
└── assets/
    └── images/
        ├── chara_title.png     # タイトル画面用グループイラスト
        ├── chara_stage1.png    # STAGE 1 キャラ（金髪ギャル・全身）
        ├── chara_stage2.png    # STAGE 2 キャラ（ピンクギャル・全身）
        ├── chara_stage3.png    # STAGE 3 キャラ（黒髪ギャル・全身）
        ├── chara1_full.png     # キャラ①全身版（高解像度・オリジナル）
        ├── chara1_bust.png     # キャラ①バストアップ版
        ├── chara2_full.png     # キャラ②全身版
        ├── chara2_bust.png     # キャラ②バストアップ版
        ├── chara3_full.png     # キャラ③全身版
        ├── chara3_bust.png     # キャラ③バストアップ版
        ├── chara4_full.png     # キャラ④全身版（拡張用）
        ├── chara4_bust.png     # キャラ④バストアップ版
        ├── chara5_full.png     # キャラ⑤全身版（拡張用）
        └── chara5_bust.png     # キャラ⑤バストアップ版
```

## 🚀 起動方法（ローカルでの確認）

このゲームはサーバーを必要とせず、ブラウザで直接ファイルを開くだけで遊べます。

1. このフォルダの中にある `index.html` をダブルクリックしてブラウザで開きます。
2. または、ローカルサーバーを立ち上げて確認することもできます。
   ```bash
   python3 -m http.server 8080
   ```
   ブラウザで `http://localhost:8080` にアクセスしてください。

## 🌐 GitHub Pagesでの公開手順

このプロジェクトはそのまま GitHub Pages で公開できる構成になっています。

1. GitHub に新しいリポジトリを作成します。
2. このフォルダ内のすべてのファイルをリポジトリにプッシュします。
   ```bash
   git init
   git add .
   git commit -m "Initial commit: AREA BLASTER"
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
3. リポジトリの **Settings** > **Pages** を開きます。
4. **Source** を `Deploy from a branch` に設定し、**Branch** を `main` にして **Save** をクリックします。
5. 数分待つと、上部に公開されたURLが表示されます。

## 🔧 今後の拡張ポイント

### ステージの追加
`game.js` の `STAGES` 配列にオブジェクトを追加するだけでステージが増えます。

```javascript
const STAGES = [
  // ... 既存のステージ ...
  {
    id:          4,
    label:       'STAGE 4',
    clearRate:   0.88,
    enemyCount:  5,
    enemySpeed:  3.0,
    bgColor:     '#1a0d0d',
    bgAccent:    '#3a1a1a',
    filledColor: 'rgba(200, 80, 0, 0.55)',
    borderColor: 'rgba(255, 150, 50, 0.8)',
    trailColor:  '#ffab40',
    charaImage:  'assets/images/chara_stage4.png',  // キャラ④を使用
  },
];
```

### キャラクター画像の差し替え
`assets/images/` フォルダの画像を差し替えるだけで、ゲーム内のキャラクターが変わります。

| ファイル名 | 用途 | 推奨サイズ |
|-----------|------|-----------|
| `chara_title.png` | タイトル画面 | 縦長（3:4推奨） |
| `chara_stage1.png` | STAGE 1 背景 | 縦長（3:4推奨） |
| `chara_stage2.png` | STAGE 2 背景 | 縦長（3:4推奨） |
| `chara_stage3.png` | STAGE 3 背景 | 縦長（3:4推奨） |

### サウンドの追加
`game.js` 内の以下の箇所に Web Audio API を使った SE 再生処理を追加できます。

- `closeArea()` 関数: 領域取得時のSE
- `triggerMiss()` 関数: ミス時のSE
- `checkClear()` 関数: クリア時のSE・BGM切り替え

### 敵の種類追加
`initEnemies()` 関数と `updateEnemy()` 関数を拡張することで、直線移動・追尾型・ランダム移動など異なる行動パターンの敵を追加できます。

---
**License**: MIT License  
**Author**: Manus AI  
**Version**: 1.0.0
