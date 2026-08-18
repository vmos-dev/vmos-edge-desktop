#!/bin/bash
set -euo pipefail

INSTALL_DIR="/usr/local/bin"
SERVICE_DIR="/etc/systemd/system"
JOURNALD_DIR="/etc/systemd/journald.conf.d"
DEPLOY_DIR="/tmp/flow-engine-deploy"
BINARY_NAME="yaml-flow-engine"
SERVICE_NAME="yaml-flow-engine.service"
JOURNALD_CONF_NAME="yaml-flow-engine.conf"
INSTALL_JOURNALD_CONFIG="${INSTALL_JOURNALD_CONFIG:-0}"
BACKUP_DIR="$(mktemp -d /tmp/flow-engine-backup.XXXXXX)"
HAD_BINARY=0
HAD_SERVICE=0
HAD_JOURNALD_CONF=0
CHANGES_STARTED=0
USER_CREATED=0
WAS_ENABLED=0
WAS_ACTIVE=0

rollback_on_error() {
  local code=$?
  if [ "$code" -eq 0 ]; then
    rm -rf "$BACKUP_DIR"
    return
  fi

  echo "INSTALL_FAILED_ROLLING_BACK"

  if [ "$CHANGES_STARTED" != "1" ]; then
    rm -rf "$BACKUP_DIR"
    if [ "$USER_CREATED" = "1" ]; then
      userdel yaml-flow 2>/dev/null || true
    fi
    exit "$code"
  fi

  systemctl stop yaml-flow-engine 2>/dev/null || true

  if [ "$HAD_BINARY" = "1" ]; then
    cp "$BACKUP_DIR/$BINARY_NAME" "$INSTALL_DIR/$BINARY_NAME" || true
    chmod 755 "$INSTALL_DIR/$BINARY_NAME" || true
  else
    rm -f "$INSTALL_DIR/$BINARY_NAME" || true
  fi

  if [ "$HAD_SERVICE" = "1" ]; then
    cp "$BACKUP_DIR/$SERVICE_NAME" "$SERVICE_DIR/$SERVICE_NAME" || true
  else
    rm -f "$SERVICE_DIR/$SERVICE_NAME" || true
  fi

  if [ "$INSTALL_JOURNALD_CONFIG" = "1" ]; then
    if [ "$HAD_JOURNALD_CONF" = "1" ]; then
      cp "$BACKUP_DIR/$JOURNALD_CONF_NAME" "$JOURNALD_DIR/$JOURNALD_CONF_NAME" || true
      chmod 644 "$JOURNALD_DIR/$JOURNALD_CONF_NAME" || true
    else
      rm -f "$JOURNALD_DIR/$JOURNALD_CONF_NAME" || true
    fi
    systemctl restart systemd-journald 2>/dev/null || true
  fi

  systemctl daemon-reload 2>/dev/null || true
  if [ "$WAS_ENABLED" = "1" ]; then
    systemctl enable yaml-flow-engine 2>/dev/null || true
  else
    systemctl disable yaml-flow-engine 2>/dev/null || true
  fi

  if [ "$HAD_SERVICE" = "1" ] && [ "$HAD_BINARY" = "1" ]; then
    if [ "$WAS_ACTIVE" = "1" ]; then
      systemctl restart yaml-flow-engine 2>/dev/null || true
    else
      systemctl stop yaml-flow-engine 2>/dev/null || true
    fi
  elif [ "$USER_CREATED" = "1" ]; then
    userdel yaml-flow 2>/dev/null || true
  fi
  rm -rf "$BACKUP_DIR"
  exit "$code"
}

trap rollback_on_error EXIT

if [ ! -f "$DEPLOY_DIR/$BINARY_NAME" ] || [ ! -f "$DEPLOY_DIR/$SERVICE_NAME" ]; then
  echo "DEPLOY_FILES_MISSING"
  exit 1
fi

if [ "$INSTALL_JOURNALD_CONFIG" = "1" ] && [ ! -f "$DEPLOY_DIR/yaml-flow-engine-journald.conf" ]; then
  echo "JOURNALD_CONFIG_MISSING"
  exit 1
