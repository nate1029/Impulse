const OpenAI = require('openai');
const BaseProvider = require('./baseProvider');
const { getAllTools } = require('../tools/toolSchema');

class OpenAIProvider extends BaseProvider {
  static DEFAULT_MODEL = 'gpt-4.1-mini';

  constructor(apiKey, model = null) {
    // Ensure model is never null/undefined - use default if not provided
    const effectiveModel = model || OpenAIProvider.DEFAULT_MODEL;
    super(apiKey, effectiveModel);
    this.name = 'openai';
    this.client = new OpenAI({ apiKey: this.apiKey });
  }

  // Curated to models that can actually drive a multi-step build loop.
  // Weak/legacy models (gpt-4.1-nano, o3-mini, gpt-4-turbo, gpt-4, gpt-3.5-turbo)
  // were removed — they stall or answer in one shot instead of finishing the job.
  getAvailableModels() {
    return [
      'gpt-4.1',
      'gpt-4.1-mini',
      'o4-mini',
      'gpt-4o',
      'gpt-4o-mini'
    ];
  }

  formatTools(tools) {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
  }

  _buildRequestOptions(messages, options) {
    const tools = options.tools !== undefined ? options.tools : getAllTools();
    const useTools = Array.isArray(tools) && tools.length > 0;
    const formattedTools = useTools ? this.formatTools(tools) : undefined;
    const modelToUse = this.model || OpenAIProvider.DEFAULT_MODEL;
    const isReasoning = /^o\d/.test(modelToUse);
    const tokenKey = isReasoning ? 'max_completion_tokens' : 'max_tokens';

    const translatedMessages = messages.map(m => {
      if (Array.isArray(m.content)) {
        return {
          ...m,
          content: m.content.map(part => part.type === 'image'
            ? { type: 'image_url', image_url: { url: `data:${part.mimeType};base64,${part.data}` } }
            : { type: 'text', text: part.text || '' })
        };
      }
      return m;
    });

    // Legacy 8k-context models can't take a large completion budget on top of the prompt.
    const cap = /^gpt-4$|^gpt-3\.5/.test(modelToUse) ? 4096 : 8192;
    const requestOptions = {
      model: modelToUse,
      messages: translatedMessages,
      temperature: isReasoning ? 1 : (options.temperature || 0.7),
      [tokenKey]: Math.min(options.max_tokens || 8192, cap)
    };
    if (useTools) {
      requestOptions.tools = formattedTools;
      requestOptions.tool_choice = options.tool_choice || 'auto';
    }
    return requestOptions;
  }

  async chat(messages, options = {}) {
    const requestOptions = this._buildRequestOptions(messages, options);
    const response = await this.client.chat.completions.create(requestOptions);
    const message = response.choices[0].message;
    return {
      content: message.content,
      toolCalls: this.parseToolCalls(message),
      usage: response.usage,
      model: response.model
    };
  }

  async chatStream(messages, options = {}, onDelta) {
    const requestOptions = { ...this._buildRequestOptions(messages, options), stream: true };
    const stream = await this.client.chat.completions.create(requestOptions);

    let content = '';
    let modelName = null;
    let usage = null;
    // ponytail: OpenAI streams tool_calls fragment-by-fragment. Accumulate by index.
    // Ceiling: current agent needs whole tool_calls before executing; if we ever want
    // to stream arguments to the UI (e.g. for a live diff preview), extend here.
    const toolAcc = [];

    for await (const chunk of stream) {
      if (!modelName && chunk.model) modelName = chunk.model;
      if (chunk.usage) usage = chunk.usage;
      const d = chunk.choices?.[0]?.delta;
      if (!d) continue;
      if (d.content) {
        content += d.content;
        if (typeof onDelta === 'function') { try { onDelta({ text: d.content }); } catch (_) { /* UI-only */ } }
      }
      if (Array.isArray(d.tool_calls)) {
        for (const tc of d.tool_calls) {
          const idx = typeof tc.index === 'number' ? tc.index : 0;
          if (!toolAcc[idx]) toolAcc[idx] = { id: '', type: 'function', function: { name: '', arguments: '' } };
          if (tc.id) toolAcc[idx].id = tc.id;
          if (tc.function?.name) toolAcc[idx].function.name = tc.function.name;
          if (tc.function?.arguments) toolAcc[idx].function.arguments += tc.function.arguments;
        }
      }
    }

    const finalMessage = { content, tool_calls: toolAcc.filter(Boolean).length ? toolAcc.filter(Boolean) : undefined };
    return {
      content,
      toolCalls: this.parseToolCalls(finalMessage),
      usage,
      model: modelName
    };
  }

  parseToolCalls(response) {
    if (!response.tool_calls || response.tool_calls.length === 0) {
      return [];
    }

    return response.tool_calls.map(toolCall => ({
      id: toolCall.id,
      name: toolCall.function.name,
      arguments: JSON.parse(toolCall.function.arguments || '{}')
    }));
  }

  validateApiKey(apiKey) {
    return super.validateApiKey(apiKey) && apiKey.startsWith('sk-');
  }
}

module.exports = OpenAIProvider;

