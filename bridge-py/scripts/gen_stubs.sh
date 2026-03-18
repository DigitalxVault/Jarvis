#!/usr/bin/env bash
# Generate Python gRPC stubs from .proto files in bridge-py/proto/
# Run from anywhere — script auto-resolves paths.
# Usage: bash bridge-py/scripts/gen_stubs.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PROTO_DIR="$PROJECT_DIR/proto"
OUT_DIR="$PROJECT_DIR/generated"

echo "Proto dir:  $PROTO_DIR"
echo "Output dir: $OUT_DIR"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

# Change to project dir so uv finds the venv
cd "$PROJECT_DIR"

# Generate stubs — pass proto files as relative paths from PROTO_DIR
# to avoid issues with spaces in the directory path
COMMON_PROTO="dcs/common/v0/common.proto"
MISSION_PROTO="dcs/mission/v0/mission.proto"
UNIT_PROTO="dcs/unit/v0/unit.proto"
HOOK_PROTO="dcs/hook/v0/hook.proto"
COALITION_PROTO="dcs/coalition/v0/coalition.proto"
CUSTOM_PROTO="dcs/custom/v0/custom.proto"
TRIGGER_PROTO="dcs/trigger/v0/trigger.proto"

echo "Generating stubs for:"
echo "  $COMMON_PROTO"
echo "  $MISSION_PROTO"
echo "  $UNIT_PROTO"
echo "  $HOOK_PROTO"
echo "  $COALITION_PROTO"
echo "  $CUSTOM_PROTO"
echo "  $TRIGGER_PROTO"

uv run python -m grpc_tools.protoc \
  --proto_path="$PROTO_DIR" \
  --python_out="$OUT_DIR" \
  --grpc_python_out="$OUT_DIR" \
  --pyi_out="$OUT_DIR" \
  "$COMMON_PROTO" \
  "$MISSION_PROTO" \
  "$UNIT_PROTO" \
  "$HOOK_PROTO" \
  "$COALITION_PROTO" \
  "$CUSTOM_PROTO" \
  "$TRIGGER_PROTO"

# Add __init__.py files so generated packages are importable
find "$OUT_DIR" -type d -exec touch {}/__init__.py \;

echo ""
echo "Stubs generated in $OUT_DIR"
echo "Files:"
find "$OUT_DIR" -name "*.py" | sort
