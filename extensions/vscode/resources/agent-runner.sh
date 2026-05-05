#!/usr/bin/env bash
set +e

WORKSPACE="$1"
PROMPT_FILE="$2"
CODEX_COMMAND="${3:-codex}"
CODEX_MODEL="${4:-gpt-5.5}"
GEMINI_COMMAND="${5:-gemini}"
AUTO_FALLBACK="${6:-true}"

if [ -z "$WORKSPACE" ] || [ -z "$PROMPT_FILE" ]; then
  echo "[AI Agent] Thiếu WORKSPACE hoặc PROMPT_FILE."
  exit 2
fi

if [ ! -d "$WORKSPACE" ]; then
  echo "[AI Agent] Workspace không tồn tại: $WORKSPACE"
  exit 2
fi

if [ ! -f "$PROMPT_FILE" ]; then
  echo "[AI Agent] Prompt file không tồn tại: $PROMPT_FILE"
  exit 2
fi

cd "$WORKSPACE" || exit 2

echo "[AI Agent] Workspace: $WORKSPACE"
echo "[AI Agent] Prompt: $PROMPT_FILE"
echo "[AI Agent] Ưu tiên Codex: $CODEX_COMMAND ($CODEX_MODEL)"

run_codex() {
  local prompt
  prompt="$(cat "$PROMPT_FILE")"
  local args=(exec --cd "$WORKSPACE" --model "$CODEX_MODEL")

  if [ -n "$AI_AGENT_CODEX_PROFILE" ]; then
    args+=(--profile "$AI_AGENT_CODEX_PROFILE")
  fi

  "$CODEX_COMMAND" "${args[@]}" "$prompt"
}

run_gemini() {
  local prompt
  prompt="$(cat "$PROMPT_FILE")"
  "$GEMINI_COMMAND" -p "$prompt"
}

if command -v "$CODEX_COMMAND" >/dev/null 2>&1; then
  run_codex
  CODEX_STATUS=$?
  if [ "$CODEX_STATUS" -eq 0 ]; then
    echo "[AI Agent] Codex hoàn tất."
    exit 0
  fi
  echo "[AI Agent] Codex lỗi hoặc hết token/quota. Mã lỗi: $CODEX_STATUS"
else
  CODEX_STATUS=127
  echo "[AI Agent] Không tìm thấy Codex CLI: $CODEX_COMMAND"
fi

if [ "$AUTO_FALLBACK" != "true" ]; then
  echo "[AI Agent] Gemini fallback đang tắt."
  exit "$CODEX_STATUS"
fi

echo "[AI Agent] Chuyển sang Gemini fallback: $GEMINI_COMMAND"
if command -v "$GEMINI_COMMAND" >/dev/null 2>&1; then
  run_gemini
  GEMINI_STATUS=$?
  if [ "$GEMINI_STATUS" -eq 0 ]; then
    echo "[AI Agent] Gemini hoàn tất."
  else
    echo "[AI Agent] Gemini lỗi. Mã lỗi: $GEMINI_STATUS"
  fi
  exit "$GEMINI_STATUS"
fi

echo "[AI Agent] Không tìm thấy Gemini CLI. Cài Gemini CLI hoặc kiểm tra cấu hình aiAgent.geminiCommand."
exit "$CODEX_STATUS"
