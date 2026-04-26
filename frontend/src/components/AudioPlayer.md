1. Kiến trúc xử lý dữ liệu
Thay vì đưa cả một đoạn văn dài vào TTS, chúng ta sẽ xử lý dữ liệu qua các bước sau:

Chuẩn hóa: Tách văn bản tổng thành một mảng các câu dựa trên dấu chấm, dấu chấm hỏi, dấu chấm than.

Quản lý Index: Sử dụng useState để theo dõi câu nào đang được đọc.

Điều khiển: Hàm Play/Pause sẽ kích hoạt hoặc hủy speechSynthesis dựa trên index hiện tại.

2. Các bước triển khai (Workflow)
Bước 1: Utility tách câu (Sentence Splitter)
Tạo một hàm helper để tách text. Điều này giúp việc "seek" trở nên chính xác vì bạn nhảy theo đơn vị câu.

TypeScript
const splitIntoSentences = (text: string): string[] => {
  return text.split(/([.?!])\s+/).reduce((acc, cur, i, arr) => {
    if (i % 2 === 0) acc.push(cur + (arr[i + 1] || ""));
    return acc;
  }, [] as string[]);
};
Bước 2: Xây dựng Custom Hook useTTS
Sử dụng một Hook để đóng gói logic điều khiển.

State: currentIndex (đoạn đang đọc), isPlaying.

Action seek(index): 1. Gọi window.speechSynthesis.cancel().
2. Cập nhật setCurrentIndex(index).
3. Gọi hàm speak với đoạn văn bản tại index mới.

Bước 3: Giao diện điều khiển (UI)
Sử dụng một thanh Slider (như của thư viện Shadcn/ui hoặc HTML5 <input type="range">).

Giá trị max của Slider chính là sentences.length - 1.

Khi người dùng kéo Slider (onChange), bạn gọi hàm seek().

3. Cấu trúc Component mẫu trong Next.js
TypeScript
"use client";
import { useState, useEffect } from "react";

