# 03. データモデル & ファイル形式

本書は、ドメインモデル（メモリ上の構造）と、各エクスポート形式の仕様を定義する。
接続点（JAW / GRIP）の定義は [02 洗濯バサミ仕様](02-clothespin-spec.md) を参照。

## 1. ドメインモデル

### 1.1 概念

- **Project**: 構造物全体。ピン群・パレット・メタデータを持つ保存単位。
- **Pin**: 1 個の洗濯バサミ。色と「親への接続」または「ワールド姿勢」を持つ。
- **Connection**: あるピンの JAW を親ピンの GRIP ソケットへ嵌めた関係。

### 1.2 構造はフォレスト（森）

- 各ピンの **JAW は 1 つ**なので、**親は最大 1**。
- 各ピンの **GRIP ソケットは複数**なので、**子は複数**（分岐可能）。
- どこにも挟まれていないピン = **ルートピン**（`connection: null`）。
- → 全体は **木の集合（フォレスト）**。初期実装では **閉路（ループ）を禁止** する。

```
root(p1) ── g3 ─→ p2 ── g0 ─→ p4
   └─────── g5 ─→ p3
root(p5)            （独立した別の木）
```

### 1.3 ワールド姿勢の導出

- **ルート / 自由ピン**: ワールド姿勢 `transform`（position + quaternion）を直接保持。
- **連結ピン**: 姿勢は保持せず、`connection` から導出する（[02 §5](02-clothespin-spec.md)）。
  - 保存サイズが小さく、親を動かすと子が追従する利点。
  - 実行時は再計算をキャッシュ（メモ化）し、親更新時に該当サブツリーのみ無効化。

### 1.4 TypeScript 型（実装の指針）

```ts
type Vec3 = [number, number, number];
type Quat = [number, number, number, number]; // x, y, z, w

interface Transform {
  position: Vec3;   // mm, world
  rotation: Quat;
}

interface Connection {
  parentId: string;   // 親ピンの id
  gripIndex: number;  // 親の GRIP ソケット番号 (g0=0, g1=1, ...)
  roll: number;       // 度。離散ステップ（既定 90）
  flip: boolean;      // 表裏反転
}

interface Pin {
  id: string;             // 一意 ID（nanoid 等）
  colorId: string;        // palette[].id を参照
  connection: Connection | null;  // null = ルート/自由ピン
  transform?: Transform;          // connection が null のとき必須
}

interface PaletteColor {
  id: string;     // 例: "blue"
  name: string;   // 表示名（i18n キー or 文言）
  hex: string;    // "#1f6fe0"
}

interface ProjectMeta {
  name: string;
  createdAt: string;   // ISO 8601
  modifiedAt: string;  // ISO 8601
  appVersion: string;
}

interface Project {
  format: "clothespin-studio-project";
  version: number;       // スキーマバージョン（現行: 1）
  unit: "mm";
  meta: ProjectMeta;
  palette: PaletteColor[];
  pins: Pin[];
}
```

## 2. プロジェクトファイル（独自 JSON, .clothespin.json）

再編集可能な一次保存形式。`Project` をそのまま直列化する。

### 2.1 例

```json
{
  "format": "clothespin-studio-project",
  "version": 1,
  "unit": "mm",
  "meta": {
    "name": "My Tower",
    "createdAt": "2026-06-10T03:21:00.000Z",
    "modifiedAt": "2026-06-10T04:02:11.000Z",
    "appVersion": "0.1.0"
  },
  "palette": [
    { "id": "blue",  "name": "ブルー",   "hex": "#1f6fe0" },
    { "id": "red",   "name": "レッド",   "hex": "#e23b3b" },
    { "id": "yellow","name": "イエロー", "hex": "#f4c430" }
  ],
  "pins": [
    {
      "id": "p1",
      "colorId": "blue",
      "connection": null,
      "transform": {
        "position": [0, 0, 0],
        "rotation": [0, 0, 0, 1]
      }
    },
    {
      "id": "p2",
      "colorId": "red",
      "connection": { "parentId": "p1", "gripIndex": 3, "roll": 90, "flip": false }
    },
    {
      "id": "p3",
      "colorId": "yellow",
      "connection": { "parentId": "p1", "gripIndex": 5, "roll": 0, "flip": true }
    }
  ]
}
```

