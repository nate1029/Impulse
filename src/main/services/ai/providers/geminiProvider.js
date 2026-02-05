const { GoogleGenerativeAI } = require('@google/generative-ai');
const BaseProvider = require('./baseProvider');
const { getAllTools } = require('../tools/toolSchema');

class GeminiProvider extends BaseProvider {
  static DEFAULT_MODEL = 'gemini-1.5-flash';

  constructor(apiKey, model = null) {
    // Ensure model is never null/undefined - use default if not provided
    const effectiveModel = model || GeminiProvider.DEFAULT_MODEL;
    super(apiKey, effectiveModel);
    this.name = 'gemini';
    
    // Initialize with API key
    // The newer SDK version (0.21+) automatically uses the correct API version
    this.genAI = new GoogleGenerativeAI(this.apiKey);
  }

  getAvailableModels() {
    // Current models as of 2025/2026
    return [
      'gemini-1.5-flash',       // Fast, cost-effective
      'gemini-1.5-flash-latest',// Latest flash
      'gemini-1.5-pro',         // More capable
      'gemini-1.5-pro-latest',  // Latest pro
      'gemini-2.0-flash-exp',   // Experimental 2.0
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

  async chat(messages, options = {}) {
    const modelName = this.model || GeminiProvider.DEFAULT_MODEL;
    
    try {
      // Get the model - newer SDK handles API version automatically
      const model = this.genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: {
          temperature: options.temperature || 0.7,
          maxOutputTokens: options.max_tokens || 2000,
        }
      });

      // Convert messages to Gemini format
      const { systemInstruction, contents } = this.convertMessagesToGemini(messages);

      // Generate content
      const result = await model.generateContent({
        contents: contents,
        systemInstruction: systemInstruction || undefined,
      });

      const response = result.response;
      const text = response.text();

      return {
        content: text || '',
        toolCalls: this.parseToolCalls(response),
        usage: {
          promptTokens: response.usageMetadata?.promptTokenCount || 0,
          completionTokens: response.usageMetadata?.candidatesTokenCount || 0
        },
        model: modelName
      };
    } catch (error) {
      console.error('Gemini API error:', error);
      
      // Handle specific errors
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
  }

  convertMessagesToGemini(messages) {
    let systemInstruction = null;
    const contents = [];
    
    for (const msg of messages) {
      if (!msg.content) continue;
      
      if (msg.role === 'system') {
        // Gemini 1.5+ supports systemInstruction
        systemInstruction = msg.content;
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
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
