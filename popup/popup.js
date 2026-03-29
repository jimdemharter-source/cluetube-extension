// ClueTube Popup Script
// Handles settings management and cache controls

// Model options per provider
const MODELS = {
  anthropic: [
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (Recommended)' },
    { value: 'claude-haiku-4-20250514', label: 'Claude Haiku 4 (Faster/Cheaper)' }
  ],
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Recommended)' },
    { value: 'gpt-4o', label: 'GPT-4o (More Capable)' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' }
  ],
  google: [
    { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Most Capable)' },
    { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro' },
    { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Recommended)' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' }
  ],
  alibaba: [
    { value: 'qwen-plus', label: 'Qwen 3.5 Plus (Stable Alias)' },
    { value: 'qwen-max', label: 'Qwen 2.5 Max (Stable Alias)' },
    { value: 'qwen-turbo', label: 'Qwen 2.5 Turbo (Fast)' },
    { value: 'qwen3.5-plus-2026-02-15', label: 'Qwen 3.5 Plus (2026-02-15)' },
    { value: 'qwen3-max-2026-01-23', label: 'Qwen 3 Max (2026-01-23)' },
    { value: 'qwen-plus-2025-12-01', label: 'Qwen Plus (2025-12-01)' }
  ],
  openrouter: [
    { value: 'minimax/minimax-m2.5', label: 'MiniMax M2.5 (OpenRouter)' }
  ]
};

// Default settings
const DEFAULT_SETTINGS = {
  provider: 'google',
  model: 'gemini-2.0-flash',
  apiKeys: {
    google: '',
    alibaba: '',
    openai: '',
    anthropic: '',
    openrouter: ''
  }
};

// DOM elements
let providerSelect, modelSelect, apiKeyInput, saveBtn, clearCacheBtn;
let currentApiKeys = { ...DEFAULT_SETTINGS.apiKeys }; // Local state for keys
let statusEl, cacheCountEl, toggleVisibilityBtn;
let analyseBtn, analyseVideoInfo, analyseNotVideo, analyseResults, analyseVideoTitle;

// Current video state
let currentVideoId = null;
let currentVideoTitle = '';

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  // Get DOM elements
  providerSelect = document.getElementById('provider');
  modelSelect = document.getElementById('model');
  apiKeyInput = document.getElementById('apiKey');
  saveBtn = document.getElementById('save-btn');
  clearCacheBtn = document.getElementById('clear-cache-btn');
  statusEl = document.getElementById('status');
  cacheCountEl = document.getElementById('cache-count');
  toggleVisibilityBtn = document.getElementById('toggle-visibility');

  // Analyse elements
  analyseBtn = document.getElementById('analyse-btn');
  analyseVideoInfo = document.getElementById('analyse-video-info');
  analyseNotVideo = document.getElementById('analyse-not-video');
  analyseResults = document.getElementById('analyse-results');
  analyseVideoTitle = document.getElementById('analyse-video-title');

  // Set up event listeners
  providerSelect.addEventListener('change', handleProviderChange);

  // Track input changes to update local state immediately
  apiKeyInput.addEventListener('input', (e) => {
    const currentProvider = providerSelect.value;
    currentApiKeys[currentProvider] = e.target.value.trim();
    updateStatus(e.target.value.trim());
  });

  document.getElementById('settings-form').addEventListener('submit', handleSave);
  clearCacheBtn.addEventListener('click', handleClearCache);
  toggleVisibilityBtn.addEventListener('click', toggleKeyVisibility);
  analyseBtn.addEventListener('click', handleAnalyse);

  // Load current settings
  await loadSettings();

  // Update cache count
  await updateCacheCount();

  // Detect if on a YouTube video page
  await detectVideoPage();
});

// ============================================
// SETTINGS MANAGEMENT
// ============================================

async function loadSettings() {
  const result = await chrome.storage.sync.get('settings');
  let settings = { ...DEFAULT_SETTINGS, ...result.settings };

  // MIGRATION: If old settings exist without apiKeys, migrate them
  if (!settings.apiKeys) {
    settings.apiKeys = { ...DEFAULT_SETTINGS.apiKeys };
    // If there was an old single key, assign it to the current provider
    if (settings.apiKey && settings.provider) {
      settings.apiKeys[settings.provider] = settings.apiKey;
    }
  }
  // Ensure all providers exist in the object
  settings.apiKeys = { ...DEFAULT_SETTINGS.apiKeys, ...settings.apiKeys };
  currentApiKeys = settings.apiKeys;

  // Set provider
  providerSelect.value = settings.provider;

  // Populate and set model
  populateModels(settings.provider);
  modelSelect.value = settings.model;



  // Set API key for current provider
  apiKeyInput.value = currentApiKeys[settings.provider] || '';

  // Update status based on key
  updateStatus(apiKeyInput.value);
}