export default function TTSPlayer({ text }: { text: string }) {
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setSentences(splitIntoSentences(text));
  }, [text]);

  const speak = (index: number) => {
    window.speechSynthesis.cancel(); // Dừng câu hiện tại ngay lập tức
    const utterance = new SpeechSynthesisUtterance(sentences[index]);
    
    utterance.onend = () => {
      if (index < sentences.length - 1) {
        setCurrentIndex(index + 1);
        speak(index + 1); // Tự động đọc câu tiếp theo
      } else {
        setIsPlaying(false);
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleSeek = (index: number) => {
    setCurrentIndex(index);
    if (isPlaying) speak(index);
  };

  return (
    <div className="p-4 border rounded-lg">
      {/* Thanh Seek */}
      <input 
        type="range" 
        min="0" 
        max={sentences.length - 1} 
        value={currentIndex}
        onChange={(e) => handleSeek(parseInt(e.target.value))}
        className="w-full"
      />
      
      <div className="flex gap-4 mt-2">
        <button onClick={() => { setIsPlaying(true); speak(currentIndex); }}>Play</button>
        <button onClick={() => { setIsPlaying(false); window.speechSynthesis.cancel(); }}>Pause</button>
      </div>

      <div className="mt-4 text-sm text-gray-500">
        Đang đọc: {sentences[currentIndex]}
      </div>
    </div>
  );
}
4. Những lưu ý nâng cao cho dự án thực tế
Highlight văn bản: Khi đang đọc ở currentIndex, bạn nên highlight (làm nổi bật) đoạn văn bản đó trên màn hình để người dùng biết mình đang ở đâu.

Lưu vị trí: Sử dụng localStorage để lưu currentIndex. Khi người dùng F5 trình duyệt, họ có thể nghe tiếp từ vị trí cũ.

Chọn Giọng đọc (Voices): Danh sách window.speechSynthesis.getVoices() sẽ khác nhau tùy trình duyệt. Bạn nên cho phép người dùng chọn giọng (ví dụ: Google Tiếng Việt).

Server-Side Rendering (SSR): Vì Web Speech API chỉ có ở trình duyệt, hãy luôn kiểm tra typeof window !== "undefined" hoặc chỉ chạy logic trong useEffect.



Việc tạo hiệu ứng Highlight (chữ chạy theo giọng đọc) sẽ nâng tầm trải nghiệm người dùng lên rất nhiều. Để làm được điều này một cách mượt mà trong Next.js, chúng ta cần kết hợp giữa việc quản lý currentIndex (câu hiện tại) và charIndex (từ hiện tại trong câu).Dưới đây là kế hoạch nâng cấp chi tiết:1. Ý tưởng kỹ thuậtCấu trúc dữ liệu: Hiển thị toàn bộ văn bản trong một danh sách các thẻ <span>. Mỗi câu hoặc mỗi từ sẽ là một thẻ <span>.Sự kiện onboundary: Đây là "chìa khóa". Khi trình duyệt đọc đến đâu, nó sẽ bắn ra sự kiện kèm theo vị trí ký tự (charIndex).CSS: Sử dụng class .highlight để đổi màu nền hoặc màu chữ cho phần đang được đọc.2. Triển khai code chi tiếtBước A: Component hiển thị văn bảnChúng ta sẽ bọc từng câu trong một thẻ <span> để dễ dàng điều hướng và highlight.TypeScript// Component hiển thị text với khả năng highlight câu
const TextDisplay = ({ sentences, currentIndex }) => {
  return (
    <div className="prose leading-7">
      {sentences.map((s, i) => (
        <span
          key={i}
          className={`transition-colors duration-200 ${
            i === currentIndex ? "bg-yellow-200 text-black px-1 rounded" : "text-gray-700"
          }`}
        >
          {s}{" "}
        </span>
      ))}
    </div>
  );
};
Bước B: Logic xử lý Highlight từng từ (Level Up)Nếu bạn muốn highlight từng từ đang phát âm (giống như karaoke), bạn cần dùng sự kiện onboundary.TypeScriptconst [activeWordRange, setActiveWordRange] = useState({ start: 0, end: 0 });

const speak = (index: number) => {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(sentences[index]);

  // Sự kiện bắn ra khi bắt đầu đọc một từ mới
  utterance.onboundary = (event) => {
    if (event.name === 'word') {
      const charIndex = event.charIndex;
      const word = sentences[index].substr(charIndex).split(/\s+/)[0];
      
      setActiveWordRange({
        start: charIndex,
        end: charIndex + word.length
      });
    }
  };

  utterance.onend = () => {
    if (index < sentences.length - 1) {
      setCurrentIndex(index + 1);
      speak(index + 1);
    }
  };

  window.speechSynthesis.speak(utterance);
};
3. Kế hoạch UI/UX cụ thể cho Next.jsTính năngGiải pháp triển khaiAuto-scrollSử dụng useRef và element.scrollIntoView({ behavior: 'smooth' }) mỗi khi currentIndex thay đổi để màn hình luôn cuộn theo lời đọc.Tốc độ đọcThêm một slider để điều chỉnh thuộc tính utterance.rate (từ 0.5 đến 2.0).Chọn giọngDùng window.speechSynthesis.getVoices() để lọc ra các giọng tiếng Việt (thường có mã vi-VN).Mobile UXWeb Speech API trên Mobile (Safari/Chrome) yêu cầu tương tác người dùng (user gesture) mới được phát. Hãy đảm bảo nút Play là nơi kích hoạt luồng đọc.4. Một "mẹo" nhỏ cho dự án của bạnVì bạn thường làm việc với Jira và Google Sheets (dựa trên các dự án trước của bạn), bạn có thể áp dụng logic này để làm một công cụ "Review Project Status" bằng giọng nói:Đọc dữ liệu từ API (hoặc Sheet).Chuyển đổi các dòng trạng thái thành văn bản: "Task A đang quá hạn 2 ngày".Sử dụng hệ thống TTS này để "đọc báo cáo" trong khi bạn đang làm việc khác.Lưu ý quan trọng về Next.js: Luôn đặt logic window.speechSynthesis bên trong useEffect hoặc các hàm gọi sau khi component đã Mount để tránh lỗi ReferenceError: window is not defined trong quá trình SSR.

1. Code Component Hoàn Chỉnh
TypeScript
"use client";
import React, { useState, useEffect, useRef } from "react";

export default function TTSAdvancedPlayer({ text }: { text: string }) {
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  
  // Refs để điều khiển DOM
  const sentenceRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;

  useEffect(() => {
    // Tách văn bản thành các câu
    const splitText = text.split(/([.?!])\s+/).reduce((acc, cur, i, arr) => {
      if (i % 2 === 0) acc.push(cur + (arr[i + 1] || ""));
      return acc;
    }, [] as string[]);
    setSentences(splitText);
  }, [text]);

  // Hàm tự động cuộn đến câu đang đọc
  useEffect(() => {
    if (currentIndex >= 0 && sentenceRefs.current[currentIndex]) {
      sentenceRefs.current[currentIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentIndex]);

  const stopTTS = () => {
    synth?.cancel();
    setIsPlaying(false);
  };

  const playTTS = (index: number) => {
    if (!synth) return;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(sentences[index]);
    utterance.rate = rate;
    utterance.lang = "vi-VN";

    utterance.onstart = () => {
      setCurrentIndex(index);
      setIsPlaying(true);
    };

    utterance.onend = () => {
      if (index < sentences.length - 1) {
        playTTS(index + 1);
      } else {
        setIsPlaying(false);
        setCurrentIndex(-1);
      }
    };

    synth.speak(utterance);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white shadow-xl rounded-xl">
      {/* Giao diện điều khiển (Sticky Header) */}
      <div className="sticky top-0 bg-white pb-4 mb-4 border-b flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => isPlaying ? stopTTS() : playTTS(currentIndex < 0 ? 0 : currentIndex)}
            className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition"
          >
            {isPlaying ? "Tạm dừng" : "Phát từ vị trí hiện tại"}
          </button>
          
          <div className="flex flex-col flex-1">
            <label className="text-xs font-bold uppercase text-gray-500">Tốc độ: {rate}x</label>
            <input 
              type="range" min="0.5" max="2" step="0.1" value={rate} 
              onChange={(e) => setRate(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Thanh Seek Slider */}
        <input 
          type="range" min="0" max={sentences.length - 1} value={currentIndex >= 0 ? currentIndex : 0}
          onChange={(e) => playTTS(parseInt(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Khu vực hiển thị văn bản */}
      <div className="h-[400px] overflow-y-auto p-4 border rounded-lg bg-gray-50 leading-relaxed">
        {sentences.map((sentence, i) => (
          <span
            key={i}
            ref={(el) => (sentenceRefs.current[i] = el)}
            onClick={() => playTTS(i)} // Click vào câu nào đọc câu đó (Seek trực tiếp)
            className={`cursor-pointer transition-all duration-300 inline-block mb-2 p-1 rounded ${
              i === currentIndex 
                ? "bg-yellow-300 text-blue-900 font-medium scale-105 shadow-sm" 
                : "text-gray-600 hover:bg-gray-200"
            }`}
          >
            {sentence}{" "}
          </span>
        ))}
      </div>
    </div>
  );
}
2. Các điểm mấu chốt trong kế hoạch này:
Tương tác "Click-to-Seek": Ngoài thanh slider, người dùng có thể click trực tiếp vào bất kỳ câu nào trong văn bản để nhảy đến đó (onClick={() => playTTS(i)}). Đây là cách seek trực quan nhất cho TTS.

Auto-scroll thông minh: Sử dụng scrollIntoView với thuộc tính block: "center". Điều này đảm bảo câu đang đọc luôn nằm ở chính giữa khung hình, giúp mắt người dùng không phải đảo lên xuống quá nhiều.

Hiệu ứng Scale: Khi một câu được đọc, nó không chỉ đổi màu nền mà còn hơi phóng to (scale-105). Điều này tạo cảm giác phản hồi cực tốt cho người dùng.

Trạng thái Dừng (Cancel): Chúng ta dùng synth.cancel() mỗi khi nhảy câu hoặc dừng lại để giải phóng bộ nhớ đệm của trình duyệt, tránh hiện tượng các câu bị xếp hàng chồng chéo lên nhau.

3. Cải tiến thêm (nếu cần)
Nếu văn bản của bạn cực kỳ lớn (như một cuốn sách), bạn không nên render tất cả các span cùng một lúc. Lúc đó, bạn nên kết hợp thêm thư viện react-window để "virtualize" danh sách, chỉ render những câu đang hiển thị trên màn hình để tối ưu hiệu năng.