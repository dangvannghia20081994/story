# ANALYZE_FLOW — Quy trình chuẩn phân tích chương → `content_segments`

> Mục tiêu: mỗi khi có **chương mới** (hoặc chương segment kém) trong `chapters`, chạy quy trình này để sinh `content_segments` **chuẩn nhất** — phủ ≥95% nội dung, speaker đúng, `character_id` chỉ trỏ id có thật. Idempotent: chạy lại nhiều lần không hỏng dữ liệu, chỉ pick phần còn thiếu/kém.
>
> Phân tích chạy bằng **LLM reasoning** (spawn sub-agent `story-analyzer`, model Sonnet) — KHÔNG có worker Python tự động. Flow này là quy trình vận hành + tham chiếu prompt.
>
> - Prompt tách thoại canonical: [`SEGMENT_PROMPT.md`](SEGMENT_PROMPT.md)
> - Spec chi tiết agent: [`.claude/agents/story-analyzer.md`](.claude/agents/story-analyzer.md)
> - DB: Postgres container `story-db-1`. READ qua MCP `mcp__postgres-story__query`; WRITE qua `docker compose exec -T backend php artisan tinker` (jsonb an toàn) hoặc `docker compose exec -T db psql -U story -d story` (dollar-quote).
> - Tham số toàn bộ flow: `STORY_ID` (mặc định ví dụ = 1).

---

## 0. Nguồn sự thật (3 cờ phải khớp nhau)

Một chương được coi là **ĐÃ CHUẨN** ⇔ thỏa cả 3:

```
analyzed_at IS NOT NULL
AND content_segments hợp lệ (NOT NULL, khác 'null', khác '[]')
AND coverage BETWEEN 95 AND 100
```

Ngược lại → vào **todo set** (cần phân tích / sửa). `coverage` là % no-whitespace:
`coverage = SUM(len(text bỏ \s)) / len(content bỏ \s) * 100`.

> ⚠️ Lịch sử có lệch cờ (đã gặp 2026-06): segment có nhưng quên set `analyzed_at`; hoặc cờ set nhưng segment bị xóa. Vì vậy LUÔN dùng đồng thời cả 3 điều kiện, đừng tin riêng 1 cờ.

### Query trạng thái tổng (chạy đầu mỗi lần)

```sql
SELECT
  COUNT(*) total,
  COUNT(*) FILTER (WHERE analyzed_at IS NOT NULL
                     AND content_segments IS NOT NULL AND content_segments::text NOT IN ('null','[]')
                     AND coverage BETWEEN 95 AND 100)                                   AS done,
  COUNT(*) FILTER (WHERE content_segments IS NULL OR content_segments::text IN ('null','[]')) AS seg_empty,
  COUNT(*) FILTER (WHERE content_segments IS NOT NULL AND content_segments::text NOT IN ('null','[]')
                     AND (coverage IS NULL OR coverage < 95 OR coverage > 100))         AS seg_bad,
  COUNT(*) FILTER (WHERE analyzed_at IS NULL AND content_segments IS NOT NULL AND content_segments::text NOT IN ('null','[]')
                     AND coverage BETWEEN 95 AND 100)                                   AS flag_missing_only
FROM chapters WHERE story_id = :STORY_ID;
```

- `seg_empty` → chưa có segment (gồm cả chương mới crawl về).
- `seg_bad` → có segment nhưng coverage <95 (tách thiếu) hoặc >100 (lạc nội dung/nhân đôi).
- `flag_missing_only` → đã chuẩn nhưng chỉ thiếu cờ → **chỉ backfill cờ**, KHÔNG re-analyze (Phase 1).

---

## 1. Reconcile cờ (rẻ, làm trước — tránh phân tích lại oan)

**1a. Backfill `analyzed_at`** cho chương đã có segment đạt coverage nhưng quên cờ:

```sql
UPDATE chapters
SET analyzed_at = COALESCE(analyzed_at, updated_at, now())
WHERE story_id = :STORY_ID
  AND analyzed_at IS NULL
  AND content_segments IS NOT NULL AND content_segments::text NOT IN ('null','[]')
  AND coverage BETWEEN 95 AND 100;
```

