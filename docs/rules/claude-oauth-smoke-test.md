# Claude OAuth Smoke Test

## Purpose
- Validate whether Claude Code GitHub Action can run using `CLAUDE_CODE_OAUTH_TOKEN` without `ANTHROPIC_API_KEY`.
- Keep this separate from the normal remote fallback workflow.
- This is a retained experiment, not the active operating path.

## Required secret
- `CLAUDE_CODE_OAUTH_TOKEN`

## Workflow
- File: `.github/workflows/claude-oauth-smoke-test.yml`
- Trigger: manual only (`workflow_dispatch`)

## Test intent
- Run Claude Code Action once
- Read the repository only
- Confirm authentication worked
- Avoid editing files

## How to use
1. Add `CLAUDE_CODE_OAUTH_TOKEN` to repository secrets.
2. Open GitHub Actions.
3. Run `Claude OAuth Smoke Test`.
4. Check whether the Claude action step succeeds.
5. Confirm there were no code changes or PR attempts.

## Interpretation
- If the workflow succeeds without `ANTHROPIC_API_KEY`, OAuth-based execution is at least technically viable in this repository.
- If it fails at authentication, keep treating the current remote fallback as API-key-based.
- Even if it succeeds technically, billing behavior should still be verified separately in Anthropic account usage/billing views before relying on it for cost assumptions.

## Current status
- The repository's active remote fallback path remains `ANTHROPIC_API_KEY`-based.
- Keep this workflow for future verification only.
