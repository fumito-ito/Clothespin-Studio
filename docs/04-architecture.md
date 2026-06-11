# 04. アーキテクチャ

## 1. 技術スタック

| 領域 | 採用 | 理由 |
| --- | --- | --- |
| 言語 | **TypeScript** | 型安全。ドメインロジックの保守性（NFR-9）。 |
| ビルド | **Vite** | 高速 DX、静的出力で GitHub Pages 等にデプロイ可（NFR-4）。 |
| UI | **React** | エコシステム、R3F との親和性。 |
| 3D | **Three.js** + **React Three Fiber (R3F)** + **@react-three/drei** | Web3D 定番。宣言的にシーンを記述。 |
| 状態管理 | **Zustand**（履歴は **zundo**） | 軽量・R3F と相性良。Undo/Redo を容易に（FR-E5）。 |
| スタイル | CSS Modules（必要なら軽量ユーティリティ） | 依存を最小化。 |
| i18n | i18next（または軽量自前） | UI 文言の日英対応（NFR-7）。 |
| テスト | **Vitest** + Testing Library | ドメイン純関数を中心に単体テスト。 |
| Lint/Format | ESLint + Prettier | 一貫性。 |

- **バックエンドなし**。完全クライアントサイド・静的ホスティング。

## 2. レイヤリング（依存方向）

描画から **ドメイン（連結・拘束解決）を分離** し、純関数として単体テスト可能にする（NFR-9）。

```
┌─────────────────────────────────────────────┐
│ UI 層 (React)                                │  パネル・ツールバー・ダイアログ
│   ↳ R3F シーン (3D ビューポート)             │  ピン描画・ギズモ・ハイライト
├─────────────────────────────────────────────┤
│ アプリ状態 (Zustand store + zundo)           │  選択・ツール・履歴・プロジェクト
│   ↳ コマンド (addPin / connect / delete …)   │  状態遷移はここに集約
├─────────────────────────────────────────────┤
│ ドメイン (純 TS / Three非依存 or math のみ)  │  ← テストの主対象
│   ・連結モデル / 拘束解決（姿勢導出）        │
│   ・占有・閉路・整合性バリデーション         │
│   ・部品表(BOM)集計 / 寸法計算               │
├─────────────────────────────────────────────┤
│ I/O (serializer / exporters / importer)      │  JSON / CSV / glTF / STL / PNG
├─────────────────────────────────────────────┤
│ アセット / 定数                               │  洗濯バサミ定義(接続点) / GLB / パレット
└─────────────────────────────────────────────┘
```

依存は上から下の一方向。ドメインは UI / Three に依存しない（ベクトル演算は軽量 math か three/math のみ）。

## 3. ディレクトリ構成（案）

```
src/
  app/                # エントリ、ルートレイアウト、グローバルプロバイダ
  scene/              # R3F: Canvas, カメラ, ライト, グリッド, ギズモ
    PinInstances.tsx  # InstancedMesh による大量描画
    SocketHints.tsx   # 選択ピンの GRIP ソケット表示
    PlacementGhost.tsx# 配置プレビュー（ゴースト）
  ui/                 # パネル/ツールバー/ダイアログ（2D HTML）
    Toolbar/ Palette/ StatsPanel/ ExportMenu/ ...
  state/              # Zustand store, コマンド, 履歴(zundo)
  domain/             # ★純ロジック（テスト対象）
    clothespin.ts     # 接続点定義(JAW/GRIP)・寸法・座標フレーム
    solve.ts          # 連結→ワールド姿勢の導出/キャッシュ
    graph.ts          # フォレスト操作・閉路/占有チェック
    bom.ts            # 部品表集計
    bounds.ts         # 全体寸法計算
  io/                 # serialize/deserialize, migrate, exporters
    project.ts        # JSON 読み書き + バリデーション + migration
    exportCsv.ts exportGltf.ts exportStl.ts exportPng.ts
  assets/             # clothespin.glb, パレット定義
  i18n/               # 文言リソース
  types.ts            # 共有型（03 の型定義）
docs/                 # 本ドキュメント群
```

## 4. 状態管理

