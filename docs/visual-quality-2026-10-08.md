# スマホ画面の視認性・ビジュアル改善（2026-10-08）

ローカルの参考画像（`input/reference-images/`）と変更前の実画面を比較した。
参考の広い作業床、主人公と機械の分離、少数の主役、陰影のある統一された質感を判断軸にした。
新しいゲーム機能・外部素材の追加は行っていない。

## 変更

| ファイル | 内容 |
| --- | --- |
| `src/view3d.ts` | より正面・俯瞰寄りの縦カメラ、製材エリアへの緩やかな中心補正。主人公のサイズを維持。暖色の主光と寒色の環境光、コントラスト、標準1024pxの影、ラック・機械の接地影、明るい主人公リング。接地影は作業床より上に置く。非表示設備を影の対象から除外。 |
| `src/scenery.ts` | 一体感のある丸角の作業床。開始エリア奥の装飾木10→4、各島の境界木16→8、草花候補65→28。中央作業エリアには草花を置かず、工房を82%へ縮小。 |
| `src/investment-view.ts` | 製材所・市場は常時表示。周辺の強化・募集用小物は近づくと表示し、遠くでは抑える。近接ボタンが現れる範囲では小物が十分見える。購入・既存一覧の操作は維持。 |
| `src/simulation.ts` | 岸辺で重なっていた初期島の資源を分散。主人公の初期採集対象と製材側の木を維持。設備・資源間に間隔を確保。資源ID・総数・採集量・再生ルールは維持。 |
| `src/models.ts` | 採集木の濃淡と樹冠のサイズ差・シルエットを調整。背景木は抑えた色。 |
| `src/keeper.ts` | 主人公の服を青へ変更し、緑の地面・青緑の機械から分離。人物テクスチャの自己発光を抑え、世界の光となじませる。 |
| `src/style.css` | HUDの資源・HP・目的の高さと余白を圧縮。目的を濃い帯、近接ガイドを明るい色へ整理。待機中のスティックを抑える。 |
| `src/main.ts` | 標準1024px／軽量512pxの影を切替。軽量時の解像度低下を緩和し輪郭を保つ。DPR上限1.25と既存の自動軽量化を維持。 |
| `tests/simulation.test.ts` | 初期島の資源19個・最初の採集位置・歩ける範囲・資源間隔80以上を検査。 |
| `tests/browser/game.spec.ts` | 全島進行の採集対象を現在の島から選ぶ。資源配置の分散で以前の島に未採集ノードが残っても、テストが移動不能な旧島ノードを選ばないよう修正。 |
| `tests/investments.test.ts` | 資源配置で移動先が近くなったため、運搬速度比較を到着前の200msで行い、両者が移動中であることを確認。 |

## 素材

追加・差替素材なし。木・設備・作業床は既存のコード生成を調整。
既存のKayKit人物（CC0）を継続利用。既存素材のURL・ライセンス記録は
[asset-sources.md](asset-sources.md) にある。
参考画像そのものの素材・ロゴ・キャラクターは取り込んでいない。

## before / after

同じlocalhost・ビューポート・プレイヤー位置から、新規セーブで撮影。
390×844、412×915、1280×720の開始・製材・採集・市場を保存。
採集・加工は撮影中も動くため、瞬間の荷物・浮き文字は完全一致ではない。

- [開始：比較](../screenshots/visual-comparison-start-390.png)
- [製材：比較](../screenshots/visual-comparison-production-390.png)
- [採集：比較](../screenshots/visual-comparison-harvest-390.png)
- [市場：比較](../screenshots/visual-comparison-market-390.png)
- 個別画像：`screenshots/visual-{before,after}-{start,production,harvest,market}-{390,412,1280}.png`
- 実プレイの全島クリア：[complete-390.png](../screenshots/complete-390.png)
- 実経済ループの製材・自動運営：`screenshots/loop-output-{390,412,1280}.png` / `screenshots/loop-automation-{390,412,1280}.png`
- 撮影ログ：`screenshots/visual-before-report.json` / `screenshots/visual-after-report.json`
- 撮影スクリプト：`screenshots/visual-quality-review.mjs` / `screenshots/visual-comparisons.mjs`

画像・参考資料・作業スクリプトは既存のgitignoreに従いローカル限定。

## 検証

- localhost:5173で実画面確認。スマホ2サイズはtouch有効。
- 最終撮影の全3サイズ：console error 0、page error 0、HTTP 400以上 0（asset 404 0）、横はみ出し0。
- `npm test`：34件成功。
- `npm run build`：TypeScript・production build成功。
- `npm run audit:dist`：142ファイル成功。参考画像・スクリーンショット・作業ファイルの混入なし。
- 最終productionブラウザ検証：16件すべて成功（13.1分）。390×844／412×915／1280×720の操作・採集・製材・販売・雇用・再投資・保存復元、390pxの全島クリア、横画面2サイズ・縦横切替、旧セーブ・DPR3を確認。console/page error・HTTP 400以上を監視するケースも成功。
- `git diff --check`：成功。
- 実行ログ：`screenshots/visual-production-final.log` / `screenshots/visual-build.log`。

Chromiumのスマホ相当表示で検証。実機Safari／Androidは未検証。
この環境のソフトウェアWebGLでは自動的に軽量表示になった。
比較画像はその実際の表示を保存しており、実機でのFPSを保証する測定ではない。
