#!/usr/bin/env bash
# Hanoi City: check this Mac/Linux machine and say which engine to build with (UE 5.8 or Unity 6).
# Prints key=value facts, then recommendation=... and a short Vietnamese explanation.
# Thresholds and rules: docs/14-chon-engine.md. The Windows twin is tools/check_machine.ps1
# (same thresholds, test-enforced by tests/test_check_machine.py).
#
#   bash tools/check_machine.sh                 probe this machine
#   bash tools/check_machine.sh --facts FILE    decide from a key=value file (tests, or facts sent by someone else)
#   bash tools/check_machine.sh --disk PATH     measure free space where the repo/engine will live (default: the repo)
#
# Works with macOS's bash 3.2 (no associative arrays).
set -u

# --- thresholds (keep identical to check_machine.ps1) ---
UE_MIN_RAM_GB=32;  UE_REC_RAM_GB=64
UE_MIN_VRAM_GB=8;  UE_REC_VRAM_GB=12
UE_MIN_DISK_GB=150; UE_REC_DISK_GB=300
UE_MIN_CORES=6;    UE_REC_CORES=8
UE_MAC_MIN_RAM_GB=64
UNITY_MIN_RAM_GB=16; UNITY_REC_RAM_GB=32
UNITY_MIN_VRAM_GB=6; UNITY_REC_VRAM_GB=8
UNITY_MIN_DISK_GB=60; UNITY_REC_DISK_GB=120
UNITY_MIN_CORES=4
URP_MIN_RAM_GB=16; URP_MIN_DISK_GB=60
# --- end thresholds ---

FACTS=""
DISK_PATH="$(cd "$(dirname "$0")/.." 2>/dev/null && pwd || echo /)"
while [ $# -gt 0 ]; do
  case "$1" in
    --facts) FACTS="$2"; shift 2 ;;
    --disk) DISK_PATH="$2"; shift 2 ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "unknown argument $1" >&2; exit 2 ;;
  esac
done

os=unknown; os_version=""; cpu=""; cores=0; threads=0; ram_gb=0; gpu=""; vram_gb=0
gpu_api=unknown; apple_silicon=no; disk_free_gb=0; disk_ssd=unknown
ue_installed=no; unity_installed=no

to_gb() { awk -v b="$1" 'BEGIN { printf "%d", b / 1073741824 + 0.5 }'; }

probe_macos() {
  os=macos
  os_version="$(sw_vers -productVersion 2>/dev/null)"
  cpu="$(sysctl -n machdep.cpu.brand_string 2>/dev/null)"
  cores="$(sysctl -n hw.perflevel0.physicalcpu 2>/dev/null || sysctl -n hw.physicalcpu)"
  threads="$(sysctl -n hw.logicalcpu 2>/dev/null || echo 0)"
  ram_gb="$(to_gb "$(sysctl -n hw.memsize)")"
  [ "$(uname -m)" = "arm64" ] && apple_silicon=yes
  local disp
  disp="$(system_profiler SPDisplaysDataType 2>/dev/null)"
  gpu="$(printf '%s\n' "$disp" | awk -F': ' '/Chipset Model/ {print $2; exit}')"
  local gpu_cores
  gpu_cores="$(printf '%s\n' "$disp" | awk -F': ' '/Total Number of Cores/ {print $2; exit}')"
  [ -n "$gpu_cores" ] && gpu="$gpu ($gpu_cores GPU cores)"
  if [ "$apple_silicon" = yes ]; then
    # Unified memory: Metal lets the GPU use about two thirds of it.
    vram_gb=$(( ram_gb * 2 / 3 ))
  else
    local v
    v="$(printf '%s\n' "$disp" | awk -F': ' '/VRAM/ {print $2; exit}')"
    case "$v" in
      *GB*) vram_gb="$(echo "$v" | tr -cd '0-9')" ;;
      *MB*) vram_gb=$(( $(echo "$v" | tr -cd '0-9') / 1024 )) ;;
    esac
  fi
  gpu_api=metal
  if printf '%s\n' "$disp" | grep -q "Metal Support: Metal 3"; then gpu_api=metal3; fi
  if diskutil info "$(df "$DISK_PATH" | awk 'NR==2 {print $1}')" 2>/dev/null | grep -q "Solid State: *Yes"; then disk_ssd=yes
  elif [ "$apple_silicon" = yes ]; then disk_ssd=yes; fi
  [ -d "/Users/Shared/Epic Games" ] && ls "/Users/Shared/Epic Games" 2>/dev/null | grep -q "UE_5" && ue_installed=yes
  [ -d "/Applications/Unity/Hub/Editor" ] && unity_installed=yes
}

