const { getSystemPrompt } = require('./prompts/systemPrompt');
const { buildContextBlock } = require('./knowledge');
const ToolExecutor = require('./tools/toolExecutor');
const SimpleMemory = require('./memory/simpleMemory');
const ModelPreferences = require('./config/modelPreferences');
const { getAllTools, getDebugTools } = require('./tools/toolSchema');
const OpenAIProvider = require('./providers/openaiProvider');
const GeminiProvider = require('./providers/geminiProvider');
const ClaudeProvider = require('./providers/claudeProvider');

/**
 * AI Agent
 * Main orchestrator for AI-powered Arduino development assistance
 */
class AIAgent {
  constructor(arduinoService, serialMonitor, errorMemory, config = {}, workspaceService = null) {
    this.arduinoService = arduinoService;
    this.serialMonitor = serialMonitor;
    this.errorMemory = errorMemory;

    // Initialize simple JSON-based memory (no SQLite dependency)
    this.memory = new SimpleMemory();

    // Model usage tracking + auto-upgrade preferences
    this.modelPrefs = new ModelPreferences();

    this.workspaceService = workspaceService;

    // Initialize tool executor
    this.toolExecutor = new ToolExecutor(
      arduinoService,
      serialMonitor,
      errorMemory,
      this.memory,
      workspaceService
    );
    
    // Provider management
    this.providers = new Map();
    this.currentProvider = null;
    this.config = {
      // Higher ceiling now that the agent is expected to finish multi-step
      // builds (write → compile → install libs/cores → fix → upload → verify).
      // Stuck-detection reclaims wasted rounds, so a real budget can be generous.
      maxIterations: config.maxIterations || 25,
      temperature: config.temperature || 0.7,
      // Completion-gate: how many times the critic may send the agent back to
      // work after it tries to yield. 0 disables the critic. Fail-open.
      maxReviews: config.maxReviews ?? 2,
      ...config
    };
    
    // Conversation history with sliding window to prevent unbounded growth
    this.conversationHistory = [];
    this.maxHistoryMessages = 40; // ~20 user + 20 assistant turns

    // Live progress callback — set by main to stream tool activity to the
    // renderer while a turn is running. Must never be able to break a turn.
    this.onToolEvent = null;

    // Text-streaming callback: fires for each text delta from the provider
    // while a turn is running. Wrapped in try/catch to isolate UI errors.
    this.onTextChunk = null;

    // Cooperative cancellation. cancel() flips the flag; the tool loop checks
    // it at each iteration and between tool calls. ponytail: no AbortController
    // threaded through providers, so the current inflight HTTP call finishes;
    // add per-provider abort when we need to kill mid-request.
    this._cancelled = false;
  }

  /** Request the current turn to stop. Best-effort; a running tool completes. */
  cancel() {
    this._cancelled = true;
    try { if (typeof this.onCancel === 'function') this.onCancel(); } catch (_) { /* UI-only */ }
  }

  _throwIfCancelled() {
    if (this._cancelled) {
      const e = new Error('Cancelled by user');
      e.code = 'CANCELLED';
      throw e;
    }
  }

  /** Emit a live tool event to the UI (best-effort, swallowed on error). */
  _emitToolEvent(event) {
    if (typeof this.onToolEvent !== 'function') return;
    try { this.onToolEvent(event); } catch (_) { /* UI-only */ }
  }

  /** Emit a text chunk (from provider streaming) to the UI. */
  _emitTextChunk(delta) {
    if (typeof this.onTextChunk !== 'function') return;
    try { this.onTextChunk(delta); } catch (_) { /* UI-only */ }
  }

  /** Provider.chatStream when both provider supports it and a UI listener exists; else fallback. */
  async _chatOnce(messages, chatOptions) {
    const canStream = typeof this.currentProvider.chatStream === 'function'
      && typeof this.onTextChunk === 'function';
    return canStream
      ? this.currentProvider.chatStream(messages, chatOptions, (d) => this._emitTextChunk(d))
      : this.currentProvider.chat(messages, chatOptions);
  }

