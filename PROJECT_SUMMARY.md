# CLUETUBE - YouTube Clickbait Detector

> AI-powered Chrome extension that analyzes YouTube videos to detect clickbait and extract key takeaways before you watch.

---

## 🎯 Core Idea

CLUETUBE solves the problem of wasted time on YouTube. It provides:

1. **Auto-Analysis on Watch Pages** - Opens any YouTube video and analysis appears instantly in the sidebar
2. **Key Takeaways** - Timestamped bullet points linking directly to relevant moments
3. **Best Comment** - AI-selected most insightful comment that adds value beyond the video
4. **Gemini Integration** - One-click "Summarise" and "Analyse" buttons to continue in Gemini

**The value proposition**: Know what's in a video before committing your time.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USER'S BROWSER                                 │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐   │
│  │   Content Script │───▶│  Background.js   │───▶│   Popup (UI)     │   │
│  │   (YouTube DOM)  │    │  (Service Worker)│    │   (Settings)     │   │
│  └────────┬─────────┘    └────────┬─────────┘    └──────────────────┘   │
│           │                       │                                      │
│           │ Check Button          │ API Calls                           │
│           ▼                       ▼                                      │
│  ┌──────────────────┐    ┌──────────────────┐                           │
│  │  Verdict Overlay │    │  Chrome Storage  │                           │
│  │  (Modal Popup)   │    │  (Cache + Keys)  │                           │
│  └──────────────────┘    └──────────────────┘                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP (port 5000)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       PYTHON BACKEND (server.py)                        │
│  ┌──────────────────┐    ┌──────────────────┐                           │
│  │  Flask Server    │───▶│ youtube-transcript│                          │
│  │  /get_transcript │    │      -api         │                          │
│  └──────────────────┘    └──────────────────┘                           │
│           │                       │                                      │
│           │ Optional: cookies.txt │ YouTube                             │
│           ▼                       ▼                                      │
│  ┌──────────────────┐    ┌──────────────────┐                           │
│  │  Session w/      │    │  Transcript JSON │                           │
│  │  User-Agent      │    │  with timestamps │                           │
│  └──────────────────┘    └──────────────────┘                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
            ┌───────────────────────┴───────────────────────┐
            ▼                                               ▼
┌───────────────────────┐                     ┌───────────────────────┐
│   Gemini Flash 2.0    │                     │  OpenAI / Anthropic   │
│   (Default Provider)  │                     │  (Optional Providers) │
└───────────────────────┘                     └───────────────────────┘
```

---

## 📁 File Structure

```
CLUETUBE-extension/
├── manifest.json          # Chrome MV3 config
├── background.js          # Service worker (API calls, caching)
├── server.py              # Python backend for transcript fetching
├── cookies.txt            # Optional: YouTube auth cookies
├── README.md              # Basic readme
│
├── popup/                 # Settings UI
│   ├── popup.html         # Settings form
│   ├── popup.css          # Dark theme styling
│   └── popup.js           # Provider/model selection, storage
│
├── content/               # YouTube page integration
│   ├── content.js         # DOM scanning, button injection, overlays
│   └── content.css        # Check button & verdict modal styles
│
└── assets/
    └── icons/             # Extension icons (16, 48, 128px)
