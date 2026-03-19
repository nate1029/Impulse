/**
 * Collaboration Service
 * CRDT-based real-time collaborative editing using Yjs.
 * 
 * Architecture:
 * - Uses Yjs for conflict-free replicated data types (CRDT)
 * - WebRTC (y-webrtc) for peer-to-peer connections (no server needed)
 * - Each document is a Y.Doc containing a Y.Text for code
 * - Awareness protocol shows cursors/selections of other users
 * 
 * Flow:
 * 1. Host creates a room (generates room ID)
 * 2. Guest joins with room ID
 * 3. Both peers sync document state via WebRTC
 * 4. Changes are applied to the shared Y.Text, which syncs automatically
 * 5. Awareness updates (cursor positions, usernames) are broadcast
 */

const Y = require('yjs');
const { EventEmitter } = require('events');

class CollaborationService extends EventEmitter {
  constructor() {
    super();
    this.doc = null;
    this.provider = null;
    this.awareness = null;
    this.roomId = null;
    this.isHost = false;
    this.connected = false;
    this.userName = 'Anonymous';
    this.userColor = this._randomColor();
    this._textObserver = null;
  }

  /**
   * Create a new collaboration room (host).
   * @param {string} initialContent - Current editor content
   * @param {string} [userName] - Display name for cursor
   * @returns {{ roomId: string }} Room identifier for guests to join
   */
  async createRoom(initialContent = '', userName = null) {
    if (this.connected) {
      await this.leaveRoom();
    }

    if (userName) this.userName = userName;

    this.roomId = this._generateRoomId();
    this.isHost = true;
    this.doc = new Y.Doc();

    // Initialize the shared text with current content
    const yText = this.doc.getText('code');
    yText.insert(0, initialContent);

    // Set up WebRTC provider
    await this._connectProvider();

    this.connected = true;
    this.emit('room-created', { roomId: this.roomId });

    return { roomId: this.roomId };
  }

  /**
   * Join an existing collaboration room (guest).
   * @param {string} roomId - Room to join
   * @param {string} [userName] - Display name
   * @returns {{ success: boolean }}
   */
  async joinRoom(roomId, userName = null) {
    if (this.connected) {
      await this.leaveRoom();
    }

    if (userName) this.userName = userName;

    this.roomId = roomId;
    this.isHost = false;
    this.doc = new Y.Doc();

    await this._connectProvider();

    this.connected = true;
    this.emit('room-joined', { roomId });

    return { success: true };
  }

  /**
   * Leave the current room and clean up.
   */
  async leaveRoom() {
    if (this._textObserver && this.doc) {
      const yText = this.doc.getText('code');
      yText.unobserve(this._textObserver);
      this._textObserver = null;
    }

    if (this.provider) {
      this.provider.destroy();
      this.provider = null;
    }

    if (this.doc) {
      this.doc.destroy();
      this.doc = null;
    }

    this.awareness = null;
    this.connected = false;
    this.roomId = null;

    this.emit('room-left');
  }

  /**
   * Apply a local change to the shared document.
   * Called when the local user edits the code.
   * @param {number} index - Position in the text
   * @param {number} deleteCount - Characters to delete
   * @param {string} insertText - Text to insert
   */
  applyLocalChange(index, deleteCount, insertText) {
    if (!this.doc) return;
    const yText = this.doc.getText('code');

    this.doc.transact(() => {
      if (deleteCount > 0) {
        yText.delete(index, deleteCount);
      }
      if (insertText) {
        yText.insert(index, insertText);
      }
    });
  }

  /**
   * Get the current shared document text.
   */
  getText() {
    if (!this.doc) return '';
    return this.doc.getText('code').toString();
  }

  /**
   * Observe remote changes to the document.
   * @param {Function} callback - Called with change events
   */
  observeChanges(callback) {
    if (!this.doc) return;
    const yText = this.doc.getText('code');

    this._textObserver = (event) => {
      // Only emit for remote changes (not our own)
      if (!event.transaction.local) {
        callback({
          type: 'remote-change',
          content: yText.toString(),
          delta: event.delta
        });
      }
    };

    yText.observe(this._textObserver);
  }

  /**
   * Update local user's cursor/selection for other peers to see.
   */
  updateCursor(position, selectionStart = null, selectionEnd = null) {
    if (!this.awareness) return;
    this.awareness.setLocalStateField('cursor', {
      position,
      selectionStart,
      selectionEnd
    });
  }

  /**
   * Get all connected peers' awareness states (cursors, names, colors).
   */
  getPeers() {
    if (!this.awareness) return [];
    const states = this.awareness.getStates();
    const peers = [];

    states.forEach((state, clientId) => {
      if (clientId !== this.doc.clientID) {
        peers.push({
          clientId,
          name: state.user?.name || 'Anonymous',
          color: state.user?.color || '#888',
          cursor: state.cursor || null
        });
      }
    });

    return peers;
  }

  /**
   * Connect the WebRTC provider.
   */
  async _connectProvider() {
    // y-webrtc is loaded dynamically because it has browser dependencies
    try {
      const { WebrtcProvider } = require('y-webrtc');

      this.provider = new WebrtcProvider(
        `impulse-ide-${this.roomId}`,
        this.doc,
        {
          signaling: ['wss://signaling.yjs.dev'],
          password: null, // Could add room passwords later
          maxConns: 20
        }
      );

      this.awareness = this.provider.awareness;

      // Set local user info
      this.awareness.setLocalStateField('user', {
        name: this.userName,
        color: this.userColor
      });

      // Listen for peer connections
      this.provider.on('peers', ({ added, removed }) => {
        if (added.length > 0) {
          this.emit('peer-joined', { peers: this.getPeers() });
        }
        if (removed.length > 0) {
          this.emit('peer-left', { peers: this.getPeers() });
        }
      });

      // Listen for awareness changes (cursor movements)
      this.awareness.on('change', () => {
        this.emit('awareness-update', { peers: this.getPeers() });
      });
    } catch (err) {
      console.error('WebRTC provider failed to load:', err.message);
      throw new Error('Collaboration requires y-webrtc. Install it with: npm install y-webrtc');
    }
  }

  _generateRoomId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 8; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
  }

  _randomColor() {
    const colors = [
      '#e06c75', '#98c379', '#e5c07b', '#61afef',
      '#c678dd', '#56b6c2', '#d19a66', '#be5046'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Get current status.
   */
  getStatus() {
    return {
      connected: this.connected,
      roomId: this.roomId,
      isHost: this.isHost,
      userName: this.userName,
      peerCount: this.getPeers().length
    };
  }
}

module.exports = CollaborationService;
