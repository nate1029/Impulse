const Anthropic = require('@anthropic-ai/sdk');
const BaseProvider = require('./baseProvider');
const { getAllTools } = require('../tools/toolSchema');

function getToolsForOptions(options) {
  if (options.tools !== undefined) return options.tools;
  return getAllTools();
}

class ClaudeProvider extends BaseProvider {
  static DEFAULT_MODEL = 'claude-sonnet-4-6';

  constructor(apiKey, model = null) {
    // Ensure model is never null/undefined - use default if not provided
    const effectiveModel = model || ClaudeProvider.DEFAULT_MODEL;
    super(apiKey, effectiveModel);
    this.name = 'claude';
    this.client = new Anthropic({ apiKey: this.apiKey });
  }

  // Curated to agent-capable models. Old 3.5/3.x haiku + opus-3 were removed —
  // superseded and weaker at multi-step tool use.
  getAvailableModels() {
    return [
      'claude-sonnet-5',
      'claude-fable-5',
      'claude-opus-4-8',
      'claude-sonnet-4-6',
      'claude-haiku-4-5-20251001',
      'claude-3-7-sonnet-20250219'
    ];
  }

  formatTools(tools) {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters
    }));
  }

  _translateMessages(messages) {
    let systemMessage = '';
    const conversationMessages = [];
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemMessage += msg.content + '\n';
      } else if (msg.role === 'tool') {
        conversationMessages.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: msg.tool_call_id,
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
          }]
        });
      } else if (msg.role === 'assistant') {
        let content;
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          const blocks = [];
          if (msg.content) blocks.push({ type: 'text', text: msg.content });
          for (const tc of msg.tool_calls) {
            const raw = tc.function?.arguments ?? tc.arguments;
            let input = {};
            if (typeof raw === 'string') { try { input = JSON.parse(raw || '{}'); } catch { input = {}; } }
            else if (raw && typeof raw === 'object') input = raw;
            blocks.push({ type: 'tool_use', id: tc.id, name: tc.function?.name || tc.name, input });
          }
          content = blocks;
        } else {
          content = msg.content || '';
        }
        conversationMessages.push({ role: 'assistant', content });
      } else {
        // Multi-modal canonical → Claude
        let content = msg.content;
        if (Array.isArray(msg.content)) {
          content = msg.content.map(part => part.type === 'image'
            ? { type: 'image', source: { type: 'base64', media_type: part.mimeType, data: part.data } }
            : { type: 'text', text: part.text || '' });
        }
        conversationMessages.push({ role: 'user', content });
      }
    }
    return { systemMessage, conversationMessages };
  }

  _buildCreateOptions(messages, options) {
    const tools = getToolsForOptions(options);
    const useTools = Array.isArray(tools) && tools.length > 0;
    const { systemMessage, conversationMessages } = this._translateMessages(messages);
    // Legacy Claude 3 models hard-cap output at 4096 tokens.
    const cap = /^claude-3-(opus|sonnet|haiku)-/.test(this.model) ? 4096 : 8192;
    const createOptions = {
      model: this.model,
      max_tokens: Math.min(options.max_tokens || 8192, cap),
      temperature: options.temperature || 0.7,
      system: systemMessage || undefined,
      messages: conversationMessages
    };
    if (useTools) createOptions.tools = this.formatTools(tools);
    return createOptions;
  }

  _formatResponse(response) {
    let text = '';
    for (const content of response.content) {
      if (content.type === 'text') text += content.text;
    }
    return {
      content: text,
      toolCalls: this.parseToolCalls(response),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens
      },
      model: response.model
    };
  }

  async chat(messages, options = {}) {
    const createOptions = this._buildCreateOptions(messages, options);
    const response = await this.client.messages.create(createOptions);
    return this._formatResponse(response);
  }

  async chatStream(messages, options = {}, onDelta) {
    const createOptions = this._buildCreateOptions(messages, options);
    const stream = this.client.messages.stream(createOptions);
    if (typeof onDelta === 'function') {
      stream.on('text', (delta) => { try { onDelta({ text: delta }); } catch (_) { /* UI-only */ } });
    }
    const finalMessage = await stream.finalMessage();
    return this._formatResponse(finalMessage);
  }

  parseToolCalls(response) {
    const toolCalls = [];

    for (const content of response.content) {
      if (content.type === 'tool_use') {
        toolCalls.push({
          id: content.id,
          name: content.name,
          arguments: content.input
        });
      }
    }

    return toolCalls;
  }

  validateApiKey(apiKey) {
    return super.validateApiKey(apiKey) && apiKey.startsWith('sk-ant-');
  }
}

module.exports = ClaudeProvider;