async function saveSettings() {
  // Update current key in state from input one last time to be sure
  currentApiKeys[providerSelect.value] = apiKeyInput.value.trim();

  const settings = {
    provider: providerSelect.value,
    model: modelSelect.value,
    apiKeys: currentApiKeys
  };

  await chrome.storage.sync.set({ settings });
  return settings;
}

function handleProviderChange() {
  const newProvider = providerSelect.value;

  // Populate models for the new provider
  populateModels(newProvider);

  // Switch API Key input to the new provider's stored key
  apiKeyInput.value = currentApiKeys[newProvider] || '';
  updateStatus(apiKeyInput.value);
}

function populateModels(provider) {
  const models = MODELS[provider] || [];

  modelSelect.innerHTML = '';
  models.forEach(model => {
    const option = document.createElement('option');
    option.value = model.value;
    option.textContent = model.label;
    modelSelect.appendChild(option);
  });
}

async function handleSave(event) {
  event.preventDefault();

  // Show saving state
  saveBtn.textContent = 'Saving...';
  saveBtn.disabled = true;

  try {
    const settings = await saveSettings();
    updateStatus(settings.apiKey);

    // Show success
    saveBtn.textContent = 'Saved!';
    setTimeout(() => {
      saveBtn.textContent = 'Save Settings';
      saveBtn.disabled = false;
    }, 1500);
  } catch (error) {
    console.error('Failed to save settings:', error);
    saveBtn.textContent = 'Error!';
    setTimeout(() => {
      saveBtn.textContent = 'Save Settings';
      saveBtn.disabled = false;
    }, 1500);
  }
}

// ============================================
// UI HELPERS
// ============================================

function updateStatus(apiKey) {
  if (apiKey && apiKey.length > 0) {
    statusEl.className = 'status status-configured';
    statusEl.querySelector('.status-text').textContent = 'Ready to analyze';
  } else {
    statusEl.className = 'status status-unconfigured';
    statusEl.querySelector('.status-text').textContent = 'Not configured';
  }
}

function toggleKeyVisibility() {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';

  // Update icon
  const eyeIcon = document.getElementById('eye-icon');
  if (isPassword) {
    eyeIcon.innerHTML = '<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>';
  } else {
    eyeIcon.innerHTML = '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>';
  }
}

// ============================================
// CACHE MANAGEMENT
// ============================================

async function updateCacheCount() {
  const items = await chrome.storage.local.get(null);
  const count = Object.keys(items).length;
  cacheCountEl.textContent = count;
}

async function handleClearCache() {
  clearCacheBtn.textContent = 'Clearing...';
  clearCacheBtn.disabled = true;

  try {
    await chrome.runtime.sendMessage({ action: 'clearCache' });
    await updateCacheCount();

    clearCacheBtn.textContent = 'Cleared!';
    setTimeout(() => {
      clearCacheBtn.textContent = 'Clear Cache';
      clearCacheBtn.disabled = false;
    }, 1500);
  } catch (error) {
    console.error('Failed to clear cache:', error);
    clearCacheBtn.textContent = 'Error!';
    setTimeout(() => {
      clearCacheBtn.textContent = 'Clear Cache';
      clearCacheBtn.disabled = false;
    }, 1500);
  }
}

// ============================================
// VIDEO PAGE DETECTION & ANALYSIS
// ============================================