```

---

## 🔄 Data Flow

### 1. User Clicks "Check" Button
```
content.js → chrome.runtime.sendMessage({action: 'analyzeTranscript'})
```

### 2. Background Worker Handles Request
```javascript
// background.js flow:
1. Check cache (chrome.storage.local) → Return if fresh
2. Fetch transcript from Python server → http://127.0.0.1:5000/get_transcript
3. Send to Gemini API with structured prompt
4. Parse JSON response
5. Cache result (24h TTL)
6. Return to content script
```

### 3. Python Server Fetches Transcript
```python
# server.py flow:
1. Receive GET /get_transcript?videoId=xxx
2. Create session with optional cookies
3. Call YouTubeTranscriptApi.fetch(video_id)
4. Format with timestamps: "[M:SS] text"
5. Return JSON: {success, transcript, timedTranscript}
```

### 4. Content Script Displays Result
```
content.js → createInlineBox(data) / showPanel(data) → Inline sidebar or slide panel
```

---

## 🎨 UI Design

### Watch Page (Inline Box)
- **Position**: Top of sidebar (above recommendations)
- **Behavior**: Auto-analyzes on page load, shows cached results instantly
- **Components**:
  - Key takeaways with timestamp links
  - Best comment with "why it adds value"
  - Gemini buttons (Summarise / Analyse)

### Browse Mode (Check Button)
- **Position**: Top-left of every thumbnail
- **Style**: Blue rounded button with checkmark icon
- **Behavior**: Click to open slide-in panel

### Slide Panel
- **Layout**: 420px panel slides from right, overlay behind
- **Components**:
  - Video thumbnail + title
  - Time saved indicator ("10 min → 30 sec read")
  - Key takeaways with timestamps
  - Best comment
  - Gemini buttons
  - Close with × or Escape key

### Popup Settings
- Dark theme matching YouTube dark mode
- Provider: Google Gemini (default)
- Model selection
- API key input with visibility toggle
- Cache count display and clear button

---

## ⚙️ Technical Specifications

### Chrome Extension
| Spec | Value |
|------|-------|
| Manifest Version | 3 |
| Version | 4.2.0 |
| Permissions | `storage`, `activeTab`, `contextMenus` |
| Host Permissions | YouTube, Gemini API, localhost |
| Content Script | Runs at `document_idle` |

### AI Integration
| Provider | Default Model |
|----------|---------------|
| Google Gemini | `gemini-2.0-flash` |
| OpenAI | `gpt-4o-mini` |
| Anthropic | `claude-3-haiku` |

### Prompt Engineering
The AI prompt requests structured JSON with:
- `keyPoints[]`: Objects with `text`, `timestamp` (seconds), `emoji`
- `core_insight`: The actual knowledge stated as fact (1-2 sentences)
- `bestComment`: AI-selected comment with `comment` and `why` fields

### Caching
- Storage: `chrome.storage.local`
- TTL: 24 hours
- Key: `videoId` → `{data, timestamp}`

### Python Backend
| Spec | Value |
|------|-------|
| Framework | Flask |
| Port | 5000 |
| CORS | Enabled |
| Transcript Source | `youtube-transcript-api` |
| Languages | `en`, `en-US`, `en-GB` |

---

## 🚀 Setup & Usage

### 1. Start Python Backend
```bash
cd CLUETUBE-extension
python server.py
```
Server runs at `http://127.0.0.1:5000`

### 2. Load Extension in Chrome
1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `CLUETUBE-extension` folder

### 3. Configure API Key
1. Click extension icon in toolbar
2. Select provider (default: Google Gemini)
3. Paste API key
4. Click "Save Settings"

### 4. Use on YouTube
1. Go to `youtube.com`
2. Hover over any video thumbnail
3. Click the blue "Check" button
4. View analysis in the modal overlay

---

## 📊 Key Features Summary

| Feature | Description |
|---------|-------------|
| 🚀 Auto-Analysis | Watch pages auto-analyze on load |
| 📌 Key Takeaways | 4-6 timestamped points with semantic emojis |
| 🔗 Timestamp Links | Click to jump directly to video moments |
| � Best Comment | AI-selected insightful comment |
| ✨ Gemini Buttons | One-click "Summarise" / "Analyse" in Gemini |
| ⚡ Caching | 24-hour cache, instant on revisit |
| 📵 Clear Errors | Specific messages for missing transcripts |
| 🌙 Dark Theme | Matches YouTube's dark mode aesthetic |

---

## 🔧 Dependencies

### Python
```
flask
flask-cors
youtube-transcript-api
requests
```

### Browser
- Chrome 88+ (Manifest V3 support)
- Active Gemini/OpenAI/Anthropic API key

---

*Last Updated: January 2026 | Version 4.2.0*
