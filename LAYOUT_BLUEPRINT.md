# Arduino IDE × Cursor Agent - Layout Blueprint

## 🎯 Design Philosophy

This hybrid IDE maintains the **familiar Arduino IDE workflow** while integrating a **Cursor-style AI agent** as a persistent, non-intrusive copilot. The AI never dominates the workspace—it assists, observes, and acts only when requested.

---

## 🧩 Core Layout Structure

### Component Hierarchy

```
app-container (100vw × 100vh)
├── activity-bar (56px width, full height)
│   ├── activity-bar-top
│   │   ├── explorer icon
│   │   ├── boards icon
│   │   ├── libraries icon
│   │   └── serial icon
│   └── activity-bar-bottom
│       ├── AI toggle icon
│       └── settings icon
│
├── sidebar (300px width, collapsible, full height)
│   ├── sidebar-header
│   └── sidebar-content (panel-specific)
│       ├── explorerPanel
│       ├── boardsPanel
│       ├── librariesPanel
│       └── serialPanel
│
└── workspace-split (flex: 1, horizontal split)
    ├── main-area (Arduino IDE Zone)
    │   ├── top-toolbar (56px height)
    │   │   ├── toolbar-left (board/port selects)
    │   │   └── toolbar-right (verify/upload buttons)
    │   │
    │   └── editor-container (flex: 1)
    │       ├── tab-bar (44px height)
    │       ├── code-editor-wrapper (flex: 1)
    │       │   ├── welcomeState (centered, when no file)
    │       │   └── editorWrapper (CodeMirror)
    │       │
    │       └── output-panel (200px height, resizable)
    │           ├── output-tabs
    │           ├── output-content (console/serial/problems)
    │           └── serial-input-row (when serial active)
    │
    ├── split-resize-handle (4px width, draggable)
    │
    └── ai-panel (AI Agent Zone)
        ├── ai-collapse-btn (absolute top-left)
        ├── ai-header
        │   ├── ai-header-title
        │   ├── ai-provider-row
        │   └── ai-status
        ├── ai-messages (flex: 1, scrollable)
        └── ai-input-area
            ├── aiInput (textarea)
            └── aiSend (button)
```

---

## 📐 Layout Specifications

### Primary Workspace (Arduino IDE Zone)

**Position & Size:**
- **Horizontal**: ~70-80% of available width (flexible, adjusts with AI panel)
- **Vertical**: Full height (100vh)
- **Min Width**: 400px (prevents editor from becoming unusable)

**Purpose:**
- Code editor (CodeMirror)
- Board & port selection (toolbar)
- Compile/upload actions (toolbar buttons)
- Serial monitor & output logs (bottom panel)
- File explorer (left sidebar)

**Design Rule:**
- This area must feel instantly familiar to Arduino users
- The AI must never visually dominate this space
- All Arduino workflows remain unchanged

### Secondary Workspace (AI Agent Zone)

**Position & Size:**
- **Horizontal**: ~20-30% of available width (default: 380px, resizable 280-800px)
- **Vertical**: Full height (100vh)
- **Docked**: Right side only

**States:**

1. **Collapsed** (60px width)
   - Shows only collapse button
   - Minimal visual footprint
   - Preserves agent state in background

2. **Expanded** (380px default, resizable)
   - Full chat interface
   - Shows reasoning, suggestions, tool actions
   - Can reference code, errors, serial output

**Default State:**
- Starts collapsed
- User activates via activity bar icon (Ctrl+Shift+A)

---

## 🔄 Panel Behavior Logic

### Split Pane Resizing

**Resize Handle:**
- **Width**: 4px
- **Cursor**: `col-resize` on hover
- **Position**: Between `main-area` and `ai-panel`
- **Visibility**: Hidden when AI panel is collapsed

**Resize Constraints:**
- **Minimum AI Panel Width**: 280px
- **Maximum AI Panel Width**: 800px
- **Minimum Arduino Zone Width**: 400px (enforced by flex)

