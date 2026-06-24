#!/usr/bin/env bash
# TTS toàn bộ chapters của 1 story bằng 1 voice cố định → audio_single_path
# Usage: ./story_single_tts.sh <story_id> <voice_id> [limit] [chapter_parallel] [tts_parallel]
#
# story_id         : ID của story cần xử lý
# voice_id         : Voice ID (default: capcut:BV074_streaming; hỗ trợ: 8001-8004, edge:vi-VN-HoaiMyNeural...)
# limit            : số chapter xử lý (default: 100)
# chapter_parallel : số chapter chạy đồng thời (default: 3)
# tts_parallel     : số luồng TTS mỗi chapter (default: 6)
#
# Output: backend/storage/app/public/stories/<story_id>/chapters/<chapter_id>/audio_single.mp3
# Skip  : chapter đã có audio_single.mp3 trên disk (resume-safe)

set -euo pipefail

STORY_ID="${1:?Thiếu story_id. Usage: $0 <story_id> [voice_id] [limit] [chapter_parallel] [tts_parallel]}"
VOICE_ID="${2:-capcut:BV074_streaming}"
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
    AND content IS NOT NULL
    AND length(trim(content)) > 0
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
  echo "[chapter ${chapter_id}] Lấy content từ DB..."

  # Lấy content, strip HTML tags
  local raw_content
  raw_content=$(docker exec "$db_container" psql -U "$db_user" -d "$db_name" -t -A -c "
    SELECT trim(regexp_replace(regexp_replace(content, '<[^>]+>', ' ', 'g'), '\s+', ' ', 'g'))
    FROM chapters WHERE id=${chapter_id};
  " 2>/dev/null)

  if [[ -z "${raw_content// }" ]]; then
    echo "[chapter ${chapter_id}] WARN: content rỗng — bỏ qua"
    return 0
  fi

  local content_len=${#raw_content}
  local max_chars=9000

  # Tách thành chunks nếu vượt giới hạn 10k ký tự API
  local chunks=()
  if [[ $content_len -le $max_chars ]]; then
    chunks=("$raw_content")
  else
    local buf="" buf_len=0
    for word in $raw_content; do
      local wlen=${#word}
      if [[ $buf_len -gt 0 && $((buf_len + wlen + 1)) -gt $max_chars ]]; then
        chunks+=("$buf")
        buf="$word"; buf_len=$wlen
      else
        [[ $buf_len -gt 0 ]] && buf="${buf} ${word}" || buf="$word"
        buf_len=$((buf_len + wlen + 1))
      fi
    done
    [[ -n "${buf:-}" ]] && chunks+=("$buf")
  fi

  local num_chunks=${#chunks[@]}
  echo "[chapter ${chapter_id}] TTS ${num_chunks} call(s) (~${content_len} ký tự) voice=${voice_id}..."

  # TTS từng chunk, retry 3 lần mỗi chunk
  local ci attempt fsize success
  for ci in "${!chunks[@]}"; do
    local seg_file
    seg_file=$(printf "%s/segment_%03d.mp3" "$seg_dir" "$((ci+1))")
    success=0
    for attempt in 1 2 3; do
      if bash "${script_dir}/tts_revid.sh" "${chunks[$ci]}" "$voice_id" "+0%" "$seg_file" 2>/dev/null; then
        fsize=$(stat -c%s "$seg_file" 2>/dev/null || echo 0)
        if [[ $fsize -gt 1000 ]]; then
          echo "[chapter ${chapter_id}] chunk $((ci+1))/${num_chunks} ✓ (${fsize}B)"
          success=1; break
        fi
      fi
      rm -f "$seg_file"; sleep 3
    done
    if [[ $success -eq 0 ]]; then
      echo "[chapter ${chapter_id}] WARN: chunk $((ci+1)) TTS thất bại — bỏ qua chapter"
      return 0
    fi
  done

  # Nếu chỉ 1 chunk → mv thẳng; nhiều chunk → merge
  if [[ $num_chunks -eq 1 ]]; then
    mv "${seg_dir}/segment_001.mp3" "$audio_out"
  else
    local merge_output
    merge_output=$(docker run --rm \
      --user "$(id -u):$(id -g)" \
      -v "$(realpath "$seg_dir"):/data" \
      "$MERGE_IMAGE" audio_single.mp3 2>&1)
    echo "$merge_output"
    local merged="${seg_dir}/audio_single.mp3"
    if [[ ! -f "$merged" ]]; then
      echo "[chapter ${chapter_id}] WARN: merge thất bại — sẽ retry lần sau"
      return 0
    fi
    mv "$merged" "$audio_out"
  fi

  local size duration_sec
  size=$(du -h "$audio_out" | cut -f1)
  duration_sec=$(docker run --rm \
    --user "$(id -u):$(id -g)" \
    -v "$(realpath "$out_dir"):/data" \
    --entrypoint ffprobe "$MERGE_IMAGE" \
    -v quiet -show_entries format=duration -of csv=p=0 /data/audio_single.mp3 2>/dev/null \
    | awk '{printf "%d", int($1 + 0.5)}' || echo 0)

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
