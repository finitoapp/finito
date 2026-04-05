---
name: finito-commit
description: Review the current Git worktree in the Finito repository and create one commit for the current changeset. Use when the user asks to commit current work, generate a commit message from the actual diff, or finish a task by staging and committing files. Prefer this skill only when the intent is a single commit for the current worktree; if the user wants multiple commits, selective staging, or exclusions, clarify first.
---

# Finito Commit

Commit the current Finito worktree as one coherent changeset.
Inspect the actual diff first, then derive a conventional commit message from the content.

## Workflow

1. Inspect Git state before staging:
- Run `git status --short`.
- If there are no changes, report that and stop.
- If the worktree clearly mixes unrelated concerns, ask whether to split the commit instead of forcing one message.

2. Read enough of the diff to understand the real change:
- Run `git diff --stat` and `git diff --cached --stat`.
- Open representative changed files or focused diffs for the main areas.
- Base the commit message on behavior and intent, not only filenames.

3. Build the commit message with conventional-commit rules:
- Read [../conventional-commit/SKILL.md](../conventional-commit/SKILL.md) before composing the message.
- Follow its allowed types, imperative description style, scope guidance, and breaking-change rules.
- Prefer the narrowest useful scope, usually the Finito feature or subsystem touched by most of the diff.
- Use `refactor` for structural/internal improvements without intended behavior change, `feat` for new behavior, `fix` for bug fixes, and `chore` only for maintenance work.

4. Stage and commit non-interactively:
- Stage the intended worktree with `git add -A` unless the user requested a narrower commit.
- Commit with `git commit -m "type(scope): description"` when a title is enough.
- If body or footer materially help, use repeated `-m` flags instead of opening an editor.

5. Handle failures pragmatically:
- If `git commit` fails because of hooks or formatting checks, inspect the output.
- Fix issues that are directly caused by the current changeset when reasonable.
- If a blocker is outside the task scope, report it clearly instead of guessing.

6. Report the result:
- Return the final commit message.
- Summarize the main areas included in the commit.
- Mention any intentionally uncommitted files if the user asked for exclusions.

## Guardrails

- Do not amend, rebase, squash, or rewrite commits unless the user explicitly asks.
- Do not use interactive Git flows.
- Do not commit when the user asked only for review or for a proposed message.
- Do not silently exclude relevant untracked files from the current changeset.
- Do not invent a generic commit message before inspecting the diff.
