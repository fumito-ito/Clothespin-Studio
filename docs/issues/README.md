# Issue 管理（リポジトリ内）

Issue は GitHub Issues ではなく本ディレクトリで管理する。**1 Issue = 1 ファイル**
（並列セッション/worktree で編集が衝突しないため）。

## ファイル形式

ファイル名: `NNNN-slug.md`（4 桁ゼロ埋め連番。既存最大 + 1 で採番）

```markdown
---
id: 1
title: 短いタイトル
status: open        # open | in-progress | done | wontfix
depends: []          # 依存する issue id（例: [1, 2]）
branch:              # 着手時にブランチ名を記入
pr:                  # マージ後に PR URL を記入
created: YYYY-MM-DD
---

## 目的
## 受入基準
- [ ] 検証可能な条件で書く
## 参照
```

## ワークフロー

1. **起票**: 上記形式でファイルを追加（status: open）
2. **着手**: `issue/NNNN-slug` ブランチを切り、frontmatter を `status: in-progress` + `branch:` 記入
3. **完了**: PR マージ後、`status: done` + `pr:` 記入（PR 内で更新してよい）

## 一覧の確認

インデックスファイルは持たない（並列更新で衝突するため）。一覧はコマンドで取る:

```bash
grep -H "^status:\|^title:" docs/issues/*.md   # 全 issue の状態
grep -l "status: open" docs/issues/*.md         # open のみ
```

## 並列作業の原則

- Issue 単位でブランチ/worktree を分ける。**同一 Issue を複数セッションで同時に触らない**
- `depends:` が未完了の Issue には着手しない
