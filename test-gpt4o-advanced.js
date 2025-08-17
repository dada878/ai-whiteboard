// 進階 GPT-4o 模型測試
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

const testModelDirectly = async () => {
  console.log('🚀 直接測試 GPT-4o 模型...\n');
  
  try {
    // 測試基本對話
    console.log('📝 測試 1: 基本對話能力');
    const basicResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: '你是一個測試助手。請簡短回答。'
        },
        {
          role: 'user',
          content: '請確認你使用的模型版本。'
        }
      ],
      max_tokens: 100,
      temperature: 0.7,
    });
    
    console.log('✅ 回應:', basicResponse.choices[0].message.content);
    console.log('📊 使用 tokens:', basicResponse.usage);
    
    // 測試長文本處理
    console.log('\n📝 測試 2: 長文本處理能力');
    const longText = '這是一個測試文本。'.repeat(1000); // 約 10,000 字元
    
    const longResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: `請計算這段文字的字數並回答：${longText}`
        }
      ],
      max_tokens: 200,
      temperature: 0.7,
    });
    
    console.log('✅ 長文本測試完成');
    console.log('📊 輸入 tokens:', longResponse.usage.prompt_tokens);
    console.log('📊 輸出 tokens:', longResponse.usage.completion_tokens);
    console.log('📊 總計 tokens:', longResponse.usage.total_tokens);
    
    // 測試工具調用能力
    console.log('\n📝 測試 3: 工具調用能力');
    const toolResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: '請搜尋白板上關於 "AI" 的內容'
        }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'search_notes',
            description: '搜尋白板上的便利貼',
            parameters: {
              type: 'object',
              properties: {
                keywords: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '搜尋關鍵字列表'
                }
              },
              required: ['keywords']
            }
          }
        }
      ],
      tool_choice: 'auto',
    });
    
    if (toolResponse.choices[0].message.tool_calls) {
      console.log('✅ 工具調用成功:');
      toolResponse.choices[0].message.tool_calls.forEach(call => {
        console.log(`  - ${call.function.name}: ${call.function.arguments}`);
      });
    } else {
      console.log('ℹ️ 模型未調用工具');
    }
    
    console.log('\n✨ 所有測試完成！');
    console.log('\n📋 GPT-4o 模型特性:');
    console.log('  ✅ 128K tokens context window');
    console.log('  ✅ 支援工具調用 (Function Calling)');
    console.log('  ✅ 更強的推理能力');
    console.log('  ✅ 更快的回應速度');
    console.log('  ✅ 更低的成本 (相比 GPT-4)');
    
  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
    if (error.response) {
      console.error('錯誤詳情:', error.response.data);
    }
  }
};

// 檢查 API Key
if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
  console.log('⚠️ 請設定 NEXT_PUBLIC_OPENAI_API_KEY 環境變數');
  console.log('例如: NEXT_PUBLIC_OPENAI_API_KEY=your-key node test-gpt4o-advanced.js');
} else {
  testModelDirectly();
}