const { getSystemPrompt } = require('./prompts/systemPrompt');
const ToolExecutor = require('./tools/toolExecutor');
const SimpleMemory = require('./memory/simpleMemory');
const { getAllTools, getDebugTools } = require('./tools/toolSchema');
const OpenAIProvider = require('./providers/openaiProvider');
const GeminiProvider = require('./providers/geminiProvider');
const ClaudeProvider = require('./providers/claudeProvider');

/**
 * AI Agent
 * Main orchestrator for AI-powered Arduino development assistance
 */
class AIAgent {
  constructor(arduinoService, serialMonitor, errorMemory, config = {}) {
    this.arduinoService = arduinoService;
    this.serialMonitor = serialMonitor;
    this.errorMemory = errorMemory;
    
    // Initialize simple JSON-based memory (no SQLite dependency)
    this.memory = new SimpleMemory();
    
    // Initialize tool executor
    this.toolExecutor = new ToolExecutor(
      arduinoService,
      serialMonitor,
      errorMemory,
      this.memory
    );
    
    // Provider management
    this.providers = new Map();
    this.currentProvider = null;
    this.config = {
      maxIterations: config.maxIterations || 10,
      temperature: config.temperature || 0.7,
      ...config
    };
    
    // Conversation history
    this.conversationHistory = [];
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
    if (id.startsWith('gpt-')) return 'openai';
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
      'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
      'claude-3-opus-20240229': 'Claude 3 Opus',
      'claude-3-sonnet-20240229': 'Claude 3 Sonnet',
      'claude-3-haiku-20240307': 'Claude 3 Haiku',
      'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
      'gpt-4o-mini': 'GPT-4o Mini',
      'gpt-4o': 'GPT-4o',
      'gpt-4-turbo': 'GPT-4 Turbo',
      'gpt-4': 'GPT-4',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo',
      'gemini-1.5-flash': 'Gemini 1.5 Flash',
      'gemini-1.5-flash-latest': 'Gemini 1.5 Flash (Latest)',
      'gemini-1.5-pro': 'Gemini 1.5 Pro',
      'gemini-1.5-pro-latest': 'Gemini 1.5 Pro (Latest)',
      'gemini-2.0-flash-exp': 'Gemini 2.0 Flash (Experimental)'
    };
    for (const providerName of this.providers.keys()) {
      const ProviderClass = this.providers.get(providerName);
      const tempInstance = new ProviderClass('temp-key');
      const models = tempInstance.getAvailableModels();
      for (const modelId of models) {
        list.push({
          id: modelId,
          displayName: displayNames[modelId] || modelId,
          provider: providerName
        });
      }
    }
    return list;
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
   * Process a user query with optional tool use (mode-dependent)
   * @param {string} userQuery - User message
   * @param {Object} context - IDE context
   * @param {string} mode - 'agent' | 'ask' | 'debug'
   */
  async processQuery(userQuery, context = {}, mode = 'agent') {
    if (!this.currentProvider) {
      throw new Error('No provider selected. Please set a provider first.');
    }

    const toolsForMode = this._getToolsForMode(mode);
    const useTools = Array.isArray(toolsForMode) && toolsForMode.length > 0;

    // Build user content: prepend IDE context when available
    const ctx = [];
    if (!context.hasFileOpen) {
      ctx.push('NO_FILE_OPEN');
    } else if (context.currentSketchPath) {
      ctx.push(`sketch=${context.currentSketchPath}`);
    }
    if (context.selectedBoard) ctx.push(`board=${context.selectedBoard}`);
    if (context.selectedPort) ctx.push(`port=${context.selectedPort}`);

    const userContent = ctx.length > 0
      ? `[IDE: ${ctx.join(', ')}]\n\n${userQuery}`
      : userQuery;

    this.conversationHistory.push({
      role: 'user',
      content: userContent
    });

    const messages = [
      {
        role: 'system',
        content: getSystemPrompt(mode)
      },
      ...this.conversationHistory
    ];

    const chatOptions = {
      temperature: this.config.temperature,
      max_tokens: this.config.max_tokens || 2000,
      tools: toolsForMode
    };

    // Ask mode: single turn, no tools
    if (!useTools) {
      const response = await this.currentProvider.chat(messages, chatOptions);
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
    const maxIterations = this.config.maxIterations;
    const toolResults = [];

    while (iteration < maxIterations) {
      const response = await this.currentProvider.chat(messages, chatOptions);

      if (!response.toolCalls || response.toolCalls.length === 0) {
        if (response.content) {
          this.conversationHistory.push({
            role: 'assistant',
            content: response.content
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
        const startTime = Date.now();
        const result = await this.toolExecutor.execute(toolCall);
        const executionTime = Date.now() - startTime;
        if (typeof result === 'object' && result !== null) {
          result.executionTime = executionTime;
        }
        toolResults.push(result);

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.name,
          content: typeof result === 'string' ? result : JSON.stringify(result)
        });
      }

      iteration++;
    }

    return {
      response: 'Maximum iterations reached. Please refine your query.',
      toolResults: toolResults,
      warning: 'max_iterations_reached'
    };
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
    const query = `Analyze this Arduino error and suggest fixes: ${errorMessage}\n\nContext: ${JSON.stringify(context, null, 2)}`;
    
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
  async analyzeSerialOutput(serialOutput, lines = 50) {
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
   * Get conversation history
   */
  getHistory() {
    return this.conversationHistory;
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

