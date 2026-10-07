# 灯芽の開拓者 / Tomori Frontier

**[ブラウザで遊ぶ](https://tomot084.github.io/tomori-frontier/)**

霧に眠る浮島を、小さな灯守が復旧するオリジナルの3D Idle Arcade。
CC0の人物・樹木素材をTomoriの見た目に合わせ、独自の資源スタック、精霊、建物、地形、エフェクトと組み合わせています。素材の出典は [docs/asset-sources.md](docs/asset-sources.md) に記録しています。

スマホはフィールドをドラッグ、PCはWASD / 矢印キーで移動。採集・攻撃・回収・建設への投入は自動です。敵の灯貨を工房で使い、攻撃・採集・移動・HP・容量を育てます。工房は回復・安全地帯です。HPが低いと実を使って回復し、倒れても素材を保って野営地へ戻ります。

木を切って丸太を拾い、背中へ高く積んで製材所の右のINPUTへ。95ms間隔で1本ずつ降ろし、丸太が加工機へ流れ、左のOUTPUTに板材が積み上がります。最初は自分が製材所のそばで作業し、OUTPUTから板材を背負って市場へ運びます。1枚ずつ客へ渡すと灯貨が金庫に積まれ、近づいて回収できます。丸太も板材も建築に使えます。

投資地点は14種類。道具・容量を育てるか、木こり・製材担当・運搬係・販売係を雇うか、コンベア・製材速度・在庫容量・売値へ投資するかを選べます。コンベアを買うと設備と動くベルトが出現し、離れていても製材が進みます。木こりは木へ歩き、切り、拾い、積み、1本ずつ降ろします。既存の建築／市場ルートを維持し、市場ルートの原木は製材所INPUTへ、板材は運搬係が市場へ運びます。投資パネルは補助一覧で、地面の募集・設備予定地へ近づいて購入し、購入後は閉じて世界の変化を見られます。

三つの開拓を約5〜10分で遊ぶ規模です。クリア後も採集・戦闘・強化を続けられます。資源・敵は再生するため、素材不足で詰みません。荷物が満杯なら建設地点へ運ぶか背かごを強化してください。

## 3D移行と既存セーブ

旧Phaser版の進行を引き継ぎ、表示をBabylon.jsへ移行しました。`tomori-frontier-v1` のKEYと座標単位を維持し、旧版の資源・建築途中・開放・強化・位置・HPを続けられます。市場と雇用の状態は追加のeconomy項目に保存します。追加項目のない旧セーブでは加入済みの仲間を引き継ぎ、新規ゲームでは任意に雇います。加工・在庫・運搬予約・回収途中の灯貨も保存します。旧進行の分析は [docs/3d-migration.md](docs/3d-migration.md)、生産ラインの視覚比較は [docs/physical-economy-2026-10-07.md](docs/physical-economy-2026-10-07.md)、通常画面の整理は [docs/progressive-disclosure-2026-10-07.md](docs/progressive-disclosure-2026-10-07.md) に記録しています。

## 開発

Node.js 24 / TypeScript / Babylon.js 9 / Vite。バックエンド・外部サービス・CDN素材・有料素材はありません。すべてGitHub Pagesから静的配信します。

```sh
npm ci
npm run dev
npm test
npx playwright install --with-deps chromium
npm run test:browser
npm run build
# ビルド済みの静的ファイルでもブラウザ検証
npm run test:production
```

Playwrightは390×844 / 412×915（touch有効）/ 1280×720、縦横切替、DPR3を確認します。E2Eフックで位置だけを移動し、本体の採集・投入・戦闘・強化で橋→門→灯台を通します。資源や進捗を付与しません。実採集→INPUT→製材→OUTPUT→市場→金庫→雇用→コンベア→再投資と、旧版の保存互換も別ケースで検証します。

`npm test` はエンジン非依存の資源・建築・強化・移動・戦闘・復帰・セーブを検証します。

開発中、またはURLに `?e2e` を付けたときだけ `window.__game` が利用でき、state / position / entities / input / save / inspectで確認できます。inspectは描画エンジン・FPS・三角形数・メッシュ数・積み荷・内部解像度も返します。通常プレイでは公開しません。

```sh
# 共通移動入力を実際に操作する追加の連続プレイレビュー
node scripts/playthrough.mjs
```

## 構成

- `data.ts`: 設定・互換Save・純粋な進行処理。
- `investments.ts`, `investment-view.ts`, `crew.ts`: 投資先、木材市場、配達・採集運搬の仲間と地面タイル。
- `simulation.ts`: エンジンから独立したPlayer / Gatherable / Enemy / DropItemと採集・戦闘・建築。
- `models.ts`, `scenery.ts`: オリジナルの低ポリモデル、関節、地形、環境、小物と建築。
- `production-view.ts`: 丸太/板材/灯貨の在庫・飛行プールと動く生産設備。
- `view3d.ts`: カメラ、陰影、描画範囲、モーション、破壊・取得・投入の演出。
- `input.ts`, `ui.ts`: pointer capture、画面方向へ移動する共通入力、コンパクトなHUD、近接アクション、工房UI。
- `.github/workflows/pages.yml`: main pushでtest / browser test / build / Pages deploy。

DPRは1.25相当まで。影は512px。低ポリの共有素材と静的メッシュ結合を使い、カメラ外を非表示にします。丸太100本・板材100枚まで共有形状で積載。INPUT/OUTPUT/市場/金庫はthin instanceで各100個まで表示。木材/板材/灯貨の移動物は各24個の固定プール。石4個・袋1個、ドロップ64個、3D破片48個、浮き数字32個まで。低速時は内部解像度と影の更新頻度を下げ、設定からも軽量表示を選べます。WebGL対応ブラウザが必要です。

LocalStorageへ3秒間隔、建築・強化・フォーカス喪失時に保存。端末・ブラウザごとに独立します。設定のリセットには確認があります。実機のSafari / Androidによる検証は未実施で、自動検証はChromiumのタッチエミュレーションです。

## ライセンス

オリジナルのコード・3Dモデル・SVG・テクスチャはMIT（LICENSE）。Babylon.jsはApache-2.0。依存パッケージは同梱ライセンスに従います。承認済みのCC0素材の出典とライセンスは [docs/asset-sources.md](docs/asset-sources.md) とdocs/licensesに記録しています。参考ゲームの素材・ロゴ・キャラクター・UIは含みません。ローカル参考資料のinputと作業スクリーンショットはcommit・distへ含めません。
