// OpenAI Function Calling 工具定義
import type { ChatCompletionTool } from 'openai/resources/chat/completions';

// 1. 搜尋便利貼工具
export const searchNotesTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'search_notes',
    description: '根據關鍵字搜尋白板上的便利貼內容。會返回符合條件的便利貼及其連接關係和群組資訊。',
    parameters: {
      type: 'object',
      properties: {
        keywords: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: '搜尋關鍵字列表（1-5個關鍵字）',
          minItems: 1,
          maxItems: 5
        },
        match_type: {
          type: 'string',
          enum: ['any', 'all'],
          description: '匹配模式：any(符合任一關鍵字) 或 all(必須符合所有關鍵字)',
          default: 'any'
        },
        in_group: {
          type: 'string',
          description: '限定在特定群組ID內搜尋（選填）'
        }
      },
      required: ['keywords']
    }
  }
};

// 2. 根據 ID 查詢便利貼
export const getNoteByIdTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'get_note_by_id',
    description: '根據ID獲取特定便利貼的詳細資訊，包含其內容、位置、顏色、連接關係（哪些便利貼連到它、它連到哪些便利貼）以及所屬群組。',
    parameters: {
      type: 'object',
      properties: {
        note_id: {
          type: 'string',
          description: '便利貼的唯一識別碼（格式通常為 note_xxxxx）'
        },
        include_connections: {
          type: 'boolean',
          description: '是否包含連接關係資訊（傳入和傳出的連接）',
          default: true
        },
        include_group: {
          type: 'boolean',
          description: '是否包含所屬群組資訊',
          default: true
        }
      },
      required: ['note_id']
    }
  }
};

// 3. 搜尋群組
export const searchGroupsTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'search_groups',
    description: '根據關鍵字搜尋群組名稱。會返回符合條件的群組及其包含的便利貼和子群組資訊。',
    parameters: {
      type: 'object',
      properties: {
        keywords: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: '搜尋關鍵字列表（1-5個關鍵字）',
          minItems: 1,
          maxItems: 5
        },
        match_type: {
          type: 'string',
          enum: ['any', 'all'],
          description: '匹配模式：any(符合任一關鍵字) 或 all(必須符合所有關鍵字)',
          default: 'any'
        },
        include_nested: {
          type: 'boolean',
          description: '是否包含巢狀子群組的搜尋結果',
          default: true
        }
      },
      required: ['keywords']
    }
  }
};

// 4. 根據 ID 查詢群組
export const getGroupByIdTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'get_group_by_id',
    description: '根據ID獲取特定群組的詳細資訊，包含群組名稱、顏色、包含的便利貼列表、子群組列表，以及父群組資訊（如果有的話）。',
    parameters: {
      type: 'object',
      properties: {
        group_id: {
          type: 'string',
          description: '群組的唯一識別碼（格式通常為 group_xxxxx）'
        },
        include_contents: {
          type: 'boolean',
          description: '是否包含群組內容詳情（便利貼和子群組的詳細資訊）',
          default: true
        },
        include_parent: {
          type: 'boolean',
          description: '是否包含父群組資訊',
          default: true
        },
        max_depth: {
          type: 'integer',
          description: '遞迴查詢子群組的最大深度（1-5）',
          default: 1,
          minimum: 1,
          maximum: 5
        }
      },
      required: ['group_id']
    }
  }
};

// 5. 取得白板概覽（新增）
export const getWhiteboardOverviewTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'get_whiteboard_overview',
    description: '取得整個白板的概覽資訊，包含總體統計、主要群組、最近更新等。適合在對話開始時了解白板整體狀況。',
    parameters: {
      type: 'object',
      properties: {
        include_top_groups: {
          type: 'boolean',
          description: '是否包含主要群組列表',
          default: true
        },
        include_recent_notes: {
          type: 'boolean',
          description: '是否包含最近的便利貼',
          default: false
        }
      }
    }
  }
};

// 匯出所有工具
export const aiAgentTools: ChatCompletionTool[] = [
  searchNotesTool,
  getNoteByIdTool,
  searchGroupsTool,
  getGroupByIdTool,
  getWhiteboardOverviewTool
];

// 工具返回值的類型定義
export interface EnhancedStickyNote {
  id: string;
  content: string;
  color: string;
  position: { x: number; y: number };
  connections: {
    incoming: Array<{
      noteId: string;
      noteContent: string;
    }>;
    outgoing: Array<{
      noteId: string;
      noteContent: string;
    }>;
  };
  group?: {
    id: string;
    name: string;
  };
}

export interface EnhancedGroup {
  id: string;
  name: string;
  color: string;
  contains: {
    notes: Array<{
      id: string;
      content: string;
    }>;
    groups: Array<{
      id: string;
      name: string;
    }>;
  };
  parentGroup?: {
    id: string;
    name: string;
  };
  stats: {
    totalNotes: number;
    totalGroups: number;
    depth: number;
  };
}

export interface SearchNotesResponse {
  results: EnhancedStickyNote[];
  totalMatches: number;
  searchSummary: string;
}

export interface GetNoteResponse {
  note: EnhancedStickyNote | null;
  error?: string;
}

export interface SearchGroupsResponse {
  results: EnhancedGroup[];
  totalMatches: number;
  groupHierarchy: string;
}

export interface GetGroupResponse {
  group: EnhancedGroup | null;
  error?: string;
}

export interface WhiteboardOverviewResponse {
  stats: {
    totalNotes: number;
    totalGroups: number;
    totalEdges: number;
    totalImages: number;
  };
  topGroups?: Array<{
    id: string;
    name: string;
    noteCount: number;
  }>;
  recentNotes?: Array<{
    id: string;
    content: string;
    groupName?: string;
  }>;
  summary: string;
}