  /** Pull a short human-readable detail (path/query/…) out of tool args. */
  static _toolDetail(args) {
    let a = args;
    if (typeof a === 'string') {
      try { a = JSON.parse(a); } catch (_) { return ''; }
    }
    if (!a || typeof a !== 'object') return '';
    const v = a.path || a.file_path || a.filepath || a.query || a.pattern ||
      a.board || a.port || a.command || '';
    return typeof v === 'string' ? v.slice(0, 80) : '';
  }

  /**
   * Register a provider
   */
  registerProvider(name, provider) {
    this.providers.set(name, provider);
  }

  /**
   * Set current provider
   */
  setProvider(providerName, apiKey, model = null) {
    if (!this.providers.has(providerName)) {
      throw new Error(`Provider ${providerName} not registered`);
    }

    const ProviderClass = this.providers.get(providerName);
    const provider = new ProviderClass(apiKey, model);
    
    if (!provider.validateApiKey(apiKey)) {
      throw new Error(`Invalid API key for provider ${providerName}`);
    }

    this.currentProvider = provider;
    return provider;
  }

  /**
   * Initialize default providers (without API keys)
   */
  initializeProviders() {
    this.providers.set('openai', OpenAIProvider);
    this.providers.set('gemini', GeminiProvider);
    this.providers.set('claude', ClaudeProvider);
  }

  /**
   * Get available providers
   */
  getAvailableProviders() {
    return Array.from(this.providers.keys());
  }

  /**
   * Get available models for a provider
   */
  getAvailableModels(providerName = null) {
    if (providerName && this.providers.has(providerName)) {
      const ProviderClass = this.providers.get(providerName);
      const tempInstance = new ProviderClass('temp-key');
      return tempInstance.getAvailableModels();
    }
    if (!this.currentProvider) {
      return [];
    }
    return this.currentProvider.getAvailableModels();
  }

  /**
   * Model ID to provider name (for API key lookup and setProvider)
   */
  static getProviderFromModel(modelId) {
    if (!modelId || typeof modelId !== 'string') return null;
    const id = modelId.toLowerCase();
    if (id.startsWith('claude-')) return 'claude';
    if (id.startsWith('gpt-') || /^o\d/.test(id)) return 'openai';
    if (id.startsWith('gemini-')) return 'gemini';
    return null;
  }

  /**
   * Unified list of all models from all providers for the dropdown.
   * Returns { id, displayName, provider }.
   */
  getUnifiedModelList() {
    const list = [];
    const displayNames = {
      // Claude 5
      'claude-sonnet-5': 'Claude Sonnet 5',
      'claude-fable-5': 'Claude Fable 5',
      // Claude 4.x
      'claude-opus-4-8': 'Claude Opus 4.8',
      'claude-sonnet-4-6': 'Claude Sonnet 4.6',
      'claude-haiku-4-5-20251001': 'Claude Haiku 4.5',
      // Claude 3.x
      'claude-3-7-sonnet-20250219': 'Claude 3.7 Sonnet',
      'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
      'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
      'claude-3-opus-20240229': 'Claude 3 Opus',
      'claude-3-haiku-20240307': 'Claude 3 Haiku',
      // OpenAI GPT-4.1
      'gpt-4.1': 'GPT-4.1',
      'gpt-4.1-mini': 'GPT-4.1 Mini',
      'gpt-4.1-nano': 'GPT-4.1 Nano',
      // OpenAI reasoning
      'o4-mini': 'o4-mini',
      'o3-mini': 'o3-mini',
      // OpenAI GPT-4o
      'gpt-4o': 'GPT-4o',
      'gpt-4o-mini': 'GPT-4o Mini',
      // OpenAI legacy
      'gpt-4-turbo': 'GPT-4 Turbo',
      'gpt-4': 'GPT-4',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo',
      // Gemini 2.5
      'gemini-2.5-pro': 'Gemini 2.5 Pro',
      'gemini-2.5-flash': 'Gemini 2.5 Flash',
      'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
      // Gemini 2.0
      'gemini-2.0-flash': 'Gemini 2.0 Flash',
      'gemini-2.0-flash-lite': 'Gemini 2.0 Flash Lite',
      // Gemini 1.5
      'gemini-1.5-pro': 'Gemini 1.5 Pro',
      'gemini-1.5-flash': 'Gemini 1.5 Flash'
    };
    for (const providerName of this.providers.keys()) {
      const ProviderClass = this.providers.get(providerName);
      const tempInstance = new ProviderClass('temp-key');
      const models = tempInstance.getAvailableModels();
      // getAvailableModels() returns newest-first, so index 0 is the latest.
      models.forEach((modelId, idx) => {
        list.push({
          id: modelId,
          displayName: displayNames[modelId] || modelId,
          provider: providerName,
          latest: idx === 0
        });
      });
    }
    return list;
  }