probe_linux() {
  os=linux
  os_version="$(. /etc/os-release 2>/dev/null; echo "${PRETTY_NAME:-}")"
  cpu="$(awk -F': ' '/model name/ {print $2; exit}' /proc/cpuinfo)"
  threads="$(nproc 2>/dev/null || echo 0)"
  cores="$(lscpu -p=core,socket 2>/dev/null | grep -v '^#' | sort -u | wc -l | tr -d ' ')"
  [ "$cores" -gt 0 ] 2>/dev/null || cores="$threads"
  ram_gb="$(awk '/MemTotal/ {printf "%d", $2 / 1048576 + 0.5}' /proc/meminfo)"
  if command -v nvidia-smi >/dev/null 2>&1; then
    local line
    line="$(nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits 2>/dev/null | head -1)"
    gpu="${line%%,*}"
    vram_gb=$(( $(echo "${line##*,}" | tr -cd '0-9') / 1024 ))
    gpu_api=vulkan
  elif command -v lspci >/dev/null 2>&1; then
    gpu="$(lspci 2>/dev/null | grep -iE 'vga|3d controller' | head -1 | sed 's/.*: //')"
  fi
  local dev rota
  dev="$(df "$DISK_PATH" | awk 'NR==2 {print $1}' | sed 's|/dev/||; s/[0-9]*$//; s/p$//')"
  rota="$(cat "/sys/block/$dev/queue/rotational" 2>/dev/null)"
  [ "$rota" = 0 ] && disk_ssd=yes
  [ "$rota" = 1 ] && disk_ssd=no
  [ -d "$HOME/Unity/Hub/Editor" ] && unity_installed=yes
  ls -d "$HOME"/UnrealEngine* "$HOME"/Epic* 2>/dev/null | grep -q . && ue_installed=yes
}

if [ -n "$FACTS" ]; then
  # key=value lines; only the keys this script knows are read.
  while IFS='=' read -r k v; do
    case "$k" in
      os|os_version|cpu|cores|threads|ram_gb|gpu|vram_gb|gpu_api|apple_silicon|disk_free_gb|disk_ssd|ue_installed|unity_installed)
        eval "$k=\"\$v\"" ;;
    esac
  done < "$FACTS"
else
  case "$(uname -s)" in
    Darwin) probe_macos ;;
    Linux) probe_linux ;;
    *) echo "this script is for macOS and Linux; on Windows run tools/check_machine.ps1" >&2; exit 2 ;;
  esac
  disk_free_gb="$(df -Pk "$DISK_PATH" | awk 'NR==2 {printf "%d", $4 / 1048576}')"
fi

# --- decision (keep identical to check_machine.ps1) ---
ue_fail=""; unity_fail=""
ue() { ue_fail="${ue_fail:+$ue_fail; }$1"; }
un() { unity_fail="${unity_fail:+$unity_fail; }$1"; }
[ "$ram_gb" -lt "$UE_MIN_RAM_GB" ] && ue "RAM ${ram_gb}<${UE_MIN_RAM_GB}GB"
[ "$vram_gb" -lt "$UE_MIN_VRAM_GB" ] && ue "VRAM ${vram_gb}<${UE_MIN_VRAM_GB}GB"
[ "$disk_free_gb" -lt "$UE_MIN_DISK_GB" ] && ue "disk ${disk_free_gb}<${UE_MIN_DISK_GB}GB"
[ "$cores" -lt "$UE_MIN_CORES" ] && ue "cores ${cores}<${UE_MIN_CORES}"
[ "$disk_ssd" = no ] && ue "disk is HDD"
if [ "$os" = macos ] && [ "$ram_gb" -lt "$UE_MAC_MIN_RAM_GB" ]; then ue "Mac RAM ${ram_gb}<${UE_MAC_MIN_RAM_GB}GB"; fi
if [ "$os" = macos ] && [ "$apple_silicon" != yes ]; then ue "Intel Mac"; fi

