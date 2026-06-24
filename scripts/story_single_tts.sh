#!/usr/bin/env bash
# TTS toàn bộ chapters của 1 story bằng 1 voice cố định → audio_single_path
# Usage: ./story_single_tts.sh <story_id> <voice_id> [limit] [chapter_parallel] [tts_parallel]
#
# story_id         : ID của story cần xử lý
# voice_id         : Voice ID (vd: capcut:BV074_streaming, 8001, edge:vi-VN-HoaiMyNeural)
# limit            : số chapter xử lý (default: 100)
# chapter_parallel : số chapter chạy đồng thời (default: 3)
# tts_parallel     : số luồng TTS mỗi chapter (default: 6)
#
# Output: backend/storage/app/public/stories/<story_id>/chapters/<chapter_id>/audio_single.mp3
# Skip  : chapter đã có audio_single.mp3 trên disk (resume-safe)

set -euo pipefail

STORY_ID="${1:?Thiếu story_id. Usage: $0 <story_id> <voice_id> [limit] [chapter_parallel] [tts_parallel]}"
VOICE_ID="${2:?Thiếu voice_id. Ví dụ: capcut:BV074_streaming}"
LIMIT="${3:-100}"
CH_PARALLEL="${4:-3}"
TTS_PARALLEL="${5:-6}"

DB_CONTAINER="${DB_CONTAINER:-story-db-1}"
DB_USER="${DB_USER:-story}"
DB_NAME="${DB_NAME:-story}"
MERGE_IMAGE="${MERGE_IMAGE:-story-merge}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(realpath "${SCRIPT_DIR}/..")"
DATA_DIR="${REPO_ROOT}/data"
mkdir -p "$DATA_DIR"

echo "=== Story Single TTS: story_id=${STORY_ID} voice=${VOICE_ID} ==="
echo "Limit: ${LIMIT} chapters | Chapter parallel: ${CH_PARALLEL} | TTS parallel: ${TTS_PARALLEL}"
echo ""

