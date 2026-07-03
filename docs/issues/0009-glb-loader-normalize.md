---
id: 9
title: GLB ローダ + 正規化（スケール / Z-up / 接地）
status: open
depends: []
parent: 1
branch:
pr:
created: 2026-07-03
---

モデル目安: sonnet

## 目的

GLB ファイルをブラウザ内で読み込み、後続（ボクセル化）が扱う中間表現 `MeshData` へ変換する。
**対象は GLB のみ**（Interfaces 絞り。STL / OBJ は issue 0014）。

## モジュール契約（後続 Issue との境界）

```ts
// three 非依存の純データ（src/types.ts に追加）
interface MeshData {
  positions: Float32Array   // xyz 連続・単位 mm・正規化済み
  indices: Uint32Array      // 三角形
  faceColors?: Float32Array // face ごとの RGB（0-1）。無色は undefined
}
// src/io/loadModel.ts（新規）: GLTFLoader → メッシュ統合 → MeshData
// src/domain/normalize.ts（新規・純関数）: bbox から「最長辺=目標mm・Y-up→Z-up・min.z=0」への
// 変換を計算し positions に適用する
```

## 受入基準

- [ ] プログラム生成した既知寸法の GLB を読み込み、正規化後の bbox が
      （最長辺 = 目標 mm・Z-up・min.z = 0）になることを vitest で数値検証
- [ ] マテリアル色 / 頂点色が `faceColors` へ入ることをテスト（無色 → undefined）
- [ ] `normalize` は three の数学クラス以外に依存しない純関数（domain ルール準拠）
- [ ] 壊れたファイル / 非 GLB は例外でなくエラーメッセージ付き結果で返す（テスト）

## スコープ外

STL / OBJ（0014）・ボクセル化（0010）・UI（0012）・テクスチャからの色抽出（将来）

## 参照

- docs/07 §9 M1 / 既存の io 実装例: `src/io/exportGltf.ts`・`src/io/imageToCells.ts`
