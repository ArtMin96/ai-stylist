#!/usr/bin/env bash
# PreToolUse guard for ONE agent's Bash commands. Wired from the agent's own frontmatter
# (.claude/agents/<name>.md `hooks:` → matcher "Bash", exec form) with the agent's allowed command
# patterns as args:
#   guard-agent-bash.sh PATTERN...
# A `Bash(just:*)` specifier in an agent's `tools:` does not restrict Bash, so this hook is the
# per-agent limit. The command is split into simple commands on UNQUOTED && || ; | |& & and
# newlines (quote-, backslash- and comment-aware: `rg -n "a|b"` is one command). Every simple
# command, minus leading VAR=value words, must glob-match ([[ == ]]) the read-only BASELINE below
# or one PATTERN; `cd <dir>` and bare assignments always pass. Denied outright: $( ) and backticks
# (also inside double quotes), <( ) and >( ), output redirection other than to /dev/null or an fd
# duplication (2>&1, >&2), find -delete/-exec/-execdir/-ok/-okdir/-fprint*/-fls, rg --pre,
# sort -o/--output, git --output (git diff/log/show write a file with it), VAR= prefixes that change
# what runs (PATH, BASH_ENV, GIT_*, LD_*, ...) and VAR= prefixes that repoint a recipe at another
# database or credential (DATABASE_URL, *_URL, *_TOKEN, *_KEY, *_SECRET). No jq → deny (fail
# closed). Never writes anything itself.
#
# Not a sandbox: an allowed command's own behaviour (a `just` recipe, `uniq IN OUT`, a variable
# expanding to flags) is trusted. It scopes cooperating agents; the repo-wide guard-bash.sh and
# .claude/settings.json permissions still apply on top.
set -uo pipefail
export LC_ALL=C # byte-wise string indexing: fast and predictable

if ! command -v jq >/dev/null 2>&1; then
  while IFS= read -r _; do :; done
  printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"jq is not installed, so the per-agent Bash guard cannot inspect this command (fail closed). Report the command you need under Blockers: jq must be installed."}}'
  exit 0
fi

input="$(cat)"
agent="$(jq -r '.agent_type // "this agent"' <<<"$input")"
command="$(jq -r '.tool_input.command // empty' <<<"$input")"
[[ -n "$command" ]] || exit 0

BASELINE=(
  'pwd' 'ls' 'ls *' 'cat *' 'head *' 'tail *' 'wc *' 'rg *' 'grep *' 'jq *' 'sort*' 'uniq*'
  'cut *' 'tr *' 'diff *' 'file *' 'stat *' 'basename *' 'dirname *' 'echo*' 'printf *'
  'test *' 'true' 'false' 'date*' 'just --summary' 'just --list*'
  'git status*' 'git diff*' 'git log*' 'git show*' 'git rev-parse*' 'git merge-base*'
  'git ls-files*' 'git blame*' 'git branch --show-current' 'git worktree list*' 'find *'
)
PATTERNS=("${BASELINE[@]}" "$@")

deny() {
  local list="" p
  for p in "${PATTERNS[@]}"; do list="${list:+$list, }$p"; done
  jq -nc --arg reason "$1 $agent may run only simple commands matching: $list (plus cd <dir> and VAR=value prefixes), joined by && || ; | or newlines. Report the command you need under Blockers." \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'
  exit 0
}

