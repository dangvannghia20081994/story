<?php

namespace App\Http\Requests\Cms;

/**
 * Cùng quy tắc validate với {@see StoreCrawlerJobRequest}, nhưng sửa job chỉ một URL (một dòng).
 */
class UpdateCrawlerJobRequest extends StoreCrawlerJobRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $rules = parent::rules();
        $rules['source_url'] = ['required', 'string', 'max:10000', 'regex:/^[^\r\n]+$/u'];

        return $rules;
    }

    public function messages(): array
    {
        return array_merge(parent::messages(), [
            'source_url.regex' => 'Khi sửa job chỉ nhập một URL trên một dòng (không tạo nhiều job từ màn sửa).',
        ]);
    }
}