**1b. Hạ cờ** chương có `analyzed_at` nhưng segment rỗng/hỏng (coverage thấp) → đưa về todo:

```sql
UPDATE chapters
SET analyzed_at = NULL
WHERE story_id = :STORY_ID
  AND analyzed_at IS NOT NULL
  AND (content_segments IS NULL OR content_segments::text IN ('null','[]')
       OR coverage IS NULL OR coverage < 95 OR coverage > 100);
```

Sau 1a+1b: `analyzed_at IS NULL` ⇔ "cần xử lý". Đây là cờ chọn batch ở Phase 2.

---

## 2. Chọn batch & chia luồng song song

### 2a. Danh sách cần xử lý (ordered)

```sql
SELECT id, chapter_number, length(content) clen,
       CASE
         WHEN content_segments IS NULL OR content_segments::text IN ('null','[]') THEN 'new'
         WHEN coverage < 95  THEN 'under'
         WHEN coverage > 100 THEN 'over'
         ELSE 'recheck'
       END AS reason
FROM chapters
WHERE story_id = :STORY_ID AND analyzed_at IS NULL
ORDER BY chapter_number ASC;
```

### 2b. Chia luồng

- Hỏi user **số luồng** trước mỗi batch (mặc định ưu tiên **≥6 luồng**).
- Chia danh sách id thành N nhóm **chẵn theo số chương**, mỗi luồng giữ TẬP id RỜI NHAU.
- Mỗi luồng = 1 Agent `story-analyzer`, spawn **song song trong 1 message**.
- Mỗi chapter ghi DB riêng (per-id `UPDATE`) → không race giữa luồng.
- Batch lớn (>40 chương): chia nhiều đợt, mỗi đợt N luồng × ~5 chương.

---

## 3. Pipeline 1 chương (mỗi luồng lặp cho từng id của mình)

### B1. Lấy nội dung
```sql
SELECT id, story_id, chapter_number, title, content FROM chapters WHERE id = :ID;
```

### B2. Làm sạch `content` (BẮT BUỘC, trước khi tách) — áp dụng ở CẢ `content` lẫn `content_segments`

**B2.1. Gỡ artifact crawler / meta-text biên tập AI**: vd `"Dưới đây là văn bản đã được biên tập lại:"`, bullet phân tích đại từ, câu xưng "Tôi sẽ biên tập…". Chỉ gỡ ĐÚNG chuỗi meta, GIỮ câu truyện liền kề. Chi tiết & cảnh báo: `story-analyzer.md` §B1.5. Báo story-master để `worker-crawler-python` fix selector gốc nếu artifact lặp lại.

**B2.2. Gỡ dòng/đoạn chỉ-ký-hiệu (symbol-only)**: bất kỳ dòng mà sau khi bỏ whitespace chỉ còn dấu/ký hiệu — `...` `…` `……` `..` `*` `***` `* * *` `---` `***` `===` `~~~` `___`, hoặc dots bọc trong ngoặc kép (`"..."`, `“…”`, `“......”`), lone `"`/`'` — đều là rác (scene-break marker, markdown sót, ngập ngừng rỗng). **Gỡ khỏi `content`** và **KHÔNG emit thành segment**.
  - Tiêu chí máy: text mà `regexp_replace(txt, '[^0-9A-Za-zÀ-ỹĐđ]', '', 'g')` ra rỗng → là symbol-only → bỏ.
  - GIỮ khi dấu nằm TRONG câu có chữ (vd `"Ta... ta không biết."` → giữ nguyên). Chỉ bỏ khi cả dòng/segment chỉ toàn dấu.

Nếu có gỡ ở content → `UPDATE chapters.content` rồi mới tách. SQL dọn hàng loạt dữ liệu cũ: xem **Phụ lục B — Dọn symbol-only**.

### B3. Nạp danh bạ (nguồn DUY NHẤT để gán `character_id`)
```sql
SELECT id, name FROM characters WHERE story_id = :STORY_ID ORDER BY id;
SELECT word, replacement FROM lexicons WHERE story_id = :STORY_ID AND type='name';
```

