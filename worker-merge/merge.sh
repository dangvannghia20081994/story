#!/usr/bin/env bash
# Merge tất cả segment_*.mp3 trong /data theo thứ tự → audio.mp3
# Usage (bên trong container): merge [output_name]
# Docker:  docker run --rm -v /path/to/chapter:/data story-merge [audio.mp3]

set -euo pipefail

OUTPUT_NAME="${1:-audio.mp3}"
DATA_DIR="/data"
OUTPUT_PATH="${DATA_DIR}/${OUTPUT_NAME}"
LIST_FILE="${DATA_DIR}/.merge_list.txt"

mapfile -t SEGMENTS < <(ls "${DATA_DIR}"/segment_*.mp3 2>/dev/null | sort -V)

[[ ${#SEGMENTS[@]} -eq 0 ]] && { echo "ERROR: Không tìm thấy segment_*.mp3 trong ${DATA_DIR}"; exit 1; }

printf "file '%s'\n" "${SEGMENTS[@]}" > "$LIST_FILE"

echo "Merging ${#SEGMENTS[@]} segments → ${OUTPUT_PATH}"
ffmpeg -y -f concat -safe 0 -i "$LIST_FILE" \
  -ar 44100 -ac 1 -c:a libmp3lame -q:a 4 "$OUTPUT_PATH" 2>&1
rm -f "$LIST_FILE"

DURATION_SEC=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$OUTPUT_PATH" 2>/dev/null \
  | awk '{printf "%d", int($1 + 0.5)}')
SIZE=$(du -h "$OUTPUT_PATH" | cut -f1)
echo "DURATION_SEC=${DURATION_SEC}"
echo "Done: ${OUTPUT_NAME} | Duration: ${DURATION_SEC}s | Size: ${SIZE}"
