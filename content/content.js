/* =============================================================================
   CLUETUBE - HYBRID CONTENT SCRIPT
   v2.0.0 button injection + V4 slide panel UI
============================================================================= */

(() => {
  'use strict';

  // === DUPLICATE-INSTANCE GUARD ===
  // YouTube SPA can cause Chrome to re-inject content scripts.
  // Prevent multiple copies from running and fighting each other.
  if (window.__CLUETUBELoaded) {
    console.log('[ClueTube] Already loaded, skipping duplicate injection.');
    return;
  }
  window.__CLUETUBELoaded = true;

  // Track processed videos to avoid duplicate buttons
  const processedVideos = new Set();

  // Panel state
  let panelVisible = false;

  // Injection lock to prevent race conditions
  let injectingForVideoId = null;

  // ============================================
  // SVG ICONS
  // ============================================
  const ICONS = {
    close: `<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
  };

  // ============================================
  // UI HANDLER
  // ============================================

  async function handleCheckClick(event) {
    event.preventDefault();
    event.stopPropagation();

    const button = event.currentTarget;

    // Re-extract video data from parent at click time to avoid stale references
    // YouTube recycles DOM elements, so dataset values may be outdated
    const parentRenderer = button.closest('ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer');
    let videoId, title, channel;

    if (parentRenderer) {
      const freshData = extractVideoData(parentRenderer);
      if (freshData) {
        videoId = freshData.id;
        title = freshData.title;
        channel = freshData.channel;
      }
    }

    // Fallback to dataset if parent extraction fails
    if (!videoId) {
      videoId = button.dataset.videoId;
      title = button.dataset.title;
      channel = button.dataset.channel;
    }

    if (!videoId) {
      console.error('[ClueTube] Could not determine video ID');
      return;
    }

    // CACHED STATE HANDLER
    if (button.classList.contains('CLUETUBE-cached')) {
      chrome.storage.local.get(videoId, (items) => {
        if (items[videoId]) {
          showPanelWithData(items[videoId].data, videoId);
        } else {
          // Cache missing/expired? Proceed to analyze again.
          button.classList.remove('CLUETUBE-cached');
          startAnalysis(button, videoId, title);
        }
      });
      return;
    }

    startAnalysis(button, videoId, title);
  }

  function startAnalysis(button, videoId, title) {
    // Show loading state on button
    button.classList.add('CLUETUBE-loading');
    button.innerHTML = `<span class="CLUETUBE-spinner-small"></span><span>Analyzing...</span>`;

    // Show panel with loading
    showPanel(videoId, title, button);
  }

  // ============================================
  // SLIDE PANEL
  // ============================================

  function showPanel(videoId, title, button) {
    // Remove existing panel
    closePanel();

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'CLUETUBE-panel-overlay';
    overlay.addEventListener('click', closePanel);

    // Create panel
    const panel = document.createElement('div');
    panel.className = 'CLUETUBE-panel';
    panel.innerHTML = `
      <div class="CLUETUBE-panel-header">
        <span class="CLUETUBE-panel-title">ClueTube Analysis</span>
        <button class="CLUETUBE-panel-close">${ICONS.close}</button>
      </div>
      <div class="CLUETUBE-panel-content">
        <div class="CLUETUBE-panel-loading">
          <div class="CLUETUBE-spinner"></div>
          <span>Analyzing video...</span>
        </div>
      </div>
    `;

    panel.querySelector('.CLUETUBE-panel-close').addEventListener('click', closePanel);

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    // Animate in
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
      panel.classList.add('visible');
    });

    panelVisible = true;

    // Fetch analysis
    fetchAnalysis(videoId, title, button);
  }

  function closePanel() {
    const panel = document.querySelector('.CLUETUBE-panel');
    const overlay = document.querySelector('.CLUETUBE-panel-overlay');

    if (panel) {
      panel.classList.remove('visible');
      setTimeout(() => panel.remove(), 350);
    }
    if (overlay) {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 300);
    }

    panelVisible = false;

    // Reset button states
    document.querySelectorAll('.CLUETUBE-check-btn.CLUETUBE-loading').forEach(btn => {
      btn.classList.remove('CLUETUBE-loading');
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-5-5 1.41-1.41L11 14.17l7.59-7.59L20 8l-9 9z"/>
        </svg>
        <span>Check</span>
      `;
    });
  }

  async function fetchAnalysis(videoId, title, button) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'analyzeTranscript',
        data: { videoId, title, channel: '' }
      });

      if (response.success) {
        renderPanelContent(response.data, videoId, title);
        // Replace button with cache badge - green = analyzed
        if (button) {
          button.classList.add('CLUETUBE-cached');
          button.classList.remove('CLUETUBE-loading');
          button.innerHTML = `
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-5-5 1.41-1.41L11 14.17l7.59-7.59L20 8l-9 9z"/>
            </svg>
            <span>Check</span>
          `;
        }
      } else {
        renderPanelError(response.error || 'Analysis failed.');
      }
    } catch (err) {
      console.error('[ClueTube] Error:', err);
      renderPanelError('Could not connect to analysis service.');
    }
  }

  function renderPanelContent(data, videoId, title) {
    const panel = document.querySelector('.CLUETUBE-panel');
    if (!panel) return;

    const content = panel.querySelector('.CLUETUBE-panel-content');
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const thumbUrl = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;

    // Calculate time saved
    const totalWords = (data.keyPoints || []).reduce((sum, p) => {
      return sum + (p.text?.split(/\s+/).length || 0);
    }, 0) + (data.core_insight?.split(/\s+/).length || 0);
    const readSeconds = Math.ceil(totalWords / 200 * 60);
    const videoDuration = data.videoDuration || 0;
    const videoMinutes = Math.floor(videoDuration / 60);

    // Build takeaways - text itself is the link
    const takeawaysHtml = (data.keyPoints || []).map(point => {
      const p = typeof point === 'object' ? point : { text: point, emoji: '💡' };
      const textContent = escapeHtml(p.text);
      // If timestamp exists, make the text a clickable link
      const textWithLink = p.timestamp
        ? `<a href="${videoUrl}&t=${p.timestamp}" target="_blank" class="CLUETUBE-takeaway-link">${textContent}</a>`
        : `<span>${textContent}</span>`;
      return `
        <li class="CLUETUBE-takeaway">
          <span class="CLUETUBE-emoji">${p.emoji || '💡'}</span>
          <div class="CLUETUBE-takeaway-content">
            ${textWithLink}
          </div>
        </li>
      `;
    }).join('');

    content.innerHTML = `
      <div class="CLUETUBE-video-preview">
        <img src="${thumbUrl}" alt="" class="CLUETUBE-thumb">
        <a href="${videoUrl}" target="_blank" class="CLUETUBE-video-title">${escapeHtml(title || 'Video')}</a>
        ${videoMinutes > 0 ? `<span class="CLUETUBE-time-saved">⏱️ ${videoMinutes} min → ${readSeconds} sec read</span>` : ''}
      </div>

      <div class="CLUETUBE-takeaways-box">
        <ul class="CLUETUBE-takeaways">${takeawaysHtml || '<li>No takeaways available.</li>'}</ul>
      </div>

      ${data.bestComment && data.bestComment.comment ? `
        <div class="CLUETUBE-best-comment">
          <div class="CLUETUBE-comment-header">
            <span class="CLUETUBE-comment-icon">💬</span>
            <span class="CLUETUBE-comment-why">${escapeHtml(data.bestComment.why || 'from comments')}</span>
          </div>
          <p class="CLUETUBE-comment-text">"${escapeHtml(data.bestComment.comment)}"</p>
        </div>
      ` : ''}

      <div class="CLUETUBE-gemini-buttons">
        <button class="CLUETUBE-gemini-btn" data-video-id="${videoId}" data-mode="elaborate" data-title="${escapeHtml(title || '')}">Elaborate Title ↗</button>
        <button class="CLUETUBE-gemini-btn" data-video-id="${videoId}" data-mode="keypoints">Key Points ↗</button>
        <button class="CLUETUBE-gemini-btn" data-video-id="${videoId}" data-mode="summarise">Summarise ↗</button>
      </div>
    `;

    // Gemini buttons click handlers
    content.querySelectorAll('.CLUETUBE-gemini-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleGemini(btn.dataset.videoId, btn.dataset.mode, btn, btn.dataset.title);
      });
    });
  }

  function renderPanelError(message) {
    const panel = document.querySelector('.CLUETUBE-panel');
    if (!panel) return;

    const content = panel.querySelector('.CLUETUBE-panel-content');
    content.innerHTML = `
      <div class="CLUETUBE-panel-error">
        <div class="CLUETUBE-error-icon">⚠️</div>
        <p>${escapeHtml(message)}</p>
      </div>
    `;
  }

  // ============================================
  // CACHE BADGES
  // ============================================



  function showPanelWithData(data, videoId) {
    closePanel();

    const overlay = document.createElement('div');
    overlay.className = 'CLUETUBE-panel-overlay';
    overlay.addEventListener('click', closePanel);

    const panel = document.createElement('div');
    panel.className = 'CLUETUBE-panel';
    panel.innerHTML = `
      <div class="CLUETUBE-panel-header">
        <span class="CLUETUBE-panel-title">ClueTube Analysis</span>
        <button class="CLUETUBE-panel-close">${ICONS.close}</button>
      </div>
      <div class="CLUETUBE-panel-content"></div>
    `;

    panel.querySelector('.CLUETUBE-panel-close').addEventListener('click', closePanel);

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    requestAnimationFrame(() => {
      overlay.classList.add('visible');
      panel.classList.add('visible');
    });

    panelVisible = true;
    renderPanelContent(data, videoId, '');
  }

  // ============================================
  // UI COMPONENTS (v2.0.0 style button)
  // ============================================

  function createCheckButton(videoId, title, channel) {
    const button = document.createElement('button');
    button.className = 'CLUETUBE-check-btn';
    button.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="10" cy="10" r="6"/>
        <line x1="14.5" y1="14.5" x2="20" y2="20"/>
      </svg>
      <span>Check</span>
    `;
    button.dataset.videoId = videoId;
    button.dataset.title = title;
    button.dataset.channel = channel;
    button.addEventListener('click', handleCheckClick);
    return button;
  }

  // ============================================
  // UTILITIES
  // ============================================

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function getSentimentEmoji(sentiment) {
    const emojis = {
      positive: '👍',
      negative: '👎',
      mixed: '⚖️',
      neutral: '😐',
      unavailable: '💬'
    };
    return emojis[sentiment] || '💬';
  }

  function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  }

  function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  // ============================================
  // GEMINI BUTTONS
  // ============================================

  const GEMINI_PROMPTS = {
    elaborate: (url, title) => `${url}

The video title is: "${title}"

Elaborate on this title. Using what the video actually covers, explain what the title means, why it matters, and what the viewer should understand about it. Don't just summarise the video — focus on unpacking the title's claim or topic.`,
    keypoints: (url) => `${url}

Extract ALL key points and important facts stated in this video. Be thorough and comprehensive. List every significant claim, statistic, insight, and actionable takeaway. Format as a numbered list.`,
    summarise: (url) => `${url}

Summarise`
  };

  function handleGemini(videoId, mode, buttonElement, title) {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const prompt = mode === 'elaborate'
      ? GEMINI_PROMPTS[mode](videoUrl, title || '')
      : GEMINI_PROMPTS[mode](videoUrl);
    const originalText = mode === 'elaborate' ? 'Elaborate Title ↗'
      : mode === 'keypoints' ? 'Key Points ↗'
        : 'Summarise ↗';

    navigator.clipboard.writeText(prompt).then(() => {
      // Show copied state
      if (buttonElement) {
        buttonElement.classList.add('copied');
        buttonElement.textContent = '✓ Copied';
      }

      // Delayed open after 800ms
      setTimeout(() => {
        window.open('https://gemini.google.com/app', '_blank');
        if (buttonElement) {
          buttonElement.classList.remove('copied');
          buttonElement.textContent = originalText;
        }
      }, 800);
    });
  }

  // ============================================
  // DOM SCANNER (v2.0.0 technique)
  // ============================================

  function extractVideoData(element) {
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
      const data = extractVideoData(el);
      if (!data) return;

      // Check for existing button/badge with WRONG video ID (DOM recycling)
      const existingBtn = el.querySelector('.CLUETUBE-check-btn');
      const existingBadge = el.querySelector('.CLUETUBE-cache-badge');

      if (existingBtn && existingBtn.dataset.videoId !== data.id) {
        // DOM was recycled - remove stale button
        existingBtn.remove();
      }
      if (existingBadge && existingBadge.dataset.videoId !== data.id) {
        // DOM was recycled - remove stale badge
        existingBadge.remove();
      }

      // Skip if already has CORRECT button or badge
      if (el.querySelector('.CLUETUBE-check-btn') || el.querySelector('.CLUETUBE-cache-badge')) return;

      // Check cache first
      chrome.storage.local.get(data.id, (items) => {
        // Double-check element still needs button (async timing)
        if (el.querySelector('.CLUETUBE-check-btn')) return;

        // Create button always
        const btn = createCheckButton(data.id, data.title, data.channel);

        if (items[data.id] && Date.now() - items[data.id].timestamp < 24 * 60 * 60 * 1000) {
          // Mark as cached (green)
          btn.classList.add('CLUETUBE-cached');
        }

        const thumbnail = el.querySelector('ytd-thumbnail') || el.querySelector('a#thumbnail');
        if (thumbnail) {
          thumbnail.style.position = 'relative';
          thumbnail.appendChild(btn);
        } else {
          el.style.position = 'relative';
          el.appendChild(btn);
        }
      });
    });
  }

  // ============================================
  // KEYBOARD
  // ============================================

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panelVisible) {
      closePanel();
    }
  });

  // ============================================
  // CONTEXT MENU SUPPORT
  // ============================================

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'analyzeFromContextMenu') {
      showPanel(message.videoId, '', null);
    }
  });

  // ============================================
  // INLINE WATCH PAGE SUMMARY
  // ============================================

  let currentWatchVideoId = null; // Track current video to detect navigation
  let sidebarObserver = null;     // Observer waiting for sidebar to appear

  /**
   * Wait for the sidebar (#secondary) to appear in the DOM.
   * Uses a MutationObserver instead of fragile retry polling.
   * Falls back to #below (area under the video) after timeout.
   */
  function waitForSidebar(videoId, callback) {
    // Clean up any previous observer
    if (sidebarObserver) {
      sidebarObserver.disconnect();
      sidebarObserver = null;
    }

    // Immediate check
    const sidebar = document.querySelector('#secondary-inner, #secondary');
    if (sidebar) {
      callback(sidebar);
      return;
    }

    const TIMEOUT_MS = 30000; // 30 second safety timeout
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      if (sidebarObserver) {
        sidebarObserver.disconnect();
        sidebarObserver = null;
      }
      // Fallback: try #below (area under the video player)
      const fallback = document.querySelector('#below');
      if (fallback) {
        console.warn('[ClueTube] Sidebar not found after 30s, using #below as fallback.');
        callback(fallback);
      } else {
        console.error('[ClueTube] Neither #secondary nor #below found. Cannot inject.');
      }
    }, TIMEOUT_MS);

    // Watch for the sidebar to appear
    sidebarObserver = new MutationObserver(() => {
      if (timedOut) return;
      const sidebar = document.querySelector('#secondary-inner, #secondary');
      if (sidebar) {
        clearTimeout(timeoutId);
        sidebarObserver.disconnect();
        sidebarObserver = null;
        callback(sidebar);
      }
    });

    const root = document.querySelector('ytd-app') || document.body;
    sidebarObserver.observe(root, { childList: true, subtree: true });
  }

  function injectWatchPageSummary() {
    // Remove box if NOT on a watch page (handles SPA navigation away)
    if (!window.location.pathname.startsWith('/watch')) {
      const existingBoxes = document.querySelectorAll('.CLUETUBE-inline-box');
      existingBoxes.forEach(box => box.remove());
      currentWatchVideoId = null;
      injectingForVideoId = null;
      return;
    }

    // Get video ID
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('v');
    if (!videoId) return;

    // Check if we already have a box for this video
    const existingBox = document.querySelector('.CLUETUBE-inline-box');
    if (existingBox && existingBox.dataset.videoId === videoId) return;

    // Check injection lock - another call is already handling this video
    if (injectingForVideoId === videoId) return;

    // Remove old box if different video
    if (existingBox) existingBox.remove();
    currentWatchVideoId = videoId;
    injectingForVideoId = videoId;

    // Wait for sidebar, then inject
    waitForSidebar(videoId, (container) => {
      // Bail if video changed while we were waiting
      if (injectingForVideoId !== videoId) return;
      injectingForVideoId = null;

      // Final check: box may have been added by another code path
      if (document.querySelector(`.CLUETUBE-inline-box[data-video-id="${videoId}"]`)) return;

      // Remove any stale boxes
      document.querySelectorAll(`.CLUETUBE-inline-box:not([data-video-id="${videoId}"])`)
        .forEach(box => box.remove());

      // Check cache
      chrome.storage.local.get(videoId, (items) => {
        // Re-check after async gap
        if (document.querySelector(`.CLUETUBE-inline-box[data-video-id="${videoId}"]`)) return;

        if (items[videoId] && Date.now() - items[videoId].timestamp < 24 * 60 * 60 * 1000) {
          const box = createInlineBox(items[videoId].data, videoId);
          container.insertBefore(box, container.firstChild);
        } else {
          const box = createInlineBox('button', videoId);
          container.insertBefore(box, container.firstChild);
        }
      });
    });
  }

  async function handleAnalyseClick(videoId) {
    const box = document.querySelector(`.CLUETUBE-inline-box[data-video-id="${videoId}"]`);
    if (!box) return;

    // Replace button with loading state
    const content = box.querySelector('.CLUETUBE-inline-content');
    if (content) {
      content.innerHTML = `
        <div class="CLUETUBE-spinner-small"></div>
        <p>Analyzing video...</p>
      `;
      content.classList.add('CLUETUBE-inline-loading');
    }

    const title = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1.title')?.textContent || '';
    const channel = document.querySelector('#channel-name a, ytd-channel-name a')?.textContent || '';

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'analyzeTranscript',
        data: { videoId, title, channel }
      });

      if (response.success) {
        // Update the inline box with results
        updateInlineBox(response.data, videoId);
      } else {
        updateInlineBoxError(response.error || 'Analysis failed', videoId);
      }
    } catch (e) {
      updateInlineBoxError('Could not connect to analysis service.', videoId);
    }
  }

  function updateInlineBox(data, videoId) {
    const box = document.querySelector('.CLUETUBE-inline-box');
    if (!box || box.dataset.videoId !== videoId) return;

    const newBox = createInlineBox(data, videoId);
    box.replaceWith(newBox);
  }

  function updateInlineBoxError(message, videoId) {
    const box = document.querySelector('.CLUETUBE-inline-box');
    if (!box) return;

    box.innerHTML = `
      <div class="CLUETUBE-inline-header">
        <span class="CLUETUBE-inline-logo">ClueTube</span>
      </div>
      <div class="CLUETUBE-inline-content">
        <p class="CLUETUBE-inline-error">⚠️ ${escapeHtml(message)}</p>
        <button class="CLUETUBE-analyse-btn CLUETUBE-retry-btn">Retry</button>
      </div>
    `;

    // Add retry handler
    if (videoId) {
      box.querySelector('.CLUETUBE-retry-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        handleAnalyseClick(videoId);
      });
    }
  }

  function createInlineBox(data, videoId) {
    const box = document.createElement('div');
    box.className = 'CLUETUBE-inline-box';
    box.dataset.videoId = videoId;

    if (data === 'button') {
      // Analyse button state
      box.innerHTML = `
        <div class="CLUETUBE-inline-header">
          <span class="CLUETUBE-inline-logo">ClueTube</span>
        </div>
        <div class="CLUETUBE-inline-content CLUETUBE-inline-button-state">
          <button class="CLUETUBE-analyse-btn">Analyse</button>
        </div>
      `;

      box.querySelector('.CLUETUBE-analyse-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        handleAnalyseClick(videoId);
      });
    } else if (!data) {
      // No data (fallback)
      box.innerHTML = `
        <div class="CLUETUBE-inline-header">
          <span class="CLUETUBE-inline-logo">ClueTube</span>
        </div>
        <div class="CLUETUBE-inline-content">
          <p class="CLUETUBE-inline-prompt">Waiting for analysis...</p>
        </div>
      `;
    } else {
      // Has data - show summary
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const keyPointsHtml = (data.keyPoints || []).map(p => {
        const point = typeof p === 'object' ? p : { text: p, emoji: '💡' };
        const link = point.timestamp
          ? `<a href="${videoUrl}&t=${point.timestamp}" class="CLUETUBE-inline-link">${escapeHtml(point.text)}</a>`
          : `<span>${escapeHtml(point.text)}</span>`;
        return `<li class="CLUETUBE-inline-point"><span class="CLUETUBE-inline-emoji">${point.emoji || '💡'}</span>${link}</li>`;
      }).join('');

      box.innerHTML = `
        <div class="CLUETUBE-inline-header">
          <span class="CLUETUBE-inline-logo">ClueTube</span>
          <button class="CLUETUBE-inline-expand" title="View full analysis">↗</button>
        </div>
        <ul class="CLUETUBE-inline-points">${keyPointsHtml}</ul>
        ${data.bestComment && data.bestComment.comment ? `
          <div class="CLUETUBE-inline-comment">
            <span class="CLUETUBE-inline-emoji">💬</span>
            <span>"${escapeHtml(data.bestComment.comment.substring(0, 100))}${data.bestComment.comment.length > 100 ? '...' : ''}"</span>
          </div>
        ` : ''}
        <div class="CLUETUBE-gemini-buttons">
          <button class="CLUETUBE-gemini-btn" data-mode="elaborate">Elaborate Title ↗</button>
          <button class="CLUETUBE-gemini-btn" data-mode="keypoints">Key Points ↗</button>
          <button class="CLUETUBE-gemini-btn" data-mode="summarise">Summarise ↗</button>
        </div>
      `;

      // Expand button opens full panel
      box.querySelector('.CLUETUBE-inline-expand')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const title = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1.title')?.textContent || '';
        showPanelWithData(data, videoId);
      });

      // Gemini buttons
      box.querySelectorAll('.CLUETUBE-gemini-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const pageTitle = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1.title')?.textContent || '';
          handleGemini(videoId, btn.dataset.mode, btn, pageTitle);
        });
      });
    }

    return box;
  }

  // ============================================
  // INIT
  // ============================================

  function init() {
    console.log('[ClueTube] Hybrid UI loaded (v2 buttons + v4 panel)');
    setInterval(scanForVideos, 1000);

    // Initial checks
    scanForVideos();
    if (window.location.pathname.startsWith('/watch')) {
      injectWatchPageSummary();
    }

    // PRIMARY: YouTube SPA navigation events
    // yt-navigate-finish fires after most navigations
    window.addEventListener('yt-navigate-finish', () => {
      injectWatchPageSummary();
    });

    // BACKUP: yt-page-data-updated fires on some navigations where
    // yt-navigate-finish doesn't (e.g. back/forward, mini-player)
    window.addEventListener('yt-page-data-updated', () => {
      injectWatchPageSummary();
    });

    // SAFETY NET: lightweight interval to catch any edge cases
    // where neither event fires (e.g. direct URL change, popstate)
    setInterval(() => {
      if (window.location.pathname.startsWith('/watch')) {
        const urlParams = new URLSearchParams(window.location.search);
        const videoId = urlParams.get('v');
        // Only trigger if we don't already have the right box
        if (videoId && !document.querySelector(`.CLUETUBE-inline-box[data-video-id="${videoId}"]`)) {
          injectWatchPageSummary();
        }
      } else {
        // Clean up boxes if we navigated away from a watch page
        const boxes = document.querySelectorAll('.CLUETUBE-inline-box');
        if (boxes.length > 0) {
          boxes.forEach(box => box.remove());
          currentWatchVideoId = null;
        }
      }
    }, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();