  /**
   * The newest (latest) model id per provider.
   * @returns {Record<string, string>} e.g. { claude: '...', openai: '...' }
   */
  getLatestByProvider() {
    const map = {};
    for (const providerName of this.providers.keys()) {
      const ProviderClass = this.providers.get(providerName);
      const tempInstance = new ProviderClass('temp-key');
      const models = tempInstance.getAvailableModels();
      if (models.length > 0) map[providerName] = models[0];
    }
    return map;
  }

  /** All valid model ids across every provider. */
  getAllModelIds() {
    const ids = [];
    for (const providerName of this.providers.keys()) {
      const ProviderClass = this.providers.get(providerName);
      const tempInstance = new ProviderClass('temp-key');
      ids.push(...tempInstance.getAvailableModels());
    }
    return ids;
  }

  /** Record real usage of a model (fire-and-forget safe). */
  async recordModelUsage(modelId) {
    try { await this.modelPrefs.recordUsage(modelId); } catch (_) { /* best effort */ }
  }

  /**
   * Decide which model the IDE should use on boot.
   *
   * Rules:
   *  - A pinned model always wins (auto-upgrade never moves away from it).
   *  - Otherwise pick the LATEST model of the user's preferred provider
   *    (falls back to the most-used model's provider, then any provider
   *    that has an API key, then the first registered provider).
   *  - The most-used model is always returned too, so the UI can keep it
   *    surfaced even after an upgrade.
   *
   * @param {string[]} providersWithKeys - providers that have an API key set
   * @returns {Promise<{suggested: string|null, reason: string, pinned: string|null, mostUsed: string|null, autoUpgrade: boolean, preferredProvider: string|null, latestByProvider: Record<string,string>}>}
   */
  async getModelSuggestion(providersWithKeys = []) {
    const latestByProvider = this.getLatestByProvider();
    const validIds = this.getAllModelIds();
    const state = await this.modelPrefs.getState();
    const mostUsed = await this.modelPrefs.getMostUsed(validIds);

    const keyed = Array.isArray(providersWithKeys) ? providersWithKeys.filter(Boolean) : [];
    const hasKey = (p) => keyed.length === 0 || keyed.includes(p);

    // 1. Pinned model wins outright (if it still exists in the catalog).
    if (state.pinnedModel && validIds.includes(state.pinnedModel)) {
      return {
        suggested: state.pinnedModel,
        reason: 'pinned',
        pinned: state.pinnedModel,
        mostUsed,
        autoUpgrade: state.autoUpgrade,
        preferredProvider: state.preferredProvider,
        latestByProvider
      };
    }

    // 2. Choose the target provider.
    const mostUsedProvider = mostUsed ? AIAgent.getProviderFromModel(mostUsed) : null;
    const candidates = [
      state.preferredProvider,
      mostUsedProvider,
      ...keyed,
      ...this.providers.keys()
    ];
    let targetProvider = null;
    for (const p of candidates) {
      if (p && latestByProvider[p] && hasKey(p)) { targetProvider = p; break; }
    }
    // Last resort: first provider that has a latest model at all.
    if (!targetProvider) {
      targetProvider = Object.keys(latestByProvider)[0] || null;
    }

    const suggested = targetProvider ? latestByProvider[targetProvider] : (mostUsed || null);

    return {
      suggested,
      reason: state.autoUpgrade ? 'latest' : 'preferred',
      pinned: null,
      mostUsed,
      autoUpgrade: state.autoUpgrade,
      preferredProvider: state.preferredProvider,
      latestByProvider
    };
  }

