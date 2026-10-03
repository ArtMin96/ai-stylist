#!/usr/bin/env bash
# Prints the APP_ENV a local dev process starts with: the exported value when it is not empty, else
# the value in the repo-root .env, else `local` (scripts/lib.sh local_app_env).
#   bash scripts/dev-app-env.sh [dotenv file]   (default: the repo-root .env)
# `just dev-api` and `just dev-workers` put the result on each process's command line, so an empty
# APP_ENV never leaves deployment.environment.name off the telemetry of api, jobs or segmentation.
# The value goes to stdout for the recipe to pass on; nothing else of .env is read.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
local_app_env "${1:-$REPO_ROOT/.env}"
