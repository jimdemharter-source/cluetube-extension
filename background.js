// ClueTube Background Service Worker
// v3.2.0 - Optimized (No Comments, No Region)

const PYTHON_SERVER_URL = "https://cluetube-extension.vercel.app";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// ... (Rest of existing background logic)

async function fetchTranscriptFromPython(videoId) {
  try {
    // Note: Vercel routes /api/ requests to the Python functions
    const response = await fetch(`${PYTHON_SERVER_URL}/api/get_transcript?videoId=${videoId}`);

    if (!response.ok) {
      const respText = await response.text().catch(() => "No response body");
      let errMsg = "Server returned error";
      
      try {
        const errJson = JSON.parse(respText);
        errMsg = errJson.error || errMsg;
        
        // Detailed debug: if traceback is present, show the tail of it
        if (errJson.traceback) {
          const lines = errJson.traceback.trim().split('\n');
          const lastErr = lines[lines.length - 1];
          errMsg += `\n[Trace: ${lastErr}]`;
        }
      } catch (e) {
        // Not JSON - likely a Vercel 500 page or timeout
        errMsg = `Server error ${response.status}: ${respText.substring(0, 50)}...`;
      }

      // Make transcript errors more user-friendly
      if (errMsg.includes('disabled')) {
        return { success: false, error: "📵 No transcript: Creator disabled captions for this video." };
      }
      if (errMsg.includes('No English') || errMsg.includes('no transcript') || errMsg.includes('NotFound')) {
        return { success: false, error: "🌐 No transcript: This video doesn't have captions available." };
      }
      if (errMsg.includes('empty')) {
        return { success: false, error: "📭 No transcript: Captions are empty." };
      }

      return { success: false, error: errMsg };
    }

    const data = await response.json();
    return data;

  } catch (e) {
    console.error("Vercel API Connection Failed:", e);
    return {
      success: false,
      error: `🔌 Connection failed: ${e.message}`
    };
  }
}

// ============================================
// AI LOGIC
// ============================================

const SYSTEM_PROMPT = `
You are a knowledge extraction system. Your job is to make watching this video unnecessary.
Extract 4-6 key points with emojis.
For each point, include a SHORT QUOTE (3-8 words) copied EXACTLY from the transcript where this point is discussed.
Use emojis: 💰📈📉💎⚠️🚨❌✅🚩💡🔑🎯🧠🔍⚡📅🔄🚀💼🤝🔧💻👤🏆💥📌🔮🌊

After extraction, provide a single "core insight" — the most important takeaway in 1-2 sentences.
- NOT a description of the video
- NOT "this video covers..."
- The actual knowledge, stated directly as fact

Return ONLY this JSON (no markdown):
{"keyPoints":[{"text":"Key point summary","quote":"exact words","emoji":"💡"}],"core_insight":"The actual knowledge"}
`;

async function callQwen(apiKey, model, title, channel, transcript) {
  return callOpenAICompatible('alibaba', apiKey, model, title, channel, transcript);
}

async function callOpenAICompatible(provider, apiKey, model, title, channel, transcript) {
  const url = PROVIDERS[provider]?.url || PROVIDERS.openai.url;

  // Limit transcript length to avoid context limits (Qwen/GPT have large windows but good to be safe)
  const maxChars = 100000;
  const t = transcript.length > maxChars ? transcript.substring(0, maxChars) + "..." : transcript;

  const userMessage = `Title: "${title}"\nChannel: "${channel}"\n\nTRANSCRIPT:\n${t}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage }
      ],
      response_format: { type: "json_object" } // Force JSON
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API Error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;

  if (!text) throw new Error("Empty response from AI");

  const parsed = parseJSONResponse(text);
  return postProcessAnalysis(parsed, transcript);
}

async function callGemini(apiKey, model, title, channel, transcript) {
  const modelName = model || 'gemini-2.0-flash';
  const url = PROVIDERS.google.url(modelName);

  const maxChars = 50000;
  const t = transcript.length > maxChars ? transcript.substring(0, maxChars) + "..." : transcript;

  const prompt = `${SYSTEM_PROMPT}\n\nTitle: "${title}"\nChannel: "${channel}"\n\nTRANSCRIPT:\n${t}`;

  const response = await fetch(`${url}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 4096 }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API Error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    console.error('[ClueTube] Blocked/Empty:', data);
    throw new Error('AI returned empty response.');
  }

  const parsed = parseJSONResponse(text);
  return postProcessAnalysis(parsed, transcript);
}

// Helper to safely parse JSON from LLM output
function parseJSONResponse(text) {
  if (!text) return null;
  try {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('JSON Parse Error:', e);
    // Simple repair attempt
    try {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start >= 0 && end > start) {
        return JSON.parse(text.substring(start, end + 1));
      }
    } catch (ignore) { }

    return {
      keyPoints: [{ text: "Could not parse AI response. Try again.", emoji: "⚠️" }],
      core_insight: "Response format error."
    };
  }
}

