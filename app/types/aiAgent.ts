// AI Agent 相關類型定義

import { StickyNote, Group, Edge, WhiteboardData } from '../types';

// 訊息類型
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolExecutions?: ToolExecution[];
}

// 白板上下文
export interface WhiteboardContext {
  summary: string;
  statistics: {
    noteCount: number;
    groupCount: number;
    edgeCount: number;
    imageCount: number;
  };
  recentChanges?: {
    type: 'create' | 'update' | 'delete';
    target: 'note' | 'group' | 'edge';
    timestamp: Date;
  }[];
  selectedElements?: {
    notes: string[];
    groups: string[];
    edges: string[];
  };
}

// 工具執行結果
export interface ToolExecution {
  id: string;
  tool: ToolType;
  params: any;
  result?: any;
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
  timestamp: Date;
}

// 工具類型
export enum ToolType {
  SEARCH = 'search_notes',
  GET_DETAILS = 'get_details',
  TRACE_CONNECTIONS = 'trace_connections',
  CREATE_NOTE = 'create_note',
  CREATE_EDGE = 'create_edge',
  MANAGE_GROUP = 'manage_group',
  OPTIMIZE_LAYOUT = 'optimize_layout',
  ANALYZE = 'analyze_content',
  SUMMARIZE = 'summarize_board'
}

// 工具參數定義
export interface ToolParams {
  [ToolType.SEARCH]: SearchToolParams;
  [ToolType.GET_DETAILS]: GetDetailsParams;
  [ToolType.TRACE_CONNECTIONS]: TraceConnectionsParams;
  [ToolType.CREATE_NOTE]: CreateNoteParams;
  [ToolType.CREATE_EDGE]: CreateEdgeParams;
  [ToolType.MANAGE_GROUP]: GroupToolParams;
  [ToolType.OPTIMIZE_LAYOUT]: LayoutParams;
  [ToolType.ANALYZE]: AnalyzeParams;
  [ToolType.SUMMARIZE]: SummarizeParams;
}

// 搜尋工具參數
export interface SearchToolParams {
  keywords: string[];
  matchType?: 'any' | 'all';
  limit?: number;
  includeGroups?: boolean;
}

export interface SearchResult {
  notes: Array<StickyNote & { relevance: number }>;
  groups?: Array<Group & { relevance: number }>;
  totalMatches: number;
}

// 獲取詳細資訊工具參數
export interface GetDetailsParams {
  noteId?: string;
  groupId?: string;
  includeConnections?: boolean;
  includeGroup?: boolean;
  includeContent?: boolean;
}

export interface NoteDetails {
  note: StickyNote;
  group?: Group;
  incomingConnections: Array<{
    edge: Edge;
    sourceNote: StickyNote;
  }>;
  outgoingConnections: Array<{
    edge: Edge;
    targetNote: StickyNote;
  }>;
  metadata: {
    connectionCount: number;
    isInGroup: boolean;
    groupName?: string;
    position: { x: number; y: number };
  };
}

// 追蹤連接工具參數
export interface TraceConnectionsParams {
  startNoteId: string;
  direction?: 'forward' | 'backward' | 'both';
  maxDepth?: number;  // 最大追蹤深度，預設 3
  includeContent?: boolean;
  stopAtKeywords?: string[];  // 遇到包含這些關鍵字的便利貼時停止
}

export interface ConnectionTrace {
  path: Array<{
    note: StickyNote;
    depth: number;
    edge?: Edge;  // 連接到這個便利貼的邊
  }>;
  endNodes: StickyNote[];  // 終端節點
  totalNodes: number;
  branches: Array<{  // 分支路徑
    fromNoteId: string;
    paths: ConnectionTrace[];
  }>;
}

// 建立便利貼參數
export interface CreateNoteParams {
  content: string | string[];  // 支援批量建立
  position?: { x: number; y: number };
  color?: string;
  groupId?: string;
  autoLayout?: boolean;
}

export interface CreateNoteResult {
  notes: StickyNote[];
  success: boolean;
}

// 建立連接參數
export interface CreateEdgeParams {
  connections: Array<{
    fromNoteId: string;
    toNoteId: string;
    label?: string;
  }>;
  skipExisting?: boolean;
}

export interface CreateEdgeResult {
  edges: Edge[];
  skipped: number;
  success: boolean;
}

// 群組管理參數
export interface GroupToolParams {
  action: 'create' | 'add' | 'remove' | 'rename' | 'delete';
  noteIds?: string[];
  groupId?: string;
  groupName?: string;
  color?: string;
}

export interface GroupToolResult {
  group?: Group;
  affected: number;
  success: boolean;
}

// 佈局優化參數
export interface LayoutParams {
  strategy: 'grid' | 'tree' | 'radial' | 'force' | 'hierarchical';
  targetNotes?: string[];
  preserveGroups?: boolean;
  spacing?: number;
}

export interface LayoutResult {
  movedNotes: number;
  newLayout: Array<{ id: string; x: number; y: number }>;
  success: boolean;
}