  /**
   * Get tools array for the given mode
   * @param {string} mode - 'agent' | 'ask' | 'debug'
   */
  _getToolsForMode(mode) {
    if (mode === 'ask') return [];
    if (mode === 'debug') return getDebugTools();
    return getAllTools();
  }

  /**
   * Completion gate. When the agent tries to yield with a text-only turn, a
   * strict reviewer decides whether the user's goal is actually met. Returns
   * { complete, missing }. Fail-open: any error/parse failure ⇒ complete:true,
   * so the critic can never trap the user in a loop.
   *
   * @param {string} userGoal - the original user request
   * @param {string[]} toolLog - compact list of actions taken this turn
   * @param {string} finalText - the agent's would-be final message
   */
  async _reviewCompletion(userGoal, toolLog, finalText) {
    try {
      const summary = (toolLog && toolLog.length) ? toolLog.join('; ') : '(no tools were used)';
      const reviewMessages = [
        {
          role: 'system',
          content:
            'You are a strict completion reviewer for an Arduino IDE build agent. ' +
            'Given the user\'s goal, the actions the agent took, and its final message, ' +
            'decide whether the goal is FULLY achieved. A build/code task is only complete ' +
            'when working code was written into the project AND it was compiled successfully; ' +
            'if the goal implies hardware behavior and a board is connected, it should also be ' +
            'uploaded/verified. If the agent has genuinely done all it can without the user ' +
            '(hardware not connected, a decision only the user can make), treat it as complete. ' +
            'If the user only asked a question, complete = true. ' +
            'Respond with ONLY minified JSON: {"complete":true|false,"missing":"the single most important next action, if incomplete"}.'
        },
        {
          role: 'user',
          content: `USER GOAL:\n${String(userGoal).slice(0, 2000)}\n\nACTIONS TAKEN:\n${summary}\n\nAGENT'S FINAL MESSAGE:\n${String(finalText || '(none)').slice(0, 2000)}`
        }
      ];
      const resp = await this.currentProvider.chat(reviewMessages, { temperature: 0, max_tokens: 200, tools: [] });
      const txt = (resp.content || '').trim();
      const m = txt.match(/\{[\s\S]*\}/);
      if (!m) return { complete: true };
      const parsed = JSON.parse(m[0]);
      return {
        complete: parsed.complete !== false,
        missing: typeof parsed.missing === 'string' ? parsed.missing.slice(0, 500) : ''
      };
    } catch (_) {
      return { complete: true }; // fail-open — never trap the user
    }
  }