**Resize Behavior:**
```javascript
// User drags resize handle left/right
// AI panel width adjusts (280px - 800px range)
// Arduino zone flexes to fill remaining space
// State persisted in state.aiPanelWidth
```

### Collapse/Expand Logic

**Collapse Button:**
- **Position**: Top-left of AI panel (absolute)
- **Action**: Toggles `ai-panel.collapsed` class
- **Visual**: Rotates 180° when collapsed

**State Transitions:**

```
Collapsed (60px)
  ↓ [Click collapse button or activity icon]
Expanded (380px default, resizable)
  ↓ [Click collapse button]
Collapsed (60px)
```

**When Collapsed:**
- `ai-header`, `ai-messages`, `ai-input-area` → `display: none`
- Only collapse button visible
- Agent state preserved (messages, context, provider)
- Resize handle hidden

**When Expanded:**
- All UI elements visible
- Resize handle active
- Full chat interface available

---

## 🤖 AI Agent Interaction Model

### A. Passive Mode (Default)

**Behavior:**
- Agent watches silently
- Highlights issues only when errors occur
- Shows subtle notifications (non-blocking)

**Context Awareness:**
- Monitors active file/tab
- Observes compile results
- Watches serial monitor output
- Tracks board/port selection

**Visual Indicators:**
- Activity bar icon shows notification dot on errors
- Non-intrusive status updates in `ai-status`

### B. Active Mode (User-Initiated)

**Trigger:**
- User clicks AI activity icon (Ctrl+Shift+A)
- Panel expands (if collapsed)
- User types instruction in `aiInput`

**Example Flow:**
```
User: "Fix the serial output issue"
  ↓
Agent: [Reasoning displayed]
  ↓
Agent: [Action plan displayed]
  ↓
Agent: [Requests confirmation for hardware actions]
  ↓
User: [Confirms]
  ↓
Agent: [Executes via Tool Executor]
```

### C. Action Confirmation

**Hardware-Affecting Actions Require Confirmation:**
- ✅ Compile
- ✅ Upload
- ✅ Baud rate change
- ✅ Serial connect/disconnect

**Confirmation UI:**
- Agent displays action plan before execution
- User confirms via button or explicit approval
- Agent executes via `Tool Executor` (backend)

**Non-Hardware Actions (No Confirmation):**
- ✅ Reading code
- ✅ Analyzing errors
- ✅ Suggesting fixes
- ✅ Explaining concepts

---

## 🧠 Context Awareness System

### Automatic Context Updates

The AI agent automatically receives updates when:

1. **File Changes:**
   ```javascript
   state.context.activeFile = filePath
   state.context.editorCode = editor.getValue()
   ```

2. **Board/Port Selection:**
   ```javascript
   state.context.selectedBoard = boardFQBN
   state.context.selectedPort = portAddress
   ```

3. **Compile Results:**
   ```javascript
   state.context.lastCompileResult = {
     success: boolean,
     programSize: number,
     usagePercent: number,
     warnings: array,
     error: string
   }
   ```

4. **Serial Monitor State:**
   ```javascript
   state.context.serialConnected = boolean
   state.context.currentBaudRate = number
   ```

### Context Object Structure

```javascript
{
  activeFile: string | null,           // Current open file path
  selectedBoard: string | null,         // Board FQBN
  selectedPort: string | null,          // Port address
  lastCompileResult: object | null,    // Last compile outcome
  currentBaudRate: number,             // Serial baud rate
  serialConnected: boolean,            // Serial connection state
  editorCode: string | null             // Current editor content
}
```

### Context Update Function

```javascript
function updateAIContext() {
  // Gathers current state
  // Updates state.context
  // Emits to AI agent (if IPC available)
}
```

---

## 🎨 Visual Design Rules

### Layout Proportions

**Default State (AI Panel Expanded):**
- Arduino Zone: ~75% width
- AI Panel: ~25% width (380px)

**Collapsed State:**
- Arduino Zone: ~98% width
- AI Panel: ~2% width (60px)

**Resized State:**
- Arduino Zone: Flexible (400px minimum)
- AI Panel: 280px - 800px (user-defined)

