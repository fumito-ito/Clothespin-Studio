---
id: 1
title: 3D モデル取り込み → ボクセル化（M1）
status: open
depends: []
branch:
pr:
created: 2026-07-03
---

## 目的

既存 3D モデル（GLB / STL / OBJ）をブラウザ内で読み込み、成長アルゴリズムの入力となる
ボクセル目標（`"i,j,k"` → colorId）へ変換する。全処理クライアント完結（NFR-10）。

## 受入基準

- [ ] three.js の `GLTFLoader` / `STLLoader` / `OBJLoader` でファイルを読み込める
- [ ] 正規化: スケール（目標サイズ mm 指定）・向き（Z-up へ）・原点（接地）
- [ ] 内外判定によるソリッドボクセル化（レイキャスト等）。非 watertight メッシュでも破綻しない
- [ ] 頂点色/マテリアル色 → 最近傍パレット色の割り当て（無色モデルは既定色）
- [ ] 代表モデル（低ポリのフィギュア等）でボクセル結果を 3D 表示で目視確認できる
- [ ] `src/domain/` 側は純ロジックとして vitest でテスト（合成メッシュで内外判定を検証）

## 参照

- docs/07 §7・§9 M1（develop/generate-from-image 上）
- 流用: `domain/grow.ts` / `catalog.ts` / `collision.ts`（変更不要のはず）
