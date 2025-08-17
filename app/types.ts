export interface StickyNote {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  color: string;
  groupId?: string; // 所屬群組ID
}

export interface Edge {
  id: string;
  from: string;
  to: string;
}

export interface ViewportState {
  zoomLevel: number;
  panOffset: { x: number; y: number };
}

export interface Group {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
  noteIds: string[]; // 群組內便利貼的ID列表
  imageIds?: string[]; // 群組內圖片的ID列表
  parentGroupId?: string; // 父群組ID，用於支援嵌套群組
  childGroupIds?: string[]; // 子群組ID列表
}

export interface ImageElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  url: string;
  filename?: string;
  uploadedAt?: Date;
  groupId?: string;  // 所屬群組 ID
}

export interface WhiteboardData {
  notes: StickyNote[];
  edges: Edge[];
  groups: Group[];
  images?: ImageElement[];
  viewport?: ViewportState;
}

export interface NetworkConnection {
  note: StickyNote;
  relationship: 'leads_to' | 'derives_from';
}

export interface NetworkAnalysis {
  targetNote: StickyNote;
  incomingConnections: NetworkConnection[];
  outgoingConnections: NetworkConnection[];
  allRelatedNotes: StickyNote[];
  networkSize: number;
}

export type AIFeature = 'brainstorm' | 'analyze' | 'summarize';

export interface Project {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  description?: string;
  thumbnail?: string; // Base64 encoded preview image
}

export interface ProjectWithData extends Project {
  whiteboardData: WhiteboardData;
}