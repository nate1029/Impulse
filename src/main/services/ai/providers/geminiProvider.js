const { GoogleGenerativeAI } = require('@google/generative-ai');
const BaseProvider = require('./baseProvider');

class GeminiProvider extends BaseProvider {
  static DEFAULT_MODEL = 'gemini-2.5-flash';

  constructor(apiKey, model = null) {
    // Ensure model is never null/undefined - use default if not provided
    const effectiveModel = model || GeminiProvider.DEFAULT_MODEL;
    super(apiKey, effectiveModel);
    this.name = 'gemini';
    
    // Initialize with API key
    // The newer SDK version (0.21+) automatically uses the correct API version
    this.genAI = new GoogleGenerativeAI(this.apiKey);
  }

  // Curated to agent-capable models. "-lite" tiers and the 1.5 legacy family
  // were removed — too weak to reliably finish multi-step builds.
  getAvailableModels() {
    return [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.0-flash'
    ];
  }

  formatTools(tools) {
    // Gemini uses Function Calling format
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: tool.parameters.properties || {},
        required: tool.parameters.required || []
      }
    }));
  }

  _prepareRequest(messages, options) {
    const modelName = this.model || GeminiProvider.DEFAULT_MODEL;
    const modelConfig = {
      model: modelName,
      generationConfig: {
        temperature: options.temperature || 0.7,
        maxOutputTokens: options.max_tokens || 8192
      }
    };
    if (options.tools && Array.isArray(options.tools) && options.tools.length > 0) {
      modelConfig.tools = [{ functionDeclarations: this.formatTools(options.tools) }];
    }
    const model = this.genAI.getGenerativeModel(modelConfig);
    const { systemInstruction, contents } = this.convertMessagesToGemini(messages);
    return { model, modelName, request: { contents, systemInstruction: systemInstruction || undefined } };
  }

  _handleGeminiError(error, modelName) {
    console.error('Gemini API error:', error);
    if (error.message?.includes('API key')) {
      throw new Error('Invalid Gemini API key. Get one from https://aistudio.google.com/apikey');
    }
    if (error.message?.includes('not found') || error.message?.includes('404')) {
      throw new Error(`Model "${modelName}" not available. Try updating @google/generative-ai package or use a different model.`);
    }
    if (error.message?.includes('quota') || error.message?.includes('rate')) {
      throw new Error('API quota exceeded. Please wait and try again.');
    }
    throw new Error(`Gemini error: ${error.message}`);
  }

  async chat(messages, options = {}) {
    const { model, modelName, request } = this._prepareRequest(messages, options);
    try {
      const result = await model.generateContent(request);
      const response = result.response;
      let text = '';
      try { text = response.text(); } catch (_) { /* function-call-only */ }
      return {
        content: text || '',
        toolCalls: this.parseToolCalls(response),
        usage: {
          promptTokens: response.usageMetadata?.promptTokenCount || 0,
          completionTokens: response.usageMetadata?.candidatesTokenCount || 0
        },
        model: modelName
      };
    } catch (error) { this._handleGeminiError(error, modelName); }
  }

  async chatStream(messages, options = {}, onDelta) {
    const { model, modelName, request } = this._prepareRequest(messages, options);
    try {
      const result = await model.generateContentStream(request);
      let content = '';
      for await (const chunk of result.stream) {
        let text = '';
        try { text = chunk.text?.() || ''; } catch (_) { /* function-call chunk */ }
        if (text) {
          content += text;
          if (typeof onDelta === 'function') { try { onDelta({ text }); } catch (_) { /* UI-only */ } }
        }
      }
      const response = await result.response;
      return {
        content,
        toolCalls: this.parseToolCalls(response),
        usage: {
          promptTokens: response.usageMetadata?.promptTokenCount || 0,
          completionTokens: response.usageMetadata?.candidatesTokenCount || 0
        },
        model: modelName
      };
    } catch (error) { this._handleGeminiError(error, modelName); }
  }

  convertMessagesToGemini(messages) {
    let systemInstruction = null;
    const contents = [];
    
    for (const msg of messages) {
      if (msg.role === 'system') {
        // Gemini 1.5+ supports systemInstruction
        if (msg.content) systemInstruction = msg.content;
        continue;
      }

      if (msg.role === 'tool') {
        // Tool result message -> Gemini functionResponse
        contents.push({
          role: 'user',
          parts: [{
            functionResponse: {
              name: msg.name || 'unknown',
              response: { result: msg.content || '' }
            }
          }]
        });
        continue;
      }

      if (msg.role === 'assistant') {
        const parts = [];
        // Add text content if present
        if (msg.content) {
          parts.push({ text: msg.content });
        }
        // Add function calls if present
        if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
          for (const tc of msg.tool_calls) {
            const fn = tc.function || tc;
            parts.push({
              functionCall: {
                name: fn.name,
                args: typeof fn.arguments === 'string' ? JSON.parse(fn.arguments) : (fn.arguments || {})
              }
            });
          }
        }
        if (parts.length > 0) {
          contents.push({ role: 'model', parts });
        }
        continue;
      }

      // User messages — plain string or canonical multi-modal blocks
      if (Array.isArray(msg.content)) {
        const parts = msg.content.map(p => p.type === 'image'
          ? { inline_data: { mime_type: p.mimeType, data: p.data } }
          : { text: p.text || '' });
        contents.push({ role: 'user', parts });
      } else if (msg.content) {
        contents.push({
          role: 'user',
          parts: [{ text: msg.content }]
        });
      }
    }
    
    // Ensure we have at least one user message
    if (contents.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: 'Hello' }]
      });
    }
    
    return { systemInstruction, contents };
  }

  parseToolCalls(response) {
    const toolCalls = [];
    
    try {
      const candidates = response.candidates || [];
      for (const candidate of candidates) {
        const content = candidate.content;
        if (content && content.parts) {
          for (const part of content.parts) {
            if (part.functionCall) {
              toolCalls.push({
                id: `gemini-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: part.functionCall.name,
                arguments: part.functionCall.args || {}
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error parsing tool calls:', error);
    }

    return toolCalls;
  }

  validateApiKey(apiKey) {
    // Gemini API keys typically start with "AI" and are 39 characters
    return super.validateApiKey(apiKey) && apiKey.length >= 30;
  }
}

module.exports = GeminiProvider;