### B4. Tách segment — theo `SEGMENT_PROMPT.md`
Output: mảng `[{ "speaker", "text", "character_id": <int|null> }]` theo đúng thứ tự xuất hiện. Quy tắc cốt lõi (rút gọn — đọc đủ ở `SEGMENT_PROMPT.md`):

1. **Phủ toàn bộ content**, không tóm tắt, không bỏ đoạn. Segment cuối = câu cuối chương.
2. **Thoại** → `speaker` = tên nhân vật, `text` bỏ ngoặc kép bao ngoài; phần dẫn thoại ("…", hắn nói) tách thành `narration` riêng liền sau.
3. **Trần thuật / miêu tả / nội tâm thuật lại / tiếng động ngắn** → `speaker = "narration"`, `character_id = null`.
4. **`character_id` chỉ dùng id CÓ THẬT** trong danh bạ (khớp name hoặc alias lexicon→canonical). Không khớp → `null`. ❌ TUYỆT ĐỐI không bịa id, không đánh số 0,1,2…
5. **Chuẩn hóa speaker**: người kể luôn đúng chữ `"narration"`; tên viết GIỐNG HỆT danh bạ (đúng dấu/Hán-Việt). Nhãn vai vô danh (Lão hòa thượng, Thủ vệ…) → giữ nhãn + `character_id=null`. Không xác định → `speaker="_unknown"`.
6. **KHÔNG để speaker là fragment/câu cụt/lẫn động từ** (`"Triệu Đỉnh Thiên đáp"` SAI → speaker `"Triệu Đỉnh Thiên"`, chữ "đáp" thuộc narration). Đây là lỗi hay gặp nhất.
7. **Bỏ segment rỗng / symbol-only**: text sau trim mà rỗng, hoặc chỉ gồm dấu/ký hiệu — `...` `…` `……` `*` `***` `---` `"..."` `“…”`, lone `"`/`'`, `\n`… (không còn chữ/số sau khi bỏ `[^0-9A-Za-zÀ-ỹĐđ]`) → KHÔNG emit (xem B2.2). Đồng thời các chuỗi này cũng phải đã được gỡ khỏi `content`.
8. **KHÔNG tạo character mới trong luồng phân tích.** Tên rõ nhưng thiếu danh bạ → `character_id=null` + ghi lại tên đó để reconcile Phase 5.

### B5. Verify gate per-chapter (PHẢI đạt mới ghi)
```sql
SELECT jsonb_array_length(content_segments) n,
       ROUND((SELECT SUM(length(x->>'text')) FROM jsonb_array_elements(content_segments) x)::numeric
             / NULLIF(length(content),0), 3) cov_raw
FROM chapters WHERE id = :ID;
```
Hoặc tính trên JSON vừa sinh trước khi ghi. **Gate**: coverage no-whitespace ≥ 0.95 và ≤ 1.00, JSON parse được, không câu meta lọt vào. Không đạt → tách lại, KHÔNG ghi đại.

### B6. Ghi DB atomic — segment + cờ + coverage CÙNG LÚC
Cách an toàn nhất (tinker, không lo escape):
```bash
docker compose exec -T backend php artisan tinker --execute='
$c = App\Models\Chapter::find(:ID);
$c->content_segments = json_decode(file_get_contents("/tmp/seg_:ID.json"), true);
$c->analyzed_at = now();
$c->save();
'
docker compose exec -T backend php artisan chapters:recompute-coverage --id=:ID
```
Hoặc psql dollar-quote khi backend container TẮT (viết JSON ra `/tmp/seg_<id>.json` rồi):
```bash
docker compose exec -T db psql -U story -d story -v ON_ERROR_STOP=1 \
  -c "UPDATE chapters SET content_segments = \$json\$[...JSON...]\$json\$::jsonb, analyzed_at=now(), updated_at=now() WHERE id=<id>;"
```
**Bắt buộc** set/recompute `coverage` sau ghi để cột `coverage` không bị stale. Verify per-chapter:
```sql
SELECT jsonb_array_length(content_segments) n,
  ROUND((SELECT SUM(length(x->>'text')) FROM jsonb_array_elements(content_segments) x)::numeric/length(content),3) cov
FROM chapters WHERE id=<id>;  -- cov ≥ 0.95 mới đạt gate
```

