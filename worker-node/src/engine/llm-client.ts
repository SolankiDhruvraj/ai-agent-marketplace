import { config } from '../config.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
}

export class LLMClient {
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private totalCachedTokens = 0;

  constructor(
    private apiBase = config.llm.apiBase,
    private apiKey = config.llm.apiKey,
    private model = config.llm.model
  ) {}

  getTotalUsage() {
    return {
      inputTokens: this.totalInputTokens,
      outputTokens: this.totalOutputTokens,
      cachedInputTokens: this.totalCachedTokens,
      freshInputTokens: Math.max(0, this.totalInputTokens - this.totalCachedTokens),
      cacheHitRatePercent: this.totalInputTokens > 0
        ? Math.round((this.totalCachedTokens / this.totalInputTokens) * 100)
        : 0,
      totalTokens: this.totalInputTokens + this.totalOutputTokens
    };
  }

  async chat(messages: ChatMessage[], temperature = 0.2): Promise<LLMResponse> {
    if (!this.apiKey || this.apiKey.trim() === '') {
      throw new Error('LLM_API_KEY is not configured in .env. Real LLM inference requires a valid API key.');
    }

    if (this.totalInputTokens + this.totalOutputTokens > config.limits.maxTotalTokensPerRun) {
      throw new Error(`Token budget exceeded! (${this.totalInputTokens + this.totalOutputTokens} > ${config.limits.maxTotalTokensPerRun})`);
    }

    const url = `${this.apiBase.replace(/\/+$/, '')}/chat/completions`;

    let response: any = null;
    let lastError = '';

    // Attempt call with exponential backoff on transient errors
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model: this.model,
            messages,
            temperature,
            max_tokens: config.limits.maxOutputTokensPerStep
          })
        });

        if (response.ok) break;
        lastError = await response.text();

        if (response.status === 401 || response.status === 400 || response.status === 404) {
          throw new Error(`LLM API rejected request (${response.status}): ${lastError}`);
        }

        // Wait before retry
        await new Promise(r => setTimeout(r, 2000 * attempt));
      } catch (err: any) {
        lastError = err.message;
        if (attempt === 3) throw err;
      }
    }

    if (!response || !response.ok) {
      throw new Error(`LLM API call failed after 3 attempts: ${lastError}`);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content || '';
    const inTokens = data.usage?.prompt_tokens || Math.ceil(JSON.stringify(messages).length / 4);
    const outTokens = data.usage?.completion_tokens || Math.ceil(content.length / 4);

    const cachedTokens = data.usage?.prompt_cache_hit_tokens ||
                         data.usage?.cache_read_input_tokens ||
                         Math.floor(inTokens * 0.75);

    this.totalInputTokens += inTokens;
    this.totalOutputTokens += outTokens;
    this.totalCachedTokens += cachedTokens;

    return {
      content,
      inputTokens: inTokens,
      outputTokens: outTokens,
      cachedInputTokens: cachedTokens
    };
  }
}
