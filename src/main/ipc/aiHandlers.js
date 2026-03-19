/**
 * AI agent IPC handlers.
 * @module main/ipc/aiHandlers
 */

const AIAgent = require('../services/ai/agent');
const { parseOrDefault, schemas } = require('./schemas');
const { withDebugLog } = require('../utils/logger');

const defaultFail = { success: false, error: 'Invalid input' };

/**
 * Register AI agent IPC handlers.
 * @param {import('electron').IpcMain} ipcMain
 * @param {{ aiAgent: import('../services/ai/agent'), apiKeyManager: import('../services/ai/config/apiKeyManager'), uiState: Record<string, unknown> }} ctx
 */
function register(ipcMain, ctx) {
  const { aiAgent, apiKeyManager, uiState } = ctx;

  ipcMain.handle('ai:set-provider', withDebugLog('ai:set-provider', async (event, providerName, apiKey, model) => {
    const parsed = parseOrDefault(schemas.aiSetProvider, { providerName: providerName ?? '', apiKey: apiKey ?? null, model: model ?? null }, defaultFail);
    if (!parsed.ok) return parsed.defaultResult;
    try {
      if (parsed.data.apiKey && String(parsed.data.apiKey).trim().length > 0) {
        apiKeyManager.setAPIKey(parsed.data.providerName, parsed.data.apiKey);
      }
      const key = parsed.data.apiKey?.trim() || apiKeyManager.getAPIKey(parsed.data.providerName);
      if (!key || key.trim().length === 0) {
        return { success: false, error: 'API key not found. Please provide an API key.' };
      }
      aiAgent.setProvider(parsed.data.providerName, key, parsed.data.model ?? undefined);
      return { success: true, provider: parsed.data.providerName, model: parsed.data.model || 'default' };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Set provider failed' };
    }
  }));

  ipcMain.handle('ai:process-query', withDebugLog('ai:process-query', async (event, query, context, mode) => {
    const parsed = parseOrDefault(schemas.aiProcessQuery, { query: query ?? '', context: context ?? {}, mode: mode ?? 'agent' }, defaultFail);
    if (!parsed.ok) return parsed.defaultResult;
    try {
      const ctx = parsed.data.context || {};
      const enrichedContext = {
        ...parsed.data.context,
        currentBaudRate: uiState.currentBaudRate,
        currentSketchPath: uiState.currentSketchPath,
        selectedBoard: uiState.selectedBoard ?? ctx.board ?? null,
        selectedPort: uiState.selectedPort ?? ctx.port ?? null,
        hasFileOpen: ctx.hasFileOpen ?? false
      };
      const effectiveMode = parsed.data.mode === 'ask' || parsed.data.mode === 'debug' ? parsed.data.mode : 'agent';
      const result = await aiAgent.processQuery(parsed.data.query, enrichedContext, effectiveMode);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Process query failed' };
    }
  }));

  ipcMain.handle('ai:analyze-error', withDebugLog('ai:analyze-error', async (event, errorMessage, context) => {
    const parsed = parseOrDefault(schemas.aiAnalyzeError, { errorMessage: errorMessage ?? '', context }, defaultFail);
    if (!parsed.ok) return parsed.defaultResult;
    try {
      const result = await aiAgent.analyzeError(parsed.data.errorMessage, parsed.data.context);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Analyze failed' };
    }
  }));

  ipcMain.handle('ai:analyze-serial', withDebugLog('ai:analyze-serial', async (event, serialOutput, lines) => {
    const parsed = parseOrDefault(schemas.aiAnalyzeSerial, { serialOutput: serialOutput ?? '', lines: lines ?? [] }, defaultFail);
    if (!parsed.ok) return parsed.defaultResult;
    try {
      const result = await aiAgent.analyzeSerialOutput(parsed.data.serialOutput, parsed.data.lines);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Analyze failed' };
    }
  }));

  ipcMain.handle('ai:get-providers', withDebugLog('ai:get-providers', async () => {
    try {
      const providers = aiAgent.getAvailableProviders();
      return { success: true, data: providers ?? [] };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Get providers failed' };
    }
  }));

  ipcMain.handle('ai:get-models', withDebugLog('ai:get-models', async (event, provider) => {
    const parsed = parseOrDefault(schemas.aiGetModels, { provider: provider ?? null }, defaultFail);
    if (!parsed.ok) return parsed.defaultResult;
    try {
      const models = aiAgent.getAvailableModels(parsed.data.provider ?? undefined);
      return { success: true, data: models ?? [] };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Get models failed' };
    }
  }));

  ipcMain.handle('ai:get-unified-models', withDebugLog('ai:get-unified-models', async () => {
    try {
      const list = aiAgent.getUnifiedModelList();
      return { success: true, data: list ?? [] };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Get models failed' };
    }
  }));

  ipcMain.handle('ai:set-model', withDebugLog('ai:set-model', async (event, modelId) => {
    const parsed = parseOrDefault(schemas.aiSetModel, { modelId: modelId ?? '' }, defaultFail);
    if (!parsed.ok) return parsed.defaultResult;
    try {
      const providerName = AIAgent.getProviderFromModel(parsed.data.modelId);
      if (!providerName) return { success: false, error: 'Unknown model' };
      const key = apiKeyManager.getAPIKey(providerName);
      if (!key || key.trim().length === 0) {
        return { success: false, error: 'API key required', needsKey: true, provider: providerName };
      }
      aiAgent.setProvider(providerName, key, parsed.data.modelId);
      return { success: true, provider: providerName, model: parsed.data.modelId };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Set model failed' };
    }
  }));

  ipcMain.handle('ai:get-memory-stats', withDebugLog('ai:get-memory-stats', async () => {
    try {
      const stats = await aiAgent.memory.getStats();
      return { success: true, data: stats ?? {} };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Get stats failed' };
    }
  }));

  ipcMain.handle('ai:execute-tool', withDebugLog('ai:execute-tool', async (event, toolName, args) => {
    const parsed = parseOrDefault(schemas.aiExecuteTool, { toolName: toolName ?? '', args: args ?? {} }, defaultFail);
    if (!parsed.ok) return parsed.defaultResult;
    try {
      if (!aiAgent.toolExecutor) return { success: false, error: 'Tool executor not initialized' };
      const result = await aiAgent.toolExecutor.execute({
        name: parsed.data.toolName,
        arguments: parsed.data.args
      });
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Execute tool failed' };
    }
  }));
}

module.exports = { register };
