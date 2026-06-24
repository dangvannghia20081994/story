#!/usr/bin/env bash
# Revid TTS API — tổng hợp giọng đọc tiếng Việt
# Usage: ./tts_revid.sh "<text>" <voice_id> [rate] [output_file]
#
# voice_id format:
#   8001-8004, 5000-5029  → Revid integer voice  (field: voice_id)
#   edge:<voice>          → Microsoft Edge TTS   (field: engine + voice)
#   capcut:<voice>        → CapCut TTS           (field: engine + voice)
#
# rate   : "+0%" | "+10%" | "-10%" | ... (default: +0%)
# output : path file mp3 để lưu; bỏ trống → in JSON thô
#          đặt biến TTS_DATA_DIR để auto-save vào thư mục đó

set -euo pipefail

TEXT="${1:?Thiếu text. Usage: $0 \"<text>\" <voice_id> [rate] [output_file]}"
VOICE_ID="${2:?Thiếu voice_id}"
RATE="${3:-+0%}"
OUTPUT="${4:-}"

API_KEY="sk_JyvWEYr8akwJwrvhsKo2tN1wJcLPUZ7z"

# --- Build payload theo loại voice ---
if [[ "$VOICE_ID" =~ ^[0-9]+$ ]]; then
  # Revid integer voice
  PAYLOAD=$(jq -n \
    --arg  text     "$TEXT" \
    --argjson voice_id "$VOICE_ID" \
    --arg  rate     "$RATE" \
    '{text: $text, language: "vi-VN", return_base64: true, voice_id: $voice_id, rate: $rate}')

elif [[ "$VOICE_ID" == edge:* ]]; then
  # Microsoft Edge TTS: edge:vi-VN-HoaiMyNeural → engine=edge, voice=vi-VN-HoaiMyNeural
  VOICE_NAME="${VOICE_ID#edge:}"
  PAYLOAD=$(jq -n \
    --arg text   "$TEXT" \
    --arg voice  "$VOICE_NAME" \
    --arg rate   "$RATE" \
    '{text: $text, language: "vi-VN", return_base64: true, engine: "edge", voice: $voice, rate: $rate, pitch: "+0Hz"}')

elif [[ "$VOICE_ID" == capcut:* ]]; then
  # CapCut TTS: capcut:BV074_streaming → engine=capcut, voice=BV074_streaming
  VOICE_NAME="${VOICE_ID#capcut:}"
  PAYLOAD=$(jq -n \
    --arg text   "$TEXT" \
    --arg voice  "$VOICE_NAME" \
    --arg rate   "$RATE" \
    '{text: $text, language: "vi-VN", return_base64: true, engine: "capcut", voice: $voice, rate: $rate, pitch: "+0Hz"}')

else
  echo "ERROR: voice_id không hợp lệ: $VOICE_ID" >&2
  exit 1
fi

# --- Gọi API ---
RESPONSE=$(curl -s 'https://tts.revidapi.com/api/v1/tts' \
  -H 'accept: */*' \
  -H 'accept-language: en-US,en;q=0.9,vi;q=0.8' \
  -H 'content-type: application/json' \
  -H 'origin: https://revidapi.com' \
  -H 'priority: u=1, i' \
  -H 'referer: https://revidapi.com/' \
  -H 'sec-ch-ua: "Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Linux"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-site' \
  -H 'user-agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36' \
  -H "x-api-key: $API_KEY" \
  -H 'x-revidapi-client: tts-studio' \
  --data-raw "$PAYLOAD")

# --- Xử lý output ---
if [[ -z "$OUTPUT" && -n "${TTS_DATA_DIR:-}" ]]; then
  mkdir -p "$TTS_DATA_DIR"
  OUTPUT="${TTS_DATA_DIR}/$(date +%s%N).mp3"
fi

if [[ -n "$OUTPUT" ]]; then
  echo "$RESPONSE" | jq -r '.audio // .audio_base64 // .data // error("No audio field in response")' | base64 -d > "$OUTPUT"
  echo "Saved: $OUTPUT ($(du -h "$OUTPUT" | cut -f1))"
else
  echo "$RESPONSE"
fi
