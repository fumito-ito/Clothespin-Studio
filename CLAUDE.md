# Clothespin Studio

洗濯バサミ（39×60×12mm）を連結して大型立体物を設計する Web アプリ（BrickLink Studio の洗濯バサミ版）。
**クライアント完結・外部送信なし（NFR-10）が絶対制約**。サーバ/ML/外部 API は導入しない。

## コマンドと検証

- `npm run dev` / `npm test` / `npm run lint` / `npm run format:check` / `npm run build`
- 変更後は CI と同じ 4 点を通すこと: `lint` → `format:check` → `test` → `build`
- `src/` の ts/tsx/css は PostToolUse hook が prettier を自動適用する（他ディレクトリは対象外なので注意）

## アーキテクチャ

- `src/domain/` 純ロジック（制約は path ルールで注入）/ `src/scene/` R3F 描画 /
  `src/state/` zustand+zundo / `src/io/` 入出力 / `src/ui/` パネル
- 設計文書は `docs/01`〜`07`。`07` が構築モデルと現行ロードマップ（`develop/generate-from-image` 上）

## 規約

- コードコメント・docs・Issue = 日本語 / コミットメッセージ・PR = 英語
- commit / push はユーザーが指示したときのみ
- PR レビューは GitHub（Copilot レビューが自動で付く）。squash マージ推奨

## ブランチと Issue

- `main` = 安定・デプロイ。機能は `develop/<feature>` 統合ブランチへ feature ブランチから PR
- Issue はリポジトリ内 `docs/issues/`（1 Issue = 1 ファイル。運用は docs/issues/README.md）。GitHub Issues は使わない
- 並列作業は git worktree + Issue 単位でブランチを分ける。同一 Issue を複数セッションで触らない
