---
id: 12
title: 取り込みダイアログ最小版（ファイル選択 → ボクセルプレビュー）
status: open
depends: [9, 10, 11]
parent: 1
branch:
pr:
created: 2026-07-03
---

モデル目安: sonnet

## 目的

パイプライン（loadModel → voxelizeSolid）を UI に配線し、ボクセル結果を目視確認できるようにする。
**ピン化（growAssembly 接続）はしない** — それは issue 0002 のスコープ。

## 内容

- `src/ui/ImportDialog.tsx`（新規）: ファイル選択 → 読み込み → ボクセルを簡易ボックス群で
  3D プレビュー表示（`InstancedMesh` 等・パレット色反映）。目標サイズ mm の入力（既定 400）
- `ControlPanel` にエントリ追加、`i18n/messages.ts` に文言追加（日英）
- モーダルは `createPortal(…, document.body)` 方式（`GeneratorDialog` の教訓に従う）

## 受入基準

- [ ] 代表 GLB を選択するとボクセルプレビューが表示される（preview ツールのスクリーンショットで確認）
- [ ] ボクセル数・推定ピン数を表示する
- [ ] 読み込み失敗時にエラーメッセージを表示し、古いプレビューを残さない
- [ ] lint / format:check / test / build がすべて通る

## スコープ外

growAssembly への接続・生成ボタン（issue 0002）・シェル化等のパラメータ UI（issue 0003）

## 参照

- 既存ダイアログの実装: `src/ui/GeneratorDialog.tsx`（portal / エラー処理 / デバウンスの先例）
