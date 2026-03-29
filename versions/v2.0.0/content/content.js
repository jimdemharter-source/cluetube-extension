// CLUETUBE Content Script v6.0
// UI Logic Only - Backend handles fetching

(() => {
  'use strict';

  // Track processed videos to avoid duplicate buttons
  const processedVideos = new Set();

  // ============================================
  // UI HANDLER
  // ============================================

  async function handleCheckClick(event) {
    event.preventDefault();
    event.stopPropagation();

    const button = event.currentTarget;
    const { videoId, title, channel } = button.dataset;

    // Find container for overlay
    let container = button.closest('ytd-thumbnail') ||
      button.closest('ytd-rich-item-renderer')?.querySelector('ytd-thumbnail') ||
      button.parentElement;

    if (!container) return;

    // Get the thumbnail URL
    const thumbnailImg = container.querySelector('img');
    const thumbnailUrl = thumbnailImg?.src || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    // Remove existing overlay
    const existing = document.querySelector('.CLUETUBE-verdict-overlay');
    if (existing) existing.remove();

    // Show Loading (now fixed position, so append to body)
    const loadingOverlay = createLoadingOverlay();
    document.body.appendChild(loadingOverlay);

    try {
      // SEND TO BACKGROUND (Which talks to Python)
      const response = await chrome.runtime.sendMessage({
        action: 'analyzeTranscript',
        data: { videoId, title, channel }
      });

      loadingOverlay.remove();

      if (response.success) {
        document.body.appendChild(createVerdictOverlay(response.data, response.fromCache, title, thumbnailUrl, videoId));
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('[CLUETUBE] Error:', error);
      loadingOverlay.remove();
      document.body.appendChild(createErrorOverlay(error.message));
    }
  }

  // ============================================
  // UI COMPONENTS
  // ============================================

  function createCheckButton(videoId, title, channel) {
    const button = document.createElement('button');
    button.className = 'CLUETUBE-check-btn';
    button.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-5-5 1.41-1.41L11 14.17l7.59-7.59L20 8l-9 9z"/>
      </svg>
      <span>Check</span>
    `;
    button.dataset.videoId = videoId;
    button.dataset.title = title;
    button.dataset.channel = channel;
    button.addEventListener('click', handleCheckClick);
    return button;
  }

  // Format seconds to MM:SS or HH:MM:SS
  function formatTimestamp(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function createVerdictOverlay(data, fromCache, title, thumbnailUrl, videoId) {
    const overlay = document.createElement('div');
    overlay.className = 'CLUETUBE-verdict-overlay';

    // Only highlight HIGH clickbait with red
    const isHighClickbait = data.verdict === 'HIGH';
    const colorClass = isHighClickbait ? 'CLUETUBE-verdict-high' : '';

    // Video URL
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Default emoji if none provided
    const defaultEmoji = '💡';

    // Build key points HTML with semantic emojis from AI
    let keyPointsHtml = '<p class="CLUETUBE-no-points">No key takeaways available.</p>';
    if (data.keyPoints && data.keyPoints.length > 0) {
      const pointsList = data.keyPoints.map((p, i) => {
        // Handle both new format (object with text/timestamp/emoji) and old format (string)
        if (typeof p === 'object' && p.text) {
          const timestamp = p.timestamp || 0;
          const emoji = p.emoji || defaultEmoji;
          const timestampUrl = `${videoUrl}&t=${timestamp}`;
          return `<li>
            <span class="CLUETUBE-bullet-emoji">${emoji}</span>
            <a href="${timestampUrl}" target="_blank" class="CLUETUBE-keypoint-link">
              ${escapeHtml(p.text)}
            </a>
          </li>`;
        } else {
          // Fallback for old string format
          return `<li><span class="CLUETUBE-bullet-emoji">${defaultEmoji}</span><span class="CLUETUBE-keypoint-text">${escapeHtml(p)}</span></li>`;
        }
      }).join('');
      keyPointsHtml = `<ul>${pointsList}</ul>`;
    }

    // Show warning banner only for HIGH clickbait
    const warningBanner = isHighClickbait
      ? `<div class="CLUETUBE-warning-banner">🚨 High Clickbait Warning</div>`
      : '';

    // Build conclusion section if available (handles both string and object format)
    let conclusionHtml = '';
    const conclusionText = typeof data.conclusion === 'string'
      ? data.conclusion
      : (data.conclusion?.text || '');
    if (conclusionText) {
      conclusionHtml = `
        <div class="CLUETUBE-conclusion">
          <p class="CLUETUBE-conclusion-text">${escapeHtml(conclusionText)}</p>
        </div>
      `;
    }

    overlay.innerHTML = `
      <div class="CLUETUBE-verdict-card ${colorClass}">
        ${warningBanner}
        <button class="CLUETUBE-close-btn">×</button>
        
        <a href="${videoUrl}" target="_blank" class="CLUETUBE-video-link">
          <div class="CLUETUBE-video-info">
            <img src="${thumbnailUrl}" alt="Thumbnail" class="CLUETUBE-thumbnail" />
            <div class="CLUETUBE-video-title">${escapeHtml(title || 'Video')} ▶</div>
          </div>
        </a>
        
        <div class="CLUETUBE-section-title">📌 Key Takeaways</div>
        <div class="CLUETUBE-keypoints">
          ${keyPointsHtml}
        </div>
        
        ${conclusionHtml}
      </div>
    `;

    // Close on clicking overlay background or X button
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('.CLUETUBE-close-btn').onclick = (e) => { e.stopPropagation(); overlay.remove(); };
    return overlay;
  }

  function createLoadingOverlay() {
    const div = document.createElement('div');
    div.className = 'CLUETUBE-verdict-overlay';
    div.innerHTML = `<div class="CLUETUBE-verdict-card" style="text-align:center;padding:15px;">Analyzing Video...</div>`;
    return div;
  }

  function createErrorOverlay(msg) {
    const div = document.createElement('div');
    div.className = 'CLUETUBE-verdict-overlay';
    div.innerHTML = `
      <div class="CLUETUBE-verdict-card" style="border-left:4px solid #ff4444;">
        <div style="font-weight:bold;margin-bottom:5px;">Error</div>
        <div style="font-size:12px;">${escapeHtml(msg)}</div>
        <button class="CLUETUBE-close-btn" style="position:absolute;top:5px;right:5px;">×</button>
      </div>`;
    div.querySelector('button').onclick = (e) => { e.stopPropagation(); div.remove(); };
    return div;
  }

  function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  // ============================================
  // DOM SCANNER
  // ============================================

  function extractVideoData(element) {
    // Robust extraction for various YouTube layouts
    const link = element.querySelector('a#thumbnail, a.ytd-thumbnail, a[href*="/watch"]');
    if (!link?.href) return null;

    const match = link.href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (!match) return null;

    const titleEl = element.querySelector('#video-title, .title, h3 a');
    const channelEl = element.querySelector('#channel-name a, .ytd-channel-name a');

    return {
      id: match[1],
      title: titleEl?.textContent?.trim() || 'Video',
      channel: channelEl?.textContent?.trim() || 'Channel'
    };
  }

  function scanForVideos() {
    const selectors = [
      'ytd-rich-item-renderer',
      'ytd-video-renderer',
      'ytd-grid-video-renderer',
      'ytd-compact-video-renderer'
    ];

    document.querySelectorAll(selectors.join(',')).forEach(el => {
      // Skip if already processed or has button
      if (el.querySelector('.CLUETUBE-check-btn')) return;

      const data = extractVideoData(el);
      if (!data || processedVideos.has(data.id)) return;

      // Ensure relative positioning for button
      el.style.position = 'relative';

      const btn = createCheckButton(data.id, data.title, data.channel);
      el.appendChild(btn);

      processedVideos.add(data.id);
    });
  }

  // ============================================
  // INIT
  // ============================================

  function init() {
    console.log('[CLUETUBE v6.0] UI Loaded');
    setInterval(scanForVideos, 1000);
    scanForVideos();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();