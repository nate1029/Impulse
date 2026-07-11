/**
 * Completion-gate critic loop.
 *
 * The failure we're fixing: the agent used to yield the instant it emitted a
 * text-only turn ("here's the code") — no check that the goal was met. These
 * tests prove the critic now sends a premature yield back to work, is bounded,
 * and fails open so it can never trap the user.
 */
jest.mock('../prompts/systemPrompt', () => ({
  getSystemPrompt: jest.fn(() => 'You are a helpful assistant.')
}));
jest.mock('../knowledge', () => ({ buildContextBlock: () => '' }));

const AIAgent = require('../agent');

/**
 * A provider that plays a fixed script. Critic calls are distinguished from
 * main calls by the reviewer system prompt, so one class serves both roles.
 */
class ScriptedProvider {
  constructor(mainScript, criticScript) {
    this.mainScript = mainScript;   // array of responses for the agent loop
    this.criticScript = criticScript; // array of JSON strings for the reviewer
    this.mainCalls = 0;
    this.criticCalls = 0;
  }
  validateApiKey() { return true; }
  getAvailableModels() { return ['scripted']; }
  async chat(messages, _options) {
    const sys = (messages[0] && messages[0].content) || '';
    if (sys.includes('completion reviewer')) {
      const verdict = this.criticScript[this.criticCalls] ?? '{"complete":true}';
      this.criticCalls++;
      return { content: verdict, toolCalls: [], usage: {}, model: 'scripted' };
    }
    if (sys.includes('ran out of steps')) {
      // the incomplete-summariser call — not part of the agent loop count
      return { content: 'Here is what I did and what remains. Reply continue.', toolCalls: [], usage: {}, model: 'scripted' };
    }
    const resp = this.mainScript[Math.min(this.mainCalls, this.mainScript.length - 1)];
    this.mainCalls++;
    return { content: resp.content, toolCalls: resp.toolCalls || [], usage: {}, model: 'scripted' };
  }
}

function agentWith(mainScript, criticScript, config = {}) {
  const agent = new AIAgent({}, {}, {}, config);
  const provider = new ScriptedProvider(mainScript, criticScript);
  agent.registerProvider('scripted', () => provider);
  // registerProvider stores a class; we need the instance — set it directly.
  agent.currentProvider = provider;
  return { agent, provider };
}

const SHALLOW = { content: 'Here is the code.', toolCalls: [] };
const TOOL_TURN = { content: null, toolCalls: [{ id: 't1', name: 'get_available_baud_rates', arguments: {} }] };
const FINAL = { content: 'Done — it compiles.', toolCalls: [] };

describe('critic loop', () => {
  test('sends a premature yield back to work, then finishes', async () => {
    // main: shallow yield → (sent back) → tool turn → final yield
    // critic: first review says incomplete, second says complete
    const { agent, provider } = agentWith(
      [SHALLOW, TOOL_TURN, FINAL],
      ['{"complete":false,"missing":"compile the sketch"}', '{"complete":true}'],
      { maxReviews: 2 }
    );
    const result = await agent.processQuery('build me a blinker', { hasFileOpen: true }, 'agent');
    expect(result.response).toBe('Done — it compiles.');
    expect(provider.mainCalls).toBe(3);   // it did NOT stop at the first shallow turn
    expect(provider.criticCalls).toBe(2);
  });

  test('maxReviews:0 disables the critic — first yield stands', async () => {
    const { agent, provider } = agentWith(
      [SHALLOW, FINAL],
      ['{"complete":false,"missing":"do more"}'],
      { maxReviews: 0 }
    );
    const result = await agent.processQuery('build me a blinker', { hasFileOpen: true }, 'agent');
    expect(result.response).toBe('Here is the code.');
    expect(provider.mainCalls).toBe(1);
    expect(provider.criticCalls).toBe(0);
  });

  test('critic is bounded — never loops more than maxReviews times', async () => {
    // critic always says incomplete; agent always yields shallow.
    const { agent, provider } = agentWith(
      [SHALLOW],
      ['{"complete":false,"missing":"x"}', '{"complete":false,"missing":"x"}', '{"complete":false,"missing":"x"}'],
      { maxReviews: 2 }
    );
    const result = await agent.processQuery('build', { hasFileOpen: true }, 'agent');
    expect(result.response).toBe('Here is the code.');
    expect(provider.criticCalls).toBe(2);       // stopped after the cap
    expect(provider.mainCalls).toBe(3);         // initial + 2 sent-backs
  });

  test('fail-open: malformed critic output is treated as complete', async () => {
    const { agent, provider } = agentWith(
      [SHALLOW, FINAL],
      ['not json at all'],
      { maxReviews: 2 }
    );
    const result = await agent.processQuery('build', { hasFileOpen: true }, 'agent');
    expect(result.response).toBe('Here is the code.');
    expect(provider.mainCalls).toBe(1);
  });

  test('ask mode never invokes the critic', async () => {
    const { agent, provider } = agentWith([SHALLOW], ['{"complete":false,"missing":"x"}'], { maxReviews: 2 });
    await agent.processQuery('what is I2C?', {}, 'ask');
    expect(provider.criticCalls).toBe(0);
  });
});

describe('stuck detection + graceful incomplete exit', () => {
  // edit_code with no UI callbacks fails identically every time → a spin.
  const FAILING_TOOL = { content: null, toolCalls: [{ id: 'e', name: 'edit_code', arguments: { operation: 'replace', startLine: 1, newCode: 'x' } }] };

  test('bails out early when the same failure repeats, with a real summary', async () => {
    const { agent, provider } = agentWith(
      [FAILING_TOOL],                 // always tries the same failing edit
      ['{"complete":false,"missing":"keep going"}'],
      { maxReviews: 0, maxIterations: 25 }
    );
    const result = await agent.processQuery('fix it', { hasFileOpen: true }, 'agent');
    expect(result.warning).toBe('stuck');
    expect(result.incomplete).toBe(true);
    // stopped at the repeat limit (3), NOT after all 25 iterations
    expect(provider.mainCalls).toBeLessThanOrEqual(4);
    expect(result.response).toMatch(/continue/i); // actionable, not a dead-end
  });

  test('max-iterations exit returns a summary and preserves history for continue', async () => {
    // never yields, never fails — just keeps making a (successful) tool call
    const BUSY = { content: null, toolCalls: [{ id: 'b', name: 'get_available_baud_rates', arguments: {} }] };
    const { agent, provider } = agentWith([BUSY], ['{"complete":true}'], { maxReviews: 0, maxIterations: 3 });
    const result = await agent.processQuery('do a huge build', { hasFileOpen: true }, 'agent');
    expect(result.warning).toBe('max_iterations_reached');
    expect(result.incomplete).toBe(true);
    expect(result.response).toMatch(/continue/i);
    expect(provider.mainCalls).toBe(3); // respected the budget
    // last history entry is the summary, so a follow-up "continue" has context
    const last = agent.conversationHistory[agent.conversationHistory.length - 1];
    expect(last.role).toBe('assistant');
  });
});
