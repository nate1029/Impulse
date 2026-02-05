const Anthropic = require('@anthropic-ai/sdk');
const BaseProvider = require('./baseProvider');
const { getAllTools } = require('../tools/toolSchema');

function getToolsForOptions(options) {
  if (options.tools !== undefined) return options.tools;
  return getAllTools();
}

class ClaudeProvider extends BaseProvider {
  static DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';

  constructor(apiKey, model = null) {
    // Ensure model is never null/undefined - use default if not provided
    const effectiveModel = model || ClaudeProvider.DEFAULT_MODEL;
    super(apiKey, effectiveModel);
    this.name = 'claude';
    this.client = new Anthropic({ apiKey: this.apiKey });
  }

  getAvailableModels() {
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'claude-3-5-haiku-20241022'
    ];
  }

  formatTools(tools) {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters
    }));
  }

  async chat(messages, options = {}) {
    const tools = getToolsForOptions(options);
    const useTools = Array.isArray(tools) && tools.length > 0;
    const formattedTools = useTools ? this.formatTools(tools) : [];

    // Separate system message from other messages
    let systemMessage = '';
    const conversationMessages = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemMessage += msg.content + '\n';
      } else if (msg.role === 'tool') {
        // Handle tool result messages - Claude expects these in user role
        conversationMessages.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: msg.tool_call_id,
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
          }]
        });
      } else if (msg.role === 'assistant') {
        // Assistant may have tool_calls (from agent) - Claude expects content as array of blocks
        let content;
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          const blocks = [];
          if (msg.content) {
            blocks.push({ type: 'text', text: msg.content });
          }
          for (const tc of msg.tool_calls) {
            const raw = tc.function?.arguments ?? tc.arguments;
            let input = {};
            if (typeof raw === 'string') {
              try { input = JSON.parse(raw || '{}'); } catch { input = {}; }
            } else if (raw && typeof raw === 'object') {
              input = raw;
            }
            blocks.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.function?.name || tc.name,
              input
            });
          }
          content = blocks;
        } else {
          content = msg.content || '';
        }
        conversationMessages.push({
          role: 'assistant',
          content
        });
      } else {
        conversationMessages.push({
          role: 'user',
          content: msg.content
        });
      }
    }

    const createOptions = {
      model: this.model,
      max_tokens: options.max_tokens || 2000,
      temperature: options.temperature || 0.7,
      system: systemMessage || undefined,
      messages: conversationMessages
    };
    if (useTools) createOptions.tools = formattedTools;
    const response = await this.client.messages.create(createOptions);

    // Extract text content
    let text = '';
    for (const content of response.content) {
      if (content.type === 'text') {
        text += content.text;
      }
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