### Spacing & Borders

**Section Dividers:**
- **Thick Rules**: 4px solid black (between major sections)
- **Thin Rules**: 2px solid black (between panels)
- **Hairlines**: 1px solid gray (subtle dividers)

**Panel Borders:**
- Activity bar: 2px right border
- Sidebar: 2px right border
- AI panel: 4px left border (when expanded)
- AI panel: 2px left border (when collapsed)

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+E` | Toggle Explorer panel |
| `Ctrl+Shift+B` | Toggle Boards panel |
| `Ctrl+Shift+L` | Toggle Libraries panel |
| `Ctrl+Shift+M` | Toggle Serial Monitor panel |
| `Ctrl+Shift+A` | Toggle AI Agent panel |
| `Ctrl+R` | Verify/Compile |
| `Ctrl+U` | Upload |

---

## 🔧 Implementation Notes

### Frontend Architecture

**HTML Structure:**
- Semantic, accessible markup
- All interactive elements have proper ARIA labels
- Focus management for keyboard navigation

**CSS Architecture:**
- CSS Custom Properties (design tokens)
- Flexbox for layout
- No grid (keeps it simple)
- Minimal transitions (100ms max, instant preferred)

**JavaScript Architecture:**
- Event-driven state management
- Context updates trigger automatically
- Resize logic uses mouse events (no external libraries)
- State persisted in `state` object

### Communication Flow

**IDE → Agent:**
```
IDE Event (file open, compile, etc.)
  ↓
updateAIContext() called
  ↓
state.context updated
  ↓
IPC event emitted (if available)
  ↓
Agent receives context update
```

**Agent → IDE:**
```
Agent suggests action
  ↓
User confirms
  ↓
Agent calls Tool Executor (backend)
  ↓
Tool Executor executes action
  ↓
IDE updates UI
```

### State Persistence

**Session State:**
- AI panel width: `state.aiPanelWidth` (persisted)
- AI panel collapsed: `state.aiPanelCollapsed` (session-only)
- Context: `state.context` (always current)

**Local Storage (Future):**
- Panel width preference
- Panel default state (collapsed/expanded)
- Context history (optional)

---

## ✅ Success Criteria

### User Experience

✅ **Arduino users feel "at home"**
- Familiar layout and workflows
- No learning curve for Arduino IDE features

✅ **AI users feel "empowered"**
- Agent is accessible but not intrusive
- Clear communication of agent actions
- Context-aware assistance

✅ **No visual clutter**
- Clean, minimal interface
- AI panel doesn't dominate
- Clear separation of concerns

✅ **No modal interruptions**
- All interactions are inline
- Confirmations are contextual
- No blocking dialogs

### Technical Requirements

✅ **Resizable split pane**
- Smooth drag-to-resize
- Constrained within bounds
- State persisted

✅ **Collapsible AI panel**
- Smooth collapse/expand
- State preserved
- Minimal footprint when collapsed

✅ **Context awareness**
- Automatic updates
- Complete context object
- Real-time synchronization

✅ **Accessibility**
- Keyboard navigation
- Focus management
- ARIA labels
- Screen reader support

---

## 🚀 Future Enhancements

### Potential Additions

1. **Panel Docking:**
   - Allow AI panel to dock left/right/bottom
   - Currently right-side only

2. **Panel Splitting:**
   - Multiple AI agent instances
   - Side-by-side agent views

3. **Context History:**
   - Timeline of context changes
   - Rollback to previous states

4. **Agent Profiles:**
   - Different agents for different tasks
   - Customizable agent behavior

5. **Visual Debugging:**
   - Show context updates visually
   - Debug panel for agent communication

---

## 📝 Notes

- **Backend Unchanged**: All backend code remains untouched
- **IPC Ready**: Context updates can be sent via Electron IPC
- **Extensible**: Easy to add new context properties
- **Maintainable**: Clear separation of concerns

This blueprint ensures the hybrid IDE feels like **Arduino IDE × Cursor**, not a chatbot bolted onto an editor.
