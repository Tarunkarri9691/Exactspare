import fs from 'fs';
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

/**
 * Analyze an uploaded spare part image using Vision API (or autonomous fallback)
 */
export const analyzeImageForPart = async ({ filePath, mimeType, originalName }) => {
  const status = getAiProviderStatus();

  // If no AI key configured, use clean autonomous visual fallback
  if (!status.isConfigured) {
    const hint = originalName ? originalName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') : '';
    return {
      isAiPowered: false,
      providerMode: 'autonomous_fallback',
      probablePartName: hint || 'Automotive Component',
      suggestedCategory: 'Maintenance & Fluids',
      vehicleType: null,
      keywords: hint ? [hint] : ['brake', 'filter', 'spark plug', 'battery']
    };
  }

  try {
    const imageBuffer = fs.readFileSync(filePath);
    const base64Data = imageBuffer.toString('base64');

    if (status.provider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      const model = process.env.AI_MODEL || 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const prompt = `Identify this automotive spare part from the image.
Respond STRICTLY with valid JSON in this exact format:
{
  "probablePartName": "e.g. Front Disc Brake Pad",
  "suggestedCategory": "e.g. Brakes",
  "vehicleType": "Bike" or "Car" or "Scooter" or "Bicycle" or "Other" or null,
  "keywords": ["keyword1", "keyword2", "keyword3"]
}`;

      const payload = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType || 'image/jpeg',
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 300
        }
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Gemini vision HTTP error: ${response.status}`);
      }

      const resData = await response.json();
      const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';

      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          isAiPowered: true,
          providerMode: 'gemini_vision',
          probablePartName: parsed.probablePartName || 'Identified Auto Component',
          suggestedCategory: parsed.suggestedCategory || 'Other',
          vehicleType: parsed.vehicleType || null,
          keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [parsed.probablePartName]
        };
      }
    }
  } catch (err) {
    logger.warn('Image vision analysis failed or timed out:', err.message);
  }

  // Fallback if vision call failed
  const hint = originalName ? originalName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') : '';
  return {
    isAiPowered: false,
    providerMode: 'fallback_after_error',
    probablePartName: hint || 'Automotive Component',
    suggestedCategory: 'Other',
    vehicleType: null,
    keywords: hint ? [hint] : ['brake', 'filter', 'spark plug', 'battery']
  };
};

const capitalizeWords = (str) => {
  if (!str) return '';
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
};

/**
 * Extract comprehensive spare part catalog fields from an uploaded photograph
 * (Used by Shop Owner to auto-fill Part Name, SKU, Category, Brand, Specs, Pricing, etc.)
 */
export const extractPartDetailsFromImage = async ({ filePath, mimeType, originalName }) => {
  const status = getAiProviderStatus();

  // If Gemini Vision is configured, send the image securely to extract genuine suggestions
  if (status.isConfigured && status.provider === 'gemini') {
    try {
      const imageBuffer = fs.readFileSync(filePath);
      const base64Data = imageBuffer.toString('base64');
      const apiKey = process.env.GEMINI_API_KEY;
      const model = process.env.AI_MODEL || 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const prompt = `You are an expert automotive spare parts recognition assistant.
Analyze this spare part image or packaging label carefully.
Determine if an automotive spare part, component, or specification label is genuinely identifiable.

If the image is too blurry, unidentifiable, or not an automotive spare part, respond strictly with:
{"recognized": false, "message": "Could not identify confidently from this image. Please enter the details manually."}

If you can genuinely recognize the spare part or read its packaging/label, respond with valid JSON:
{
  "recognized": true,
  "partName": "Descriptive commercial part name (e.g. Front Disc Brake Pad Set)",
  "category": "Must be one of: Engine, Brakes, Transmission, Suspension, Electrical, Body & Panels, Steering, Exhaust, Lighting, Cooling, Fuel System, Maintenance & Fluids, Accessories, Other",
  "subcategory": "Suggested subcategory or empty string",
  "manufacturer": "Brand/manufacturer if clearly visible or OEM Standard",
  "partNumber": "Part number or SKU reference if visible on label, or empty string",
  "vehicleType": "Car or Bike or Scooter or Bicycle or Other",
  "compatibleMakes": "Known vehicle makes if identifiable, or empty string",
  "compatibleModels": "Known vehicle models if identifiable, or empty string",
  "compatibleYears": "Known model years if identifiable, or empty string",
  "condition": "NEW",
  "description": "Suggested technical description based on visible component features"
}

IMPORTANT CONSTRAINTS:
- Do NOT predict, calculate, or suggest any price or demand forecast. Price is strictly set manually by the store owner.
- Do NOT invent or fabricate an exact part number or vehicle compatibility if it is not genuinely identifiable from the image.
- Never claim the image alone proves exact compatibility or authenticity.`;

      const payload = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType || 'image/jpeg',
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 600
        }
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const resData = await response.json();
        const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.recognized === false) {
            return {
              recognized: false,
              isAiPowered: true,
              message: parsed.message || 'Could not identify confidently from this image. Please enter the details manually.'
            };
          }

          return {
            recognized: true,
            isAiPowered: true,
            providerMode: 'gemini_vision',
            partName: parsed.partName || '',
            category: parsed.category || 'Engine',
            subcategory: parsed.subcategory || '',
            manufacturer: parsed.manufacturer || '',
            partNumber: parsed.partNumber || '',
            vehicleType: parsed.vehicleType || 'Car',
            compatibleMakes: parsed.compatibleMakes || '',
            compatibleModels: parsed.compatibleModels || '',
            compatibleYears: parsed.compatibleYears || '',
            condition: parsed.condition || 'NEW',
            description: parsed.description || ''
          };
        }
      }
    } catch (err) {
      logger.warn('Gemini vision part recognition failed:', err.message);
    }
  }

  // Graceful fallback when AI is not configured or recognition is uncertain
  return {
    recognized: false,
    isAiPowered: false,
    isAiConfigured: status.isConfigured,
    message: status.isConfigured
      ? 'Could not identify confidently from this image. Please enter the information manually.'
      : 'AI image recognition is not configured on this server. Manual entry is fully supported below.'
  };
};

export default { getAiProviderStatus, processAssistantMessage, analyzeImageForPart, extractPartDetailsFromImage };