### Output mỗi luồng (báo về)
Bảng: `id | n_segments | coverage | #character_id gán | tên thiếu danh bạ`.

---

## 4. (sau batch) Reconcile danh bạ + relink

Các "tên thiếu danh bạ" 6 luồng gom lại → quyết định ở **1 nơi** (tránh tạo trùng):
1. Tên là nhân vật thật → `Character::firstOrCreate(story_id, name)`; alias thật (`word≠replacement`) → `Lexicon::updateOrCreate(... type=name, priority=mb_strlen(word))`. Epithet mơ hồ (Hắc Y Nhân, Âm Ma Lão Nhân…) → để `null`.
2. **Relink deterministic** quét toàn story: gán `character_id` cho segment có speaker khớp name/alias mà đang null.
```sql
BEGIN;
UPDATE chapters c SET content_segments = sub.new_segs
FROM (
  SELECT s.id, jsonb_agg(
    CASE WHEN (t.e->>'character_id') IS NULL AND t.e->>'speaker' NOT IN ('narration','_unknown') AND r.cid IS NOT NULL
         THEN t.e || jsonb_build_object('character_id', r.cid) ELSE t.e END ORDER BY t.ord) AS new_segs
  FROM chapters s
  CROSS JOIN LATERAL jsonb_array_elements(s.content_segments) WITH ORDINALITY AS t(e, ord)
  LEFT JOIN LATERAL (
     SELECT COALESCE(
        (SELECT ch.id FROM characters ch WHERE ch.story_id=s.story_id AND lower(ch.name)=lower(t.e->>'speaker') ORDER BY ch.id LIMIT 1),
        (SELECT ch.id FROM lexicons lx JOIN characters ch ON ch.story_id=s.story_id AND lower(ch.name)=lower(lx.replacement)
          WHERE lx.story_id=s.story_id AND lx.type='name' AND lower(lx.word)=lower(t.e->>'speaker') ORDER BY ch.id LIMIT 1)
     ) AS cid) r ON true
  WHERE s.content_segments IS NOT NULL AND s.story_id=1
  GROUP BY s.id) sub
WHERE c.id = sub.id;
COMMIT;
```
3. Đo lại metric tổng (coverage trung bình, total `_unknown`, total no-cid):
```sql
WITH seg AS (SELECT c.id, c.content_segments, length(c.content) clen FROM chapters c WHERE c.content_segments IS NOT NULL AND c.story_id=1),
agg AS (SELECT s.id,
   SUM(length(e->>'text'))::numeric/NULLIF(s.clen,0) cov,
   COUNT(*) FILTER (WHERE e->>'speaker'='_unknown') n_unknown,
   COUNT(*) FILTER (WHERE e->>'speaker' NOT IN ('narration','_unknown') AND (e->>'character_id') IS NULL) n_nocid
   FROM seg s, jsonb_array_elements(s.content_segments) e GROUP BY s.id, s.clen)
SELECT COUNT(*) chapters, ROUND(AVG(cov),3) avg_cov,
   COUNT(*) FILTER (WHERE cov<0.80) cov_lt_80, SUM(n_unknown) total_unknown, SUM(n_nocid) total_nocid FROM agg;
```
> Epithet mơ hồ (Âm Ma Lão Nhân, Thất Sát, Hắc Y Nhân, Vô Cực Kiếm Thánh…) tạm để `null` cho tới khi tái xuất đủ cơ sở tạo character.

---

## 5. Đóng sổ & báo cáo

Chạy lại query Phase 0 → kỳ vọng `seg_empty = 0`, `seg_bad = 0`, `flag_missing_only = 0`.

