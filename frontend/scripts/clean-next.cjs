/* Xóa thư mục .next — dùng khi dev/build báo ENOENT hoặc manifest lỗi (Windows / Turbopack). */
const fs = require("fs");
const path = require("path");

const nextDir = path.join(__dirname, "..", ".next");
if (fs.existsSync(nextDir)) {
  fs.rmSync(nextDir, { recursive: true, force: true });
  // eslint-disable-next-line no-console -- CLI script
  console.log("Removed .next");
} else {
  // eslint-disable-next-line no-console -- CLI script
  console.log(".next not found, nothing to remove");
}
