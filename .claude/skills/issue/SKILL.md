---
name: issue
description: docs/issues の Issue に着手または完了処理をする。着手は既定で下位モデルの implementer サブエージェントへ委任し、このセッション（上位モデル）は選定・レビュー・フィードバックに徹する。
disable-model-invocation: true
---

# Issue ワークフロー: $ARGUMENTS

`$ARGUMENTS` は Issue 番号（例: `1`）、`<番号> done`（完了処理）、`<番号> solo`（委任せず自分で実装）。

## 着手（`/issue NNNN`）— 既定は委任フロー

このセッション（上位モデル）の仕事は **①モデル選定 ②レビュー ③フィードバック** のみ。
実装は implementer サブエージェント（`.claude/agents/implementer.md`）に委任する。

1. **準備**: `docs/issues/` の該当ファイルを読み、`depends:` の各 Issue が `status: done` か確認
   （未完了なら着手せず報告して止まる）。統合ブランチ（現行: `develop/generate-from-image`）を
   最新化し `issue/NNNN-<slug>` ブランチを作成。frontmatter を `status: in-progress` +
   `branch:` に更新してコミット。
2. **モデル選定**: 受入基準から実装担当モデルを決め、**選定理由を 1 行でユーザーに報告**する。
   - `haiku`: 機械的な作業（リネーム・文言・docs・定型的な配線・frontmatter 更新）
   - `sonnet`（既定）: 受入基準が明確な通常実装
   - `opus` または solo: 新規アルゴリズム・連結幾何・設計判断を含むもの
3. **委任**: implementer を選定モデルで起動する。プロンプトは**自己完結**にする —
   Issue 本文全文（受入基準含む）/ 作業ブランチ名 / 検証コマンド 4 点 / コミット禁止の注意。
4. **レビュー**（上位モデルの本務）:
   - 報告と `git diff` を受入基準と照合し、検証 4 点（lint / format:check / test / build）を自分でも再実行
   - スコープ外変更・テスト不足・幾何の裏取り不足を重点的に見る
   - 指摘は **SendMessage で同じエージェントに返す**（文脈維持。新規スポーンしない）
5. **エスカレーション**: レビュー 2 往復で解決しない場合、モデルを 1 段上げて再委任するか
   自分で引き取る。どちらにするか理由付きで報告する。
6. **確定**: レビュー通過後、このセッションがコミットして「完了」フローへ。

複数 Issue を 1 セッションで並列に回す場合は、implementer を `run_in_background` +
worktree 分離で複数起動し、完了順にレビューする（依存のない Issue に限る）。

## 完了（`/issue NNNN done`）

1. 受入基準のチェックボックスを、それぞれの**検証結果（実測値・テスト名）付き**で埋める。
2. 検証 4 点をすべて通す。
3. コミット（英語）→ push → 統合ブランチ宛に PR を作成（英語）。
4. 同じ PR 内で frontmatter を `status: done`・`pr: <URL>` に更新する。
