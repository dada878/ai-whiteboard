// 測試 GPT-4o 模型連接
const testGPT4o = async () => {
  console.log('🧪 測試 GPT-4o 模型連接...\n');
  
  try {
    // 建立測試資料
    const testData = {
      userMessage: "測試問題：請分析這個白板的內容",
      whiteboardData: {
        notes: [
          {
            id: 'test-1',
            x: 100,
            y: 100,
            content: '測試便利貼 1：AI 系統升級',
            color: 'yellow'
          },
          {
            id: 'test-2',
            x: 300,
            y: 100,
            content: '測試便利貼 2：GPT-4o 模型',
            color: 'blue'
          }
        ],
        edges: [{
          id: 'edge-1',
          from: 'test-1',
          to: 'test-2',
          type: 'arrow'
        }],
        groups: []
      }
    };

    // 測試 AI Agent 端點
    console.log('📍 測試 /api/ai-agent/stream-natural 端點...');
    const response = await fetch('http://localhost:3000/api/ai-agent/stream-natural', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // 讀取串流回應
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let result = '';
    
    console.log('✅ 成功連接到 GPT-4o 模型！\n');
    console.log('📥 接收回應中...\n');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      result += chunk;
      
      // 解析並顯示思考步驟
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'thinking') {
              console.log(`💭 思考: ${data.data.thinking}`);
            } else if (data.type === 'tool_call') {
              console.log(`🔧 工具: ${data.data.name} - ${data.data.arguments}`);
            } else if (data.type === 'response') {
              console.log(`\n📝 回應: ${data.data}`);
            }
          } catch (e) {
            // 忽略解析錯誤
          }
        }
      }
    }

    console.log('\n✨ GPT-4o 模型測試完成！');
    console.log('📊 模型資訊:');
    console.log('  - 模型: gpt-4o');
    console.log('  - Context 限制: 128K tokens');
    console.log('  - 設定的 maxTokens: 50,000');
    
  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
    console.log('\n🔍 可能的原因:');
    console.log('  1. 開發伺服器未啟動 (執行 npm run dev)');
    console.log('  2. OpenAI API key 未設定');
    console.log('  3. 網路連接問題');
  }
};

// 執行測試
testGPT4o();