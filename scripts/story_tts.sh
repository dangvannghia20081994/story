#!/usr/bin/env bash
# Batch TTS toàn bộ chapters của 1 story
# Usage: ./story_tts.sh <story_id> [limit] [chapter_parallel] [tts_parallel]
#
# story_id         : ID của story cần xử lý
# limit            : số chapter xử lý (default: 100)
# chapter_parallel : số chapter chạy đồng thời (default: 3)
# tts_parallel     : số luồng TTS mỗi chapter (default: 6)
#
# Output: data/<chapter_id>/audio.mp3 cho mỗi chapter
# Skip  : chapter đã có audio.mp3 sẵn (resume-safe)

set -euo pipefail

STORY_ID="${1:?Thiếu story_id. Usage: $0 <story_id> [limit] [chapter_parallel] [tts_parallel]}"
LIMIT="${2:-100}"
CH_PARALLEL="${3:-3}"
TTS_PARALLEL="${4:-6}"

DB_CONTAINER="${DB_CONTAINER:-story-db-1}"
DB_USER="${DB_USER:-story}"
DB_NAME="${DB_NAME:-story}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(realpath "${SCRIPT_DIR}/..")"
DATA_DIR="${REPO_ROOT}/data"
mkdir -p "$DATA_DIR"

echo "=== Story TTS: story_id=${STORY_ID} ==="
echo "Limit: ${LIMIT} chapters | Chapter parallel: ${CH_PARALLEL} | TTS parallel: ${TTS_PARALLEL}"
echo ""

# Lấy danh sách chapter_id theo thứ tự chapter_number
mapfile -t CHAPTER_IDS < <(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "
  SELECT id FROM chapters
  WHERE story_id=${STORY_ID}
    AND content_segments IS NOT NULL
    AND jsonb_array_length(content_segments) > 0
    AND audio_multiple_path IS NULL
  ORDER BY id ASC
  LIMIT ${LIMIT};
" 2>/dev/null | grep -E '^[0-9]+$')

TOTAL=${#CHAPTER_IDS[@]}
echo "Tìm thấy: ${TOTAL} chapters cần xử lý"
echo ""

# Xử lý 1 chapter (export segments + TTS + merge)
process_chapter() {
  local chapter_id="$1"
  local story_id="$2"
  local tts_parallel="$3"
  local script_dir="$4"
  local data_dir="$5"
  local db_container="$6"
  local db_user="$7"
  local db_name="$8"

  local repo_root
  repo_root="$(realpath "${script_dir}/..")"
  local out_dir="${repo_root}/backend/storage/app/public/stories/${story_id}/chapters/${chapter_id}"
  local audio_out="${out_dir}/audio.mp3"
  local seg_file="${data_dir}/${chapter_id}/segments.tsv"

  # Skip nếu đã có audio
  if [[ -f "$audio_out" ]]; then
    echo "[chapter ${chapter_id}] SKIP (đã có audio.mp3)"
    return 0
  fi

  mkdir -p "$out_dir"
  mkdir -p "${data_dir}/${chapter_id}"
  echo "[chapter ${chapter_id}] Export segments..."

  # Export segments từ DB
  docker exec "$db_container" psql -U "$db_user" -d "$db_name" -t -A -c "
    SELECT (seg->>'speaker') || E'\t' || replace(seg->>'text', E'\n', ' ')
    FROM chapters
    CROSS JOIN LATERAL jsonb_array_elements(content_segments) WITH ORDINALITY AS t(seg, ordinality)
    WHERE id=${chapter_id}
    ORDER BY ordinality;
  " 2>/dev/null > "$seg_file"

  local seg_count
  seg_count=$(wc -l < "$seg_file")
  echo "[chapter ${chapter_id}] TTS ${seg_count} segments (${tts_parallel} luồng)..."

  bash "${script_dir}/chapter_tts.sh" "$chapter_id" "$story_id" "$seg_file" "+0%" "$tts_parallel" \
    2>&1 | grep -E '^\[3/3\]|^Done:|^ERROR' | sed "s/^/  [ch${chapter_id}] /" || true

  if [[ -f "$audio_out" ]]; then
    echo "[chapter ${chapter_id}] DONE → ${audio_out}"
  else
    echo "[chapter ${chapter_id}] WARN: audio.mp3 không tạo được — sẽ retry lần sau"
  fi
}
export -f process_chapter

# Chạy chapters theo job pool với CH_PARALLEL luồng
done_count=0
running=0
declare -a PIDS=()
declare -a CHS=()

for chapter_id in "${CHAPTER_IDS[@]}"; do
  process_chapter "$chapter_id" "$STORY_ID" "$TTS_PARALLEL" \
    "$SCRIPT_DIR" "$DATA_DIR" "$DB_CONTAINER" "$DB_USER" "$DB_NAME" &

  PIDS+=($!)
  CHS+=("$chapter_id")
  running=$((running + 1))

  if [[ $running -ge $CH_PARALLEL ]]; then
    wait "${PIDS[0]}" || true
    done_count=$((done_count + 1))
    echo "--- Progress: ${done_count}/${TOTAL} chapters done ---"
    PIDS=("${PIDS[@]:1}")
    CHS=("${CHS[@]:1}")
    running=$((running - 1))
  fi
done

# Chờ các chapter còn lại
for pid in "${PIDS[@]}"; do
  wait "$pid" || true
  done_count=$((done_count + 1))
  echo "--- Progress: ${done_count}/${TOTAL} chapters done ---"
done

echo ""
echo "=== Hoàn tất: ${TOTAL} chapters → data/<chapter_id>/audio.mp3 ==="
