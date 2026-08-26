// Local rule-based fallback emergency classifier
export const fallbackClassifySOS = (description = '') => {
  const desc = description.toLowerCase().trim();
  let category = 'other';
  let severity = 'medium';
  let priority = 'P2';
  const reason = 'Fallback classifier applied due to missing or failed Gemini API.';

  // Check critical words first
  if (
    desc.includes('unconscious') ||
    desc.includes('dying') ||
    desc.includes('cannot breathe') ||
    desc.includes('no pulse') ||
    desc.includes('heart attack') ||
    desc.includes('cardiac arrest') ||
    desc.includes('severe bleeding') ||
    desc.includes('major crash') ||
    desc.includes('trapped in fire') ||
    desc.includes('suicide')
  ) {
    severity = 'critical';
    priority = 'P0';
  } else if (
    desc.includes('chest pain') ||
    desc.includes('bleeding') ||
    desc.includes('broken bone') ||
    desc.includes('fracture') ||
    desc.includes('accident') ||
    desc.includes('fire') ||
    desc.includes('weapon') ||
    desc.includes('gun') ||
    desc.includes('attack') ||
    desc.includes('drowning')
  ) {
    severity = 'high';
    priority = 'P1';
  } else if (
    desc.includes('fever') ||
    desc.includes('sick') ||
    desc.includes('pain') ||
    desc.includes('theft') ||
    desc.includes('robbery') ||
    desc.includes('lost') ||
    desc.includes('minor')
  ) {
    severity = 'medium';
    priority = 'P2';
  } else if (desc.length > 0) {
    severity = 'low';
    priority = 'P3';
  }

  // Categories
  if (
    desc.includes('chest') ||
    desc.includes('heart') ||
    desc.includes('stroke') ||
    desc.includes('breathing') ||
    desc.includes('unconscious') ||
    desc.includes('bleeding') ||
    desc.includes('fracture') ||
    desc.includes('medical') ||
    desc.includes('hospital') ||
    desc.includes('doctor') ||
    desc.includes('choking')
  ) {
    category = 'medical';
  } else if (
    desc.includes('accident') ||
    desc.includes('crash') ||
    desc.includes('car') ||
    desc.includes('collision') ||
    desc.includes('road')
  ) {
    category = 'accident';
  } else if (
    desc.includes('fire') ||
    desc.includes('smoke') ||
    desc.includes('burn') ||
    desc.includes('flame') ||
    desc.includes('explode') ||
    desc.includes('explosion')
  ) {
    category = 'fire';
  } else if (
    desc.includes('robbery') ||
    desc.includes('theft') ||
    desc.includes('thief') ||
    desc.includes('fight') ||
    desc.includes('attack') ||
    desc.includes('weapon') ||
    desc.includes('gun') ||
    desc.includes('police') ||
    desc.includes('crime')
  ) {
    category = 'police';
  } else if (
    desc.includes('flood') ||
    desc.includes('water') ||
    desc.includes('drown') ||
    desc.includes('heavy rain') ||
    desc.includes('tsunami')
  ) {
    category = 'flood';
  } else if (
    desc.includes('earthquake') ||
    desc.includes('quake') ||
    desc.includes('tremor') ||
    desc.includes('shake')
  ) {
    category = 'earthquake';
  } else if (
    desc.includes('landslide') ||
    desc.includes('avalanche') ||
    desc.includes('cyclone') ||
    desc.includes('hurricane') ||
    desc.includes('tornado') ||
    desc.includes('disaster')
  ) {
    category = 'disaster';
  }

  return {
    category,
    severity,
    priority,
    reason,
    confidence: 0.5
  };
};

/**
 * Classify SOS emergency description using Gemini REST API
 */
