#!/usr/bin/env bash
# `just repo-setup name [--apply] [--from OWNER/REPO]...`: re-point this repository's own name in
# tracked files after it was renamed, transferred or moved to a new GitHub repository
# (docs/NEW-REPO-SETUP.md section 4; guide: tools/github/README.md).
#
# Without --apply (or with --check): a report, nothing is written. It lists every tracked line that
# names this project's repository under another OWNER/REPO than the one `origin` points at, and
# exits 1 when there is one. --apply rewrites exactly those lines to origin's OWNER/REPO; a second
# run finds nothing. No network: the local git config and tracked files are all it reads.
#
# Which name counts as "another name of this repository". Tracked files link to many third-party
# GitHub repositories, so "any github.com/OWNER/REPO that is not origin" would be wrong. The names
# looked for are:
#   - the one the tracked files use today: OWNER/REPO in RUNBOOK_URL_PREFIX of
#     tools/observability/check.mjs. `just observability-sync all --check` (in ci-parity) rejects
#     an alert whose runbook link does not start with that prefix, so that one line cannot drift
#     from the alert definitions;
#   - the remote `old-origin`, when it exists (docs/NEW-REPO-SETUP.md section 3 creates it);
#   - every --from OWNER/REPO: for a name an earlier, partial edit left behind.
# A line matches when one of those names follows `github.com/`, `github.com:` or
# `githubusercontent.com/` and ends there (`.git`, a `/`, punctuation or the end of the line may
# follow; `ai-stylist-android` is not `ai-stylist`). Letter case is ignored, as GitHub ignores it.
# When the repository's name changed, and not only its owner, the `cd <old name>` of a clone
# command is rewritten too: on the `git clone` line itself and on the line directly below it.
# Product names (the npm scope, bundle ids, host names, the compose project) are never touched.
#
# Left alone on purpose: the paths listed in tools/github/name-keep.txt, each with its reason
# (history that must keep pointing at where a pull request or a run really lives). The report
# names them and counts their lines.
#
# --quiet prints one line (for `just doctor`, scripts/github-lib.sh doctor_repo_name).
# --apply is owner-run: it rewrites human-only files (README.md, docs/SERVICES-SETUP.md,
# docs/DEVELOPING-ON-MACOS.md) among others, so it refuses inside an AI agent session.
# Exit codes: 0 nothing to re-point, or rewritten · 1 lines found (report), or refused ·
# 2 wrong usage · 3 cannot tell (no github.com origin, or no recorded name).
# Linux + macOS: bash 3.2-clean; POSIX awk does the matching (no sed -i, no grep -P).
set -euo pipefail

# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
# shellcheck source=scripts/github-lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/github-lib.sh"
cd "$REPO_ROOT"

PREFIX_FILE='tools/observability/check.mjs'
KEEP_FILE='tools/github/name-keep.txt'

usage_error() {
    echo "repo-setup name: $1" >&2
    echo "usage: just repo-setup name [--apply] [--from OWNER/REPO]...   (no --apply = report only: lists the lines, writes nothing)" >&2
    exit 2
}

