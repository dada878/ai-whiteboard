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
    description: '🔗 重要的圖探索工具：根據ID獲取特定便利貼的詳細資訊，包含其內容、位置、顏色、連接關係（哪些便利貼連到它、它連到哪些便利貼）以及所屬群組。特別適合用於探索相鄰節點 - 當找到相關便利貼時，可以透過連接關係探索附近的其他便利貼來獲得更完整的脈絡。',
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

// 6. 創建便利貼
export const createNoteTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'create_note',
    description: '在白板上創建新的便利貼。可以指定位置、內容、顏色等屬性。',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: '便利貼的文字內容',
          minLength: 1,
          maxLength: 500
        },
        x: {
          type: 'number',
          description: 'X座標位置（建議範圍：-2000 到 2000）。如果不指定，會自動選擇合適位置'
        },
        y: {
          type: 'number',
          description: 'Y座標位置（建議範圍：-2000 到 2000）。如果不指定，會自動選擇合適位置'
        },
        color: {
          type: 'string',
          enum: ['yellow', 'pink', 'blue', 'green', 'orange', 'purple', 'gray'],
          description: '便利貼顏色',
          default: 'yellow'
        },
        group_id: {
          type: 'string',
          description: '將便利貼加入指定群組ID（選填）'
        }
      },
      required: ['content']
    }
  }
};

// 7. 建立連結
export const createEdgeTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'create_edge',
    description: '在兩個便利貼之間建立箭頭連結，表示它們之間的關係或流程。',
    parameters: {
      type: 'object',
      properties: {
        from_note_id: {
          type: 'string',
          description: '起始便利貼的ID'
        },
        to_note_id: {
          type: 'string',
          description: '目標便利貼的ID'
        }
      },
      required: ['from_note_id', 'to_note_id']
    }
  }
};

// 8. 創建群組
export const createGroupTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'create_group',
    description: '創建新的群組來組織相關的便利貼。可以指定群組名稱、顏色，並可選擇要加入群組的便利貼。',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '群組名稱',
          minLength: 1,
          maxLength: 100
        },
        color: {
          type: 'string',
          enum: ['yellow', 'pink', 'blue', 'green', 'orange', 'purple', 'gray'],
          description: '群組顏色',
          default: 'blue'
        },
        note_ids: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: '要加入群組的便利貼ID列表（選填）',
          maxItems: 50
        },
        parent_group_id: {
          type: 'string',
          description: '父群組ID，用於創建嵌套群組（選填）'
        }
      },
      required: ['name']
    }
  }
};

// 9. 移動便利貼
export const moveNoteTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'move_note',
    description: '移動便利貼到新的位置。可以精確指定座標或相對移動。',
    parameters: {
      type: 'object',
      properties: {
        note_id: {
          type: 'string',
          description: '要移動的便利貼ID'
        },
        x: {
          type: 'number',
          description: '新的X座標位置'
        },
        y: {
          type: 'number',
          description: '新的Y座標位置'
        },
        relative: {
          type: 'boolean',
          description: '是否為相對移動（true=相對當前位置，false=絕對位置）',
          default: false
        }
      },
      required: ['note_id', 'x', 'y']
    }
  }
};

// 10. 更新便利貼
export const updateNoteTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'update_note',
    description: '更新便利貼的內容、顏色或其他屬性。',
    parameters: {
      type: 'object',
      properties: {
        note_id: {
          type: 'string',
          description: '要更新的便利貼ID'
        },
        content: {
          type: 'string',
          description: '新的文字內容（選填）',
          minLength: 1,
          maxLength: 500
        },
        color: {
          type: 'string',
          enum: ['yellow', 'pink', 'blue', 'green', 'orange', 'purple', 'gray'],
          description: '新的顏色（選填）'
        }
      },
      required: ['note_id']
    }
  }
};

