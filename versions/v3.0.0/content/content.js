/* =============================================================================
   CLUETUBE - REFINED CONTENT SCRIPT
   Quieter, more intentional interactions.
============================================================================= */

(function() {
  'use strict';

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------
  const CONFIG = {
    HOVER_DELAY: 500,           // ms before button appears
    PANEL_CLOSE_KEY: 'Escape',
    ANALYZE_KEY: 't',           // Press T while hovering to analyze
    SELECTORS: {
      thumbnail: 'ytd-thumbnail, ytd-playlist-thumbnail',
      videoRenderer: 'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer',
      videoLink: 'a#video-title-link, a#video-title, a.ytd-thumbnail'
    }
  };

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let currentHoveredThumbnail = null;
  let hoverTimeout = null;
  let currentVideoId = null;
  let panelVisible = false;

  // ---------------------------------------------------------------------------
  // SVG Icons
  // ---------------------------------------------------------------------------
  const ICONS = {
    analyze: `<svg viewBox="0 0 24 24"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>`,
    loading: `<svg viewBox="0 0 24 24"><path d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.07-5.07l-2.83 2.83M9.76 14.24l-2.83 2.83m0-10.14l2.83 2.83m4.48 4.48l2.83 2.83"/></svg>`,
    close: `<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
  };

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------
  function extractVideoId(element) {
    // Try to find video ID from various YouTube link patterns
    const links = element.querySelectorAll('a[href*="watch?v="], a[href*="/shorts/"]');
    for (const link of links) {
      const href = link.href;
      const match = href.match(/(?:watch\?v=|\/shorts\/)([a-zA-Z0-9_-]{11})/);
      if (match) return match[1];
    }
    return null;
  }

  function formatTimestamp(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function getVideoUrl(videoId, timestamp = null) {
    let url = `https://www.youtube.com/watch?v=${videoId}`;
    if (timestamp) url += `&t=${Math.floor(timestamp)}s`;
    return url;
  }

  function getThumbnailUrl(videoId) {
    return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
  }

  // ---------------------------------------------------------------------------
  // Cache Badge (visual indicator on analyzed videos)
  // ---------------------------------------------------------------------------
  function addCacheBadge(thumbnail, verdict, videoId) {
    // Remove existing badge if any
    const existing = thumbnail.querySelector('.CLUETUBE-cache-badge');
    if (existing) existing.remove();

    const badge = document.createElement('div');
    badge.className = 'CLUETUBE-cache-badge';
    badge.dataset.verdict = verdict;
    badge.dataset.videoId = videoId;
    badge.title = `CLUETUBE: ${verdict} clickbait`;
    
    // Click badge to show panel with cached data
    badge.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showPanelForVideo(videoId, thumbnail);
    });

    thumbnail.style.position = 'relative';
    thumbnail.appendChild(badge);
  }

  function loadCacheBadges() {
    // Load all cached verdicts and display badges
    chrome.storage.local.get(null, (items) => {
      const thumbnails = document.querySelectorAll(CONFIG.SELECTORS.thumbnail);
      thumbnails.forEach(thumb => {
        const videoId = extractVideoId(thumb.closest(CONFIG.SELECTORS.videoRenderer) || thumb);
        if (videoId && items[videoId]) {
          const cached = items[videoId];
          // Check if cache is still valid (24 hours)
          if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
            addCacheBadge(thumb, cached.data.verdict, videoId);
          }
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Check Button (contextual, appears on hover)
  // ---------------------------------------------------------------------------
  function createCheckButton() {
    const btn = document.createElement('button');
    btn.className = 'CLUETUBE-check-btn';
    btn.innerHTML = `${ICONS.analyze}<span>Check</span>`;
    btn.addEventListener('click', handleCheckClick);
    return btn;
  }

  function showCheckButton(thumbnail) {
    // Don't show if already has a button
    if (thumbnail.querySelector('.CLUETUBE-check-btn')) return;

    const btn = createCheckButton();
    thumbnail.style.position = 'relative';
    thumbnail.appendChild(btn);

    // Trigger visibility after a frame (for animation)
    requestAnimationFrame(() => {
      btn.classList.add('visible');
    });
  }

  function hideCheckButton(thumbnail) {
    const btn = thumbnail.querySelector('.CLUETUBE-check-btn');
    if (btn) {
      btn.classList.remove('visible');
      // Remove after animation
      setTimeout(() => btn.remove(), 200);
    }
  }

  function handleCheckClick(e) {
    e.preventDefault();
    e.stopPropagation();

    const btn = e.currentTarget;
    const thumbnail = btn.closest(CONFIG.SELECTORS.thumbnail);
    const renderer = thumbnail?.closest(CONFIG.SELECTORS.videoRenderer) || thumbnail;
    const videoId = extractVideoId(renderer);

    if (!videoId) {
      console.error('[CLUETUBE] Could not extract video ID');
      return;
    }

    // Show loading state
    btn.classList.add('loading');
    btn.innerHTML = `${ICONS.loading}<span>Analyzing...</span>`;

    showPanelForVideo(videoId, thumbnail);
  }

  // ---------------------------------------------------------------------------
  // Slide-In Panel
  // ---------------------------------------------------------------------------
  function createPanel() {
    // Remove existing panel if any
    const existing = document.querySelector('.CLUETUBE-panel');
    if (existing) existing.remove();

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'CLUETUBE-panel-overlay';
    overlay.addEventListener('click', closePanel);

    // Create panel
    const panel = document.createElement('div');
    panel.className = 'CLUETUBE-panel';
    panel.innerHTML = `
      <div class="CLUETUBE-panel-header">
        <span class="CLUETUBE-panel-title">CLUETUBE Analysis</span>
        <button class="CLUETUBE-panel-close">${ICONS.close}</button>
      </div>
      <div class="CLUETUBE-panel-content">
        <div class="CLUETUBE-panel-loading">
          <div class="CLUETUBE-spinner"></div>
          <span class="CLUETUBE-loading-text">Analyzing video...</span>
        </div>
      </div>
    `;

    panel.querySelector('.CLUETUBE-panel-close').addEventListener('click', closePanel);

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    // Show with animation
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
      panel.classList.add('visible');
    });

    panelVisible = true;
    return panel;
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
    currentVideoId = null;

    // Reset any loading buttons
    document.querySelectorAll('.CLUETUBE-check-btn.loading').forEach(btn => {
      btn.classList.remove('loading');
      btn.innerHTML = `${ICONS.analyze}<span>Check</span>`;
    });
  }

  function renderPanelContent(data, videoId, videoTitle) {
    const panel = document.querySelector('.CLUETUBE-panel');
    if (!panel) return;

    const content = panel.querySelector('.CLUETUBE-panel-content');
    
    // Build takeaways HTML
    const takeawaysHtml = data.keyPoints.map(point => `
      <li class="CLUETUBE-takeaway">
        <span class="CLUETUBE-takeaway-emoji">${point.emoji || '•'}</span>
        <div class="CLUETUBE-takeaway-content">
          <p class="CLUETUBE-takeaway-text">${point.text}</p>
          ${point.timestamp ? `
            <a href="${getVideoUrl(videoId, point.timestamp)}" 
               class="CLUETUBE-takeaway-timestamp" 
               target="_blank">
              ${formatTimestamp(point.timestamp)}
            </a>
          ` : ''}
        </div>
      </li>
    `).join('');

    content.innerHTML = `
      <div class="CLUETUBE-video-preview">
        <img src="${getThumbnailUrl(videoId)}" alt="" class="CLUETUBE-video-thumb">
        <div class="CLUETUBE-video-info">
          <a href="${getVideoUrl(videoId)}" target="_blank" class="CLUETUBE-video-title">
            ${videoTitle || 'Video'}
          </a>
          <span class="CLUETUBE-verdict-badge" data-verdict="${data.verdict}">
            ${data.verdict} Clickbait
          </span>
        </div>
      </div>

      ${data.clickbaitReason ? `
        <p class="CLUETUBE-clickbait-reason">"${data.clickbaitReason}"</p>
      ` : ''}

      <div class="CLUETUBE-section">
        <h3 class="CLUETUBE-section-header">📌 Key Takeaways</h3>
        <ul class="CLUETUBE-takeaways">
          ${takeawaysHtml}
        </ul>
      </div>

      <div class="CLUETUBE-conclusion">
        <div class="CLUETUBE-conclusion-label">So what?</div>
        <p class="CLUETUBE-conclusion-text">${data.conclusion}</p>
      </div>
    `;
  }

  function renderPanelError(message) {
    const panel = document.querySelector('.CLUETUBE-panel');
    if (!panel) return;

    const content = panel.querySelector('.CLUETUBE-panel-content');
    content.innerHTML = `
      <div class="CLUETUBE-panel-error">
        <div class="CLUETUBE-error-icon">⚠️</div>
        <p class="CLUETUBE-error-message">${message}</p>
        <button class="CLUETUBE-retry-btn">Try Again</button>
      </div>
    `;

    content.querySelector('.CLUETUBE-retry-btn').addEventListener('click', () => {
      if (currentVideoId) {
        content.innerHTML = `
          <div class="CLUETUBE-panel-loading">
            <div class="CLUETUBE-spinner"></div>
            <span class="CLUETUBE-loading-text">Analyzing video...</span>
          </div>
        `;
        analyzeVideo(currentVideoId);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Analysis Flow
  // ---------------------------------------------------------------------------
  async function showPanelForVideo(videoId, thumbnail) {
    currentVideoId = videoId;
    
    // Get video title from thumbnail context
    const renderer = thumbnail?.closest(CONFIG.SELECTORS.videoRenderer) || thumbnail;
    const titleEl = renderer?.querySelector('#video-title, #video-title-link, .title');
    const videoTitle = titleEl?.textContent?.trim() || '';

    // Create and show panel
    createPanel();

    // Check cache first
    chrome.storage.local.get(videoId, (items) => {
      if (items[videoId]) {
        const cached = items[videoId];
        if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
          // Use cached data
          renderPanelContent(cached.data, videoId, videoTitle);
          resetCheckButton(thumbnail);
          return;
        }
      }
      // Fetch fresh analysis
      analyzeVideo(videoId, videoTitle, thumbnail);
    });
  }

  async function analyzeVideo(videoId, videoTitle = '', thumbnail = null) {
    try {
      // Request analysis from background script
      const response = await chrome.runtime.sendMessage({
        action: 'analyzeTranscript',
        videoId: videoId
      });

      if (response.success) {
        renderPanelContent(response.data, videoId, videoTitle);
        
        // Add cache badge to thumbnail
        if (thumbnail) {
          addCacheBadge(thumbnail, response.data.verdict, videoId);
        }
      } else {
        renderPanelError(response.error || 'Analysis failed. Please try again.');
      }
    } catch (err) {
      console.error('[CLUETUBE] Analysis error:', err);
      renderPanelError('Could not connect to analysis service.');
    }

    resetCheckButton(thumbnail);
  }

  function resetCheckButton(thumbnail) {
    if (!thumbnail) return;
    const btn = thumbnail.querySelector('.CLUETUBE-check-btn');
    if (btn) {
      btn.classList.remove('loading');
      btn.innerHTML = `${ICONS.analyze}<span>Check</span>`;
    }
  }

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------
  function handleThumbnailMouseEnter(e) {
    const thumbnail = e.target.closest(CONFIG.SELECTORS.thumbnail);
    if (!thumbnail) return;

    currentHoveredThumbnail = thumbnail;

    // Clear any existing timeout
    if (hoverTimeout) clearTimeout(hoverTimeout);

    // Show button after delay
    hoverTimeout = setTimeout(() => {
      if (currentHoveredThumbnail === thumbnail) {
        showCheckButton(thumbnail);
      }
    }, CONFIG.HOVER_DELAY);
  }

  function handleThumbnailMouseLeave(e) {
    const thumbnail = e.target.closest(CONFIG.SELECTORS.thumbnail);
    if (!thumbnail) return;

    // Clear timeout
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }

    // Hide button (unless mouse moved to the button itself)
    const relatedTarget = e.relatedTarget;
    if (!relatedTarget?.closest('.CLUETUBE-check-btn')) {
      hideCheckButton(thumbnail);
    }

    if (currentHoveredThumbnail === thumbnail) {
      currentHoveredThumbnail = null;
    }
  }

  function handleKeyDown(e) {
    // Close panel with Escape
    if (e.key === CONFIG.PANEL_CLOSE_KEY && panelVisible) {
      closePanel();
      return;
    }

    // Analyze with T key while hovering
    if (e.key.toLowerCase() === CONFIG.ANALYZE_KEY && currentHoveredThumbnail && !panelVisible) {
      const renderer = currentHoveredThumbnail.closest(CONFIG.SELECTORS.videoRenderer) || currentHoveredThumbnail;
      const videoId = extractVideoId(renderer);
      if (videoId) {
        showPanelForVideo(videoId, currentHoveredThumbnail);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------
  function init() {
    console.log('[CLUETUBE] Initializing refined UI...');

    // Event delegation for thumbnail hover
    document.addEventListener('mouseenter', handleThumbnailMouseEnter, true);
    document.addEventListener('mouseleave', handleThumbnailMouseLeave, true);

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown);

    // Load cache badges for visible thumbnails
    loadCacheBadges();

    // Observe for dynamically loaded content
    const observer = new MutationObserver((mutations) => {
      let shouldLoadBadges = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
          shouldLoadBadges = true;
          break;
        }
      }
      if (shouldLoadBadges) {
        // Debounce badge loading
        clearTimeout(observer.badgeTimeout);
        observer.badgeTimeout = setTimeout(loadCacheBadges, 500);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Add context menu integration (requires manifest update)
    setupContextMenu();
  }

  function setupContextMenu() {
    // Listen for context menu trigger from background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'analyzeFromContextMenu') {
        const videoId = message.videoId;
        if (videoId) {
          showPanelForVideo(videoId, null);
        }
      }
    });
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