  /**
   * Process a user query with optional tool use (mode-dependent)
   * @param {string} userQuery - User message
   * @param {Object} context - IDE context
   * @param {string} mode - 'agent' | 'ask' | 'debug'
   */
  async processQuery(userQuery, context = {}, mode = 'agent', attachments = []) {
    if (!this.currentProvider) {
      throw new Error('No provider selected. Please set a provider first.');
    }

    this._cancelled = false;

    // Track real usage so the "most-used" model stays surfaced even after
    // auto-upgrades. Fire-and-forget — never block the query on disk I/O.
    if (this.currentProvider.model) {
      this.recordModelUsage(this.currentProvider.model).catch(() => {});
    }

    const toolsForMode = this._getToolsForMode(mode);
    const useTools = Array.isArray(toolsForMode) && toolsForMode.length > 0;

    // Build user content: prepend IDE context when available
    const ctx = [];
    // Only assert "no file open" when the caller explicitly said so — internal
    // callers (serial analysis) pass no editor context at all.
    if (context.hasFileOpen === false) {
      ctx.push('NO_FILE_OPEN');
    } else if (context.currentSketchPath) {
      ctx.push(`sketch=${context.currentSketchPath}`);
    }
    if (context.selectedBoard) ctx.push(`board=${context.selectedBoard}`);
    if (context.selectedPort) ctx.push(`port=${context.selectedPort}`);
    if (context.workspaceRoot) {
      const name = String(context.workspaceRoot).split(/[/\\]/).pop();
      ctx.push(`project=${name}`);
    }

    // Surface the most recent compilation result so the agent can see and act
    // on compile errors the user hit via the Verify button (not just via tools).
    let compileBlock = '';
    const lcr = context.lastCompileResult;
    if (lcr && typeof lcr === 'object') {
      if (lcr.success === false) {
        const details = (lcr.output && lcr.output.trim())
          || (Array.isArray(lcr.errors) && lcr.errors.join('\n'))
          || lcr.message
          || 'Compilation failed.';
        compileBlock = `\n\n[LAST COMPILE FAILED]\n${String(details).slice(0, 3000)}`;
      } else if (lcr.success === true) {
        ctx.push('lastCompile=success');
      }
    }

    // Flow awareness blocks — silent context the agent should honour
    // without the user having to spell it out.
    let selectionBlock = '';
    if (typeof context.editorSelection === 'string' && context.editorSelection.length > 0) {
      selectionBlock = `\n\n[EDITOR SELECTION — the user has this range highlighted; treat it as the primary target for "this" / "here" / "explain" / "fix"]\n${context.editorSelection}`;
    }
    let serialBlock = '';
    if (typeof context.recentSerial === 'string' && context.recentSerial.trim()) {
      serialBlock = `\n\n[RECENT SERIAL OUTPUT — last lines the board printed; use when diagnosing runtime behaviour without needing to call read_serial]\n${context.recentSerial}`;
    }

    const userText = (ctx.length > 0
      ? `[IDE: ${ctx.join(', ')}]\n\n${userQuery}`
      : userQuery) + compileBlock + selectionBlock + serialBlock;

    // Multi-modal content: text + optional images. Providers translate the
    // {type:'image', mimeType, data} block into their native shape.
    const validImages = Array.isArray(attachments)
      ? attachments.filter(a => a && typeof a.data === 'string' && typeof a.mimeType === 'string')
      : [];
    const userMessage = validImages.length === 0
      ? { role: 'user', content: userText }
      : {
          role: 'user',
          content: [
            { type: 'text', text: userText },
            ...validImages.map(a => ({ type: 'image', mimeType: a.mimeType, data: a.data }))
          ]
        };

    this.conversationHistory.push(userMessage);

    // Trim history to sliding window to prevent unbounded token growth
    this._trimHistory();

    const verifyBlock = context.autoVerify ? `

## AUTO-VERIFY MODE (strict — user toggled this on)
Hardware verification is already your default; this makes it MANDATORY and adds a retry loop. After every successful upload_sketch:
1. If serial isn't already connected, call connect_serial with the selected port + a sensible baud rate (115200 for ESP32/RP2040, 9600 as fallback).
2. Call verify_serial with a short distinctive substring you expect the sketch to print (from the code you wrote — a Serial.println you added, or a known startup banner). If you didn't add anything printable, add one BEFORE uploading.
3. If verify_serial returns { passed: false }, read the sampledLines to diagnose, patch the code, and re-upload. Repeat up to 3 attempts total before reporting failure.
4. Report the outcome plainly: "Verified on hardware ✓" or "Verification failed after N attempts — here's what serial actually showed: …".
Do NOT stop to ask the user to check serial for you, and do NOT skip these steps — the whole point is proving the code actually runs on the board.
` : '';

    const messages = [
      {
        role: 'system',
        content: getSystemPrompt(mode) + buildContextBlock(context.workspaceRoot) + verifyBlock
      },
      ...this.conversationHistory
    ];

    // Building code wants determinism; only Ask (conversational) wants warmth.
    // High temp made the agent wander and summarize early instead of finishing.
    const temperature = mode === 'ask'
      ? (this.config.temperature ?? 0.7)
      : 0.2;

    const chatOptions = {
      temperature,
      // Code-writing agent: 2k truncated sketches mid-file. Providers clamp
      // this for legacy models that cap lower.
      max_tokens: this.config.max_tokens || 8192,
      tools: toolsForMode
    };

    // Ask mode: single turn, no tools
    if (!useTools) {
      const response = await this._chatOnce(messages, chatOptions);
      if (response.content) {
        this.conversationHistory.push({
          role: 'assistant',
          content: response.content
        });
      }
      return {
        response: response.content,
        toolResults: [],
        usage: response.usage,
        model: response.model
      };
    }

    let iteration = 0;
    let reviewsUsed = 0;
    const maxIterations = this.config.maxIterations;
    const toolResults = [];
    // Compact per-turn action log so later turns remember what the agent DID
    // (files written, compiles run), not just what it said.
    const toolLog = [];
    // Stuck detection: the same tool call producing the SAME failure over and
    // over is not progress — it's a loop. Count repeated identical failures and
    // bail early instead of grinding the whole iteration budget to nothing.
    const failCounts = new Map();
    const REPEAT_FAIL_LIMIT = 3;
    let stuck = false;
    let stuckTool = '';
    const historyContent = (text) => toolLog.length === 0
      ? text
      : `${text || ''}\n\n[actions taken this turn: ${toolLog.join('; ')}]`;

    while (iteration < maxIterations) {
      this._throwIfCancelled();
      const response = await this._chatOnce(messages, chatOptions);
      this._throwIfCancelled();

      if (!response.toolCalls || response.toolCalls.length === 0) {
        // Completion gate: before letting the agent yield on a text-only turn,
        // ask the critic whether the user's goal is actually met. If not, send
        // it back to work with the concrete missing step. Agent mode only,
        // bounded by maxReviews, fail-open.
        if (mode === 'agent' && reviewsUsed < this.config.maxReviews && !this._cancelled) {
          const verdict = await this._reviewCompletion(userQuery, toolLog, response.content);
          if (!verdict.complete && verdict.missing) {
            reviewsUsed++;
            messages.push({ role: 'assistant', content: response.content || '(continuing)' });
            messages.push({
              role: 'user',
              content:
                `[GOAL REVIEW — not complete yet] ${verdict.missing}\n\n` +
                'Continue until the full goal is met. Take the next concrete action now ' +
                '(write / compile / install a library / fix the error / upload). Do not stop to summarize.'
            });
            iteration++;
            continue;
          }
        }
        if (response.content) {
          this.conversationHistory.push({
            role: 'assistant',
            content: historyContent(response.content)
          });
        }
        return {
          response: response.content,
          toolResults: toolResults,
          usage: response.usage,
          model: response.model
        };
      }

      const assistantMsg = {
        role: 'assistant',
        content: response.content || null,
        tool_calls: response.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: typeof tc.arguments === 'string'
              ? tc.arguments
              : JSON.stringify(tc.arguments || {})
          }
        }))
      };
      messages.push(assistantMsg);

      for (const toolCall of response.toolCalls) {
        this._throwIfCancelled();
        const startTime = Date.now();
        const detail = AIAgent._toolDetail(toolCall.arguments);
        this._emitToolEvent({ phase: 'start', tool: toolCall.name, detail, id: toolCall.id });
        const result = await this.toolExecutor.execute(toolCall);
        const executionTime = Date.now() - startTime;
        if (typeof result === 'object' && result !== null) {
          result.executionTime = executionTime;
        }
        this._emitToolEvent({
          phase: 'end',
          tool: toolCall.name,
          detail: (result && typeof result === 'object' && typeof result.path === 'string' && result.path) || detail,
          id: toolCall.id,
          ok: !(result && typeof result === 'object' && result.success === false),
          ms: executionTime
        });
        toolResults.push(result);
        const failed = result && typeof result === 'object' && result.success === false;
        toolLog.push(`${toolCall.name}${detail ? `(${detail})` : ''}${failed ? ' FAILED' : ''}`);

        // A repeated identical failure (same tool + same error) means the agent's
        // attempts aren't changing the outcome. Progress changes the error, so a
        // genuine fix cycle never trips this.
        if (failed) {
          const err = String(result.error || (result.result && result.result.error) || '').slice(0, 160);
          const sig = `${toolCall.name}::${err}`;
          const n = (failCounts.get(sig) || 0) + 1;
          failCounts.set(sig, n);
          if (n >= REPEAT_FAIL_LIMIT) { stuck = true; stuckTool = toolCall.name; }
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.name,
          content: typeof result === 'string' ? result : JSON.stringify(result)
        });
      }

      if (stuck) break;
      iteration++;
    }

    // Ran out of budget (or got stuck) before finishing. Don't dump a useless
    // "refine your query" — tell the user what got done, what's left, and that
    // they can resume. Progress is preserved in history so "continue" works.
    const reason = stuck
      ? `I kept hitting the same failure from ${stuckTool} without making progress`
      : 'I hit my step limit for a single turn';
    const summary = await this._summariseIncomplete(userQuery, toolLog, reason);
    this.conversationHistory.push({
      role: 'assistant',
      content: historyContent(summary)
    });

    return {
      response: summary,
      toolResults: toolResults,
      warning: stuck ? 'stuck' : 'max_iterations_reached',
      incomplete: true
    };
  }

  /**
   * Build a user-facing message when a turn ends unfinished: what got done,
   * what's left, and that they can reply "continue" to resume. One bounded,
   * tool-free model call; fails open to a formatted action list.
   */
  async _summariseIncomplete(userQuery, toolLog, reason) {
    const actions = (toolLog && toolLog.length) ? toolLog.join(', ') : 'no actions completed yet';
    const fallback =
      `I paused before finishing — ${reason}. So far this turn: ${actions}. ` +
      'Your progress is saved — reply "continue" and I\'ll pick up where I left off.';
    try {
      const msgs = [
        {
          role: 'system',
          content:
            'An Arduino build agent ran out of steps mid-task. In 2–4 short sentences, tell the user ' +
            'what got done, what still remains, and the single next step. End by telling them they can ' +
            'reply "continue" to resume. Be concrete; no preamble, no apology beyond a brief note.'
        },
        {
          role: 'user',
          content: `GOAL:\n${String(userQuery).slice(0, 1500)}\n\nACTIONS TAKEN THIS TURN:\n${actions}\n\nWHY IT PAUSED: ${reason}`
        }
      ];
      const r = await this.currentProvider.chat(msgs, { temperature: 0.2, max_tokens: 300, tools: [] });
      return (r.content || '').trim() || fallback;
    } catch (_) {
      return fallback; // never fail the turn on the summary
    }
  }

  /**
   * Analyze error with AI assistance
   */
  async analyzeError(errorMessage, context = {}) {
    // First, check memory
    const memoryResults = await this.memory.searchSimilarErrors(errorMessage, 5);
    
    if (memoryResults.match && memoryResults.fixes.length > 0) {
      // Found exact match with fixes
      return {
        source: 'memory',
        error: memoryResults.match,
        fixes: memoryResults.fixes,
        confidence: 1.0
      };
    }

    // If no provider set, return memory results only
    if (!this.currentProvider) {
      return {
        source: 'memory',
        matches: memoryResults.matches || [],
        message: 'No AI provider configured. Showing memory results only.'
      };
    }

    // Use AI to analyze
    let query = `Analyze this Arduino error and suggest fixes: ${errorMessage}\n\nContext: ${JSON.stringify(context, null, 2)}`;
    
    if (memoryResults.matches && memoryResults.matches.length > 0) {
      query += `\n\nSimilar past errors found: ${JSON.stringify(memoryResults.matches, null, 2)}`;
    }

    const result = await this.processQuery(query, context);
    
    return {
      source: 'ai',
      analysis: result.response,
      memoryResults: memoryResults,
      toolResults: result.toolResults
    };
  }

  /**
   * Analyze serial output
   */
  async analyzeSerialOutput(serialOutput) {
    if (!this.currentProvider) {
      return {
        source: 'local',
        message: 'No AI provider configured. Serial output logged but not analyzed.'
      };
    }

    const query = `Analyze this serial monitor output from an Arduino board:\n\n${serialOutput}\n\nWhat is the board doing? Are there any issues?`;
    
    return await this.processQuery(query, { type: 'serial_analysis' });
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
  }

  /**
   * Summarise the current conversation with the AI, then replace history with
   * a single seeded system-style user message containing the summary.
   * Returns the summary text so the UI can display a divider card.
   *
   * @returns {Promise<string>} summary text
   */
  async summarizeAndCompact() {
    if (!this.currentProvider) throw new Error('No provider configured');
    if (this.conversationHistory.length === 0) return '';

    // Ask the model to produce a concise summary of what happened so far.
    const summarisePrompt = [
      {
        role: 'system',
        content:
          'You are a technical assistant. Produce a concise but complete summary of the ' +
          'conversation below. Keep all important decisions, code changes, errors encountered, ' +
          'and next steps. Write in the third person. Max 400 words.'
      },
      ...this.conversationHistory,
      {
        role: 'user',
        content:
          'Please summarise the conversation above so it can be used as context going forward.'
      }
    ];

    const response = await this.currentProvider.chat(summarisePrompt, {
      temperature: 0.3,
      max_tokens: 600,
      tools: [] // no tools during summarisation
    });

    const summary = (response.content || '').trim() || 'Conversation summarised (no content returned).';

    // Replace history with a single seeded context message so the next query
    // has a compact starting point without losing important context.
    this.conversationHistory = [
      {
        role: 'user',
        content: `[CONVERSATION SUMMARY]\n${summary}`
      },
      {
        role: 'assistant',
        content: 'Understood. I have the context from the previous conversation. How can I help?'
      }
    ];

    return summary;
  }

  /**
   * Get conversation history
   */
  getHistory() {
    return this.conversationHistory;
  }

  /**
   * Trim conversation history to stay within the sliding window.
   * Preserves the most recent messages and never cuts in the middle
   * of a tool-call/tool-result pair.
   */
  _trimHistory() {
    if (this.conversationHistory.length <= this.maxHistoryMessages) return;

    // Keep the most recent messages within budget
    const excess = this.conversationHistory.length - this.maxHistoryMessages;
    // Don't cut in the middle of a tool exchange — find safe cut point
    let cutAt = excess;
    while (cutAt < this.conversationHistory.length) {
      const msg = this.conversationHistory[cutAt];
      // Safe to cut before a user message (not a tool result)
      if (msg.role === 'user' && !msg.tool_call_id) break;
      cutAt++;
    }
    if (cutAt > 0 && cutAt < this.conversationHistory.length) {
      this.conversationHistory = this.conversationHistory.slice(cutAt);
    }
  }

  /**
   * Close and cleanup
   */
  close() {
    if (this.memory) {
      this.memory.close();
    }
  }
}

module.exports = AIAgent;

