// CLUETUBE Popup Script
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
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Recommended)' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (More Capable)' }
  ]
};

// Default settings
const DEFAULT_SETTINGS = {
  provider: 'google',
  model: 'gemini-2.0-flash',
  apiKey: ''
};

// DOM elements
let providerSelect, modelSelect, apiKeyInput, saveBtn, clearCacheBtn;
let statusEl, cacheCountEl, toggleVisibilityBtn;

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

  // Set up event listeners
  providerSelect.addEventListener('change', handleProviderChange);
  document.getElementById('settings-form').addEventListener('submit', handleSave);
  clearCacheBtn.addEventListener('click', handleClearCache);
  toggleVisibilityBtn.addEventListener('click', toggleKeyVisibility);

  // Load current settings
  await loadSettings();

  // Update cache count
  await updateCacheCount();
});

// ============================================
// SETTINGS MANAGEMENT
// ============================================

async function loadSettings() {
  const result = await chrome.storage.sync.get('settings');
  const settings = { ...DEFAULT_SETTINGS, ...result.settings };

  // Set provider
  providerSelect.value = settings.provider;

  // Populate and set model
  populateModels(settings.provider);
  modelSelect.value = settings.model;

  // Set API key
  apiKeyInput.value = settings.apiKey;

  // Update status
  updateStatus(settings.apiKey);
}

async function saveSettings() {
  const settings = {
    provider: providerSelect.value,
    model: modelSelect.value,
    apiKey: apiKeyInput.value.trim()
  };

  await chrome.storage.sync.set({ settings });
  return settings;
}

function handleProviderChange() {
  const provider = providerSelect.value;
  populateModels(provider);
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
