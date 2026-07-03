---
id: 7
title: 統合 UX / エクスポート統合 / 旧レリーフ削除（M7）
status: open
depends: [3, 4]
branch:
pr:
created: 2026-07-03
---

## 目的

3D モデル取り込み機能を製品として統合し、不採用となった旧レリーフ（画像→2.5D）実装を削除する。

## 受入基準

- [ ] 取り込みダイアログ（ファイル選択 → プレビュー → パラメータ → 生成）
- [ ] 部品表 / 保存・読込 / GLB・STL・PNG エクスポートとの統合確認
- [ ] 旧レリーフ実装の削除: `ui/GeneratorDialog.tsx` の画像系 / `io/imageToCells.ts`(+test) /
      `generator.ts` の高さ場系 / `i18n` の `gen*` 文言 / `store.ts` の合成画像ヘルパー
      （色量子化 `nearestColorId` 等は取り込み側へ移設して流用）
- [ ] docs 更新（docs/07 の進捗・docs/05 ロードマップへの反映）

## 参照

- docs/07 §9 M7 クリーンアップ一覧（develop/generate-from-image 上）
