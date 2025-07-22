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
}

export interface WhiteboardData {
  notes: StickyNote[];
  edges: Edge[];
  groups: Group[];
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