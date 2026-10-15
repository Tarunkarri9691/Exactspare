/**
 * EXACTSPARE Rule-Based Intelligent NLP Fallback Parser
 * Operates when no external AI provider API key is configured.
 * Accurately extracts vehicle entity attributes and generates natural, helpful responses.
 */

const KNOWN_VEHICLE_TYPES = [
  { match: /\b(bike|motorcycle|two[- ]wheeler)\b/i, value: 'Bike' },
  { match: /\b(scooter|scooty|moped)\b/i, value: 'Scooter' },
  { match: /\b(car|sedan|suv|hatchback|four[- ]wheeler)\b/i, value: 'Car' },
  { match: /\b(bicycle|cycle)\b/i, value: 'Bicycle' }
];

const KNOWN_MAKES = [
  'Honda',
  'Hyundai',
  'Maruti',
  'Suzuki',
  'Maruti Suzuki',
  'Tata',
  'Mahindra',
  'Toyota',
  'Yamaha',
  'Bajaj',
  'Royal Enfield',
  'Hero',
  'TVS',
  'KTM',
  'Ford',
  'Volkswagen',
  'Renault',
  'Nissan',
  'Kia',
  'MG'
];

const KNOWN_MODELS = [
  { name: 'Activa', make: 'Honda', type: 'Scooter' },
  { name: 'Jupiter', make: 'TVS', type: 'Scooter' },
  { name: 'Access', make: 'Suzuki', type: 'Scooter' },
  { name: 'Dio', make: 'Honda', type: 'Scooter' },
  { name: 'Swift', make: 'Maruti', type: 'Car' },
  { name: 'i20', make: 'Hyundai', type: 'Car' },
  { name: 'i10', make: 'Hyundai', type: 'Car' },
  { name: 'Creta', make: 'Hyundai', type: 'Car' },
  { name: 'Baleno', make: 'Maruti', type: 'Car' },
  { name: 'City', make: 'Honda', type: 'Car' },
  { name: 'Innova', make: 'Toyota', type: 'Car' },
  { name: 'Pulsar', make: 'Bajaj', type: 'Bike' },
  { name: 'Splendor', make: 'Hero', type: 'Bike' },
  { name: 'Classic 350', make: 'Royal Enfield', type: 'Bike' },
  { name: 'Bullet', make: 'Royal Enfield', type: 'Bike' },
  { name: 'Apache', make: 'TVS', type: 'Bike' },
  { name: 'Duke', make: 'KTM', type: 'Bike' },
  { name: 'FZ', make: 'Yamaha', type: 'Bike' },
  { name: 'Shine', make: 'Honda', type: 'Bike' },
  { name: 'Scorpio', make: 'Mahindra', type: 'Car' },
  { name: 'Thar', make: 'Mahindra', type: 'Car' }
];

const KNOWN_CATEGORIES = [
  { keywords: /\b(brake|pads|rotor|disc|caliper)\b/i, category: 'Brakes' },
  { keywords: /\b(engine|piston|spark plug|gasket|valve)\b/i, category: 'Engine' },
  { keywords: /\b(battery|alternator|starter|headlight|tail light|bulb|fuse|horn)\b/i, category: 'Electrical' },
  { keywords: /\b(suspension|shock absorber|strut|fork)\b/i, category: 'Suspension' },
  { keywords: /\b(filter|air filter|oil filter|fuel filter)\b/i, category: 'Filters' },
  { keywords: /\b(transmission|clutch|gear|chain|sprocket)\b/i, category: 'Transmission' },
  { keywords: /\b(cooling|radiator|coolant|fan)\b/i, category: 'Cooling' },
  { keywords: /\b(exhaust|silencer|muffler)\b/i, category: 'Exhaust' },
  { keywords: /\b(tyre|tire|wheel|rim|tube)\b/i, category: 'Tires & Wheels' },
  { keywords: /\b(wiper|blade|mirror|body|bumper|fender)\b/i, category: 'Body' }
];

/**
 * Extracts structured attributes from a user message
 */
