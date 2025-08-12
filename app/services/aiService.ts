import { WhiteboardData, NetworkAnalysis, StickyNote, Edge } from '../types';

export class AIService {
  private apiKey: string | null = null;

  constructor() {
    // 在實際使用時，你需要設定 OpenAI API key
    this.apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || null;
  }

  async brainstorm(content: string): Promise<string[]> {
    if (!this.apiKey) {
      // 模擬 AI 回應用於測試
      return [
        `${content}的應用`,
        `${content}優化`,
        `${content}延伸`,
        `${content}創新`
      ];
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `你是專業的創意發想專家，擅長產生高品質、實用的想法。

核心能力：
- 深入理解概念本質
- 產生創新但可執行的想法
- 平衡創意與實用性
- 確保概念的多樣性

輸出規範：
- 4-5個概念，每個3-8字
- 涵蓋不同面向
- 避免重複或相似概念`
            },
            {
              role: 'user',
              content: `為「${content}」生成高品質延伸概念。

思考方向：
- 核心功能/特性
- 實際應用場景
- 關鍵技術/方法
- 創新可能性
- 相關領域連結

直接輸出（不要編號）：`
            }
          ],
          max_tokens: 150,
          temperature: 0.75,
          presence_penalty: 0.3,
        }),
      });

      const data = await response.json();
      const result = data.choices[0].message.content;
      
      // 解析回應並過濾
      return result.split('\n')
        .map((line: string) => {
          let cleaned = line.trim();
          // 移除編號
          cleaned = cleaned.replace(/^\d+[\.\、\)]\s*/, '');
          // 移除引號
          cleaned = cleaned.replace(/^[「『"'"]|[」』"'"]$/g, '');
          // 移除冒號後的解釋
          if (cleaned.includes('：')) {
            cleaned = cleaned.split('：')[0];
          }
          return cleaned;
        })
        .filter((line: string) => line.length > 0 && line.length <= 15)
        .slice(0, 5);
    } catch (error) {
      console.error('AI brainstorm error:', error);
      return [`${content}發想`];
    }
  }

  async brainstormWithContext(
    networkAnalysis: NetworkAnalysis, 
    whiteboardData: WhiteboardData,
    onProgress?: (step: string, progress: number, result?: string) => void
  ): Promise<string[]> {
    const { targetNote, incomingConnections, outgoingConnections, allRelatedNotes } = networkAnalysis;
    
    if (!this.apiKey) {
      // 模擬簡短回應
      return [
        `${targetNote.content}應用`,
        `${targetNote.content}改良`,
        `${targetNote.content}結合`,
        `${targetNote.content}創新`
      ];
    }

    try {
      onProgress?.('💡 分析脈絡...', 30);
      console.log('=== Smart Brainstorming ===');
      console.log('Target Node:', targetNote.content);
      
      // 智能分析節點類型和位置
      const childCount = outgoingConnections.length;
      const parentCount = incomingConnections.length;
      
      // 建立結構化的上下文
      let contextInfo = '';
      let brainstormType = '';
      
      // 收集關鍵上下文
      const parentNodes = incomingConnections.slice(0, 2).map(c => c.note.content);
      const childNodes = outgoingConnections.slice(0, 3).map(c => c.note.content);
      const siblingNodes = [];
      
      // 找出真正的兄弟節點
      if (parentCount > 0 && incomingConnections[0].note) {
        // 找出父節點的 ID
        const parentNote = incomingConnections[0].note;
        const parentId = parentNote.id;
        
        // 找出所有從父節點出發的邊（排除當前節點）
        const siblings = whiteboardData.edges
          .filter(e => e.from === parentId && e.to !== targetNote.id)
          .slice(0, 3)
          .map(e => whiteboardData.notes.find(n => n.id === e.to))
          .filter(Boolean)
          .map(n => n!.content);
        siblingNodes.push(...siblings);
      }
      
      // 判斷發想類型
      if (childCount === 0 && parentCount > 0) {
        brainstormType = '葉節點';
        contextInfo = `這是「${parentNodes[0] || '上層概念'}」的具體實現`;
      } else if (parentCount === 0 && childCount > 0) {
        brainstormType = '根節點';
        contextInfo = `這是最上層概念，下有：${childNodes.join('、')}`;
      } else if (childCount > 0) {
        brainstormType = '分支節點';
        contextInfo = `上層：${parentNodes[0] || '無'}，已有子項：${childNodes.join('、')}`;
      } else {
        brainstormType = '獨立節點';
        contextInfo = '這是獨立的概念節點';
      }
      
      // 如果有兄弟節點，加入平行概念
      if (siblingNodes.length > 0) {
        contextInfo += `\n平行概念：${siblingNodes.join('、')}`;
      }
      
      onProgress?.('✨ 生成創意中...', 70);
      
      // 優化的 prompt 設計
      const systemPrompt = `你是專業的思維導圖發想專家。你會：
1. 理解概念的層次關係和脈絡
2. 生成高品質、有創意但實用的想法
3. 確保新概念與現有結構協調一致
4. 每個概念簡潔有力（3-8個字）`;
      
      const userPrompt = `目標節點：「${targetNote.content}」
節點類型：${brainstormType}
${contextInfo}

任務：生成4-5個高品質的延伸概念

要求：
- 如果是葉節點：著重實際應用、具體方法、執行細節
- 如果是根節點：思考更高層次的分類、策略方向
- 如果是分支節點：補充缺失的重要面向
- 避免與現有概念重複
- 保持同一抽象層次
- 確保邏輯連貫性

直接輸出概念（不要編號或解釋）：`;
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: userPrompt
            }
          ],
          max_tokens: 150,
          temperature: 0.8,
          presence_penalty: 0.3,
          frequency_penalty: 0.2
        }),
      });

      const data = await response.json();
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('API failed:', data);
        return [`${targetNote.content}發想`];
      }
      
      const result = data.choices[0].message.content;
      console.log('Generated:', result);
      
      // 解析回應
      const lines = result.split('\n')
        .map((line: string) => {
          // 清理文字
          let cleaned = line.trim();
          // 移除編號
          cleaned = cleaned.replace(/^\d+[\.\、\)]\s*/, '');
          // 移除引號
          cleaned = cleaned.replace(/^[「『"'"]|[」』"'"]$/g, '');
          // 移除冒號後的解釋
          if (cleaned.includes('：')) {
            cleaned = cleaned.split('：')[0];
          }
          return cleaned;
        })
        .filter((line: string) => line.length > 0 && line.length <= 15)
        .slice(0, 5);
      
      onProgress?.('🎉 完成！', 100);
      
      return lines.length > 0 ? lines : [`${targetNote.content}延伸`];
    } catch (error) {
      console.error('AI brainstorm with context error:', error);
      return [`${targetNote.content}發想`];
    }
  }

  // 新功能：AI 收斂節點 - Chain of Thought 分析
  async convergeNodes(
    targetNote: StickyNote, 
    childNotes: StickyNote[], 
    whiteboardData: WhiteboardData,
    maxKeepCount: number = 3
  ): Promise<{
    keepNodes: Array<{
      id: string;
      content: string;
      reason: string;
      importance: number;
    }>;
    removeNodes: Array<{
      id: string;
      content: string;
      reason: string;
    }>;
    analysis: string;
  }> {
    if (!this.apiKey) {
      // 模擬收斂結果
      const keep = childNotes.slice(0, maxKeepCount).map((note, index) => ({
        id: note.id,
        content: note.content,
        reason: `排名第 ${index + 1}，具有核心重要性`,
        importance: 1 - (index * 0.2)
      }));
      const remove = childNotes.slice(maxKeepCount).map(note => ({
        id: note.id,
        content: note.content,
        reason: '重要性較低，建議移除以聚焦核心'
      }));
      return {
        keepNodes: keep,
        removeNodes: remove,
        analysis: `分析了 ${childNotes.length} 個子節點，建議保留 ${keep.length} 個核心項目。`
      };
    }

    try {
      console.log('=== Starting AI Node Convergence Chain of Thought ===');
      console.log('Target Node:', targetNote.content);
      console.log('Child Nodes:', childNotes.map(n => n.content));

      // Step 1: 分析目標節點的上下文和目的
      const step1Response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: '你是策略分析專家。分析節點的目的和上下文，為收斂分析提供基礎。'
            },
            {
              role: 'user',
              content: `分析目標節點「${targetNote.content}」的戰略意圖：

子節點列表：
${childNotes.map((note, i) => `${i + 1}. ${note.content}`).join('\n')}

請分析：
1. 這個節點的主要目的是什麼？
2. 它在整體策略中扮演什麼角色？
3. 子節點之間的關係類型是什麼？（並列選項 vs 實施步驟 vs 分類項目）
4. 收斂的標準應該是什麼？（重要性 vs 可行性 vs 影響力）

請提供深入的分析，為後續收斂提供方向。`
            }
          ],
          max_tokens: 400,
          temperature: 0.3,
        }),
      });

      const step1Data = await step1Response.json();
      if (!step1Data.choices || !step1Data.choices[0] || !step1Data.choices[0].message) {
        throw new Error('Failed to analyze node context');
      }
      const contextAnalysis = step1Data.choices[0].message.content;
      console.log('Context Analysis:', contextAnalysis);

      // Step 2: 逐一評估每個子節點的重要性
      const step2Response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: '你是評估專家。基於上下文分析，逐一評估每個項目的重要性和優先級。'
            },
            {
              role: 'user',
              content: `基於上下文分析：
${contextAnalysis}

現在請逐一評估以下每個子節點：
${childNotes.map((note, i) => `${i + 1}. ${note.content}`).join('\n')}

對每個項目評估：
1. 戰略重要性（1-10分）
2. 實施可行性（1-10分）
3. 預期影響力（1-10分）
4. 與目標的契合度（1-10分）
5. 簡短理由說明

請為每個項目提供結構化評估。`
            }
          ],
          max_tokens: 600,
          temperature: 0.2,
        }),
      });

      const step2Data = await step2Response.json();
      if (!step2Data.choices || !step2Data.choices[0] || !step2Data.choices[0].message) {
        throw new Error('Failed to evaluate node importance');
      }
      const evaluationAnalysis = step2Data.choices[0].message.content;
      console.log('Evaluation Analysis:', evaluationAnalysis);

      // Step 3: 制定收斂策略並決定保留/移除
      const step3Response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `你是收斂決策專家。基於前面的分析，決定哪些項目應該保留，哪些應該移除。

請以 JSON 格式回應，包含：
{
  "keepNodes": [
    {
      "content": "項目內容",
      "reason": "保留理由",
      "importance": 0.95
    }
  ],
  "removeNodes": [
    {
      "content": "項目內容", 
      "reason": "移除理由"
    }
  ],
  "analysis": "整體分析總結"
}`
            },
            {
              role: 'user',
              content: `基於以下分析制定收斂決策：

上下文分析：
${contextAnalysis}

詳細評估：
${evaluationAnalysis}

收斂要求：
- 目標節點：「${targetNote.content}」
- 原有項目數：${childNotes.length}個
- 目標保留數：最多${maxKeepCount}個最核心項目
- 收斂原則：保留最具戰略價值和實施可行性的項目

子節點列表：
${childNotes.map((note, i) => `${i + 1}. ${note.content}`).join('\n')}

請做出最終收斂決策，選出最關鍵的${maxKeepCount}個項目保留，其餘移除。`
            }
          ],
          max_tokens: 500,
          temperature: 0.1,
        }),
      });

      const step3Data = await step3Response.json();
      if (!step3Data.choices || !step3Data.choices[0] || !step3Data.choices[0].message) {
        throw new Error('Failed to make convergence decision');
      }

      const convergenceResult = step3Data.choices[0].message.content;
      console.log('Convergence Result:', convergenceResult);

      try {
        const parsedResult = JSON.parse(convergenceResult);
        
        // 確保結果包含 ID
        const keepNodes = parsedResult.keepNodes.map((node: any) => {
          const matchedNote = childNotes.find(n => n.content === node.content);
          return {
            id: matchedNote?.id || '',
            content: node.content,
            reason: node.reason,
            importance: node.importance || 0.8
          };
        });

        const removeNodes = parsedResult.removeNodes.map((node: any) => {
          const matchedNote = childNotes.find(n => n.content === node.content);
          return {
            id: matchedNote?.id || '',
            content: node.content,
            reason: node.reason
          };
        });

        console.log('=== End of AI Node Convergence ===');

        return {
          keepNodes,
          removeNodes,
          analysis: parsedResult.analysis
        };

      } catch (parseError) {
        console.error('Failed to parse convergence result:', parseError);
        throw new Error('Failed to parse AI convergence result');
      }

    } catch (error) {
      console.error('AI converge nodes error:', error);
      throw error;
    }
  }

  async analyzeStructure(whiteboardData: WhiteboardData): Promise<string> {
    if (!this.apiKey) {
      return `📊 白板結構分析（測試模式）\n\n目前有 ${whiteboardData.notes.length} 個便利貼和 ${whiteboardData.edges.length} 條連線。\n\n建議：\n• 可以考慮將相關主題分組\n• 檢查是否有遺漏的關鍵概念\n• 考慮簡化過於複雜的連接關係`;
    }

    try {
      const structureData = {
        notes: whiteboardData.notes.map(note => ({
          id: note.id,
          content: note.content,
          position: { x: note.x, y: note.y }
        })),
        connections: whiteboardData.edges
      };

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: '你是一個邏輯結構分析專家，請分析白板上的便利貼和連線關係，提供結構化的分析和建議。'
            },
            {
              role: 'user',
              content: `請根據以下便利貼與關係連線，分析此張圖的邏輯架構，有沒有遺漏的主題、過於複雜或重複的地方：\n\n${JSON.stringify(structureData, null, 2)}`
            }
          ],
          max_tokens: 800,
          temperature: 0.3,
        }),
      });

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('AI analyze error:', error);
      return '結構分析服務暫時無法使用，請稍後再試。';
    }
  }

  async summarize(whiteboardData: WhiteboardData): Promise<string> {
    if (!this.apiKey) {
      const topics = whiteboardData.notes.map(note => note.content).join('、');
      return `📝 白板摘要（測試模式）\n\n主要主題：${topics}\n\n這張白板包含了 ${whiteboardData.notes.length} 個核心概念，透過 ${whiteboardData.edges.length} 個連接關係組織起來，形成了一個完整的思維架構。`;
    }

    try {
      const summaryData = {
        notes: whiteboardData.notes.map(note => note.content),
        connections: whiteboardData.edges.length
      };

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: '你是一個內容摘要專家，請為白板內容生成簡潔而全面的摘要。'
            },
            {
              role: 'user',
              content: `請為這張白板生成摘要，包含核心要點和邏輯關係：\n\n便利貼內容：${summaryData.notes.join('、')}\n連接關係數量：${summaryData.connections}`
            }
          ],
          max_tokens: 600,
          temperature: 0.5,
        }),
      });

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('AI summarize error:', error);
      return '摘要服務暫時無法使用，請稍後再試。';
    }
  }

  // 新功能：分析選定區域
  async analyzeSelection(notes: StickyNote[], edges: Edge[]): Promise<string> {
    if (!this.apiKey) {
      const concepts = notes.map(n => n.content).join('、');
      return `📊 選定區域分析\n\n包含 ${notes.length} 個概念：${concepts}\n\n主要關聯性：這些概念之間存在 ${edges.length} 個連接關係。\n\n💡 建議：可以進一步細化概念之間的關係，並考慮添加更多支撐性的想法。`;
    }

    try {
      const notesContent = notes.map(n => `- ${n.content}`).join('\n');
      const connections = edges.map(e => {
        const from = notes.find(n => n.id === e.from);
        const to = notes.find(n => n.id === e.to);
        return from && to ? `${from.content} → ${to.content}` : null;
      }).filter(Boolean).join('\n');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: '你是一個思維分析專家。分析選定區域的概念結構，提供深入見解。使用表情符號讓分析更生動。保持簡潔但深刻。'
            },
            {
              role: 'user',
              content: `分析以下選定的概念和關係：\n\n概念：\n${notesContent}\n\n關係：\n${connections || '無明確連接'}\n\n請提供：\n1. 核心主題識別\n2. 概念間的邏輯關係\n3. 潛在的缺失環節\n4. 改進建議`
            }
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('AI analyze selection error:', error);
      return '選定區域分析暫時無法使用';
    }
  }

  // 新功能：智慧修正建議
  async suggestImprovements(notes: StickyNote[]): Promise<string> {
    if (!this.apiKey) {
      return `✨ 智慧修正建議\n\n針對您選定的 ${notes.length} 個便利貼：\n\n📝 文字優化：\n- 確保每個概念簡潔明瞭\n- 使用統一的語言風格\n\n🔗 結構改善：\n- 相關概念可以建立連接\n- 考慮分組相似的想法\n\n💡 內容增強：\n- 為關鍵概念添加更多細節\n- 考慮不同角度的觀點`;
    }

    try {
      const notesContent = notes.map(n => `- ${n.content}`).join('\n');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: '你是一個內容優化專家。分析便利貼內容，提供具體、可行的改進建議。使用表情符號讓建議更友好。'
            },
            {
              role: 'user',
              content: `請為以下便利貼內容提供改進建議：\n\n${notesContent}\n\n請提供：\n1. 文字表達優化\n2. 概念清晰度提升\n3. 邏輯結構改善\n4. 補充缺失的關鍵點`
            }
          ],
          max_tokens: 400,
          temperature: 0.6,
        }),
      });

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('AI suggest improvements error:', error);
      return '改進建議服務暫時無法使用';
    }
  }

  // 新功能：內容重構
  async restructureContent(notes: StickyNote[], edges: Edge[]): Promise<{ 
    suggestion: string;
    proposedStructure: { groups: string[], connections: string[] };
  }> {
    if (!this.apiKey) {
      return {
        suggestion: '🔄 內容重構建議\n\n建議將相關概念分組並建立更清晰的層級結構。',
        proposedStructure: {
          groups: ['核心概念組', '支撐想法組', '延伸應用組'],
          connections: ['建立因果關係', '標示依賴關係', '突出關鍵路徑']
        }
      };
    }

    try {
      const notesContent = notes.map(n => n.content).join('、');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: '你是一個資訊架構專家。分析現有內容，提供重構建議以提升邏輯性和清晰度。'
            },
            {
              role: 'user',
              content: `重構以下概念：${notesContent}\n\n請提供：\n1. 重構原因\n2. 建議的新結構\n3. 概念分組方案\n4. 關鍵連接關係`
            }
          ],
          max_tokens: 400,
          temperature: 0.6,
        }),
      });

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // 簡單解析回應
      return {
        suggestion: content,
        proposedStructure: {
          groups: ['核心組', '支撐組', '延伸組'],
          connections: ['主要路徑', '次要關聯']
        }
      };
    } catch (error) {
      console.error('AI restructure error:', error);
      return {
        suggestion: '重構服務暫時無法使用',
        proposedStructure: { groups: [], connections: [] }
      };
    }
  }

  // 新功能：SWOT 分析
  async generateSWOT(topic: string, notes: StickyNote[]): Promise<{
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  }> {
    if (!this.apiKey) {
      return {
        strengths: [`${topic}的核心優勢`, '現有資源', '團隊能力'],
        weaknesses: [`${topic}的潛在不足`, '資源限制', '經驗缺乏'],
        opportunities: [`${topic}的市場機會`, '技術趨勢', '合作可能'],
        threats: [`${topic}的外部威脅`, '競爭壓力', '環境變化']
      };
    }

    try {
      const context = notes.map(n => n.content).join('、');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: '你是商業分析專家。進行 SWOT 分析時，每個類別提供 3-4 個簡短、具體的要點。'
            },
            {
              role: 'user',
              content: `對「${topic}」進行 SWOT 分析。\n相關背景：${context}\n\n請用 JSON 格式回應，包含 strengths、weaknesses、opportunities、threats 四個陣列。`
            }
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      try {
        return JSON.parse(content);
      } catch {
        // 如果解析失敗，返回預設結構
        return {
          strengths: ['需要更多資訊'],
          weaknesses: ['需要更多資訊'],
          opportunities: ['需要更多資訊'],
          threats: ['需要更多資訊']
        };
      }
    } catch (error) {
      console.error('AI SWOT error:', error);
      return {
        strengths: ['分析服務暫時無法使用'],
        weaknesses: ['分析服務暫時無法使用'],
        opportunities: ['分析服務暫時無法使用'],
        threats: ['分析服務暫時無法使用']
      };
    }
  }

  // 新功能：心智圖生成
  async generateMindMap(centralIdea: string, depth: number = 3): Promise<{
    nodes: Array<{ id: string; content: string; level: number }>;
    connections: Array<{ from: string; to: string }>;
  }> {
    if (!this.apiKey) {
      // 模擬心智圖結構
      const nodes = [
        { id: '0', content: centralIdea, level: 0 },
        { id: '1', content: `${centralIdea}-分支1`, level: 1 },
        { id: '2', content: `${centralIdea}-分支2`, level: 1 },
        { id: '3', content: `${centralIdea}-分支3`, level: 1 },
        { id: '4', content: '子分支1-1', level: 2 },
        { id: '5', content: '子分支1-2', level: 2 },
      ];
      const connections = [
        { from: '0', to: '1' },
        { from: '0', to: '2' },
        { from: '0', to: '3' },
        { from: '1', to: '4' },
        { from: '1', to: '5' },
      ];
      return { nodes, connections };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `你是心智圖專家。生成${depth}層深度的心智圖結構。每個節點要簡短（3-8字）。以 JSON 格式回應。`
            },
            {
              role: 'user',
              content: `為「${centralIdea}」生成心智圖。需要：\n1. nodes 陣列：包含 id、content、level\n2. connections 陣列：包含 from、to\n\n確保有${depth}層深度，每層3-4個分支。`
            }
          ],
          max_tokens: 800,
          temperature: 0.8,
        }),
      });

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      try {
        return JSON.parse(content);
      } catch {
        // 解析失敗時返回基本結構
        return {
          nodes: [{ id: '0', content: centralIdea, level: 0 }],
          connections: []
        };
      }
    } catch (error) {
      console.error('AI mind map error:', error);
      return {
        nodes: [{ id: '0', content: centralIdea, level: 0 }],
        connections: []
      };
    }
  }

  // 新功能：關鍵路徑分析
  async analyzeCriticalPath(notes: StickyNote[], edges: Edge[]): Promise<{
    path: string[];
    bottlenecks: string[];
    suggestions: string[];
  }> {
    if (!this.apiKey) {
      return {
        path: ['起始點', '關鍵步驟1', '關鍵步驟2', '目標'],
        bottlenecks: ['資源瓶頸', '時間限制'],
        suggestions: ['優化流程', '增加資源', '並行處理']
      };
    }

    try {
      const notesMap = new Map(notes.map(n => [n.id, n.content]));
      const connections = edges.map(e => ({
        from: notesMap.get(e.from) || '未知',
        to: notesMap.get(e.to) || '未知'
      }));

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: '你是流程優化專家。分析概念之間的依賴關係，識別關鍵路徑和瓶頸。'
            },
            {
              role: 'user',
              content: `分析以下流程：\n${connections.map(c => `${c.from} → ${c.to}`).join('\n')}\n\n請識別：\n1. 關鍵路徑（最重要的執行序列）\n2. 潛在瓶頸\n3. 優化建議\n\n以 JSON 格式回應，包含 path、bottlenecks、suggestions 三個陣列。`
            }
          ],
          max_tokens: 500,
          temperature: 0.6,
        }),
      });

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      try {
        return JSON.parse(content);
      } catch {
        return {
          path: ['需要更多連接資訊'],
          bottlenecks: ['資料不足'],
          suggestions: ['建立更多概念連接']
        };
      }
    } catch (error) {
      console.error('AI critical path error:', error);
      return {
        path: ['分析服務暫時無法使用'],
        bottlenecks: [],
        suggestions: []
      };
    }
  }

  async askWithContext(
    networkAnalysis: any,
    whiteboardData: WhiteboardData,
    userPrompt: string
  ): Promise<string> {
    if (!this.apiKey) {
      return `📝 自訂提問（測試模式）\n\n您的問題：${userPrompt}\n\n基於「${networkAnalysis.targetNote.content}」的回答：\n這是一個很好的問題！在實際應用中，這個概念可以通過多種方式實現...`;
    }

    try {
      // 構建思維導圖結構（使用與 brainstormWithContext 完全相同的邏輯）
      const targetNote = networkAnalysis.targetNote;
      
      // 找到目標節點的根節點
      const findRoot = (nodeId: string, visitedNodes: Set<string> = new Set()): string => {
        if (visitedNodes.has(nodeId)) return nodeId; // 避免循環
        visitedNodes.add(nodeId);
        
        const parentEdge = whiteboardData.edges.find(e => e.to === nodeId);
        if (!parentEdge) return nodeId; // 沒有父節點，這就是根
        
        return findRoot(parentEdge.from, visitedNodes);
      };
      
      const rootId = findRoot(targetNote.id);
      
      // 使用 BFS 建立完整的樹結構
      const buildFullTree = (rootId: string, maxDepth: number = 4): string => {
        const visited = new Set<string>();
        let result = '';
        
        const buildSubTree = (nodeId: string, depth: number = 0): string => {
          if (depth > maxDepth || visited.has(nodeId)) return '';
          visited.add(nodeId);
          
          const node = whiteboardData.notes.find(n => n.id === nodeId);
          if (!node) return '';
          
          const indent = '  '.repeat(depth);
          const cleanContent = node.content.replace(/\n/g, '\\n');
          
          // 標記當前節點
          let treeStr = `${indent}- ${cleanContent}`;
          if (nodeId === targetNote.id) {
            treeStr += ' 🎯 (當前節點)';
          }
          treeStr += '\n';
          
          // 找出所有子節點
          const childEdges = whiteboardData.edges.filter(e => e.from === nodeId);
          childEdges.forEach(edge => {
            treeStr += buildSubTree(edge.to, depth + 1);
          });
          
          return treeStr;
        };
        
        result = buildSubTree(rootId, 0);
        return result;
      };
      
      // 建立完整的樹結構
      let mindMapStructure = '### Mind Map 結構：\n\n';
      mindMapStructure += buildFullTree(rootId);
      
      // 構建上下文資訊
      const contextInfo = `
${mindMapStructure}

當前聚焦節點：${networkAnalysis.targetNote.content}
相關節點數量：${networkAnalysis.networkSize}
`;

      // 優化的 system prompt
      const systemPrompt = `你是一個專業的知識助理，擅長分析思維導圖和知識結構。

你的任務是：
1. 仔細閱讀提供的思維導圖結構，理解節點之間的關係
2. 特別注意標記為 🎯 的當前節點
3. 基於整體知識結構和當前節點的上下文，回答用戶的問題

回答要求：
- 直接、具體地回應問題
- 考慮當前節點在整體知識結構中的位置和作用
- 提供實用的見解、建議或延伸思考
- 保持簡潔但有深度，避免泛泛而談
- 如果問題涉及實際應用，請提供具體的例子或步驟`;
      
      const userMessage = `以下是完整的知識結構和上下文：

${contextInfo}

基於以上信息，請回答以下問題：
${userPrompt}`;
      
      // 詳細日誌
      console.log('=== Ask AI Prompt ===');
      console.log('System Prompt:');
      console.log(systemPrompt);
      console.log('\nUser Message:');
      console.log(userMessage);
      console.log('=== End of Ask AI Prompt ===\n');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: userMessage
            }
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('Invalid API response structure:', data);
        return '抱歉，無法獲得有效的回答。';
      }
      
      return data.choices[0].message.content;
    } catch (error) {
      console.error('AI ask with context error:', error);
      return '詢問服務暫時無法使用，請稍後再試。';
    }
  }

  // 新功能：AI 自動分組
  async autoGroupNotes(notes: StickyNote[]): Promise<{
    groups: Array<{
      id: string;
      name: string;
      noteIds: string[];
      color: string;
      reason: string;
    }>;
    ungrouped: string[];
  }> {
    if (!this.apiKey) {
      // 模擬分組 - 使用唯一的 ID
      const timestamp = Date.now();
      const groups = [
        {
          id: `group-${timestamp}-1`,
          name: '核心概念',
          noteIds: notes.slice(0, Math.ceil(notes.length / 3)).map(n => n.id),
          color: '#E3F2FD',
          reason: '這些是主要的核心概念'
        },
        {
          id: `group-${timestamp}-2`,
          name: '實作細節',
          noteIds: notes.slice(Math.ceil(notes.length / 3), Math.ceil(notes.length * 2 / 3)).map(n => n.id),
          color: '#FCE4EC',
          reason: '這些是具體的實作方法'
        }
      ];
      const ungrouped = notes.slice(Math.ceil(notes.length * 2 / 3)).map(n => n.id);
      return { groups, ungrouped };
    }

    try {
      const notesData = notes.map(note => ({
        id: note.id,
        content: note.content
      }));

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: '你是一個資訊分類專家。分析便利貼內容，根據主題相似性進行智能分組。每個組要有清晰的主題和理由。'
            },
            {
              role: 'user',
              content: `分析以下便利貼並分組：\n${JSON.stringify(notesData, null, 2)}\n\n請以 JSON 格式回應，包含：\n1. groups 陣列：每個組包含 id（使用 UUID 格式如 "group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}"）、name（簡短名稱）、noteIds（便利貼 ID 陣列）、color（從 #E3F2FD, #F3E5F5, #E8F5E8, #FFF3E0, #FCE4EC 中選擇）、reason（分組理由）\n2. ungrouped 陣列：無法分組的便利貼 ID`
            }
          ],
          max_tokens: 800,
          temperature: 0.6,
        }),
      });

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      try {
        return JSON.parse(content);
      } catch {
        return {
          groups: [{
            id: `default-group-${Date.now()}`,
            name: '預設分組',
            noteIds: notes.slice(0, Math.ceil(notes.length / 2)).map(n => n.id),
            color: '#E3F2FD',
            reason: '自動分組失敗，使用預設分組'
          }],
          ungrouped: notes.slice(Math.ceil(notes.length / 2)).map(n => n.id)
        };
      }
    } catch (error) {
      console.error('AI auto group error:', error);
      return { groups: [], ungrouped: notes.map(n => n.id) };
    }
  }

  // 新功能：AI 自動建立新便利貼
  async autoGenerateNotes(context: WhiteboardData, targetArea?: { x: number; y: number }): Promise<{
    notes: Array<{
      content: string;
      x: number;
      y: number;
      color: string;
      reason: string;
    }>;
  }> {
    if (!this.apiKey) {
      const baseX = targetArea?.x || 400;
      const baseY = targetArea?.y || 400;
      return {
        notes: [
          {
            content: '延伸概念 1',
            x: baseX,
            y: baseY,
            color: '#FFF9C4',
            reason: '基於現有內容的自然延伸'
          },
          {
            content: '補充說明',
            x: baseX + 220,
            y: baseY,
            color: '#E8F5E9',
            reason: '為現有概念提供更多細節'
          },
          {
            content: '實際應用',
            x: baseX + 110,
            y: baseY + 150,
            color: '#FCE4EC',
            reason: '將理論轉化為實踐'
          }
        ]
      };
    }

    try {
      // 分析現有內容找出缺失的概念
      const existingConcepts = context.notes.map(n => n.content).join('、');
      const structure = this.analyzeStructureForGeneration(context);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: '你是一個知識結構分析專家。根據現有內容，識別缺失的關鍵概念並生成新的便利貼。每個便利貼要簡短（3-8字）且有價值。'
            },
            {
              role: 'user',
              content: `現有概念：${existingConcepts}\n\n結構分析：${structure}\n\n請生成 3-5 個新的便利貼來補充完善這個知識結構。\n\n以 JSON 格式回應，包含 notes 陣列，每個項目包含：content（內容）、color（顏色代碼）、reason（生成理由）`
            }
          ],
          max_tokens: 500,
          temperature: 0.8,
        }),
      });

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      try {
        const result = JSON.parse(content);
        // 計算位置
        const baseX = targetArea?.x || 400;
        const baseY = targetArea?.y || 400;
        return {
          notes: result.notes.map((note: any, index: number) => ({
            ...note,
            x: baseX + (index % 3) * 220,
            y: baseY + Math.floor(index / 3) * 150
          }))
        };
      } catch {
        return { notes: [] };
      }
    } catch (error) {
      console.error('AI auto generate notes error:', error);
      return { notes: [] };
    }
  }

  // 新功能：AI 自動連線
  async autoConnectNotes(notes: StickyNote[], existingEdges: Edge[]): Promise<{
    edges: Array<{
      from: string;
      to: string;
      reason: string;
      confidence: number;
    }>;
  }> {
    if (!this.apiKey) {
      // 模擬自動連線
      const edges = [];
      if (notes.length >= 2) {
        edges.push({
          from: notes[0].id,
          to: notes[1].id,
          reason: '這兩個概念有直接的邏輯關係',
          confidence: 0.8
        });
      }
      if (notes.length >= 3) {
        edges.push({
          from: notes[1].id,
          to: notes[2].id,
          reason: '順序性的概念流程',
          confidence: 0.7
        });
      }
      return { edges };
    }

    try {
      const notesData = notes.map(note => ({
        id: note.id,
        content: note.content
      }));
      
      const existingConnections = existingEdges.map(edge => ({
        from: notes.find(n => n.id === edge.from)?.content,
        to: notes.find(n => n.id === edge.to)?.content
      }));

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: '你是一個邏輯關係分析專家。分析概念之間的關聯性，建立有意義的連接。只建立確實有邏輯關係的連接。'
            },
            {
              role: 'user',
              content: `分析以下便利貼，找出應該連接的概念對：\n\n便利貼：${JSON.stringify(notesData)}\n\n現有連接：${JSON.stringify(existingConnections)}\n\n請以 JSON 格式回應，包含 edges 陣列，每個連接包含：from（起始 ID）、to（目標 ID）、reason（連接理由）、confidence（信心度 0-1）`
            }
          ],
          max_tokens: 600,
          temperature: 0.5,
        }),
      });

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      try {
        return JSON.parse(content);
      } catch {
        return { edges: [] };
      }
    } catch (error) {
      console.error('AI auto connect error:', error);
      return { edges: [] };
    }
  }

  // 新功能：AI 智能整理
  async smartOrganize(whiteboardData: WhiteboardData): Promise<{
    layout: Array<{
      noteId: string;
      newX: number;
      newY: number;
      groupId?: string;
    }>;
    newGroups: Array<{
      id: string;
      name: string;
      color: string;
      noteIds: string[];
    }>;
    removeSuggestions: string[];
    reason: string;
  }> {
    if (!this.apiKey) {
      // 模擬智能整理
      const centerX = 600;
      const centerY = 400;
      const radius = 300;
      
      const layout = whiteboardData.notes.map((note, index) => {
        const angle = (index / whiteboardData.notes.length) * 2 * Math.PI;
        return {
          noteId: note.id,
          newX: centerX + radius * Math.cos(angle),
          newY: centerY + radius * Math.sin(angle)
        };
      });
      
      return {
        layout,
        newGroups: [],
        removeSuggestions: [],
        reason: '以圓形佈局組織所有便利貼，提高視覺清晰度'
      };
    }

    try {
      const structureData = {
        notes: whiteboardData.notes.map(note => ({
          id: note.id,
          content: note.content,
          currentPosition: { x: note.x, y: note.y }
        })),
        edges: whiteboardData.edges,
        groups: whiteboardData.groups
      };

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: '你是一個視覺化佈局專家。分析白板結構，提供最優的組織方案，包括位置調整、分組建議和冗餘內容識別。'
            },
            {
              role: 'user',
              content: `優化以下白板佈局：\n${JSON.stringify(structureData, null, 2)}\n\n請以 JSON 格式回應：\n1. layout：便利貼新位置\n2. newGroups：建議的新分組\n3. removeSuggestions：可以移除的冗餘便利貼 ID\n4. reason：整理原因`
            }
          ],
          max_tokens: 800,
          temperature: 0.6,
        }),
      });

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      try {
        return JSON.parse(content);
      } catch {
        return {
          layout: [],
          newGroups: [],
          removeSuggestions: [],
          reason: '無法解析優化建議'
        };
      }
    } catch (error) {
      console.error('AI smart organize error:', error);
      return {
        layout: [],
        newGroups: [],
        removeSuggestions: [],
        reason: '智能整理服務暫時無法使用'
      };
    }
  }

  // 輔助方法：分析結構以生成新內容
  private analyzeStructureForGeneration(whiteboardData: WhiteboardData): string {
    const noteCount = whiteboardData.notes.length;
    const edgeCount = whiteboardData.edges.length;
    const groupCount = whiteboardData.groups?.length || 0;
    
    // 找出孤立節點
    const connectedNotes = new Set<string>();
    whiteboardData.edges.forEach(edge => {
      connectedNotes.add(edge.from);
      connectedNotes.add(edge.to);
    });
    const isolatedCount = whiteboardData.notes.filter(n => !connectedNotes.has(n.id)).length;
    
    // 找出中心節點（連接最多的）
    const connectionCount = new Map<string, number>();
    whiteboardData.edges.forEach(edge => {
      connectionCount.set(edge.from, (connectionCount.get(edge.from) || 0) + 1);
      connectionCount.set(edge.to, (connectionCount.get(edge.to) || 0) + 1);
    });
    
    const hubNodes = Array.from(connectionCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, count]) => {
        const note = whiteboardData.notes.find(n => n.id === id);
        return note ? note.content : '';
      })
      .filter(Boolean);
    
    return `共有 ${noteCount} 個便利貼，${edgeCount} 個連接，${groupCount} 個分組。${isolatedCount} 個孤立概念。主要中心概念：${hubNodes.join('、')}`;
  }

  // 新功能：詢問選定區域
  async askAboutSelection(
    notes: StickyNote[], 
    edges: Edge[], 
    whiteboardData: WhiteboardData,
    userPrompt: string
  ): Promise<string> {
    if (!this.apiKey) {
      const concepts = notes.map(n => n.content).join('、');
      return `📝 基於選定區域的回答（測試模式）\n\n您的問題：${userPrompt}\n\n選定的概念：${concepts}\n\n這些概念之間存在著密切的關聯。${userPrompt} 的答案需要綜合考慮這些概念的相互作用...`;
    }

    try {
      const notesContent = notes.map(n => `- ${n.content}`).join('\n');
      const connections = edges.map(e => {
        const from = notes.find(n => n.id === e.from);
        const to = notes.find(n => n.id === e.to);
        return from && to ? `${from.content} → ${to.content}` : null;
      }).filter(Boolean).join('\n');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: '你是一個智慧助理。基於用戶選定的概念和它們之間的關係，回答用戶的問題。保持回答簡潔、準確、有洞察力。使用表情符號讓回答更生動。'
            },
            {
              role: 'user',
              content: `基於以下選定的概念和關係，回答問題：\n\n選定概念：\n${notesContent}\n\n概念關係：\n${connections || '無明確連接'}\n\n用戶問題：${userPrompt}\n\n請提供一個有洞察力的回答。`
            }
          ],
          temperature: 0.7,
          max_tokens: 500
        })
      });

      const data = await response.json();
      
      if (data.error) {
        console.error('OpenAI API error:', data.error);
        return '❌ AI 服務暫時無法使用，請稍後再試。';
      }

      return data.choices[0].message.content;
    } catch (error) {
      console.error('AI askAboutSelection error:', error);
      return '❌ AI 詢問功能暫時無法使用。';
    }
  }
}

export const aiService = new AIService();