[ "$ram_gb" -lt "$UNITY_MIN_RAM_GB" ] && un "RAM ${ram_gb}<${UNITY_MIN_RAM_GB}GB"
[ "$vram_gb" -lt "$UNITY_MIN_VRAM_GB" ] && un "VRAM ${vram_gb}<${UNITY_MIN_VRAM_GB}GB"
[ "$disk_free_gb" -lt "$UNITY_MIN_DISK_GB" ] && un "disk ${disk_free_gb}<${UNITY_MIN_DISK_GB}GB"
[ "$cores" -lt "$UNITY_MIN_CORES" ] && un "cores ${cores}<${UNITY_MIN_CORES}"

if [ -z "$ue_fail" ]; then
  recommendation=ue5
  if [ "$ram_gb" -ge "$UE_REC_RAM_GB" ] && [ "$vram_gb" -ge "$UE_REC_VRAM_GB" ] && [ "$disk_free_gb" -ge "$UE_REC_DISK_GB" ] && [ "$cores" -ge "$UE_REC_CORES" ]; then tier=recommended; else tier=minimum; fi
elif [ -z "$unity_fail" ]; then
  recommendation=unity_hdrp
  if [ "$ram_gb" -ge "$UNITY_REC_RAM_GB" ] && [ "$vram_gb" -ge "$UNITY_REC_VRAM_GB" ] && [ "$disk_free_gb" -ge "$UNITY_REC_DISK_GB" ]; then tier=recommended; else tier=minimum; fi
elif [ "$ram_gb" -ge "$URP_MIN_RAM_GB" ] && [ "$disk_free_gb" -ge "$URP_MIN_DISK_GB" ]; then
  recommendation=unity_urp; tier=minimum
else
  recommendation=none; tier=none
fi
# --- end decision ---

cat <<OUT
os=$os
os_version=$os_version
cpu=$cpu
cores=$cores
threads=$threads
ram_gb=$ram_gb
gpu=$gpu
vram_gb=$vram_gb
gpu_api=$gpu_api
apple_silicon=$apple_silicon
disk_path=$DISK_PATH
disk_free_gb=$disk_free_gb
disk_ssd=$disk_ssd
ue_installed=$ue_installed
unity_installed=$unity_installed
ue_blockers=$ue_fail
unity_blockers=$unity_fail
recommendation=$recommendation
tier=$tier
OUT

ue_why="$ue_fail"; unity_why="$unity_fail"
[ "$gpu" = "" ] && echo "(không đọc được GPU/VRAM; nếu máy có GPU rời, ghi vram_gb vào file facts rồi chạy lại với --facts)"
echo
case "$recommendation" in
  ue5) echo "Khuyến nghị: Unreal Engine 5.8 (mức $tier). Làm theo docs/05-tich-hop-ue5.md." ;;
  unity_hdrp) echo "Khuyến nghị: Unity 6 HDRP (mức $tier). UE 5.8 chưa đủ vì: ${ue_why}. Làm theo docs/13-tich-hop-unity.md." ;;
  unity_urp) echo "Khuyến nghị: Unity 6 nhưng dùng URP (GPU yếu). Thiếu cho HDRP: ${unity_why}. Xem docs/14-chon-engine.md mục 5." ;;
  none) echo "Máy này chưa đủ để dựng Hà Nội trong engine nào: ${unity_why}. Tiếp tục phần không cần engine, hoặc thuê máy trạm đám mây (docs/14-chon-engine.md mục 6)." ;;
esac