### 2.2 バリデーション / 整合性ルール

読込時に以下を検証し、違反は警告・修復または読込拒否する。

- `connection.parentId` が存在し、自分自身でない。
- 接続グラフに **閉路がない**（フォレストである）。
- 同一 `(parentId, gripIndex)` の重複（ソケット二重占有）がない。
- ルートピン（`connection: null`）は `transform` を持つ。
- `colorId` が `palette` に存在する（無ければ既定色にフォールバック）。
- `gripIndex` が有効範囲内（`0 … N-1`）。

### 2.3 バージョニング

- `version` を必須とし、読込時に現行スキーマへマイグレーションする（NFR-5）。
- マイグレーション関数を `version` ごとにチェーンする（`v1→v2→…`）。
- `gripIndex` は [02](02-clothespin-spec.md) の正準ソケット順に依存するため、
  ソケット定義を変える場合は **新 version + マイグレーション** を必須とする。

## 3. 部品リスト（BOM, CSV）

実際に組むための買い物リスト / 教材用。色別個数と合計を出力。

### 3.1 列定義

| 列 | 内容 |
| --- | --- |
| `color_id` | パレット ID |
| `color_name` | 表示名 |
| `hex` | カラーコード |
| `count` | 個数 |

末尾に合計行（`color_id=TOTAL`）を付ける。

### 3.2 例

```csv
color_id,color_name,hex,count
blue,ブルー,#1f6fe0,128
red,レッド,#e23b3b,64
yellow,イエロー,#f4c430,32
TOTAL,,,224
```

- 文字コード: UTF-8（BOM 付きを既定 / Excel での文字化け回避。設定で無 BOM 可）。
- 改行: CRLF。フィールドは必要に応じ RFC 4180 でクオート。

## 4. 3D モデル出力

表示用の組み上がりメッシュを書き出す。再編集用ではない（編集は §2 JSON を使う）。

### 4.1 glTF（.glb）— FR-IO4

- Three.js `GLTFExporter` を使用。バイナリ `.glb` を既定。
- 色はマテリアルとして埋め込む（パレット色ごとにマテリアル分割）。
- 単位は m に変換（glTF 慣例。1mm = 0.001m）。スケール方針はオプション化。
- 大量ピンは色ごとにメッシュをマージして出力サイズ・ノード数を抑える。

### 4.2 STL — FR-IO5

- Three.js `STLExporter` を使用。バイナリ STL を既定。
- 色情報なし（STL の制約）。3D プリント / 形状確認用途。
- 全ピンを 1 ソリッドとして結合して書き出す。

## 5. 画像出力（PNG）— FR-IO6

- 現在の WebGL キャンバスを `toDataURL("image/png")` で書き出す。
- 解像度はビューポート等倍を既定、2x / 4x の高解像度オプションを用意。
- 背景透過オプション（クリア時のアルファ保持）。

## 6. 自動バックアップ（localStorage）— FR-IO7

- 一定間隔 / 操作後デバウンスで現在の `Project` を localStorage に保存。
- 起動時に未保存バックアップがあれば復元を提案。
- 外部送信は行わない（NFR-10）。

## 7. ファイル拡張子・MIME 一覧

| 形式 | 拡張子 | MIME |
| --- | --- | --- |
| プロジェクト | `.clothespin.json` | `application/json` |
| 部品表 | `.csv` | `text/csv` |
| 3D（glTF バイナリ） | `.glb` | `model/gltf-binary` |
| 3D（STL） | `.stl` | `model/stl`（慣例） |
| 画像 | `.png` | `image/png` |
