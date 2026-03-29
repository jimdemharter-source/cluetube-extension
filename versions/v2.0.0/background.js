// CLUETUBE Background Service Worker
// v2.0 - Python Backend Connector

const PYTHON_SERVER_URL = "http://127.0.0.1:5000";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// ============================================
// CORE LOGIC
// ============================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeTranscript') {
    handleAnalysis(request.data).then(sendResponse);
    return true; // Keep channel open for async response
  }
  if (request.action === 'getSettings') {
    getSettings().then(sendResponse);
    return true;
  }
  if (request.action === 'clearCache') {
    chrome.storage.local.clear().then(() => sendResponse({ success: true }));
    return true;
  }
});

async function handleAnalysis({ videoId, title, channel }) {
  const settings = await getSettings();
  if (!settings.apiKey) return { success: false, error: 'Configure API Key in settings.' };

  // 1. Check Cache
  const cached = await getCached(videoId);
  if (cached) return { success: true, data: cached, fromCache: true };

  // 2. Fetch Transcript from PYTHON SERVER
  const transcriptRes = await fetchTranscriptFromPython(videoId);
  if (!transcriptRes.success) return { success: false, error: transcriptRes.error };

  // 3. AI Analysis - use timed transcript if available for accurate timestamps
  try {
    const transcriptToUse = transcriptRes.timedTranscript || transcriptRes.transcript;
    const analysis = await callGemini(settings.apiKey, settings.model, title, channel, transcriptToUse);
    await setCache(videoId, analysis);
    return { success: true, data: analysis, fromCache: false };
  } catch (e) {
    return { success: false, error: "AI Error: " + e.message };
  }
}

// ============================================
// PYTHON SERVER CONNECTION
// ============================================

async function fetchTranscriptFromPython(videoId) {
  try {
    // This calls your local python script
    const response = await fetch(`${PYTHON_SERVER_URL}/get_transcript?videoId=${videoId}`);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Server returned error");
    }

    const data = await response.json();
    return data; // { success: true, transcript: "..." }

  } catch (e) {
    console.error("Python Server Connection Failed:", e);
    return {
      success: false,
      error: "Could not connect to Python backend. Is 'server.py' running?"
    };
  }
}

// ============================================
// AI & UTILS
// ============================================

async function callGemini(apiKey, model, title, channel, transcript) {
  const modelName = model || 'gemini-2.0-flash';
  // We can send more text now that the backend is robust
  const truncated = transcript.substring(0, 15000);

  const prompt = `
    Analyze this YouTube video for clickbait and provide key takeaways.
    Title: "${title}"
    Channel: "${channel}"
    
    TRANSCRIPT (with timestamps in [M:SS] format):
    ${truncated}
    
    Return JSON ONLY with this exact structure:
    {
      "verdict": "LOW" | "MEDIUM" | "HIGH",
      "clickbaitReason": "One sentence explaining why it is/isn't clickbait",
      "summary": "2-3 sentence summary of what the video is actually about",
      "keyPoints": [
        {"text": "Key point description", "timestamp": 120, "emoji": "💡"},
        {"text": "Another key point", "timestamp": 300, "emoji": "⚠️"}
      ],
      "conclusion": "Single sentence answering 'So what?' - see instructions below"
    }
    
    IMPORTANT for keyPoints:
    - Include 3-5 key takeaways
    - TIMESTAMPS: Use the exact [M:SS] timestamps from the transcript! Convert to seconds (e.g., [2:30] = 150 seconds)
    - Each keyPoint must have "text", "timestamp" (in SECONDS), and "emoji"
    - Choose emoji based on content type:
      💰 = money/financial  📈 = growth/bullish  📉 = decline/bearish
      ⚠️ = warning/risk     💡 = insight/idea    🔑 = key concept
      🎯 = main point       📊 = data/statistics 🧠 = strategy/thinking
      ⚡ = action/urgent    🔍 = detail/analysis 💼 = business
    
    CRITICAL for conclusion - Answer "So what?" or "Why should I care?"
    Do NOT summarize the takeaways - assume I already read them.
    Instead, provide ONE of the following based on content type:
    - Opinions/commentary: The speaker's actual stance (e.g., "He thinks the product is overhyped garbage")
    - Tutorials: The skill ceiling (e.g., "Doable in an afternoon if you know basic Python")
    - News/events: The implication (e.g., "This likely delays the merger until Q3")
    - Reviews: The verdict (e.g., "Buy if you need portability, skip if you want performance")
    - Finance: The trade (e.g., "Bullish gold if Fed pauses in March")
    - Entertainment: Honest assessment (e.g., "Funny if you're already a fan, otherwise skip")
    - Educational: The core insight (e.g., "Sleep matters more than diet for cognitive performance")
    - Drama/controversy: What actually happened (e.g., "He got caught using bots, apologized poorly")
    If the video has no clear takeaway or is pure filler, say: "No substance - skip this one"
  `;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    }
  );

  if (!response.ok) throw new Error(`API Status ${response.status}`);
  const data = await response.json();
  const text = data.candidates[0].content.parts[0].text;
  return JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
}

async function getSettings() {
  const result = await chrome.storage.sync.get('settings');
  return { apiKey: '', model: 'gemini-2.0-flash', ...result.settings };
}

async function getCached(videoId) {
  const res = await chrome.storage.local.get(videoId);
  if (res[videoId] && Date.now() - res[videoId].timestamp < CACHE_TTL_MS) {
    return res[videoId].data;
  }
  return null;
}

async function setCache(videoId, data) {
  await chrome.storage.local.set({ [videoId]: { data, timestamp: Date.now() } });
}