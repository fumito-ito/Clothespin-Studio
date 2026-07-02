---
name: issue
description: docs/issues の Issue に着手または完了処理をする。着手 = ブランチ作成 + status 更新、完了 = 検証 + PR + frontmatter 更新。
disable-model-invocation: true
---

# Issue ワークフロー: $ARGUMENTS

`$ARGUMENTS` は Issue 番号（例: `1`）または `<番号> done`（完了処理）。

## 着手（`/issue NNNN`）

1. `docs/issues/` の該当ファイルを読み、`depends:` の各 Issue が `status: done` か確認する。
   未完了の依存があれば**着手せず**報告して止まる。
2. 対象の統合ブランチ（現行: `develop/generate-from-image`）を pull で最新化し、
   `issue/NNNN-<slug>` ブランチを作成する。
3. Issue の frontmatter を `status: in-progress`・`branch: issue/NNNN-<slug>` に更新してコミットする。
4. 受入基準を作業計画に落として実装を始める。判断が要る点は先にユーザーへ確認する。

## 完了（`/issue NNNN done`）

1. 受入基準のチェックボックスを、それぞれの**検証結果（実測値・テスト名）付き**で埋める。
2. `npm run lint` → `npm run format:check` → `npm test` → `npm run build` をすべて通す。
3. コミット（英語）→ push → 統合ブランチ宛に PR を作成（英語）。
4. 同じ PR 内で frontmatter を `status: done`・`pr: <URL>` に更新する。
