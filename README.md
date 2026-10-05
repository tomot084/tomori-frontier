# 灯芽の開拓者 / Tomori Frontier

霧に眠る浮島を、小さな灯守が復旧するオリジナルの静的Webゲーム。

**遊ぶ:** https://tomot084.github.io/tomori-frontier/

スマホは画面左下をドラッグ、PCはWASD・矢印キーで移動。近づくだけで採集・戦闘・資源投入を行います。木・石・実を集めて芽渡り橋、霧払い門、暁の灯台を復旧してください。敵の灯貨は工房で五種類の強化に使えます。工房は安全地帯で、滞在中に回復します。HPが半分以下なら実を自動で消費し、倒れても資源を保ったまま野営地へ戻ります。

三段階の開拓を5〜10分で遊ぶ小規模マップ。クリア後も採集と装備強化を続けられます。素材・敵は再生し、素材不足で詰みません。素材が満杯なら建設地点へ運ぶか背かごを強化してください。放置で建築が進むタイプではなく、移動と採集が中心です。

## 開発

Node.js 24、TypeScript、Phaser 3.90、Vite。バックエンド・外部通信・有料素材・音素材なし。すべての図形とキャラクターは自作。描画はCanvas 2D、内部解像度はCSSピクセル相当（高DPIの無制限拡大をしない）。

```sh
npm ci
npm run dev
npm test
npx playwright install --with-deps chromium
npm run test:browser
npm run build
```

ブラウザ検証: 390×844 / 412×915（touch有効）、1280×720。位置移動のみを行うE2Eフックで実際の採集・投入・戦闘を通し、三つの建築、強化、リロード保存、スクロール、コンソール警告・エラー、404を確認します。資源・建築進捗はフックから書き換えません。開発時、またはURLに `?e2e` を付けた時だけ `window.__game` が利用できます。認証や秘密情報はなく、そのブラウザの進行だけが対象です。通常プレイにフックはありません。

## 設計

- `src/data.ts`: Resource、PlayerStats（stats関数）、Upgrade、Building / UnlockZone設定、敵・採集物データ、バージョン付きSaveと純粋な進行ロジック。
- `src/main.ts`: Player、Gatherable、Enemy、DropItem、Phaser Scene、共通移動入力、HUD。
- `src/style.css`: `100dvh`、safe-area、touch-action、overscroll、縦横画面対応。
- `.github/workflows/pages.yml`: main pushでunit / browser test、build、Pagesへdeploy。

素材・敵・建築・強化数値はdata.tsから調整できます。新資源追加時はResourceの型、設定、容量・描画方針も追加してください。無制限な抽象化は避けています。敵14体、採集物57個以下、ドロップ64個、同時フィードバック48個に制限。画面外でも再生タイマー等の軽い処理は動きます。

LocalStorageの `tomori-frontier-v1` に3秒間隔、建築完成・強化・フォーカス喪失時に保存。ブラウザ・端末ごとに独立し、設定のリセットは確認ダイアログ付き。不正・旧バージョンの保存は初期状態へ戻します。

実機のSafari/Androidでの動作は端末依存です。自動検証はChromiumのタッチ対応エミュレーションで行います。

## ライセンス

オリジナルコード・図形はMIT（LICENSE）。依存ライブラリは各パッケージのライセンスに従います（Phaser MIT、TypeScript Apache-2.0、Vite/Vitest/Playwrightは各同梱ライセンス）。外部の画像・フォント・音素材を再配布していません。

参考API: [Phaser Scale Manager](https://docs.phaser.io/phaser/concepts/scale-manager)、[Phaser Input](https://docs.phaser.io/phaser/concepts/input)。ゲーム名・世界観・マップ・バランス・描画はオリジナルです。
