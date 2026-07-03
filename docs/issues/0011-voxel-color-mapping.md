---
id: 11
title: ボクセル色割当（メッシュ色 → 最近傍パレット）
status: open
depends: [10]
parent: 1
branch:
pr:
created: 2026-07-03
---

モデル目安: haiku〜sonnet（既存 `nearestColorId` の流用が主）

## 目的

ボクセル目標の各ボクセルへ、メッシュの色から最近傍パレット色を割り当てる。

## 内容

- `src/domain/voxelize.ts` を拡張: 表面ボクセルは最寄り三角形の頂点色
  （`MeshData.vertexColors`・3 頂点の平均）→ `nearestColorId`
  （`src/domain/generator.ts` から流用/移設）でパレット量子化
- 内部ボクセルは最寄り表面ボクセルの色を継承
- `vertexColors` が無い（無色モデル）場合は全ボクセル既定色（`DEFAULT_COLOR_ID`）

## 受入基準

- [ ] 合成 2 色メッシュ（例: 上半分赤 / 下半分白の直方体）で、対応するボクセルに正しい
      パレット色が付くことを vitest で検証
- [ ] 無色モデル → 全ボクセル既定色のテスト
- [ ] 内部ボクセルが表面色を継承することのテスト

## スコープ外

パレット自体の拡張（issue 0004）・テクスチャサンプリング（将来）

## 参照

- `src/domain/generator.ts` の `nearestColorId`（重み付き RGB 距離）/ `src/assets/palette.ts`