export const classifySOS = async (description = '', metadata = {}) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'undefined') {
    console.warn('[AI Service] GEMINI_API_KEY is not configured. Applying fallback classifier.');
    return fallbackClassifySOS(description);
  }

  const prompt = `You are the AI triage system for the SaveLife emergency dispatch platform.
Analyze the following emergency distress description and metadata, and classify it.
You MUST return a JSON object with EXACTLY the following structure:
{
  "category": "medical" | "accident" | "fire" | "police" | "flood" | "earthquake" | "disaster" | "other",
  "severity": "critical" | "high" | "medium" | "low",
  "priority": "P0" | "P1" | "P2" | "P3",
  "reason": "brief explanation of why this classification was made",
  "confidence": 0.0 to 1.0 (float)
}

Guidelines for priority/severity:
- P0 / critical: Immediate threat to life (e.g. cardiac arrest, massive bleed, trapped in fire, drowning, active shooter).
- P1 / high: High urgency but not immediate death (e.g. broken bone, major car accident with no active bleeding, active home break-in).
- P2 / medium: Moderate urgency (e.g. minor fever, theft, property damage, low-risk storm updates).
- P3 / low: Informational/low urgency.

Distress Description: "${description}"
Metadata: ${JSON.stringify(metadata)}

Return ONLY the raw JSON object. Do not include markdown \`\`\`json wrappers or backticks.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        }),
        signal: AbortSignal.timeout(8000)
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const jsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!jsonText) throw new Error('Empty response from Gemini');

    const result = JSON.parse(jsonText.trim());

    // Validate fields and enums
    const categories = ['medical', 'accident', 'fire', 'police', 'flood', 'earthquake', 'disaster', 'other'];
    const severities = ['critical', 'high', 'medium', 'low'];
    const priorities = ['P0', 'P1', 'P2', 'P3'];

    if (!categories.includes(result.category)) result.category = 'other';
    if (!severities.includes(result.severity)) result.severity = 'medium';
    if (!priorities.includes(result.priority)) result.priority = 'P2';
    if (typeof result.confidence !== 'number') result.confidence = 0.8;
    if (!result.reason) result.reason = 'AI classified emergency request successfully.';

    return {
      category: result.category,
      severity: result.severity,
      priority: result.priority,
      reason: result.reason,
      confidence: result.confidence
    };
  } catch (error) {
    console.error('[AI Service] Gemini SOS classification failed, falling back:', error.message);
    return fallbackClassifySOS(description);
  }
};

/**
 * Chatbot answering utilizing Gemini REST API
 */
export const queryChatbot = async (message = '', chatHistory = []) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'undefined') {
    return null; // Fallback to FAQ keyword matching on controller
  }

  // Format history
  const historyFormatted = chatHistory
    .slice(-6)
    .map(msg => `${msg.sender === 'user' ? 'User' : 'Assistant'}: ${msg.text}`)
    .join('\n');

  const prompt = `You are RapidBot, the emergency platform AI assistant for SaveLife (SDEC).
You help citizens with first aid guidelines, general safety information, and platform FAQ answers.

IMPORTANT RULES:
1. You are NOT a doctor, police officer, or firefighter. NEVER prescribe medicines or diagnose.
2. If the user's message indicates an active medical emergency, severe injury, fire, assault, or life threat, advise them immediately to press the red SOS button or call local emergency numbers (e.g. 100 or 108).
3. Be supportive, concise, and clear.
4. Keep your responses short (under 4 sentences if possible).

Platform FAQ answers:
- How to trigger SOS: Click the red floating 'SOS' button at the bottom-right of the dashboard. Standard SOS alerts responders (hospitals, police, rescue) and repeats every 5 minutes. Silent SOS dispatches quietly to the closest team and auto-escalates to next-nearest if not accepted in 2 minutes.
- Emergency Contacts: You can add up to 5 contacts in your dashboard. They receive SMS alerts with your live location.
- GPS privacy: Location is only tracked during an active SOS case. It stops once resolved.
- ID Verification: Upload government ID (e.g. Aadhaar). Admin reviews it to prevent platform abuse.

Conversation history:
${historyFormatted}

User message: ${message}

Response:`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        }),
        signal: AbortSignal.timeout(8000)
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? text.trim() : null;
  } catch (error) {
    console.error('[AI Service] Gemini chatbot failed:', error.message);
    return null; // Fallback to FAQ keyword matching on controller
  }
};
