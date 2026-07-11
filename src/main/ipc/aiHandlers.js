/**
 * AI agent IPC handlers.
 * @module main/ipc/aiHandlers
 */

const AIAgent = require('../services/ai/agent');
const { parseOrDefault, schemas } = require('./schemas');
const { withDebugLog } = require('../utils/logger');
const { recordFeedback } = require('../services/ai/feedback');
const pendingEdits = require('../services/ai/pendingEdits');

const defaultFail = { success: false, error: 'Invalid input' };

/**
 * Register AI agent IPC handlers.
 * @param {import('electron').IpcMain} ipcMain
 * @param {{ aiAgent: import('../services/ai/agent'), apiKeyManager: import('../services/ai/config/apiKeyManager'), uiState: Record<string, unknown> }} ctx
 */
function register(ipcMain, ctx) {
  const { aiAgent, apiKeyManager, uiState } = ctx;

  // One agent turn at a time: aiAgent shares a single conversationHistory,
  // _cancelled flag and stream callbacks, so concurrent turns corrupt each other.
  let turnRunning = false;
  const runExclusive = async (work) => {
    if (turnRunning) return { success: false, error: 'The agent is already working on a request. Stop it or wait for it to finish.' };
    turnRunning = true;
    try { return await work(); } finally { turnRunning = false; }
  };

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

  ipcMain.handle('ai:process-query', withDebugLog('ai:process-query', async (event, query, context, mode, attachments) => {
    const parsed = parseOrDefault(schemas.aiProcessQuery, { query: query ?? '', context: context ?? {}, mode: mode ?? 'agent' }, defaultFail);
    if (!parsed.ok) return parsed.defaultResult;
    return runExclusive(async () => {
    try {
      const ctx = parsed.data.context || {};
      // Flow awareness: pull the last ~10 serial lines from the tool executor's
      // buffer so the agent sees what the board is currently saying without
      // having to ask. ponytail: 10 lines is enough for most debugging; bump if
      // agents keep calling read_serial straight after being invoked.
      let recentSerial = '';
      try {
        const buf = aiAgent?.toolExecutor?.serialBuffer;
        if (Array.isArray(buf) && buf.length > 0) {
          recentSerial = buf.slice(-10).map(e => String(e.data || '')).join('').trim().slice(-1500);
        }
      } catch (_) { /* buffer optional */ }

      const enrichedContext = {
        ...parsed.data.context,
        currentBaudRate: uiState.currentBaudRate,
        currentSketchPath: uiState.currentSketchPath,
        selectedBoard: uiState.selectedBoard ?? ctx.board ?? null,
        selectedPort: uiState.selectedPort ?? ctx.port ?? null,
        hasFileOpen: ctx.hasFileOpen ?? false,
        lastCompileResult: uiState.lastCompileResult ?? null,
        workspaceRoot: uiState.workspaceRoot ?? null,
        autoVerify: !!ctx.autoVerify,
        editorSelection: typeof ctx.editorSelection === 'string' && ctx.editorSelection.length > 0
          ? ctx.editorSelection.slice(0, 2000) : null,
        recentSerial: recentSerial || null
      };
      const effectiveMode = parsed.data.mode === 'ask' || parsed.data.mode === 'debug' ? parsed.data.mode : 'agent';
      // ponytail: shallow validate attachments here rather than extending the zod schema.
      // Cap at 4 images, 8 MB each — vision APIs choke past that anyway.
      const safeAttachments = Array.isArray(attachments)
        ? attachments
            .filter(a => a && typeof a.data === 'string' && typeof a.mimeType === 'string' && a.data.length < 8_000_000)
            .slice(0, 4)
        : [];
      const result = await aiAgent.processQuery(parsed.data.query, enrichedContext, effectiveMode, safeAttachments);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Process query failed' };
    }
    });
  }));

  ipcMain.handle('ai:analyze-error', withDebugLog('ai:analyze-error', async (event, errorMessage, context) => {
    const parsed = parseOrDefault(schemas.aiAnalyzeError, { errorMessage: errorMessage ?? '', context }, defaultFail);
    if (!parsed.ok) return parsed.defaultResult;
    return runExclusive(async () => {
    try {
      const result = await aiAgent.analyzeError(parsed.data.errorMessage, parsed.data.context);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Analyze failed' };
    }
    });
  }));

  ipcMain.handle('ai:analyze-serial', withDebugLog('ai:analyze-serial', async (event, serialOutput, lines) => {
    const parsed = parseOrDefault(schemas.aiAnalyzeSerial, { serialOutput: serialOutput ?? '', lines: lines ?? [] }, defaultFail);
    if (!parsed.ok) return parsed.defaultResult;
    return runExclusive(async () => {
    try {
      const result = await aiAgent.analyzeSerialOutput(parsed.data.serialOutput);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Analyze failed' };
    }
    });
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

  ipcMain.handle('ai:set-model', withDebugLog('ai:set-model', async (event, modelId, manual) => {
    const parsed = parseOrDefault(schemas.aiSetModel, { modelId: modelId ?? '', manual: manual ?? undefined }, defaultFail);
    if (!parsed.ok) return parsed.defaultResult;
    try {
      const providerName = AIAgent.getProviderFromModel(parsed.data.modelId);
      if (!providerName) return { success: false, error: 'Unknown model' };
      const key = apiKeyManager.getAPIKey(providerName);
      if (!key || key.trim().length === 0) {
        return { success: false, error: 'API key required', needsKey: true, provider: providerName };
      }
      aiAgent.setProvider(providerName, key, parsed.data.modelId);
      // A manual selection records the user's preferred provider so future
      // auto-upgrades stay within the family they actually chose.
      if (parsed.data.manual) {
        aiAgent.modelPrefs.setPreferredProvider(providerName).catch(() => {});
      }
      return { success: true, provider: providerName, model: parsed.data.modelId };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Set model failed' };
    }
  }));

  ipcMain.handle('ai:get-model-suggestion', withDebugLog('ai:get-model-suggestion', async () => {
    try {
      const providersWithKeys = apiKeyManager.getAllProviders();
      const suggestion = await aiAgent.getModelSuggestion(providersWithKeys);
      return { success: true, data: suggestion };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Get suggestion failed' };
    }
  }));

  ipcMain.handle('ai:pin-model', withDebugLog('ai:pin-model', async (event, modelId) => {
    const parsed = parseOrDefault(schemas.aiPinModel, { modelId: modelId ?? null }, defaultFail);
    if (!parsed.ok) return parsed.defaultResult;
    try {
      await aiAgent.modelPrefs.setPinned(parsed.data.modelId ?? null);
      return { success: true, pinned: parsed.data.modelId ?? null };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Pin model failed' };
    }
  }));

  ipcMain.handle('ai:set-auto-upgrade', withDebugLog('ai:set-auto-upgrade', async (event, enabled) => {
    const parsed = parseOrDefault(schemas.aiSetAutoUpgrade, { enabled: !!enabled }, defaultFail);
    if (!parsed.ok) return parsed.defaultResult;
    try {
      await aiAgent.modelPrefs.setAutoUpgrade(parsed.data.enabled);
      return { success: true, autoUpgrade: parsed.data.enabled };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Set auto-upgrade failed' };
    }
  }));

  ipcMain.handle('ai:cancel', withDebugLog('ai:cancel', async () => {
    try { aiAgent.cancel(); return { success: true }; }
    catch (error) { return { success: false, error: error?.message ?? 'Cancel failed' }; }
  }));

  ipcMain.on('ai:pending-edit-decide', (event, msg) => {
    if (!msg || typeof msg !== 'object') return;
    pendingEdits.decide(String(msg.id), !!msg.accepted);
  });

  ipcMain.handle('ai:record-feedback', withDebugLog('ai:record-feedback', async (event, entry) => {
    try {
      if (!entry || typeof entry !== 'object') return { success: false, error: 'Invalid entry' };
      const rating = entry.rating === 'up' || entry.rating === 'down' ? entry.rating : null;
      if (!rating) return { success: false, error: 'Rating must be up or down' };
      return recordFeedback({
        rating,
        prompt: String(entry.prompt || '').slice(0, 4000),
        response: String(entry.response || '').slice(0, 8000),
        model: entry.model || null,
        tools: Array.isArray(entry.tools) ? entry.tools.slice(0, 20) : [],
        board: entry.board || null
      });
    } catch (error) { return { success: false, error: error?.message ?? 'Feedback failed' }; }
  }));

  ipcMain.handle('ai:summarize-history', withDebugLog('ai:summarize-history', async () => {
    try {
      const summary = await aiAgent.summarizeAndCompact();
      return { success: true, summary };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Summarise failed' };
    }
  }));

  ipcMain.handle('ai:clear-history', withDebugLog('ai:clear-history', async () => {
    try {
      aiAgent.clearHistory();
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Clear failed' };
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
