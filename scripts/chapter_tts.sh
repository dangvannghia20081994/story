#!/usr/bin/env bash
# Pipeline TTS cho 1 chapter: lookup voice → TTS song song → merge audio.mp3
#
# Usage: ./chapter_tts.sh <chapter_id> <story_id> <segments_file> [rate] [parallel]
#
# segments_file: TSV, mỗi dòng gồm: speaker_name<TAB>text
#   Ví dụ:
#     narration	Ánh nắng chiều tà phủ lên đỉnh núi.
#     Lâm Phong	Ta đã đột phá Kim Đan rồi!
#
# rate     : "+0%" | "+10%" | "-5%" (default: +0%)
# parallel : số luồng TTS chạy đồng thời (default: 4)
#
# Biến môi trường:
#   DEFAULT_VOICE : fallback khi không có mapping (default: capcut:BV074_streaming)
#   DB_CONTAINER  : tên docker container Postgres (default: story-db-1)
#   DB_USER / DB_NAME : credentials (default: story / story)
#
# Output:
#   data/<chapter_id>/segment_001.mp3, segment_002.mp3, ...
#   data/<chapter_id>/audio.mp3

set -euo pipefail

CHAPTER_ID="${1:?Thiếu chapter_id. Usage: $0 <chapter_id> <story_id> <segments_file> [rate] [parallel]}"
STORY_ID="${2:?Thiếu story_id}"
SEGMENTS_FILE="${3:?Thiếu segments_file}"
RATE="${4:-+0%}"
PARALLEL="${5:-4}"

DEFAULT_VOICE="${DEFAULT_VOICE:-capcut:BV074_streaming}"
DB_CONTAINER="${DB_CONTAINER:-story-db-1}"
DB_USER="${DB_USER:-story}"
DB_NAME="${DB_NAME:-story}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(realpath "${SCRIPT_DIR}/..")"
OUT_DIR="${REPO_ROOT}/backend/storage/app/public/stories/${STORY_ID}/chapters/${CHAPTER_ID}"
mkdir -p "$OUT_DIR"

[[ -f "$SEGMENTS_FILE" ]] || { echo "ERROR: File không tồn tại: $SEGMENTS_FILE"; exit 1; }

echo "=== Chapter TTS: chapter_id=${CHAPTER_ID}, story_id=${STORY_ID} ==="
echo "Segments: ${SEGMENTS_FILE}"
echo "Output:   ${OUT_DIR}/"
echo "Parallel: ${PARALLEL} luồng | Rate: ${RATE} | Fallback: ${DEFAULT_VOICE}"
echo ""

# -----------------------------------------------------------------------
# Bước 1: Batch lookup tất cả voice từ DB (1 query)
# -----------------------------------------------------------------------
echo "[1/3] Lookup voice từ voice_mappings..."

declare -A VOICE_MAP

# Lấy danh sách unique speakers
mapfile -t SPEAKERS < <(cut -f1 "$SEGMENTS_FILE" | sort -u | grep -v '^$')

# Build IN list cho SQL (escape single quote)
IN_LIST=$(printf "'%s'," "${SPEAKERS[@]}" | sed "s/''/\\\\'/g; s/,$//")

# Query batch: ưu tiên story_id cụ thể trước global (NULLS LAST)
LOOKUP_SQL="
SELECT DISTINCT ON (speaker_name) speaker_name, voice_preset
FROM voice_mappings
WHERE speaker_name IN (${IN_LIST})
  AND (story_id = ${STORY_ID} OR story_id IS NULL)
ORDER BY speaker_name, story_id NULLS LAST;
"

while IFS='|' read -r speaker voice; do
  [[ -n "$speaker" && -n "$voice" ]] && VOICE_MAP["$speaker"]="$voice"
done < <(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAF'|' -c "$LOOKUP_SQL" 2>/dev/null)

# Hiển thị kết quả lookup
for sp in "${SPEAKERS[@]}"; do
  voice="${VOICE_MAP[$sp]:-$DEFAULT_VOICE}"
  echo "  ${sp} → ${voice}"
done
echo ""

# -----------------------------------------------------------------------
# Bước 2: Đọc segments + chạy TTS song song
# -----------------------------------------------------------------------
echo "[2/3] TTS ${PARALLEL} luồng song song..."

