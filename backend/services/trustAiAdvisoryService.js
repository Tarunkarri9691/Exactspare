import { getAiProviderStatus } from './aiProvider.js';
import { logger } from '../utils/logger.js';

const AI_TIMEOUT_MS = 9000;

/**
 * Generate an advisory summary for administrative review
 * Can leverage real configured AI provider (Gemini / OpenAI) or fall back to verified rule-based synthesis.
 * 
 * @param {Object} params
 * @param {Object} params.targetData - Verified product or shop database fields
 * @param {String} params.targetType - 'PRODUCT' | 'SHOP'
 * @param {Array} params.signals - Array of explainable signals triggered by rules
 * @param {Array} params.reports - Array of customer complaints
 * @returns {Promise<Object>} Advisory synthesis { summary, inconsistencies, suggestedActions, provider, isAiGenerated }
 */
export const generateTrustAdvisory = async ({ targetData, targetType, signals = [], reports = [] }) => {
  const providerStatus = getAiProviderStatus();

  // If external AI is not configured, generate clear explainable rule-based advisory summary
  if (!providerStatus.isConfigured) {
    return generateRuleBasedAdvisory({ targetData, targetType, signals, reports });
  }

  // AI is configured: Build clean prompt containing ONLY verified database fields
  const signalDescriptions = signals.map((s) => `• [${s.severity}] ${s.name}: ${s.reason}`).join('\n');
  const reportDescriptions = reports.map((r) => `• Customer reported (${r.category}): "${r.description}"`).join('\n');

  const systemInstruction = `You are the EXACTSPARE Trust & Safety Assistant.
Your role is to assist human platform administrators by objectively summarizing listing inconsistencies and customer reports.
CRITICAL RULES:
1. All AI output is strictly advisory. Administrative decisions require human review.
2. Never declare definitive guilt, criminal intent, or fraud. Use neutral, factual terminology.
3. You do NOT have the authority to ban accounts, cancel orders, or delist items.
4. Output MUST be valid JSON with the exact structure:
{
  "summary": "Brief 2-3 sentence overview of why this case was flagged and what the signals suggest",
  "inconsistencies": ["Specific inconsistency or observation 1", "Specific observation 2"],
  "suggestedActions": ["Action recommendation for human admin 1", "Action recommendation 2"]
}`;

  const prompt = `Review the following ${targetType} trust review case:
Target Info:
${JSON.stringify(targetData, null, 2)}

Rule Engine Signals:
${signalDescriptions || 'No rule-based anomalies triggered.'}

Customer Reports:
${reportDescriptions || 'No customer reports filed.'}

Synthesize this data into an objective administrative briefing JSON.`;

  try {
    let rawText = '';
    if (providerStatus.provider === 'gemini') {
      rawText = await callGeminiForTrust({
        apiKey: process.env.GEMINI_API_KEY,
        model: providerStatus.model,
        prompt,
        systemInstruction
      });
    } else if (providerStatus.provider === 'openai') {
      rawText = await callOpenAiForTrust({
        apiKey: process.env.OPENAI_API_KEY,
        model: providerStatus.model,
        prompt,
        systemInstruction
      });
    }

    // Parse JSON from LLM response (handling possible markdown ```json formatting)
    const cleanedJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedJson);

    return {
      summary: parsed.summary || 'AI advisory summary generated for human administrator review.',
      inconsistencies: Array.isArray(parsed.inconsistencies) ? parsed.inconsistencies : [],
      suggestedActions: Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : ['Inspect target record', 'Request seller verification'],
      provider: providerStatus.provider,
      isAiGenerated: true,
      generatedAt: new Date()
    };
  } catch (err) {
    logger.warn(`External AI advisory generation failed (${err.message}). Falling back to rule-based advisory.`);
    return generateRuleBasedAdvisory({ targetData, targetType, signals, reports });
  }
};

/**
 * Deterministic, rule-based fallback advisory generator (zero hallucinations)
 */
export const generateRuleBasedAdvisory = ({ targetData, targetType, signals = [], reports = [] }) => {
  const inconsistencies = [];
  const suggestedActions = [];

  // Synthesize rule signals
  for (const signal of signals) {
    inconsistencies.push(`${signal.name}: ${signal.reason}`);
    if (signal.ruleId === 'PRICE_OUTLIER_HIGH' || signal.ruleId === 'PRICE_OUTLIER_LOW') {
      suggestedActions.push('Request seller pricing verification or proof of invoice/purchase price.');
    }
    if (signal.ruleId === 'INVALID_OR_PLACEHOLDER_SKU') {
      suggestedActions.push('Request updated OEM or genuine manufacturer part number.');
    }
    if (signal.ruleId === 'DUPLICATE_LISTING') {
      suggestedActions.push('Request merchant merge duplicate catalog records.');
    }
    if (signal.ruleId === 'HIGH_CANCELLATION_RATE') {
      suggestedActions.push('Initiate merchant inventory audit to ensure real in-store stock availability.');
    }
  }

  // Synthesize customer reports
  if (reports.length > 0) {
    inconsistencies.push(`Platform received ${reports.length} report(s) from customers covering: ${Array.from(new Set(reports.map(r => r.category))).join(', ')}.`);
    suggestedActions.push('Review buyer statements and cross-reference with order history if applicable.');
  }

  // Default suggested actions if none specific
  if (suggestedActions.length === 0) {
    suggestedActions.push('Perform manual inspection of merchant records.');
    suggestedActions.push('Dismiss case if observed discrepancy is benign.');
  }

  const summary = `${targetType === 'PRODUCT' ? 'Listing' : 'Shop'} flagged by ${signals.length} automated rule signal(s) and ${reports.length} customer report(s). Human administrative evaluation is advised to determine whether seller correction or catalog adjustment is warranted.`;

  return {
    summary,
    inconsistencies: Array.from(new Set(inconsistencies)),
    suggestedActions: Array.from(new Set(suggestedActions)),
    provider: 'rule_based_engine',
    isAiGenerated: false,
    generatedAt: new Date()
  };
};

/**
 * Helper to call Gemini REST API for Trust summary
 */
const callGeminiForTrust = async ({ apiKey, model, prompt, systemInstruction }) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { temperature: 0.2, maxOutputTokens: 600 }
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
};

/**
 * Helper to call OpenAI REST API for Trust summary
 */
const callOpenAiForTrust = async ({ apiKey, model, prompt, systemInstruction }) => {
  const url = 'https://api.openai.com/v1/chat/completions';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 600
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '{}';
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
};