# Lấy danh sách chapter_id chưa có audio_single_path
mapfile -t CHAPTER_IDS < <(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "
  SELECT id FROM chapters
  WHERE story_id=${STORY_ID}
    AND content_segments IS NOT NULL
    AND jsonb_array_length(content_segments) > 0
    AND audio_single_path IS NULL
  ORDER BY id ASC
  LIMIT ${LIMIT};
" 2>/dev/null | grep -E '^[0-9]+$')

TOTAL=${#CHAPTER_IDS[@]}
echo "Tìm thấy: ${TOTAL} chapters cần xử lý"
echo ""

# Xử lý 1 chapter
process_chapter() {
  local chapter_id="$1"
  local story_id="$2"
  local voice_id="$3"
  local tts_parallel="$4"
  local script_dir="$5"
  local data_dir="$6"
  local db_container="$7"
  local db_user="$8"
  local db_name="$9"

  local repo_root
  repo_root="$(realpath "${script_dir}/..")"
  local out_dir="${repo_root}/backend/storage/app/public/stories/${story_id}/chapters/${chapter_id}"
  local audio_out="${out_dir}/audio_single.mp3"
  local seg_dir="${data_dir}/${chapter_id}_single"

  # Skip nếu đã có audio_single.mp3
  if [[ -f "$audio_out" ]]; then
    echo "[chapter ${chapter_id}] SKIP (đã có audio_single.mp3)"
    local db_path="stories/${story_id}/chapters/${chapter_id}/audio_single.mp3"
    docker exec "$db_container" psql -U "$db_user" -d "$db_name" -c \
      "UPDATE chapters SET audio_single_path='${db_path}' WHERE id=${chapter_id} AND audio_single_path IS NULL;" \
      2>/dev/null || true
    return 0
  fi

  mkdir -p "$out_dir" "$seg_dir"
  echo "[chapter ${chapter_id}] Export segments text..."

  # Export toàn bộ text từ content_segments (bỏ qua speaker, chỉ lấy text)
  local texts_file="${seg_dir}/texts.txt"
  docker exec "$db_container" psql -U "$db_user" -d "$db_name" -t -A -c "
    SELECT replace(seg->>'text', E'\n', ' ')
    FROM chapters
    CROSS JOIN LATERAL jsonb_array_elements(content_segments) WITH ORDINALITY AS t(seg, ordinality)
    WHERE id=${chapter_id}
      AND (seg->>'text') IS NOT NULL
      AND length(trim(seg->>'text')) > 0
    ORDER BY ordinality;
  " 2>/dev/null > "$texts_file"

  local seg_count
  seg_count=$(grep -c . "$texts_file" 2>/dev/null || echo 0)
  if [[ $seg_count -eq 0 ]]; then
    echo "[chapter ${chapter_id}] WARN: không có text nào — bỏ qua"
    return 0
  fi

  echo "[chapter ${chapter_id}] TTS ${seg_count} segments với voice=${voice_id} (${tts_parallel} luồng)..."

  # Hàm TTS 1 segment — retry 3 lần
  run_tts_single() {
    local idx="$1"
    local text="$2"
    local voice="$3"
    local seg_dir="$4"
    local script_dir="$5"

    local seg_file
    seg_file=$(printf "%s/segment_%03d.mp3" "$seg_dir" "$idx")

    local attempt fsize
    for attempt in 1 2 3; do
      if bash "${script_dir}/tts_revid.sh" "$text" "$voice" "+0%" "$seg_file" 2>/dev/null; then
        fsize=$(stat -c%s "$seg_file" 2>/dev/null || echo 0)
        if [[ $fsize -gt 500 ]]; then
          echo "[${idx}] ✓ (${fsize}B)"
          return 0
        fi
      fi
      echo "[${idx}] attempt ${attempt} failed, retry..." >&2
      rm -f "$seg_file"
      sleep 2
    done
    echo "[${idx}] ERROR: TTS thất bại sau 3 lần — bỏ qua segment" >&2
    return 0
  }
  export -f run_tts_single

  # Đọc texts file → job pool
  local idx=0
  local running=0
  declare -a PIDS=()

  while IFS= read -r text_line || [[ -n "${text_line:-}" ]]; do
    [[ -z "${text_line// }" ]] && continue
    idx=$((idx + 1))

    run_tts_single "$idx" "$text_line" "$voice_id" "$seg_dir" "$script_dir" &
    PIDS+=($!)
    running=$((running + 1))

    if [[ $running -ge $tts_parallel ]]; then
      wait "${PIDS[0]}" || true
      PIDS=("${PIDS[@]:1}")
      running=$((running - 1))
    fi
  done < "$texts_file"

  for pid in "${PIDS[@]}"; do
    wait "$pid" || true
  done

  # Đếm segments tạo được
  local created
  created=$(ls "${seg_dir}"/segment_*.mp3 2>/dev/null | wc -l)
  echo "[chapter ${chapter_id}] Đã tạo: ${created}/${idx} segments"

  if [[ $created -eq 0 ]]; then
    echo "[chapter ${chapter_id}] ERROR: Không có segment nào — bỏ qua"
    return 0
  fi

  # Merge bằng story-merge Docker image, output = audio_single.mp3
  echo "[chapter ${chapter_id}] Merging ${created} segments → audio_single.mp3..."
  local merge_output
  merge_output=$(docker run --rm \
    --user "$(id -u):$(id -g)" \
    -v "$(realpath "$seg_dir"):/data" \
    "$MERGE_IMAGE" audio_single.mp3 2>&1)
  echo "$merge_output"

  local merged_file="${seg_dir}/audio_single.mp3"
  if [[ ! -f "$merged_file" ]]; then
    echo "[chapter ${chapter_id}] WARN: merge thất bại — sẽ retry lần sau"
    return 0
  fi

  # Di chuyển sang out_dir
  mv "$merged_file" "$audio_out"

  local size duration_sec
  size=$(du -h "$audio_out" | cut -f1)
  duration_sec=$(echo "$merge_output" | grep '^DURATION_SEC=' | cut -d= -f2 | tr -d '[:space:]')

  # Update DB
  local db_path="stories/${story_id}/chapters/${chapter_id}/audio_single.mp3"
  if docker exec "$db_container" psql -U "$db_user" -d "$db_name" -c \
    "UPDATE chapters SET audio_single_path='${db_path}' WHERE id=${chapter_id};" 2>/dev/null; then
    echo "[chapter ${chapter_id}] DB: audio_single_path=${db_path} duration≈${duration_sec:-?}s"
  fi

  echo "[chapter ${chapter_id}] DONE → ${audio_out} | Size: ${size}"
}
export -f process_chapter

# Job pool
done_count=0
running=0
declare -a PIDS=()

for chapter_id in "${CHAPTER_IDS[@]}"; do
  process_chapter "$chapter_id" "$STORY_ID" "$VOICE_ID" "$TTS_PARALLEL" \
    "$SCRIPT_DIR" "$DATA_DIR" "$DB_CONTAINER" "$DB_USER" "$DB_NAME" &

  PIDS+=($!)
  running=$((running + 1))

  if [[ $running -ge $CH_PARALLEL ]]; then
    wait "${PIDS[0]}" || true
    done_count=$((done_count + 1))
    echo "--- Progress: ${done_count}/${TOTAL} chapters done ---"
    PIDS=("${PIDS[@]:1}")
    running=$((running - 1))
  fi
done

for pid in "${PIDS[@]}"; do
  wait "$pid" || true
  done_count=$((done_count + 1))
  echo "--- Progress: ${done_count}/${TOTAL} chapters done ---"
done

echo ""
echo "=== Hoàn tất: ${TOTAL} chapters → audio_single.mp3 ==="
