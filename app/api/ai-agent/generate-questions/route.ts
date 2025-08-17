import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { WhiteboardData } from '@/app/types';

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { whiteboardData }: { whiteboardData: WhiteboardData } = await request.json();
    
    // 如果沒有 OpenAI API key，返回預設問題
    if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      return NextResponse.json({
        questions: [
          '白板上有哪些內容？',
          '有哪些群組？',
          '找出所有待辦事項',
          '分析白板結構'
        ]
      });
    }

    // 準備白板內容摘要用於 AI 分析
    const summary = generateWhiteboardSummary(whiteboardData);
    
    // 如果白板是空的，返回通用問題
    if (!whiteboardData.notes || whiteboardData.notes.length === 0) {
      return NextResponse.json({
        questions: [
          '白板上有哪些內容？',
          '分析白板結構和佈局',
          '這個白板的主題是什麼？',
          '有什麼值得關注的重點？'
        ]
      });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `你是一個智能白板助手，根據用戶的白板內容生成4個有幫助的快速提問。

**規則**：
1. 生成的問題要能幫助用戶更好地理解和探索他們的白板內容
2. 問題要具體且針對性，不要太泛化
3. 優先關注白板的核心主題和重要內容
4. 考慮便利貼之間的關係、群組結構和內容類型
5. 問題要簡潔（15字以內）
6. 返回正好4個問題

**白板分析要點**：
- 識別主要主題和概念
- 找出重要的群組和分類
- 注意便利貼之間的連接關係
- 識別待辦事項、想法、問題等不同類型的內容
- 考慮可能的改進或深入探討的方向

請直接返回4個問題，每行一個，不要額外說明。`
        },
        {
          role: 'user',
          content: `請根據以下白板內容生成4個有幫助的快速提問：

${summary}`
        }
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // 解析回應，提取問題
    const questions = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => line.replace(/^\d+\.\s*/, '')) // 移除編號
      .slice(0, 4); // 確保只有4個問題

    // 如果生成的問題少於4個，補充預設問題
    while (questions.length < 4) {
      const defaultQuestions = [
        '分析白板的整體結構',
        '找出核心重點和要素',
        '探索內容之間的關聯',
        '總結主要發現'
      ];
      for (const defaultQ of defaultQuestions) {
        if (!questions.includes(defaultQ) && questions.length < 4) {
          questions.push(defaultQ);
        }
      }
    }

    return NextResponse.json({
      questions: questions.slice(0, 4)
    });

  } catch (error) {
    console.error('Error generating questions:', error);
    
    // 錯誤時返回預設問題
    return NextResponse.json({
      questions: [
        '白板上有哪些內容？',
        '有哪些群組？',
        '找出所有待辦事項',
        '分析白板結構'
      ]
    });
  }
}

function generateWhiteboardSummary(data: WhiteboardData): string {
  const parts: string[] = [];
  
  // 基本統計
  const noteCount = data.notes?.length || 0;
  const groupCount = data.groups?.length || 0;
  const edgeCount = data.edges?.length || 0;
  
  parts.push(`白板統計: ${noteCount}個便利貼, ${groupCount}個群組, ${edgeCount}個連接`);
  
  if (noteCount === 0) {
    return '這是一個空的白板。';
  }
  
  // 便利貼內容摘要
  if (data.notes && data.notes.length > 0) {
    const contents = data.notes
      .map(note => note.content)
      .filter(content => content.trim().length > 0)
      .slice(0, 20); // 限制最多20個便利貼
    
    if (contents.length > 0) {
      parts.push(`便利貼內容: ${contents.join(', ')}`);
    }
  }
  
  // 群組資訊
  if (data.groups && data.groups.length > 0) {
    const groupNames = data.groups
      .map(group => group.name)
      .filter(name => name.trim().length > 0)
      .slice(0, 10); // 限制最多10個群組
    
    if (groupNames.length > 0) {
      parts.push(`群組: ${groupNames.join(', ')}`);
    }
  }
  
  // 連接關係
  if (data.edges && data.edges.length > 0) {
    parts.push(`便利貼之間有 ${data.edges.length} 個連接關係`);
  }
  
  return parts.join('\n\n');
}