# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
npm run dev      # Start development server on http://localhost:3000
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

### Git Workflow
- 每次比較大的改動完成後，在 git commit 之前執行 `npm run lint` 確認沒有重大 lint error
- 定期 git commit

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 15 with React 19 and TypeScript
- **Styling**: Tailwind CSS with dark mode support
- **Drag & Drop**: react-draggable for sticky notes
- **AI Integration**: OpenAI GPT-4 API
- **Authentication**: NextAuth with Firebase adapter
- **Storage**: Firebase for cloud sync

### Core Components Structure

#### Main Application Flow
1. `app/page.tsx` - Entry point rendering Whiteboard component
2. `app/components/Whiteboard.tsx` - Central component managing all state and interactions
3. Context providers for Theme and Auth wrap the application

#### Key State Management in Whiteboard
- **WhiteboardData**: Central state containing notes, edges, and groups
- **History System**: Undo/redo functionality with history stack
- **Selection System**: Single and multi-select for notes and edges
- **AI Loading States**: Tracks AI operations with thinking steps
- **Viewport Control**: Zoom and pan functionality

### Component Responsibilities

#### Interactive Elements
- **StickyNote**: Draggable notes with inline editing, color options, context menu
- **Edge**: Connection arrows between notes, auto-updates on note movement
- **Group**: Visual grouping of related notes
- **AlignmentGuides**: Visual helpers during note dragging

#### UI Components
- **Toolbar**: Left-side tools for AI features, templates, notes
- **FloatingToolbar**: Top bar with project management, export, theme toggle
- **SidePanel**: Right panel displaying AI results
- **AIPreviewDialog**: Shows AI changes before applying

### Service Layer

#### AI Service (`aiService.ts`)
- Brainstorm: Generate related ideas from single note
- Analyze: Structural analysis of entire whiteboard
- Summarize: Extract key points from all content
- Network Analysis: Analyze note relationships
- Ask AI: Custom prompts for specific notes

#### Storage Services
- **StorageService**: Local storage persistence
- **ProjectService**: Project management with Firebase
- **SyncService**: Cloud synchronization
- **AuthService**: Authentication with Google/Email via NextAuth

### Data Types (`types.ts`)
- **StickyNote**: Core note structure with position, content, color
- **Edge**: Connection between notes
- **Group**: Collection of related notes
- **WhiteboardData**: Complete board state
- **NetworkAnalysis**: Relationship analysis results

## Key Implementation Details

### AI Features
- Uses OpenAI API (key in `.env.local`)
- Fallback to mock data when no API key
- Shows thinking steps during processing
- Preview dialog before applying AI-generated changes

### Dark Mode
- Class-based Tailwind dark mode
- Custom color palette in `tailwind.config.js`
- Theme persisted in localStorage
- System preference detection

### Authentication Flow
1. NextAuth handles OAuth with Google
2. Firebase adapter for user data
3. Anonymous mode support planned
4. Session-based authentication

### Important Patterns
- All file paths must be absolute, not relative
- Components check neighboring files for conventions
- AI results show in right panel (SidePanel)
- Drag selection for multiple notes
- Context menus on right-click

## Environment Variables Required
```
NEXT_PUBLIC_OPENAI_API_KEY    # For AI features
NEXTAUTH_URL                  # NextAuth base URL
NEXTAUTH_SECRET               # NextAuth encryption
GOOGLE_CLIENT_ID              # Google OAuth
GOOGLE_CLIENT_SECRET          # Google OAuth
FIREBASE_*                    # Firebase configuration
```

## Important Instructions
- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary
- ALWAYS prefer editing existing files
- NEVER proactively create documentation files unless explicitly requested