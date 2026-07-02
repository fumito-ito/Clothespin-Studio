---
id: 4
title: パレット拡張と色マッピング（M4）
status: open
depends: [2]
branch:
pr:
created: 2026-07-03
---

## 目的

現状 3 色（blue / white / warmgray）では立体モデルを色で判別できない。
市販の洗濯バサミで入手可能な色へパレットを拡張し、モデル色 → パレットの量子化品質を上げる。

## 受入基準

- [ ] パレットを実在色ベースで拡張（`assets/palette.ts`。部品表/エクスポートへの波及確認）
- [ ] 色距離の改善（知覚的距離 or 現行重み付き RGB の再調整）を量子化テストで検証
- [ ] 部品表（BOM）・保存/読込・GLB/STL エクスポートが新パレットで整合する

## 参照

- docs/07 §8 #5・§9 M4（develop/generate-from-image 上）