# Hàm TTS 1 segment — retry 3 lần trước khi bỏ qua
run_tts() {
  local idx="$1"
  local speaker="$2"
  local text="$3"
  local voice="$4"
  local rate="$5"
  local out_dir="$6"
  local script_dir="$7"

  local seg_file attempt
  seg_file=$(printf "%s/segment_%03d.mp3" "$out_dir" "$idx")

  for attempt in 1 2 3; do
    if bash "${script_dir}/tts_revid.sh" "$text" "$voice" "$rate" "$seg_file" 2>/dev/null; then
      echo "[${idx}] ${speaker} → ${voice} ✓"
      return 0
    fi
    echo "[${idx}] attempt ${attempt} failed, retry..." >&2
    sleep 2
  done
  echo "[${idx}] ERROR: TTS thất bại sau 3 lần — bỏ qua segment" >&2
  return 0  # không crash toàn batch
}
export -f run_tts

# Đọc segments file → ghi vào temp file có đầy đủ thông tin
WORK_FILE=$(mktemp)
idx=0
while IFS=$'\t' read -r speaker text || [[ -n "${speaker:-}" ]]; do
  [[ -z "${text:-}" ]] && continue
  idx=$((idx + 1))
  voice="${VOICE_MAP[$speaker]:-$DEFAULT_VOICE}"
  printf "%d\t%s\t%s\t%s\n" "$idx" "$speaker" "$voice" "$text" >> "$WORK_FILE"
done < "$SEGMENTS_FILE"

TOTAL=$idx
echo "Tổng: ${TOTAL} segments"
echo ""

# Chạy song song bằng job pool
running=0
declare -a PIDS=()

while IFS=$'\t' read -r idx speaker voice text; do
  run_tts "$idx" "$speaker" "$text" "$voice" "$RATE" "$OUT_DIR" "$SCRIPT_DIR" &
  PIDS+=($!)
  running=$((running + 1))

  # Throttle: chờ khi đạt giới hạn luồng
  if [[ $running -ge $PARALLEL ]]; then
    wait "${PIDS[0]}" || true
    PIDS=("${PIDS[@]:1}")
    running=$((running - 1))
  fi
done < "$WORK_FILE"

# Chờ tất cả luồng còn lại
wait || true
rm -f "$WORK_FILE"

echo ""

# Kiểm tra số file đã tạo
CREATED=$(ls "${OUT_DIR}"/segment_*.mp3 2>/dev/null | wc -l)
echo "Đã tạo: ${CREATED}/${TOTAL} segments"
[[ $CREATED -eq 0 ]] && { echo "ERROR: Không có segment nào được tạo."; exit 1; }

# -----------------------------------------------------------------------
# Bước 3: Merge theo đúng thứ tự
# -----------------------------------------------------------------------
echo ""
echo "[3/3] Merging ${CREATED} segments → audio.mp3..."

MERGE_LIST="${OUT_DIR}/.merge_list.txt"
ls "${OUT_DIR}"/segment_*.mp3 | sort -V | while read -r f; do
  printf "file '%s'\n" "$(realpath "$f")"
done > "$MERGE_LIST"

AUDIO_OUT="${OUT_DIR}/audio.mp3"
MERGE_IMAGE="${MERGE_IMAGE:-story-merge}"

# Merge qua Docker image story-merge, parse DURATION_SEC từ output
MERGE_OUTPUT=$(docker run --rm --user "$(id -u):$(id -g)" -v "$(realpath "$OUT_DIR"):/data" "$MERGE_IMAGE" 2>&1)
echo "$MERGE_OUTPUT"

DURATION_SEC=$(echo "$MERGE_OUTPUT" | grep '^DURATION_SEC=' | cut -d= -f2 | tr -d '[:space:]')
SIZE=$(du -h "$AUDIO_OUT" | cut -f1)

# Lưu audio_multiple_path + duration vào bảng chapters
AUDIO_DB_PATH="stories/${STORY_ID}/chapters/${CHAPTER_ID}/audio.mp3"
if [[ -n "${DURATION_SEC:-}" && "${DURATION_SEC}" =~ ^[0-9]+$ ]]; then
  docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c \
    "UPDATE chapters SET audio_multiple_path='${AUDIO_DB_PATH}', duration=${DURATION_SEC} WHERE id=${CHAPTER_ID};" \
    2>/dev/null && echo "DB: chapter_id=${CHAPTER_ID} duration=${DURATION_SEC}s audio_multiple_path=${AUDIO_DB_PATH}"
fi

echo ""
echo "Done: ${AUDIO_OUT} | Size: ${SIZE}"