fi

if ! id -u yaml-flow &>/dev/null; then
  useradd --system --no-create-home --shell /usr/sbin/nologin yaml-flow
  USER_CREATED=1
fi

if systemctl is-enabled --quiet yaml-flow-engine 2>/dev/null; then
  WAS_ENABLED=1
fi
if systemctl is-active --quiet yaml-flow-engine 2>/dev/null; then
  WAS_ACTIVE=1
fi

if [ -f "$INSTALL_DIR/$BINARY_NAME" ]; then
  cp -p "$INSTALL_DIR/$BINARY_NAME" "$BACKUP_DIR/$BINARY_NAME"
  HAD_BINARY=1
fi
if [ -f "$SERVICE_DIR/$SERVICE_NAME" ]; then
  cp -p "$SERVICE_DIR/$SERVICE_NAME" "$BACKUP_DIR/$SERVICE_NAME"
  HAD_SERVICE=1
fi
if [ "$INSTALL_JOURNALD_CONFIG" = "1" ] && [ -f "$JOURNALD_DIR/$JOURNALD_CONF_NAME" ]; then
  cp -p "$JOURNALD_DIR/$JOURNALD_CONF_NAME" "$BACKUP_DIR/$JOURNALD_CONF_NAME"
  HAD_JOURNALD_CONF=1
fi

CHANGES_STARTED=1
systemctl stop yaml-flow-engine 2>/dev/null || true

# ── 清理残留实例锁:防 PID 复用导致引擎启动时误判"已有实例在运行" ──
# 服务此时已停止。锁内记录的 PID 若已不存在,或存在但并非 yaml-flow-engine 进程
# (低位 PID 被系统进程复用),即为陈旧锁,删除即可让引擎正常启动;仅当锁确实被一个
# 仍在运行的 yaml-flow-engine 持有时才中止,避免误删锁导致起双实例。
# 路径对应 service 的 StateDirectory=yaml-flow-engine(默认 /var/lib/yaml-flow-engine)。
LOCK_FILE="/var/lib/yaml-flow-engine/instance.lock"
if [ -f "$LOCK_FILE" ]; then
  LOCK_PID="$(tr -dc '0-9' < "$LOCK_FILE" 2>/dev/null || true)"
  LOCK_STALE=1
  if [ -n "$LOCK_PID" ] && [ -e "/proc/$LOCK_PID" ]; then
    if tr '\0' ' ' < "/proc/$LOCK_PID/cmdline" 2>/dev/null | grep -qa 'yaml-flow-engine'; then
      LOCK_STALE=0
    fi
  fi
  if [ "$LOCK_STALE" = "1" ]; then
    echo "CLEANING_STALE_INSTANCE_LOCK pid=${LOCK_PID:-none}"
    rm -f "$LOCK_FILE"
  else
    echo "INSTANCE_LOCK_HELD_BY_RUNNING_ENGINE pid=$LOCK_PID"
    exit 1
  fi
fi

cp "$DEPLOY_DIR/$BINARY_NAME" "$INSTALL_DIR/$BINARY_NAME"
chmod 755 "$INSTALL_DIR/$BINARY_NAME"
cp "$DEPLOY_DIR/$SERVICE_NAME" "$SERVICE_DIR/"

systemctl daemon-reload
if [ "$INSTALL_JOURNALD_CONFIG" = "1" ]; then
  mkdir -p "$JOURNALD_DIR"
  cp "$DEPLOY_DIR/yaml-flow-engine-journald.conf" "$JOURNALD_DIR/$JOURNALD_CONF_NAME"
  chmod 644 "$JOURNALD_DIR/$JOURNALD_CONF_NAME"
  systemctl restart systemd-journald
fi
systemctl enable yaml-flow-engine
systemctl restart yaml-flow-engine

for i in $(seq 1 10); do
  if curl -sf http://127.0.0.1:47218/health > /dev/null 2>&1; then
    echo "OK"
    exit 0
  fi
  sleep 1
done
echo "HEALTH_CHECK_TIMEOUT"
exit 1