- **単一 Zustand ストア** に「ドキュメント状態（Project）」と「エディタ状態（選択・ツール・カメラ）」を保持。
- 変更は **コマンド関数経由**（`addPin`, `connectPin`, `setColor`, `deleteSubtree`, `rotateRoll`, `rotatePitch` …）。
  直接 set を散らさず、ドメイン関数を呼んで結果を反映する。
- **Undo/Redo** は zundo で「ドキュメント状態」のみを履歴対象にする（カメラ等の一時状態は除外）。
- 派生姿勢（連結ピンのワールド変換）は **セレクタでメモ化**。親更新時に該当サブツリーを無効化。

## 5. 描画・性能戦略（NFR-1/2）

大規模構造（数千〜1万ピン）を扱うため、素朴な「1 ピン = 1 Mesh」は採らない。

- **InstancedMesh**: 同一ジオメトリを 1 ドローコールで大量描画。
  - 各インスタンスの `matrix` にワールド変換、`instanceColor` に色を設定。
  - 色数が少なければ全体を 1 InstancedMesh + instanceColor で済ませる（既定）。
- **LOD**: 近景は詳細メッシュ、遠景は簡略ボックス。`drei` の Instances/LOD を活用。
- **選択ピッキング**: GPU ピッキング or `instanceId` ベースの raycast 最適化。
- **フラスタムカリング / 必要時のみ再構築**: インスタンス行列はバッファ更新を最小化。
- **接続点ヒント**は選択時のみ生成（常時は描かない）。

> ベンチマーク: M3 までに 5,000 / 10,000 ピンのストレステストシーンを用意し、fps を計測する。

## 6. 主要インタラクション設計

- **配置ツール**: ピン選択 → GRIP ソケットを候補表示 → ホバーでゴースト → クリックで確定（`connectPin`）。
- **roll/pitch 調整**: 選択中の連結ピンにキー（例: `[` `]` で roll、`{` `}` で pitch）。pitch はリング系（`g4`/`g5`/`g6`）接続時のみ有効。`g5` は roll 不可。
- **ルートピン移動**: ベース平面上を transform ギズモ（drei `PivotControls` 等）+ グリッドスナップ。
- **カメラ**: `OrbitControls`。プリセット視点はカメラ補間で切替。
- **キーボード**: Undo/Redo、削除、複製、視点、ツール切替（NFR-8）。

## 7. I/O パイプライン

- **保存/読込**: `Project` ⇄ JSON（[03 §2](03-data-model.md)）。読込時バリデーション + マイグレーション。
- **CSV**: `domain/bom.ts` の集計結果を整形（[03 §3](03-data-model.md)）。
- **glTF/STL**: シーンから書き出し用メッシュを構築 → `GLTFExporter` / `STLExporter`。
  - 出力専用に、色ごとにマージしたメッシュを一時生成（表示用 InstancedMesh とは別経路）。
- **PNG**: `gl.domElement.toDataURL`。高解像度は一時的にレンダーターゲット拡大。
- ダウンロードは `Blob` + `URL.createObjectURL` + `<a download>` で統一（`io/download.ts`）。

## 8. テスト方針

- **ドメイン純関数**を最優先で単体テスト（Vitest）:
  - 連結 → ワールド姿勢導出が期待通り（既知ケースの数値検証）。
  - 閉路検出・ソケット占有・整合性バリデーション。
  - JSON ラウンドトリップ（保存→読込で不変）、マイグレーション。
  - BOM 集計・寸法計算。
- UI/3D はスモークテスト中心（重い E2E は最小限）。

## 9. ビルド / デプロイ

- `vite build` で静的出力 → GitHub Pages / Netlify / Vercel 等にデプロイ（NFR-4）。
- 将来 PWA（オフライン動作 / インストール）を検討（[05](05-roadmap.md)）。

## 10. 主要ライブラリ候補

| 用途 | 候補 |
| --- | --- |
| 3D コア | `three` |
| React 3D | `@react-three/fiber`, `@react-three/drei` |
| 状態 / 履歴 | `zustand`, `zundo` |
| ID | `nanoid` |
| エクスポータ | three 同梱 `GLTFExporter` / `STLExporter` |
| i18n | `i18next` / `react-i18next`（または自前軽量） |
| テスト | `vitest`, `@testing-library/react` |