n=${#command}
[[ $n -le 20000 ]] || deny "Command is too long to inspect ($n bytes)."

# check_command WORD... — one simple command, quotes already removed from each word.
check_command() {
  local -a w
  w=("$@")
  local k=0 name prog joined x p
  while [[ $k -lt ${#w[@]} && "${w[k]}" =~ ^([A-Za-z_][A-Za-z0-9_]*)= ]]; do
    name="${BASH_REMATCH[1]}"
    case "$name" in
      PATH | BASH_ENV | ENV | IFS | SHELLOPTS | BASHOPTS | PS4 | PROMPT_COMMAND | CDPATH | GLOBIGNORE | \
        LD_* | DYLD_* | GIT_* | *PAGER* | *EDITOR* | VISUAL | JUST_* | NODE_OPTIONS | PYTHON* | RUBYOPT | PERL5OPT)
        deny "Setting $name changes which program runs or injects code." ;;
      DATABASE_URL | *_URL | *_TOKEN | *_KEY | *_SECRET)
        deny "Setting $name repoints a recipe at another database, service or credential." ;;
    esac
    k=$((k + 1))
  done
  [[ $k -lt ${#w[@]} ]] || return 0 # bare assignments only
  prog="${w[k]}"
  [[ "$prog" =~ [[:space:]] ]] && deny "Command name '$prog' contains whitespace."
  [[ "$prog" == cd ]] && return 0
  joined="$prog"
  for x in "${w[@]:k+1}"; do joined="$joined $x"; done
  for x in "${w[@]:k+1}"; do
    case "$prog:$x" in
      find:-delete | find:-exec | find:-execdir | find:-ok | find:-okdir | find:-fls | find:-fprint*)
        deny "find $x writes, deletes or runs commands." ;;
      rg:--pre | rg:--pre=*) deny "rg --pre runs a program on every searched file." ;;
      sort:-o* | sort:--output | sort:--output=* | sort:-[a-zA-Z]*o*) deny "sort -o writes a file." ;;
      git:--output | git:--output=*) deny "git --output writes a file." ;;
    esac
  done
  for p in "${PATTERNS[@]}"; do
    # shellcheck disable=SC2053  # the patterns are globs on purpose
    [[ "$joined" == $p ]] && return 0
  done
  deny "'$joined' is not an allowed command."
}

words=()  # words of the current simple command, quotes removed
word=""   # the word being built
inword=0  # 1 once the word has content or a (possibly empty) quoted part
last=""   # previous unquoted raw character; "" at the start of a simple command
q=""      # quote state: "" unquoted, s '...', d "...", a $'...'
target="" # read_target output
ti=0      # read_target output: index just past the target

end_word() {
  [[ $inword -eq 1 ]] && words+=("$word")
  word=""
  inword=0
}
end_command() {
  end_word
  [[ ${#words[@]} -gt 0 ]] && check_command "${words[@]}"
  words=()
  last=""
}
# read_target INDEX — the redirection target word starting at INDEX (after blanks).
read_target() {
  local ch
  ti=$1
  while [[ "${command:ti:1}" == " " || "${command:ti:1}" == $'\t' ]]; do ti=$((ti + 1)); done
  target=""
  while [[ $ti -lt $n ]]; do
    ch="${command:ti:1}"
    case "$ch" in ' ' | $'\t' | $'\n' | ';' | '&' | '|' | '<' | '>' | '(' | ')') break ;; esac
    target+="$ch"
    ti=$((ti + 1))
  done
  case "$target" in *\'* | *\"* | *\\* | *'$'* | *'`'*)
    deny "Quoted or dynamic redirection target '$target' is not allowed." ;;
  esac
}
# redirect_to_null INDEX — an output redirection whose target starts at INDEX must be /dev/null.
redirect_to_null() {
  read_target "$1"
  [[ "$target" == /dev/null ]] ||
    deny "Output redirection to '${target:-<nothing>}' is not allowed (only /dev/null and fd duplication such as 2>&1)."
}

i=0
while [[ $i -lt $n ]]; do
  c="${command:i:1}"
  nxt="${command:i+1:1}"
  case "$q" in
    s)
      if [[ "$c" == "'" ]]; then q="" last="'"; else word+="$c"; fi
      i=$((i + 1))
      continue
      ;;
    a)
      if [[ "$c" == "\\" ]]; then word+="$nxt"; i=$((i + 2)); continue; fi
      if [[ "$c" == "'" ]]; then q="" last="'"; else word+="$c"; fi
      i=$((i + 1))
      continue
      ;;
    d)
      case "$c" in
        '"') q="" last='"' ;;
        '`') deny "Command substitution (backticks) is not allowed." ;;
        '$')
          [[ "$nxt" == "(" ]] && deny "Command substitution \$( ) is not allowed."
          word+="$c"
          ;;
        "\\")
          case "$nxt" in
            '"' | "\\" | '$' | '`') word+="$nxt"; i=$((i + 1)) ;;
            $'\n') i=$((i + 1)) ;;
            *) word+="$c" ;;
          esac
          ;;
        *) word+="$c" ;;
      esac
      i=$((i + 1))
      continue
      ;;
  esac

  case "$c" in
    "'") q=s inword=1 ;;
    '"') q=d inword=1 ;;
    "\\")
      if [[ "$nxt" != $'\n' ]]; then word+="$nxt"; inword=1; fi
      i=$((i + 2))
      last="\\"
      continue
      ;;
    '`') deny "Command substitution (backticks) is not allowed." ;;
    '$')
      case "$nxt" in
        '(') deny "Command substitution \$( ) is not allowed." ;;
        "'") q=a inword=1 i=$((i + 1)) ;;
        '"') q=d inword=1 i=$((i + 1)) ;;
        *) word+="$c" inword=1 ;;
      esac
      ;;
    '#')
      case "$last" in
        '' | ' ' | $'\t' | ';' | '&' | '|' | '(' | ')' | '<' | '>')
          while [[ $i -lt $n && "${command:i:1}" != $'\n' ]]; do i=$((i + 1)); done
          continue
          ;;
        *) word+="$c" inword=1 ;;
      esac
      ;;
    ' ' | $'\t') end_word ;;
    ';' | $'\n') end_command; i=$((i + 1)); continue ;;
    '|')
      end_command
      if [[ "$nxt" == "|" || "$nxt" == "&" ]]; then i=$((i + 2)); else i=$((i + 1)); fi
      continue
      ;;
    '&')
      if [[ "$nxt" == ">" ]]; then # &> and &>> redirect stdout and stderr
        end_word
        j=$((i + 2))
        [[ "${command:j:1}" == ">" ]] && j=$((j + 1))
        redirect_to_null "$j"
        i=$ti
        last=" "
        continue
      fi
      end_command
      if [[ "$nxt" == "&" ]]; then i=$((i + 2)); else i=$((i + 1)); fi
      continue
      ;;
    '<')
      [[ "$nxt" == "(" ]] && deny "Process substitution <( ) is not allowed."
      if [[ "$nxt" == ">" ]]; then # <> opens the target read-write
        end_word
        redirect_to_null $((i + 2))
        i=$ti
        last=" "
        continue
      fi
      word+="$c"
      inword=1
      ;;
    '>')
      [[ "$nxt" == "(" ]] && deny "Process substitution >( ) is not allowed."
      # An fd number glued to the operator (2>, 1>>) belongs to the redirection, not to the words.
      if [[ $inword -eq 1 && "$word" =~ ^[0-9]+$ && "$last" =~ [0-9] ]]; then
        word=""
        inword=0
      else
        end_word
      fi
      j=$((i + 1))
      case "${command:j:1}" in
        '>' | '|') j=$((j + 1)); redirect_to_null "$j" ;;
        '&')
          read_target $((j + 1))
          [[ "$target" =~ ^([0-9]+|-)$ || "$target" == /dev/null ]] ||
            deny "Output redirection to '${target:-<nothing>}' is not allowed (only /dev/null and fd duplication such as 2>&1)."
          ;;
        *) redirect_to_null "$j" ;;
      esac
      i=$ti
      last=" "
      continue
      ;;
    *) word+="$c" inword=1 ;;
  esac
  last="$c"
  i=$((i + 1))
done

[[ -z "$q" ]] || deny "Unterminated quote."
end_command
exit 0