function postProcessAnalysis(parsed, transcript) {
  if (parsed.keyPoints && Array.isArray(parsed.keyPoints)) {
    parsed.keyPoints = parsed.keyPoints.map(point => {
      if (point.quote) {
        const timestamp = findTimestampForQuote(point.quote, transcript);
        if (timestamp !== null) point.timestamp = timestamp;
        delete point.quote;
      }
      return point;
    });
  }
  return parsed;
}

// ============================================
// UTILS
// ============================================

/**
 * Find the timestamp (in seconds) for a quote in the timed transcript.
 * The transcript format is: "[M:SS] text\n[M:SS] text\n..."
 * Returns the timestamp in seconds, or null if not found.
 */
function findTimestampForQuote(quote, transcript) {
  if (!quote || !transcript) return null;

  // Normalize the quote for matching (lowercase, collapse whitespace)
  const normalizedQuote = quote.toLowerCase().replace(/\s+/g, ' ').trim();

  // Split transcript into lines
  const lines = transcript.split('\n');

  // Try to find the quote in the transcript
  for (const line of lines) {
    // Extract timestamp and text from line
    const match = line.match(/^\[(\d+):(\d{2})\]\s*(.+)$/);
    if (!match) continue;

    const [, mins, secs, lineText] = match;
    const normalizedLine = lineText.toLowerCase().replace(/\s+/g, ' ').trim();

    // Check if this line contains the quote (fuzzy match)
    if (normalizedLine.includes(normalizedQuote) ||
      fuzzyMatch(normalizedQuote, normalizedLine)) {
      return parseInt(mins) * 60 + parseInt(secs);
    }
  }

  // If exact match failed, try sliding window across transcript
  // Build a map of timestamps to positions
  const timestampMap = [];
  let currentTimestamp = 0;
  let fullText = '';

  for (const line of lines) {
    const match = line.match(/^\[(\d+):(\d{2})\]\s*(.+)$/);
    if (match) {
      currentTimestamp = parseInt(match[1]) * 60 + parseInt(match[2]);
      timestampMap.push({ timestamp: currentTimestamp, position: fullText.length });
      fullText += ' ' + match[3].toLowerCase();
    }
  }

  // Search for quote in full text
  const searchPos = fullText.indexOf(normalizedQuote);
  if (searchPos !== -1) {
    // Find the timestamp for this position
    for (let i = timestampMap.length - 1; i >= 0; i--) {
      if (timestampMap[i].position <= searchPos) {
        return timestampMap[i].timestamp;
      }
    }
  }

  return null;
}

/**
 * Simple fuzzy matching - checks if most words from quote appear in line
 */
function fuzzyMatch(quote, line) {
  const quoteWords = quote.split(' ').filter(w => w.length > 2);
  if (quoteWords.length === 0) return false;

  let matchCount = 0;
  for (const word of quoteWords) {
    if (line.includes(word)) matchCount++;
  }

  // Match if at least 70% of significant words are found
  return matchCount / quoteWords.length >= 0.7;
}

async function getSettings() {
  const result = await chrome.storage.sync.get('settings');
  const defaults = {
    provider: 'google',
    model: 'gemini-2.0-flash',
    apiKeys: {}
  };
  const settings = { ...defaults, ...result.settings };

  // Backward compatibility / Resolution
  // If apiKeys exists, use it. If not, fallback to old apiKey if it matches provider (simple migration logic for read)
  let resolvedKey = '';

  if (settings.apiKeys && settings.apiKeys[settings.provider]) {
    resolvedKey = settings.apiKeys[settings.provider];
  } else if (settings.apiKey) {
    // Fallback for old settings format
    resolvedKey = settings.apiKey;
  }

  return { ...settings, apiKey: resolvedKey };
}

async function getCached(videoId, model) {
  const key = `${videoId}_${model || 'default'}`;
  const res = await chrome.storage.local.get(key);
  // Also check retro-compatibility for old cache keys (just videoId)
  if (!res[key]) {
    const oldRes = await chrome.storage.local.get(videoId);
    if (oldRes[videoId] && Date.now() - oldRes[videoId].timestamp < CACHE_TTL_MS) {
      return oldRes[videoId].data;
    }
  }

  if (res[key] && Date.now() - res[key].timestamp < CACHE_TTL_MS) {
    return res[key].data;
  }
  return null;
}

async function setCache(videoId, data, model) {
  const key = `${videoId}_${model || 'default'}`;
  await chrome.storage.local.set({ [key]: { data, timestamp: Date.now() } });
}