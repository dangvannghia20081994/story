1. Yêu cầu hệ thống
Trước khi bắt đầu, hãy đảm bảo máy tính của bạn đáp ứng các yêu cầu sau:

Hệ điều hành: Windows (hoặc macOS/Linux).

Bộ xử lý (CPU): Lõi kép trở lên (khuyến nghị Core i5/i7 trở lên) để có hiệu suất real-time.

Bộ nhớ RAM: Ít nhất 4 GB (khuyến nghị 8 GB trở lên).

Dung lượng lưu trữ: Khoảng 2 GB để tải và lưu trữ model.

Python: Phiên bản 3.10 trở lên nếu bạn muốn sử dụng SDK.

Phần cứng đồ họa (GPU): Không bắt buộc. Model có thể chạy tốt ngay trên CPU.

2. Chuẩn bị file âm thanh mẫu (Reference Audio)
Chất lượng của giọng nói được nhân bản phụ thuộc rất nhiều vào file mẫu. Để có kết quả tốt nhất, bạn cần:

Độ dài lý tưởng: Từ 3 đến 10 giây là đủ để model có thể nắm bắt được đặc trưng giọng nói. Mặc dù có thể hoạt động với mẫu 3-5 giây, nhưng những file dài hơn một chút (ví dụ 10 giây) thường mang lại chất lượng ổn định hơn.

Định dạng hỗ trợ: VieNeu-TTS hỗ trợ các định dạng .wav, .mp3, và .flac.

Chất lượng: File mẫu cần có chất lượng âm thanh tốt, rõ ràng, không có tạp âm nền, tiếng vọng hoặc nhạc nền.

Nội dung: Nội dung trong file mẫu nên đa dạng về mặt ngữ âm để model có thể học trọn vẹn sắc thái giọng nói.

Âm lượng: Ở mức vừa phải, không quá nhỏ cũng không quá to để tránh gây méo tiếng.

3. Cài đặt
Bạn có hai lựa chọn để cài đặt và sử dụng VieNeu-TTS:

Lựa chọn A: Cài đặt nhanh với Giao diện Đồ họa (GUI)
Đây là cách đơn giản nhất, phù hợp cho người dùng phổ thông hoặc muốn trải nghiệm nhanh.

Tải ứng dụng: Truy cập trang Releases của dự án để tải file ZIP về máy.

Giải nén và chạy: Giải nén file ZIP và chạy file .exe bên trong. Giao diện web sẽ tự động mở ra trong trình duyệt của bạn. Tại đây, bạn có thể chọn giọng đọc, nhập văn bản và nhấn "Convert" để nghe thử.

Lựa chọn B: Cài đặt bằng Python SDK (Linh hoạt)
Cách này dành cho lập trình viên hoặc những ai muốn có toàn quyền kiểm soát và tích hợp TTS vào dự án của mình.

Cài đặt eSpeak NG (Bắt buộc): Đây là thành phần không thể thiếu để TTS có thể phát âm tiếng Việt chính xác.

Tải và cài đặt eSpeak NG từ trang chính thức: https://github.com/espeak-ng/espeak-ng/releases (tải file .msi cho Windows).

Cài đặt thư viện vieneu:
Mở Command Prompt (cmd) hoặc PowerShell và chạy lệnh:

```bash
pip install vieneu --extra-index-url https://pnnbao97.github.io/llama-cpp-python-v0.3.16/cpu/
```

Lệnh này sẽ cài đặt thư viện cùng với llama-cpp-python đã được biên dịch sẵn, tránh các lỗi thường gặp trên Windows.

**Linux / macOS (trong repo, thư mục `worker-tts`):** dùng virtualenv và file `requirements.txt` (đã gồm `--extra-index-url` ở trên):

```bash
cd worker-tts
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -U pip
pip install -r requirements.txt
python check_install.py
```

Trên Linux, cài **eSpeak NG** hệ thống trước khi chạy TTS: `sudo apt install espeak-ng` (Debian/Ubuntu). Sau đó: `python synth_vieneu.py --text "Câu thử."` — xem [README.md](README.md).

4. Hướng dẫn sử dụng Voice Cloning
Sau khi cài đặt xong, bạn có thể sử dụng tính năng voice cloning. VieNeu-TTS sử dụng công nghệ Zero-shot Voice Cloning, nghĩa là bạn có thể nhân bản bất kỳ giọng nói nào chỉ với một đoạn âm thanh mẫu ngắn mà không cần phải huấn luyện lại (fine-tune) model.

Sử dụng với Python SDK (Linh hoạt)
Dưới đây là một đoạn code mẫu hoàn chỉnh để bạn thực hiện nhân bản giọng nói và lưu kết quả ra file MP3:

python
from vieneu import Vieneu

# 1. Khởi tạo model
# Lần đầu chạy, model sẽ tự động tải về máy bạn (khoảng hơn 1GB)
tts = Vieneu()  

# 2. Đường dẫn đến file giọng mẫu (3-10 giây) của bạn
path_to_ref_audio = "duong_dan/toi/file_giong_mau.wav"

# 3. Mã hóa giọng mẫu để tạo "dấu vân tay giọng nói"
cloned_voice = tts.encode_reference(path_to_ref_audio)

# 4. Nhập văn bản bạn muốn đọc bằng giọng vừa clone
text_to_speak = "Xin chào, đây là giọng nói của tôi sau khi được nhân bản."

# 5. Tổng hợp giọng nói
audio_cloned = tts.infer(text=text_to_speak, voice=cloned_voice)

# 6. Lưu kết quả ra file MP3
tts.save(audio_cloned, "output_cloned_voice.mp3")

print("✅ Đã tạo file MP3 thành công!")
Sử dụng với Giao diện Đồ họa (Dễ dùng)
Sau khi mở ứng dụng, bạn làm theo các bước sau:

Chọn chế độ Voice Cloning: Tìm và chọn tùy chọn "Clone Voice" hoặc tương tự trên giao diện.

Tải file giọng mẫu: Nhấp vào nút để tải lên file âm thanh giọng mẫu của bạn (đã chuẩn bị ở bước 2).

Nhập văn bản: Gõ hoặc dán văn bản bạn muốn chuyển đổi thành giọng nói.

Tổng hợp và lưu: Nhấn nút "Convert" hoặc "Play" để nghe thử. Nếu ưng ý, bạn có thể nhấn "Save" để lưu file âm thanh.

💡 Mẹo khắc phục sự cố thường gặp
Chất lượng giọng clone không tốt:

Nguyên nhân: Có thể do file âm thanh mẫu có tạp âm, quá ngắn hoặc văn bản cần đọc quá ngắn (dưới 5 từ).

Khắc phục: Hãy thử một file mẫu khác có chất lượng tốt hơn hoặc dài hơn (khoảng 5-10 giây). Nếu có thể, hãy thử với văn bản dài hơn.

Lỗi cài đặt llama-cpp-python:

Nguyên nhân: Lỗi này thường gặp trên Windows do quá trình biên dịch gặp trục trặc.

Khắc phục: Sử dụng chính xác lệnh pip được cung cấp ở trên. Nó đã bao gồm một phiên bản đã được biên dịch sẵn, giải quyết triệt để lỗi này.