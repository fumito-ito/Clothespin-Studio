---
id: 14
title: STL / OBJ ローダ追加
status: open
depends: [9]
parent: 1
branch:
pr:
created: 2026-07-03
---

モデル目安: haiku（0009 で確立したパイプラインへの機械的な追加）

## 目的

GLB で確立した `loadModel` パイプラインに STL / OBJ 入力を追加する。

## 内容

- `src/io/loadModel.ts` に `STLLoader` / `OBJLoader` の分岐を追加（拡張子 / マジックバイトで判別）
- STL は無色 → `faceColors` なし（既定色）。OBJ はマテリアル色があれば `faceColors` へ
- ImportDialog の accept 属性を拡張（0012 完了後なら。未完なら io 層のみ）

## 受入基準

- [ ] プログラム生成した合成 STL（バイナリ）と OBJ を読み込み、`MeshData` の頂点数・
      正規化結果を vitest で検証
- [ ] STL → `faceColors === undefined` のテスト
- [ ] 未対応拡張子はエラーメッセージ付きで拒否（テスト）

## スコープ外

その他形式（PLY / FBX 等）・テクスチャ

## 参照

- issue 0009 の `MeshData` 契約
