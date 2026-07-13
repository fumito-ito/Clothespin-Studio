---
id: 10
title: ソリッドボクセル化（watertight 前提・単色）
status: in-progress
depends: [8, 9]
parent: 1
branch:
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
function voxelizeSolid(mesh: MeshData, voxelMm: number):
  { voxels: Map<string, string>,  // "i,j,k" → colorId（本 Issue では既定色固定）
    seed: string | undefined }     // 充填ボクセルのうち中心最下層近傍（grow の慣行と同じ）
```

## 受入基準

- [ ] 合成の閉球・直方体で、解析解（中心距離 / bbox 内判定）に対する誤判定率 ≤ 2% を vitest で検証
- [ ] 内部も充填されている（シェルでない）ことをテスト（中心ボクセルが埋まる等）
- [ ] `seed` が「充填ボクセル・k 最小層・重心最近傍」であることをテスト
- [ ] 40³ 相当の処理時間を計測しテスト内でログ出力（回帰の目安。ハード制限はしない）

## スコープ外

非 watertight 頑健化（0013）・色割当（0011）・シェル化 / 中空化（issue 0003）・grow 接続（issue 0002）

## 参照

- **issue 0008 の決定記録（着手前に必読）** / docs/07 §9 M1
- 0008 の決定要約（2026-07-03 確定）: **6 方向多数決（±X/±Y/±Z の奇偶判定を多数決）**を採用。
  実装は自前の Möller–Trumbore 交差 + 一様グリッド索引（新規依存なし）。40³ で 85〜103ms。
  仮実装の参考コード: `spike/voxelization` ブランチの `spike/voxelize.ts`（マージ禁止・参照のみ）
- grow 側の期待形式: `src/domain/grow.ts` の `growAssembly(voxels, voxelMm, seedKey)`