async function detectVideoPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;

    const url = new URL(tab.url);
    const isWatch = (url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com')
      && url.pathname === '/watch';

    if (isWatch) {
      currentVideoId = url.searchParams.get('v');
      if (!currentVideoId) return;

      // Try to get the title from the tab
      currentVideoTitle = tab.title?.replace(' - YouTube', '').trim() || 'Video';

      analyseVideoTitle.textContent = currentVideoTitle;
      analyseVideoInfo.style.display = 'flex';
      analyseNotVideo.style.display = 'none';

      // Wire up Gemini buttons (work without analysis)
      setupGeminiButtons();

      // Check if we already have cached results
      // Use the same composite key format as background.js: videoId_model
      const result = await chrome.storage.sync.get('settings');
      const settings = { ...DEFAULT_SETTINGS, ...result.settings };
      const cacheKey = `${currentVideoId}_${settings.model || 'default'}`;
      const cached = await chrome.storage.local.get([cacheKey, currentVideoId]);

      // Try new composite key first, then fall back to legacy videoId-only key
      const entry = cached[cacheKey] || cached[currentVideoId];
      if (entry && Date.now() - entry.timestamp < 24 * 60 * 60 * 1000) {
        renderResults(entry.data);
        // Update button to indicate analysis is cached
        analyseBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-5-5 1.41-1.41L11 14.17l7.59-7.59L20 8l-9 9z"/>
          </svg>
          Analysed (cached)`;
        analyseBtn.classList.add('cached');
      }
    } else {
      analyseVideoInfo.style.display = 'none';
      analyseNotVideo.style.display = 'block';
    }
  } catch (e) {
    console.error('Failed to detect video page:', e);
  }
}

async function handleAnalyse() {
  if (!currentVideoId) return;

  // Show loading state
  analyseBtn.disabled = true;
  analyseBtn.innerHTML = '<span class="popup-spinner"></span> Analysing...';
  analyseResults.style.display = 'none';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'analyzeTranscript',
      data: { videoId: currentVideoId, title: currentVideoTitle, channel: '' }
    });

    if (response.success) {
      renderResults(response.data);
      // Update button to indicate analysis is done
      analyseBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-5-5 1.41-1.41L11 14.17l7.59-7.59L20 8l-9 9z"/>
        </svg>
        Analysed (cached)`;
      analyseBtn.classList.add('cached');
    } else {
      renderError(response.error || 'Analysis failed.');
      analyseBtn.classList.remove('cached');
      analyseBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-5-5 1.41-1.41L11 14.17l7.59-7.59L20 8l-9 9z"/>
        </svg>
        Analyse`;
    }
  } catch (e) {
    console.error('Analysis error:', e);
    renderError(`Extension Error: ${e.message || 'Could not connect'}`);
    analyseBtn.classList.remove('cached');
    analyseBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-5-5 1.41-1.41L11 14.17l7.59-7.59L20 8l-9 9z"/>
      </svg>
      Analyse`;
  } finally {
    analyseBtn.disabled = false;
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function renderResults(data) {
  const videoUrl = `https://www.youtube.com/watch?v=${currentVideoId}`;

  const keyPointsHtml = (data.keyPoints || []).map(p => {
    const point = typeof p === 'object' ? p : { text: p, emoji: '💡' };
    const textContent = escapeHtml(point.text);
    const textHtml = point.timestamp
      ? `<a href="${videoUrl}&t=${point.timestamp}" target="_blank" class="popup-point-link">${textContent}</a>`
      : `<span>${textContent}</span>`;
    return `<li class="popup-point">
      <span class="popup-emoji">${point.emoji || '💡'}</span>
      ${textHtml}
    </li>`;
  }).join('');

  analyseResults.innerHTML = `
    <ul class="popup-points">${keyPointsHtml}</ul>`;
  analyseResults.style.display = 'block';
}

function renderError(message) {
  analyseResults.innerHTML = `< p class="popup-error" >⚠️ ${escapeHtml(message)}</p > `;
  analyseResults.style.display = 'block';
}

function setupGeminiButtons() {
  const videoUrl = `https://www.youtube.com/watch?v=${currentVideoId}`;
  document.querySelectorAll('#popup-gemini-buttons .popup-gemini-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      const prompt = mode === 'elaborate'
        ? `${videoUrl}\n\nThe video title is: "${currentVideoTitle}"\n\nElaborate on this title. Using what the video actually covers, explain what the title means, why it matters, and what the viewer should understand about it. Don't just summarise the video — focus on unpacking the title's claim or topic.`
        : mode === 'keypoints'
          ? `${videoUrl}\n\nExtract ALL key points and important facts stated in this video. Be thorough and comprehensive. List every significant claim, statistic, insight, and actionable takeaway. Format as a numbered list.`
          : `${videoUrl}\n\nSummarise`;
      const originalText = mode === 'elaborate' ? 'Elaborate Title ↗'
        : mode === 'keypoints' ? 'Key Points ↗'
          : 'Summarise ↗';

      navigator.clipboard.writeText(prompt).then(() => {
        btn.classList.add('copied');
        btn.textContent = '✓ Copied';
        setTimeout(() => {
          window.open('https://gemini.google.com/app', '_blank');
          btn.classList.remove('copied');
          btn.textContent = originalText;
        }, 800);
      });
    });
  });
}