// 11. 將便利貼加入群組
export const addNoteToGroupTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'add_note_to_group',
    description: '將現有的便利貼加入到指定群組中。',
    parameters: {
      type: 'object',
      properties: {
        note_id: {
          type: 'string',
          description: '要加入群組的便利貼ID'
        },
        group_id: {
          type: 'string',
          description: '目標群組ID'
        }
      },
      required: ['note_id', 'group_id']
    }
  }
};

// 12. 從現有節點創建相關便利貼 (智能創建)
export const createConnectedNoteTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'create_connected_note',
    description: '從現有的便利貼延伸創建新的相關便利貼。新便利貼會自動放置在合適的位置，並自動建立連接。這是最直覺的創建方式，適合用於腦力激盪、延伸想法等場景。',
    parameters: {
      type: 'object',
      properties: {
        source_note_id: {
          type: 'string',
          description: '來源便利貼的ID（新便利貼將從此節點延伸出來）'
        },
        content: {
          type: 'string',
          description: '新便利貼的文字內容',
          minLength: 1,
          maxLength: 500
        },
        relationship: {
          type: 'string',
          enum: ['leads_to', 'derives_from', 'relates_to'],
          description: '與來源便利貼的關係：leads_to(導向)、derives_from(衍生自)、relates_to(相關)',
          default: 'leads_to'
        },
        direction: {
          type: 'string',
          enum: ['right', 'left', 'up', 'down', 'auto'],
          description: '新便利貼相對於來源的方向。auto會自動選擇最佳位置',
          default: 'auto'
        },
        color: {
          type: 'string',
          enum: ['yellow', 'pink', 'blue', 'green', 'orange', 'purple', 'gray', 'auto'],
          description: '便利貼顏色。auto會根據關係類型自動選擇',
          default: 'auto'
        },
        distance: {
          type: 'number',
          description: '與來源便利貼的距離（像素）',
          default: 250,
          minimum: 150,
          maximum: 500
        }
      },
      required: ['source_note_id', 'content']
    }
  }
};

// 匯出所有工具
export const aiAgentTools: ChatCompletionTool[] = [
  // 查詢與分析工具
  searchNotesTool,
  getNoteByIdTool,
  searchGroupsTool,
  getGroupByIdTool,
  getWhiteboardOverviewTool,
  
  // 創建工具 (核心功能)
  createConnectedNoteTool,  // 🌟 唯一的創建方式：從現有節點延伸
  createEdgeTool            // 🔗 建立連接
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

// 創建/修改操作的返回類型
export interface CreateNoteResponse {
  success: boolean;
  note?: {
    id: string;
    content: string;
    x: number;
    y: number;
    color: string;
    groupId?: string;
  };
  error?: string;
}

export interface CreateEdgeResponse {
  success: boolean;
  edge?: {
    id: string;
    from: string;
    to: string;
    fromNoteContent: string;
    toNoteContent: string;
  };
  error?: string;
}

export interface CreateGroupResponse {
  success: boolean;
  group?: {
    id: string;
    name: string;
    color: string;
    noteCount: number;
    addedNotes: string[];
  };
  error?: string;
}

export interface MoveNoteResponse {
  success: boolean;
  note?: {
    id: string;
    content: string;
    oldPosition: { x: number; y: number };
    newPosition: { x: number; y: number };
  };
  error?: string;
}

export interface UpdateNoteResponse {
  success: boolean;
  note?: {
    id: string;
    oldContent?: string;
    newContent?: string;
    oldColor?: string;
    newColor?: string;
  };
  error?: string;
}

export interface AddNoteToGroupResponse {
  success: boolean;
  note?: {
    id: string;
    content: string;
    groupId: string;
    groupName: string;
  };
  error?: string;
}

export interface CreateConnectedNoteResponse {
  success: boolean;
  newNote?: {
    id: string;
    content: string;
    x: number;
    y: number;
    color: string;
    groupId?: string;
  };
  connection?: {
    id: string;
    from: string;
    to: string;
    relationship: string;
  };
  sourceNote?: {
    id: string;
    content: string;
  };
  positioning?: {
    direction: string;
    distance: number;
    calculatedPosition: { x: number; y: number };
  };
  error?: string;
}