Báo user: `processed=N, backfilled_flag=B, re-analyzed=R, failed=K`, kèm before→after (avg coverage, #chương <95 hoặc >100, total no-cid). KHÔNG claim done nếu còn chương trong todo set.

---

## Phụ lục — trạng thái snapshot 2026-06-02 (story_id=1, total 1069)

| Nhóm | Số chương | Hành động |
|---|---|---|
| Đã chuẩn (3 cờ khớp) | ~730 | bỏ qua |
| `seg_empty` (chưa có segment) | 272 | Phase 2→3 |
| Có segment nhưng thiếu cờ, coverage OK | 66 | **Phase 1a** (backfill cờ) |
| Có segment nhưng thiếu cờ, coverage xấu | 33 | Phase 1b→3 (re-analyze) |
| Cờ set nhưng segment NULL (907,909,911) | 3 | Phase 1b→3 |

> Sau Phase 1: todo set ≈ 272 (mới) + 33 + 3 = **308 chương** cần phân tích; 66 chương chỉ cần backfill cờ.

---

## Phụ lục B — Dọn symbol-only ở dữ liệu cũ (`content` + `content_segments`)

Áp dụng cho chương ĐÃ phân tích nhưng còn lẫn segment/đoạn chỉ-ký-hiệu. Deterministic, không cần LLM. **Backup trước**, chạy preview trước khi UPDATE.

**Định nghĩa junk**: `regexp_replace(text, '[^0-9A-Za-zÀ-ỹĐđ]', '', 'g') = ''` (sau khi bỏ mọi ký tự không phải chữ/số thì rỗng).

### B-0. Preview (read-only — đếm trước khi đụng)
```sql
WITH segs AS (SELECT c.id, e->>'text' txt FROM chapters c
  CROSS JOIN LATERAL jsonb_array_elements(c.content_segments) e
  WHERE c.content_segments IS NOT NULL AND c.content_segments::text NOT IN ('null','[]'))
SELECT COUNT(*) junk_segments, COUNT(DISTINCT id) chapters
FROM segs WHERE regexp_replace(txt,'[^0-9A-Za-zÀ-ỹĐđ]','','g') = '';
```

### B-1. Backup
```sql
CREATE TABLE IF NOT EXISTS chapters_cleanup_bak AS
SELECT id, content, content_segments, now() AS backed_up_at FROM chapters WHERE 1=0;
INSERT INTO chapters_cleanup_bak
SELECT id, content, content_segments, now() FROM chapters
WHERE story_id = :STORY_ID;  -- hoặc lọc đúng chương sắp đụng
```

### B-2. Lọc segment symbol-only khỏi `content_segments`
```sql
BEGIN;
UPDATE chapters c SET
  content_segments = COALESCE((
    SELECT jsonb_agg(e ORDER BY ord)
    FROM jsonb_array_elements(c.content_segments) WITH ORDINALITY AS t(e, ord)
    WHERE regexp_replace(e->>'text', '[^0-9A-Za-zÀ-ỹĐđ]', '', 'g') <> ''
  ), '[]'::jsonb),
  updated_at = now()
WHERE c.story_id = :STORY_ID
  AND c.content_segments IS NOT NULL AND c.content_segments::text NOT IN ('null','[]')
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(c.content_segments) e
    WHERE regexp_replace(e->>'text', '[^0-9A-Za-zÀ-ỹĐđ]', '', 'g') = ''
  );
COMMIT;
```

### B-3. Gỡ dòng symbol-only khỏi `content`
Xóa từng DÒNG chỉ gồm ký hiệu (multiline), rồi gộp dòng trống thừa. GIỮ dấu nằm trong câu có chữ.
```sql
BEGIN;
UPDATE chapters SET
  content = regexp_replace(
              regexp_replace(content, '(?m)^[\s\.\…\*\-—–_=~"''“”‘’]+$', '', 'g'),
              '\n{3,}', E'\n\n', 'g'),
  updated_at = now()
WHERE story_id = :STORY_ID
  AND content ~ '(?m)^[\s\.\…\*\-—–_=~"''“”‘’]+$';
COMMIT;
```

### B-4. Recompute coverage cho chương vừa đụng & verify
```bash
docker compose exec -T backend php artisan chapters:recompute-coverage   # hoặc --id=... từng chương
```
Chạy lại B-0 → kỳ vọng `junk_segments = 0`. Coverage không tụt vì junk bị bỏ ở CẢ tử (segment) lẫn mẫu (content).

> Riêng **artifact biên tập AI** không deterministic được — quét bằng LLM (story-analyzer §B1.5) cho các chương nghi ngờ, backup `chapters_artifact_bak` như lần 2026-06-02.
