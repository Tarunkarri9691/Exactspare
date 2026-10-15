import { logger } from '../utils/logger.js';
import { extractSearchIntent, generateFallbackResponse } from './nlpSearchFallback.js';

const AI_TIMEOUT_MS = 8000; // 8-second strict timeout

/**
 * Determine configured AI provider
 */
export const getAiProviderStatus = () => {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;

  if (geminiKey && geminiKey.trim()) {
    return {
      isConfigured: true,
      provider: 'gemini',
      model: process.env.AI_MODEL || 'gemini-1.5-flash'
    };
  }

  if (openAiKey && openAiKey.trim()) {
    return {
      isConfigured: true,
      provider: 'openai',
      model: process.env.AI_MODEL || 'gpt-4o-mini'
    };
  }

  return {
    isConfigured: false,
    provider: 'none',
    model: 'rule_based_fallback',
    fallbackMode: 'rule_based_nlp'
  };
};

/**
 * Calls Google Gemini REST API
 */
const callGeminiApi = async ({ apiKey, model, prompt, systemInstruction }) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 600
    }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Gemini API error (HTTP ${response.status}): ${errBody.substring(0, 150)}`);
    }

    const data = await response.json();
    const candidateText =
      data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return candidateText.trim();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
};

/**
 * Calls OpenAI Chat Completions API
 */
const callOpenAiApi = async ({ apiKey, model, prompt, systemInstruction }) => {
  const url = 'https://api.openai.com/v1/chat/completions';

  const payload = {
    model,
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 600
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`OpenAI API error (HTTP ${response.status}): ${errBody.substring(0, 150)}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
};

/**
 * Main AI Assistant processor
 * Integrates external AI provider with local catalog search tool & rule-based fallback
 */
export const processAssistantMessage = async ({ message, history = [], matchedProducts = [] }) => {
  const status = getAiProviderStatus();
  const intent = extractSearchIntent(message);

  // If no AI provider is configured, return the verified rule-based response
  if (!status.isConfigured) {
    const fallback = generateFallbackResponse({ message, intent, products: matchedProducts });
    return {
      ...fallback,
      intent
    };
  }

  // Format real verified products for AI context injection
  const verifiedProductsSummary = matchedProducts.map((p, idx) => {
    return `${idx + 1}. ${p.partName} by ${p.manufacturer} (Price: ₹${p.price}, Stock: ${p.stockQuantity}, Shop: ${p.shopName} in ${p.shopCity}, Rating: ${p.averageRating}★)`;
  }).join('\n');

  const systemInstruction = `You are the EXACTSPARE Vehicle Spare Parts AI Assistant.
Your mission is to help Indian vehicle owners identify the right spare parts, understand compatibility, and navigate maintenance choices.

CRITICAL INVENTED INVENTORY RULES:
1. You MUST NEVER fabricate or invent product names, part numbers, prices, or store stock.
2. The real verified products from the EXACTSPARE database are provided in the prompt. Refer strictly to these products.
3. If no matching products were found, explain politely and ask the user for their exact vehicle make, model, and manufacturing year.
4. Keep answers concise, helpful, and professional in British/Indian English. Currency is INR (₹).
5. Always highlight fitment assurance: encourage users to verify OEM part numbers for critical components.`;

  const prompt = `User query: "${message}"

Extracted Intent:
- Vehicle Type: ${intent.vehicleType || 'Not specified'}
- Make: ${intent.make || 'Not specified'}
- Model: ${intent.model || 'Not specified'}
- Year: ${intent.year || 'Not specified'}
- Budget: ${intent.maxPrice ? `₹${intent.maxPrice}` : 'None'}

Verified Database Results (${matchedProducts.length} items found):
${verifiedProductsSummary || 'None currently found in database for these specific filters.'}

Please provide a helpful, natural advice response to the user query based on the above verified products. If vehicle details are missing, suggest what details would help confirm compatibility.`;

  try {
    let aiText = '';

    if (status.provider === 'gemini') {
      aiText = await callGeminiApi({
        apiKey: process.env.GEMINI_API_KEY,
        model: status.model,
        prompt,
        systemInstruction
      });
    } else if (status.provider === 'openai') {
      aiText = await callOpenAiApi({
        apiKey: process.env.OPENAI_API_KEY,
        model: status.model,
        prompt,
        systemInstruction
      });
    }

    const followUps = [];
    if (matchedProducts.length > 1) {
      followUps.push('Compare these parts');
    }
    if (intent.model) {
      followUps.push(`Show related maintenance parts for ${intent.model}`);
    } else {
      followUps.push('Check vehicle compatibility');
    }

    return {
      isAiPowered: true,
      providerMode: status.provider,
      response: aiText,
      followUps,
      missingDetails: intent.missingDetails,
      intent
    };
  } catch (err) {
    logger.warn(`AI Provider (${status.provider}) failed or timed out: ${err.message}. Falling back to rule-based engine.`);
    const fallback = generateFallbackResponse({ message, intent, products: matchedProducts });
    return {
      ...fallback,
      intent,
      providerNote: 'Switched to rule-based assistance due to temporary provider unavailability.'
    };
  }
};

export default { getAiProviderStatus, processAssistantMessage };