apply=0; check=0; quiet=0; from_list=""; from_flags=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --apply) apply=1 ;;
        --check) check=1 ;;
        --quiet) quiet=1 ;;
        --from)
            [[ $# -ge 2 ]] || usage_error "--from needs OWNER/REPO"
            from="$(github_slug_from_url "https://github.com/$2")" || usage_error "--from needs OWNER/REPO, for example --from old-owner/old-repo"
            from_list="${from_list:+$from_list }$from"
            from_flags="$from_flags --from $from"
            shift
            ;;
        *) usage_error "unknown argument '$1'" ;;
    esac
    shift
done
if [[ $apply -eq 1 && $check -eq 1 ]]; then usage_error "--apply and --check exclude each other"; fi
if [[ $apply -eq 1 && $quiet -eq 1 ]]; then usage_error "--quiet is for the report only"; fi
if [[ $apply -eq 1 ]]; then github_owner_only "just repo-setup name --apply" || exit 1; fi

# cannot_tell <reason>: the one line doctor shows as a note; exit 3.
cannot_tell() {
    if [[ $quiet -eq 1 ]]; then echo "$1"; else echo "repo-setup name: $1" >&2; fi
    exit 3
}

lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

# OWNER/REPO of RUNBOOK_URL_PREFIX in tools/observability/check.mjs; nothing when it is not there.
recorded_slug() {
    [[ -f "$PREFIX_FILE" ]] || return 0
    awk '
        /RUNBOOK_URL_PREFIX[[:space:]]*=/ && match($0, "https://github\\.com/[^/]+/[^/]+/blob/") {
            print substr($0, RSTART + 19, RLENGTH - 25)
            exit
        }' "$PREFIX_FILE"
}

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || cannot_tell "not a git checkout"
new="$(github_origin_slug)" || cannot_tell "origin is missing or is not a github.com remote; check: $GITHUB_ORIGIN_FIX"
new_low="$(lower "$new")"

# The other names of this repository, as written, without duplicates and without origin's name.
olds=""; olds_low=""
add_old() {
    local low
    low="$(lower "$1")"
    [[ "$low" != "$new_low" ]] || return 0
    case " $olds_low " in *" $low "*) return 0 ;; esac
    olds="${olds:+$olds }$1"
    olds_low="${olds_low:+$olds_low }$low"
}
recorded="$(recorded_slug)"
if [[ -z "$recorded" && -z "$from_list" ]]; then
    cannot_tell "cannot read the name tracked files use (RUNBOOK_URL_PREFIX in $PREFIX_FILE); name it: just repo-setup name --from <owner>/<repo>"
fi
if [[ -n "$recorded" ]]; then add_old "$recorded"; fi
if previous="$(github_origin_slug old-origin)"; then add_old "$previous"; fi
for from in $from_list; do add_old "$from"; done

if [[ -z "$olds" ]]; then
    if [[ $quiet -eq 1 ]]; then
        echo "tracked files name the repository origin points at ($new)"
    else
        echo "repo-setup name: tracked files name the repository origin points at ($new) — nothing to re-point"
    fi
    exit 0
fi

# --- the paths that keep the old name on purpose --------------------------------------------------

[[ -f "$KEEP_FILE" ]] || { echo "repo-setup name: $KEEP_FILE not found (the list of paths that keep the old name on purpose)" >&2; exit 1; }
keep_paths=(); keep_reasons=()
while IFS= read -r line || [[ -n "$line" ]]; do
    case "$line" in '' | '#'*) continue ;; esac
    path="${line%%[[:space:]]*}"
    reason="${line#"$path"}"
    reason="${reason#"${reason%%[![:space:]]*}"}"
    keep_paths+=("$path")
    keep_reasons+=("$reason")
done < "$KEEP_FILE"