export const extractSearchIntent = (message) => {
  if (!message || typeof message !== 'string') {
    return {
      query: '',
      vehicleType: '',
      make: '',
      model: '',
      year: '',
      category: '',
      maxPrice: null,
      missingDetails: ['vehicleType', 'make', 'model']
    };
  }

  const text = message.trim();
  let vehicleType = '';
  let make = '';
  let model = '';
  let year = '';
  let category = '';
  let maxPrice = null;
  const missingDetails = [];

  // 1. Detect Vehicle Type
  for (const vt of KNOWN_VEHICLE_TYPES) {
    if (vt.match.test(text)) {
      vehicleType = vt.value;
      break;
    }
  }

  // 2. Detect Specific Model
  for (const km of KNOWN_MODELS) {
    const modelRegex = new RegExp(`\\b${km.name}\\b`, 'i');
    if (modelRegex.test(text)) {
      model = km.name;
      if (!make) make = km.make;
      if (!vehicleType) vehicleType = km.type;
      break;
    }
  }

  // 3. Detect Make
  if (!make) {
    for (const m of KNOWN_MAKES) {
      const makeRegex = new RegExp(`\\b${m}\\b`, 'i');
      if (makeRegex.test(text)) {
        make = m;
        break;
      }
    }
  }

  // 4. Detect Year (e.g. 1995-2026)
  const yearMatch = text.match(/\b(19\d{2}|20[0-2]\d)\b/);
  if (yearMatch) {
    year = yearMatch[1];
  }

  // 5. Detect Budget / Price constraints (e.g., "under 2000", "below 1500", "under ₹5000", "max 3000")
  const budgetMatch = text.match(/(?:under|below|less than|max(?:imum)?|within|budget of)\s*(?:₹|rs\.?|inr)?\s*(\d{2,6})/i);
  if (budgetMatch) {
    maxPrice = parseInt(budgetMatch[1], 10);
  }

  // 6. Detect Category
  for (const kc of KNOWN_CATEGORIES) {
    if (kc.keywords.test(text)) {
      category = kc.category;
      break;
    }
  }

  // 7. Determine clean part search keywords
  let partKeywords = text
    .replace(/(?:find|search|need|looking for|where can i get|show me|buy|cheap|affordable|best|which|for my|my|please|in|near me|under\s*\d+|below\s*\d+)/gi, '')
    .trim();

  // If user mentioned model or make, remove it from generic part search query to avoid over-filtering
  if (model) {
    partKeywords = partKeywords.replace(new RegExp(`\\b${model}\\b`, 'gi'), '').trim();
  }
  if (make) {
    partKeywords = partKeywords.replace(new RegExp(`\\b${make}\\b`, 'gi'), '').trim();
  }
  if (year) {
    partKeywords = partKeywords.replace(new RegExp(`\\b${year}\\b`, 'gi'), '').trim();
  }

  // Check missing vital parameters
  if (!vehicleType && !model) {
    missingDetails.push('vehicleType');
  }
  if (!make && !model) {
    missingDetails.push('make');
  }
  if (!model) {
    missingDetails.push('model');
  }

  return {
    query: partKeywords || category || text,
    vehicleType,
    make,
    model,
    year,
    category,
    maxPrice,
    missingDetails
  };
};

/**
 * Generates an intelligent, natural conversational response for the fallback mode
 */
export const generateFallbackResponse = ({ message, intent, products = [] }) => {
  const { vehicleType, make, model, maxPrice, missingDetails } = intent;
  let text = '';
  const followUps = [];

  const vehicleDescriptor = [make, model].filter(Boolean).join(' ') || vehicleType || 'vehicle';

  if (products.length > 0) {
    text = `I found **${products.length} verified spare part${products.length > 1 ? 's' : ''}** for your ${vehicleDescriptor}`;
    if (maxPrice) {
      text += ` within your budget of ₹${maxPrice.toLocaleString('en-IN')}`;
    }
    text += `. All parts listed below are in stock at verified, active partner shops.`;

    if (missingDetails.includes('model') && !model) {
      text += `\n\n💡 *Tip: For exact fitment assurance, please confirm your vehicle model and year.*`;
    }

    followUps.push('Compare these options');
    followUps.push(`Show alternative brands for ${vehicleDescriptor}`);
    followUps.push('Check nearby shop locations');
  } else {
    // Zero products found
    if (!make && !model && !vehicleType) {
      text = `To help you find the exact spare part, could you tell me your vehicle type (Car, Bike, or Scooter) along with the make and model? (e.g., *"Brake pads for Honda Activa"* or *"Air filter for Swift 2021"*).`;
      followUps.push('Brake pads for Honda Activa');
      followUps.push('Air filter for Maruti Swift');
      followUps.push('Battery for Royal Enfield Classic 350');
    } else {
      text = `I searched our verified dealer catalog but could not find matching parts for **${vehicleDescriptor}** matching "${intent.query}"`;
      if (maxPrice) {
        text += ` under ₹${maxPrice.toLocaleString('en-IN')}`;
      }
      text += `. You may want to broaden your search criteria or check our general inventory catalog.`;

      followUps.push(`Browse all parts for ${vehicleDescriptor}`);
      followUps.push('Search without price filter');
      followUps.push('Ask for assistance with another part');
    }
  }

  return {
    isAiPowered: false,
    providerMode: 'rule_based_fallback',
    response: text,
    followUps,
    missingDetails
  };
};

export default { extractSearchIntent, generateFallbackResponse };