// 分析參數
export interface AnalyzeParams {
  target?: string[];  // 特定便利貼或群組
  analysisType?: 'relationship' | 'category' | 'priority' | 'all';
}

export interface AnalyzeResult {
  insights: string[];
  suggestions: string[];
  relationships?: Array<{ from: string; to: string; type: string }>;
}

// 摘要參數
export interface SummarizeParams {
  includeDetails?: boolean;
  maxLength?: number;
}

export interface SummarizeResult {
  summary: string;
  keyPoints: string[];
  themes: string[];
}

// AI Agent 請求和響應
export interface AgentRequest {
  message: string;
  context: WhiteboardContext;
  conversationHistory: ChatMessage[];
  availableTools?: ToolType[];
}

export interface AgentResponse {
  reply: string;
  toolExecutions?: ToolExecution[];
  suggestions?: string[];
  requiresConfirmation?: boolean;
  metadata?: {
    confidence: number;
    reasoning?: string;
  };
}

// 工具定義
export interface ToolDefinition {
  type: ToolType;
  name: string;
  description: string;
  parameters: Record<string, any>;
  requiresConfirmation?: boolean;
}

// 工具註冊表
export const TOOL_DEFINITIONS: Record<ToolType, ToolDefinition> = {
  [ToolType.SEARCH]: {
    type: ToolType.SEARCH,
    name: '搜尋便利貼',
    description: '根據關鍵字搜尋白板上的便利貼和群組',
    parameters: {
      keywords: { type: 'array', description: '搜尋關鍵字（最多4個）' },
      matchType: { type: 'string', enum: ['any', 'all'], default: 'any' }
    }
  },
  [ToolType.GET_DETAILS]: {
    type: ToolType.GET_DETAILS,
    name: '獲取詳細資訊',
    description: '獲取特定便利貼或群組的詳細資訊，包括連接關係',
    parameters: {
      noteId: { type: 'string', description: '便利貼 ID', optional: true },
      groupId: { type: 'string', description: '群組 ID', optional: true },
      includeConnections: { type: 'boolean', default: true },
      includeGroup: { type: 'boolean', default: true }
    }
  },
  [ToolType.TRACE_CONNECTIONS]: {
    type: ToolType.TRACE_CONNECTIONS,
    name: '追蹤連接路徑',
    description: '從一個便利貼開始，追蹤其連接路徑，可以順向或逆向追蹤多層',
    parameters: {
      startNoteId: { type: 'string', description: '起始便利貼 ID' },
      direction: { type: 'string', enum: ['forward', 'backward', 'both'], default: 'forward' },
      maxDepth: { type: 'number', default: 3, description: '最大追蹤深度' },
      stopAtKeywords: { type: 'array', optional: true, description: '停止關鍵字' }
    }
  },
  [ToolType.CREATE_NOTE]: {
    type: ToolType.CREATE_NOTE,
    name: '建立便利貼',
    description: '在白板上建立新的便利貼',
    parameters: {
      content: { type: 'string', description: '便利貼內容' },
      position: { type: 'object', optional: true },
      color: { type: 'string', optional: true },
      groupId: { type: 'string', optional: true }
    },
    requiresConfirmation: true
  },
  [ToolType.CREATE_EDGE]: {
    type: ToolType.CREATE_EDGE,
    name: '建立連接',
    description: '建立便利貼之間的連接線',
    parameters: {
      connections: { type: 'array', description: '連接定義列表' }
    },
    requiresConfirmation: true
  },
  [ToolType.MANAGE_GROUP]: {
    type: ToolType.MANAGE_GROUP,
    name: '管理群組',
    description: '建立、修改或刪除群組',
    parameters: {
      action: { type: 'string', enum: ['create', 'add', 'remove', 'rename', 'delete'] },
      noteIds: { type: 'array', optional: true },
      groupId: { type: 'string', optional: true },
      groupName: { type: 'string', optional: true }
    },
    requiresConfirmation: true
  },
  [ToolType.OPTIMIZE_LAYOUT]: {
    type: ToolType.OPTIMIZE_LAYOUT,
    name: '優化佈局',
    description: '自動優化便利貼的排版佈局',
    parameters: {
      strategy: { type: 'string', enum: ['grid', 'tree', 'radial', 'force', 'hierarchical'] },
      targetNotes: { type: 'array', optional: true }
    },
    requiresConfirmation: true
  },
  [ToolType.ANALYZE]: {
    type: ToolType.ANALYZE,
    name: '分析內容',
    description: '分析白板內容並提供洞察',
    parameters: {
      target: { type: 'array', optional: true },
      analysisType: { type: 'string', optional: true }
    }
  },
  [ToolType.SUMMARIZE]: {
    type: ToolType.SUMMARIZE,
    name: '生成摘要',
    description: '生成白板內容的摘要',
    parameters: {
      includeDetails: { type: 'boolean', optional: true },
      maxLength: { type: 'number', optional: true }
    }
  }
};