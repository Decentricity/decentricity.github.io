#!/usr/bin/env bash
# shellbot.sh
# natural language to bash using pollinations text api (GET style)
# usage:
#   bash shellbot.sh --install     # install as "shellbot" into your PATH
#   bash shellbot.sh --uninstall   # remove installed "shellbot"
#   shellbot "do something"        # after install
#   shellbot                       # interactive prompt

set -euo pipefail

API_BASE="https://text.pollinations.ai"
MODEL="openai"    # change if you want another model id
OUTFILE="pollinations_generated.sh"
INSTALL_NAME="shellbot"
SHELLBOT_URL="https://decentricity.github.io/shellbot.sh"

# ---------- install / uninstall helpers ----------

detect_target_dir() {
  # termux: prefer PREFIX/bin
  if [ -n "${PREFIX-}" ] && [[ "$PREFIX" == *com.termux* ]]; then
    echo "$PREFIX/bin"
    return
  fi

  # per-user locations
  if [ -d "$HOME/.local/bin" ] || mkdir -p "$HOME/.local/bin" 2>/dev/null; then
    echo "$HOME/.local/bin"
    return
  fi

  if [ -d "$HOME/bin" ] || mkdir -p "$HOME/bin" 2>/dev/null; then
    echo "$HOME/bin"
    return
  fi

  # system-wide if writable
  if [ -w "/usr/local/bin" ]; then
    echo "/usr/local/bin"
    return
  fi

  echo ""
}

resolve_self_path() {
  # best effort absolute path to this script
  local src="${BASH_SOURCE[0]:-$0}"

  if command -v readlink >/dev/null 2>&1; then
    local rl
    rl="$(readlink -f "$src" 2>/dev/null || readlink "$src" 2>/dev/null || true)"
    if [ -n "$rl" ]; then
      src="$rl"
    fi
  fi

  case "$src" in
    /*) echo "$src" ;;
    *)
      echo "$(pwd)/$src"
      ;;
  esac
}

install_self() {
  local target_dir
  target_dir="$(detect_target_dir)"

  if [ -z "$target_dir" ]; then
    echo "could not find a writable bin dir to install into."
    echo "please copy this script manually into a directory that is in your PATH."
    exit 1
  fi

  mkdir -p "$target_dir"

  local src target
  src="$(resolve_self_path)"
  target="$target_dir/$INSTALL_NAME"

  if [ -f "$src" ]; then
    cp "$src" "$target"
  else
    echo "could not resolve script file on disk, downloading from ${SHELLBOT_URL}"
    curl -fsSL "$SHELLBOT_URL" -o "$target"
  fi

  chmod +x "$target"

  echo "installed shellbot as:"
  echo "  $target"

  case ":$PATH:" in
    *:"$target_dir":*)
      echo "looks like $target_dir is already in your PATH."
      ;;
    *)
      echo
      echo "note: $target_dir does not seem to be in your PATH."
      echo "add this line to your shell rc (for example ~/.bashrc or ~/.zshrc):"
      echo "  export PATH=\"$target_dir:\$PATH\""
      ;;
  esac

  exit 0
}

uninstall_self() {
  local removed=0
  local oldifs="$IFS"
  IFS=':'
  for dir in $PATH; do
    IFS="$oldifs"
    [ -z "$dir" ] && { IFS=':'; continue; }
    local candidate="$dir/$INSTALL_NAME"
    if [ -f "$candidate" ]; then
      rm -f "$candidate"
      echo "removed $candidate"
      removed=1
    fi
    IFS=':'
  done
  IFS="$oldifs"

  if [ "$removed" -eq 0 ]; then
    echo "no \"$INSTALL_NAME\" found in PATH to remove."
  fi

  exit 0
}

# handle install / uninstall early and bail out
if [ "${1-}" = "--install" ]; then
  shift
  install_self
fi

if [ "${1-}" = "--uninstall" ]; then
  shift
  uninstall_self
fi

# ---------- general helpers ----------

urlencode() {
  # use python for robust url encoding
  python3 - <<'PY' "$1"
import sys, urllib.parse
print(urllib.parse.quote(sys.argv[1]))
PY
}

strip_markdown_fences() {
  # if response contains ``` blocks, extract only the fenced part
  if grep -q '```' <<<"$1"; then
    awk '
      BEGIN { inblock=0 }
      /```/ {
        if (inblock) exit
        inblock=1
        next
      }
      inblock { print }
    ' <<<"$1"
  else
    printf '%s\n' "$1"
  fi
}

# ---------- main shellbot logic ----------

if (( $# > 0 )); then
  USER_REQUEST="$*"
else
  printf 'describe what you want to do in the filesystem:\n> '
  IFS= read -r USER_REQUEST
fi

if [[ -z "${USER_REQUEST// }" ]]; then
  echo "no request given, exiting."
  exit 0
fi

PROMPT="$(cat <<EOF
you are an expert linux shell engineer.

task: write a bash script that fulfills the following user request:

\"${USER_REQUEST}\"

requirements:
- output ONLY the bash script source code.
- no markdown, no code fences, no explanation, no comments from you.
- assume this script will be saved to a file and run as:
    bash script.sh
- include this near the top:
    set -euo pipefail
- assume current working directory is where the script lives and runs.
- avoid obviously destructive commands like wiping disks or rm -rf /.
- do not ask the user for more input inside the script.
- just implement the requested behavior directly.
EOF
)"

echo
echo "contacting pollinations for a bash script..."

ENCODED_PROMPT="$(urlencode "$PROMPT")"

RESPONSE="$(
  curl -sS "${API_BASE}/${ENCODED_PROMPT}?model=${MODEL}"
)"

SCRIPT_BODY="$(strip_markdown_fences "$RESPONSE")"
SCRIPT_BODY="${SCRIPT_BODY#"${SCRIPT_BODY%%[!$'\n']*}"}"  # trim leading newlines

if [[ -z "${SCRIPT_BODY// }" ]]; then
  echo "empty script returned from pollinations."
  exit 1
fi

# ensure shebang
if [[ "${SCRIPT_BODY}" != '#!'* ]]; then
  SCRIPT_BODY="#!/usr/bin/env bash
${SCRIPT_BODY}"
fi

SCRIPT_PATH="$(pwd)/${OUTFILE}"
printf '%s\n' "$SCRIPT_BODY" > "$SCRIPT_PATH"
chmod +x "$SCRIPT_PATH"

echo
echo "=== generated bash script (${SCRIPT_PATH}) ==="
echo
printf '%s\n' "$SCRIPT_BODY"
echo
echo "=== end of script ==="

read -r -p $'\nrun this script now? [y/N] ' ANSWER
case "$ANSWER" in
  y|Y)
    echo
    echo "running script: ${SCRIPT_PATH}"
    echo
    if ! bash "$SCRIPT_PATH"; then
      status=$?
      echo
      echo "script exited with nonzero status: ${status}"
      exit "$status"
    fi
    echo
    echo "script completed successfully."
    ;;
  *)
    echo
    echo "skipping execution. you can run it later with:"
    echo "  bash ${SCRIPT_PATH}"
    ;;
esac