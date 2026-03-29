/* =============================================================================
   CLUETUBE - BACKGROUND SERVICE WORKER (Context Menu Addition)
   Add this to your existing background.js
============================================================================= */

// ---------------------------------------------------------------------------
// Context Menu Setup
// ---------------------------------------------------------------------------
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'CLUETUBE-analyze',
    title: 'Analyze with CLUETUBE',
    contexts: ['link'],
    targetUrlPatterns: [
      'https://www.youtube.com/watch*',
      'https://youtube.com/watch*',
      'https://www.youtube.com/shorts/*',
      'https://youtu.be/*'
    ]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'CLUETUBE-analyze') {
    const url = info.linkUrl;
    const videoId = extractVideoIdFromUrl(url);
    
    if (videoId && tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'analyzeFromContextMenu',
        videoId: videoId
      });
    }
  }
});

function extractVideoIdFromUrl(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Your existing message handlers and API logic remain unchanged below...
// ---------------------------------------------------------------------------
