#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="${PROJECT_DIR:-/var/www/tachyon-site}"
SERVICE_NAME="${SERVICE_NAME:-tachyon-site}"
BRANCH="${BRANCH:-master}"
BACKUP_ROOT="${BACKUP_ROOT:-$HOME/tachyon-backups}"
CHECK_URL="${CHECK_URL:-http://127.0.0.1:18080}"
RUN_CHOWN="${RUN_CHOWN:-1}"
YES=0
PULL_ONLY=0

usage() {
  cat <<'USAGE'
Tachyon server update script

Usage:
  bash deploy-tachyon.sh --yes

Options:
  -y, --yes      Confirm automatic sync when local server files changed.
  --pull-only    Use git pull --ff-only instead of forced sync to origin/BRANCH.
  -h, --help     Show this help.

Environment:
  PROJECT_DIR=/var/www/tachyon-site
  SERVICE_NAME=tachyon-site
  BRANCH=master
  BACKUP_ROOT=$HOME/tachyon-backups
  CHECK_URL=http://127.0.0.1:18080
  RUN_CHOWN=1
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -y|--yes)
      YES=1
      ;;
    --pull-only)
      PULL_ONLY=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 2
      ;;
  esac
  shift
done

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    exit 1
  fi
}

confirm() {
  local message="$1"
  if [[ "$YES" == "1" ]]; then
    return 0
  fi

  read -r -p "$message [y/N] " answer
  [[ "$answer" == "y" || "$answer" == "Y" ]]
}

sudo_cmd() {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

service_exists() {
  command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files "${SERVICE_NAME}.service" >/dev/null 2>&1
}

restore_runtime_files() {
  log "Restoring runtime data from backup"
  mkdir -p "$PROJECT_DIR/data" "$PROJECT_DIR/uploads"

  if [[ -d "$BACKUP_DIR/data" ]]; then
    cp -a "$BACKUP_DIR/data/." "$PROJECT_DIR/data/"
  fi

  if [[ -d "$BACKUP_DIR/uploads" ]]; then
    cp -a "$BACKUP_DIR/uploads/." "$PROJECT_DIR/uploads/"
  fi
}

restart_service_on_error() {
  local exit_code=$?
  echo
  echo "Update failed. Backup is stored at: $BACKUP_DIR" >&2

  if [[ -d "$PROJECT_DIR" ]]; then
    restore_runtime_files || true
  fi

  if service_exists; then
    sudo_cmd systemctl start "$SERVICE_NAME" || true
  fi

  exit "$exit_code"
}

need_command git
need_command npm
need_command node
need_command cp
need_command date

if [[ ! -d "$PROJECT_DIR/.git" ]]; then
  echo "Project git directory not found: $PROJECT_DIR" >&2
  exit 1
fi

STAMP="$(date '+%Y%m%d-%H%M%S')"
BACKUP_DIR="$BACKUP_ROOT/$STAMP"

trap restart_service_on_error ERR

log "Project: $PROJECT_DIR"
log "Backup: $BACKUP_DIR"

cd "$PROJECT_DIR"
mkdir -p "$BACKUP_DIR" data uploads

if [[ -d data ]]; then
  cp -a data "$BACKUP_DIR/data"
fi

if [[ -d uploads ]]; then
  cp -a uploads "$BACKUP_DIR/uploads"
fi

if service_exists; then
  log "Stopping service: $SERVICE_NAME"
  sudo_cmd systemctl stop "$SERVICE_NAME"
else
  log "Systemd service not found, skipping stop: $SERVICE_NAME"
fi

log "Fetching GitHub branch: origin/$BRANCH"
git fetch origin "$BRANCH"

if [[ "$PULL_ONLY" == "1" ]]; then
  log "Running git pull --ff-only"
  git pull --ff-only origin "$BRANCH"
else
  if [[ -n "$(git status --porcelain)" ]]; then
    log "Local changes detected"
    confirm "Backup is complete. Sync working tree to origin/$BRANCH and restore data/uploads after sync?" || exit 1
  fi

  log "Syncing working tree to origin/$BRANCH"
  git reset --hard "origin/$BRANCH"
fi

restore_runtime_files

log "Installing dependencies"
npm install

log "Building site"
npm run build

mkdir -p data uploads backups

if [[ "$RUN_CHOWN" == "1" ]]; then
  OWNER="$(stat -c '%U:%G' "$PROJECT_DIR")"
  log "Fixing runtime permissions: $OWNER"
  sudo_cmd chown -R "$OWNER" "$PROJECT_DIR/data" "$PROJECT_DIR/uploads" "$PROJECT_DIR/backups"
fi

if service_exists; then
  log "Starting service: $SERVICE_NAME"
  sudo_cmd systemctl start "$SERVICE_NAME"
  sudo_cmd systemctl status "$SERVICE_NAME" --no-pager -l
else
  log "Systemd service not found, skipping start: $SERVICE_NAME"
fi

if command -v curl >/dev/null 2>&1; then
  log "Checking site: $CHECK_URL"
  curl -fsS "$CHECK_URL" >/dev/null
fi

trap - ERR

log "Update complete"
echo "Backup path: $BACKUP_DIR"
