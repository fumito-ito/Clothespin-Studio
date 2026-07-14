---
id: 10
title: ソリッドボクセル化（watertight 前提・単色）
status: done
depends: [8, 9]
parent: 1
branch: issue/0010-solid-voxelization
pr:
created: 2026-07-03
---

モデル目安: sonnet（0008 の決定記録があれば設計判断は残らない）

## 目的

正規化済み `MeshData` を内外判定でソリッドボクセル目標へ変換する。方式は **issue 0008 の決定に従う**。
**watertight メッシュ前提・全ボクセル既定色**（Data/Rules 絞り。非 watertight は 0013、色は 0011）。

## モジュール契約

```ts
// src/domain/voxelize.ts（新規・純関数）
function voxelizeSolid(mesh: MeshData, voxelMm: number, colorId: string):
  { voxels: Map<string, string>,  // "i,j,k" → colorId（本 Issue では引数の colorId 固定）
    seed: string | undefined }     // 充填ボクセルのうち中心最下層近傍（grow の慣行と同じ）
```

※実装時に `colorId` を引数化（domain 層がパレットへ依存しないため。呼び出し側が既定色を渡す）。

## 受入基準

- [x] 合成の閉球・直方体で誤判定率 ≤ 2% — 閉球 **1.44%**（半径20mm・1280面）/
      直方体 **0.0047%**（`voxelize.test.ts` の解析解比較テスト）
- [x] 内部も充填されている — 中心付近 3×3×3 ブロック全充填を検証（軸沿いレイの縮退を避けるため
      球を非対称オフセット配置）
- [x] `seed` = 充填ボクセル・k 最小層・重心最近傍 — 直方体で k 最小・(i,j) 重心一致を検証
      （選定方針は `generator.cellsToVoxels` と同一）
- [x] 40³ 相当の処理時間ログ — **75.1ms**（約20480面・充填32764ボクセル。spike 実測 85〜103ms と
      同水準。軸ごと共有 3 グリッドで索引構築を削減）

## スコープ外

非 watertight 頑健化（0013）・色割当（0011）・シェル化 / 中空化（issue 0003）・grow 接続（issue 0002）

## 参照

- **issue 0008 の決定記録（着手前に必読）** / docs/07 §9 M1
- 0008 の決定要約（2026-07-03 確定）: **6 方向多数決（±X/±Y/±Z の奇偶判定を多数決）**を採用。
  実装は自前の Möller–Trumbore 交差 + 一様グリッド索引（新規依存なし）。40³ で 85〜103ms。
  仮実装の参考コード: `spike/voxelization` ブランチの `spike/voxelize.ts`（マージ禁止・参照のみ）
- grow 側の期待形式: `src/domain/grow.ts` の `growAssembly(voxels, voxelMm, seedKey)`