scan_spec=(.)
i=0
while [[ $i -lt ${#keep_paths[@]} ]]; do
    scan_spec+=(":(exclude)${keep_paths[$i]}")
    i=$((i + 1))
done

# One fixed-string pattern per host form and name: git grep narrows the tree to a few candidate
# files (-I: text files only); the awk below then decides line by line where a name really ends.
grep_patterns=()
for old in $olds_low; do
    grep_patterns+=(-e "github.com/$old" -e "github.com:$old" -e "githubusercontent.com/$old")
done

# shellcheck disable=SC2016  # awk source: $0 and friends are awk's, the shell must not expand them
NAME_AWK='
    function name_char(c) { return c ~ /^[A-Za-z0-9_-]$/ }
    # 1 when a repository name cannot continue at position p of s: the end, a character no name
    # holds, or a dot that only ends a sentence.
    function boundary(s, p,    c, n) {
        c = substr(s, p, 1)
        if (c == "") return 1
        if (name_char(c)) return 0
        if (c != ".") return 1
        n = substr(s, p + 1, 1)
        return (n == "" || !name_char(n))
    }
    function slug_ends(s, p) {
        if (boundary(s, p)) return 1
        return (substr(s, p, 4) == ".git" && boundary(s, p + 4))
    }
    function host_before(s, p,    i, h) {
        for (i = 1; i <= nhost; i++) {
            h = host[i]
            if (p > length(h) && substr(s, p - length(h), length(h)) == h) return 1
        }
        return 0
    }
    # line with every occurrence of old name k, after a GitHub host, replaced by the new name.
    function rewrite(line, k,    o, low, out, i, after) {
        o = old[k]; out = ""; low = tolower(line)
        while ((i = index(low, o)) > 0) {
            after = i + length(o)
            if (host_before(low, i) && slug_ends(low, after)) {
                out = out substr(line, 1, i - 1) new
                hits++; linehit[k] = 1
            } else {
                out = out substr(line, 1, after - 1)
            }
            line = substr(line, after); low = substr(low, after)
        }
        return out line
    }
    # line with the whole word "cd <old repository name k>" replaced by "cd <new repository name>".
    function cd_rewrite(line, k,    tok, low, out, i, after, pre, c) {
        tok = "cd " oldname[k]; out = ""; low = tolower(line)
        while ((i = index(low, tok)) > 0) {
            after = i + length(tok)
            pre = (i == 1) ? " " : substr(low, i - 1, 1)
            c = substr(low, after, 1)
            if (index(" \t;&(`", pre) > 0 && (c == "" || index(" \t\r;&)`", c) > 0)) {
                out = out substr(line, 1, i - 1) "cd " newname
                hits++
            } else {
                out = out substr(line, 1, after - 1)
            }
            line = substr(line, after); low = substr(low, after)
        }
        return out line
    }
    BEGIN {
        mode = ENVIRON["REPO_NAME_MODE"]; file = ENVIRON["REPO_NAME_FILE"]
        nold = split(ENVIRON["REPO_NAME_OLDS"], old, " ")
        new = ENVIRON["REPO_NAME_NEW"]
        newname = new; sub(/^.*\//, "", newname)
        for (k = 1; k <= nold; k++) {
            oldname[k] = old[k]; sub(/^.*\//, "", oldname[k])
            renamed[k] = (oldname[k] != tolower(newname))
        }
        nhost = split("github.com/ github.com: githubusercontent.com/", host, " ")
    }
    {
        before = hits
        out = $0
        for (k = 1; k <= nold; k++) { linehit[k] = 0; out = rewrite(out, k) }
        clone = (tolower($0) ~ /git clone/)
        bare = tolower($0); gsub(/^[ \t]+|[ \t\r]+$/, "", bare)
        for (k = 1; k <= nold; k++) {
            if (renamed[k] && ((clone && linehit[k]) || (follow[k] && bare == "cd " oldname[k]))) out = cd_rewrite(out, k)
            follow[k] = (clone && linehit[k])
        }
        if (mode == "check") {
            if (hits > before) {
                text = $0; sub(/^[ \t]+/, "", text); sub(/\r$/, "", text)
                if (length(text) > 160) text = substr(text, 1, 160) "..."
                printf "%s:%d: %s\n", file, NR, text
            }
        } else {
            if (NR > 1) printf "\n"
            printf "%s", out
        }
    }
    END { if (mode != "check" && NR > 0 && ENVIRON["REPO_NAME_EOFNL"] == "1") printf "\n" }'

# scan_file check <file>: one "<file>:<line>: <text>" line per line that would change.
# scan_file apply <file>: the rewritten file on standard output (a missing final newline stays missing).
scan_file() {
    local eofnl=0
    if [[ -s "$2" && -z "$(tail -c 1 "$2")" ]]; then eofnl=1; fi
    REPO_NAME_MODE="$1" REPO_NAME_FILE="$2" REPO_NAME_EOFNL="$eofnl" REPO_NAME_OLDS="$olds_low" REPO_NAME_NEW="$new" \
        awk "$NAME_AWK" "$2"
}

count_lines() { awk 'END { print NR }'; }

tmp=""
cleanup() { if [[ -n "$tmp" ]]; then rm -f "$tmp"; fi; }
trap cleanup EXIT

# --- find the lines ------------------------------------------------------------------------------

listing=""; n_lines=0; n_files=0; changed_files=()
while IFS= read -r -d '' file; do
    [[ -f "$file" && ! -L "$file" ]] || continue
    found="$(scan_file check "$file")"
    [[ -n "$found" ]] || continue
    listing="${listing:+$listing$'\n'}$found"
    n_lines=$((n_lines + $(printf '%s\n' "$found" | count_lines)))
    n_files=$((n_files + 1))
    changed_files+=("$file")
done < <(git grep -z -I -i -l -F "${grep_patterns[@]}" -- "${scan_spec[@]}" 2>/dev/null || true)

# "<path>: N line(s): <reason>" for each kept path that names an old name (fixed-string count).
kept_report() {
    local i=0 n
    while [[ $i -lt ${#keep_paths[@]} ]]; do
        n="$({ git grep -I -i -F "${grep_patterns[@]}" -- "${keep_paths[$i]}" 2>/dev/null || true; } | count_lines)"
        if [[ "$n" -gt 0 ]]; then
            printf '    %s: %s line(s): %s\n' "${keep_paths[$i]}" "$n" "${keep_reasons[$i]}"
        fi
        i=$((i + 1))
    done
}

olds_shown="${olds// /, }"

if [[ $quiet -eq 1 ]]; then
    if [[ $n_lines -eq 0 ]]; then
        echo "tracked files name the repository origin points at ($new)"
        exit 0
    fi
    echo "$n_lines tracked line(s) in $n_files file(s) name $olds_shown, but origin points at $new"
    exit 1
fi

kept="$(kept_report)"

if [[ $n_lines -eq 0 ]]; then
    echo "repo-setup name: no tracked line names $olds_shown outside the paths that keep it on purpose — nothing to re-point (origin: $new)"
    if [[ -n "$kept" ]]; then printf '  left alone on purpose (%s):\n%s\n' "$KEEP_FILE" "$kept"; fi
    exit 0
fi

if [[ $apply -eq 0 ]]; then
    echo "repo-setup name: origin points at $new; these tracked lines name $olds_shown — report only, nothing is written without --apply"
    printf '%s\n' "$listing" | awk '{ print "  " $0 }'
    if [[ -n "$kept" ]]; then printf '  left alone on purpose (%s):\n%s\n' "$KEEP_FILE" "$kept"; fi
    echo "repo-setup name: $n_lines line(s) in $n_files file(s) to re-point"
    echo "  to rewrite them: just repo-setup name$from_flags --apply"
    exit 1
fi

# --- apply ---------------------------------------------------------------------------------------

echo "repo-setup name: $olds_shown -> $new"
for file in "${changed_files[@]}"; do
    tmp="$(mktemp)"
    scan_file apply "$file" > "$tmp"
    # Written through the path, so the file keeps its mode.
    cat "$tmp" > "$file"
    rm -f "$tmp"; tmp=""
    echo "  rewrote $file"
done
if [[ -n "$kept" ]]; then printf '  left alone on purpose (%s):\n%s\n' "$KEEP_FILE" "$kept"; fi
echo "repo-setup name: rewrote $n_lines line(s) in $n_files file(s)"
echo "  next: just observability-sync all --check   (offline: every alert's runbook link starts with the new prefix)"
echo "        just test tooling                      (each tools/observability fixture still fails on its own rule only)"
echo "        just format --check"
echo "        just observability-sync                (pushes the new runbook links into Grafana; needs the Grafana keys in .env)"
echo "        review 'git diff', then commit the change through a pull request"
