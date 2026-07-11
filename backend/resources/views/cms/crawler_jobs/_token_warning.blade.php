@if (! ($crawlerTokenConfigured ?? true))
    <style>
        .crawler-token-warning { border-color: #f59e0b; background: #fffbeb; margin-bottom: 1rem; }
        html.theme-dark .crawler-token-warning { border-color: #92400e; background: #451a03; }
    </style>
    <div class="card crawler-token-warning">
        <strong>Chưa cấu hình <code>CRAWLER_INTERNAL_TOKEN</code> trên backend</strong>
        <p class="muted" style="margin: 0.45rem 0 0.65rem;">Worker Python gọi <code>/api/internal/crawler/*</code> sẽ bị 503 cho đến khi token được đặt trong <code>backend/.env</code> và cùng giá trị trong <code>worker-crawler/.env</code>.</p>
        <p style="margin: 0; font-size: 0.85rem;"><strong>Sinh token:</strong> trong thư mục <code>backend</code> chạy <code style="background: rgba(0,0,0,0.06); padding: 0.15rem 0.35rem; border-radius: 0.25rem;">php artisan crawler:internal-token</code> — copy dòng in ra vào cả hai file <code>.env</code>, sau đó <code>php artisan config:clear</code> (hoặc khởi động lại <code>php artisan serve</code>) và chạy lại worker.</p>
    </div>
@endif
