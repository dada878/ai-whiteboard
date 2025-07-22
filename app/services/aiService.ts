import { WhiteboardData, NetworkAnalysis } from '../types';

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
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: '你是創意發想助手。生成簡短（3-8字）的相關概念，適合便利貼顯示。每行一個想法，不要編號或符號。'
            },
            {
              role: 'user',
              content: `基於「${content}」生成4個簡短相關概念：`
            }
          ],
          max_tokens: 200,
          temperature: 0.7,
        }),
      });

      const data = await response.json();
      const result = data.choices[0].message.content;
      
      // 解析回應並過濾空行
      return result.split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0 && line.length <= 15); // 限制字數
    } catch (error) {
      console.error('AI brainstorm error:', error);
      return [`${content}發想`];
    }
  }

  async brainstormWithContext(networkAnalysis: NetworkAnalysis): Promise<string[]> {
    const { targetNote, incomingConnections, outgoingConnections } = networkAnalysis;
    
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
      // 簡化上下文描述
      const relatedConcepts = [
        ...incomingConnections.map(conn => conn.note.content),
        ...outgoingConnections.map(conn => conn.note.content)
      ].slice(0, 5); // 最多考慮5個相關概念

      const contextInfo = relatedConcepts.length > 0 
        ? `相關：${relatedConcepts.join('、')}` 
        : '';

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: '你是創意發想助手。基於核心概念和相關概念，生成4個簡短（3-8字）的延伸想法，適合便利貼。每行一個，不要編號。'
            },
            {
              role: 'user',
              content: `核心：「${targetNote.content}」\n${contextInfo}\n\n生成4個簡短延伸想法：`
            }
          ],
          max_tokens: 150,
          temperature: 0.8,
        }),
      });

      const data = await response.json();
      const result = data.choices[0].message.content;
      
      // 解析回應並限制字數
      return result.split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0 && line.length <= 12)
        .slice(0, 4); // 最多4個想法
    } catch (error) {
      console.error('AI brainstorm with context error:', error);
      return [`${targetNote.content}發想`];
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
          model: 'gpt-4',
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
          model: 'gpt-4',
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
}

export const aiService = new AIService();