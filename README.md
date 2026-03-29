# CLUETUBE - YouTube Clickbait Detector

A Chrome extension that uses AI to analyze YouTube videos and detect clickbait before you watch them.

## Features

- 🎯 **One-click analysis** - Hover over any YouTube thumbnail and click "Check"
- 🤖 **AI-powered verdicts** - Uses Claude, GPT, or Gemini to analyze video content
- 📝 **Instant summaries** - Get a 2-3 sentence summary of what the video actually covers
- ⚡ **Smart caching** - Results are cached for 24 hours to save API costs
- 🔒 **Privacy-first** - Your API key stays local, no backend servers

## Installation

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `CLUETUBE-extension` folder
6. Click the CLUETUBE icon in your toolbar to configure your API key

### Getting an API Key

Choose one of the following providers:

**Anthropic (Claude) - Recommended**
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up and add credits
3. Create an API key in Settings → API Keys

**OpenAI (GPT)**
1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up and add credits
3. Create an API key in API Keys section

**Google (Gemini)**
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Sign in with Google
3. Get an API key from the API Keys section

## Usage

1. Navigate to YouTube (youtube.com)
2. Hover over any video thumbnail
3. Click the "Check" button that appears
4. Wait 2-3 seconds for the analysis
5. View the verdict:
   - 🟢 **LOW** - Title accurately represents content
   - 🟡 **MEDIUM** - Some exaggeration but core content matches
   - 🔴 **HIGH** - Significant mismatch (clickbait!)

## Verdict Categories

| Verdict | Meaning |
|---------|---------|
| 🟢 LOW | The video delivers what the title promises. Safe to watch. |
| 🟡 MEDIUM | Some sensationalism, but the core premise is delivered. |
| 🔴 HIGH | Classic clickbait. Title promises something the video doesn't deliver. |

## Cost Estimation

Each video analysis costs approximately:
- **Claude Sonnet**: ~$0.003 per check
- **GPT-4o-mini**: ~$0.001 per check
- **Gemini Flash**: ~$0.0005 per check

Results are cached for 24 hours, so re-checking the same video is free.

## Troubleshooting

**"No captions available"**
- Some videos don't have transcripts. The extension can only analyze videos with captions enabled.

**"API error"**
- Check that your API key is correct
- Ensure you have credits/quota remaining with your provider
- Verify the model name is valid

**Button not appearing**
- Refresh the YouTube page
- Check if the extension is enabled in `chrome://extensions`
- Some YouTube layouts (like Shorts) may not be fully supported

## Privacy & Security

- Your API key is stored locally using Chrome's secure storage
- No data is sent to any servers except the LLM provider you choose
- Video analysis is performed client-side
- Transcripts are fetched directly from YouTube (publicly available data)

## Technical Stack

- **Manifest V3** Chrome Extension
- **Content Script** for YouTube UI injection
- **Service Worker** for background API calls
- **YouTube Internal API** for transcript fetching
- **Chrome Storage API** for settings and caching

## File Structure

```
CLUETUBE-extension/
├── manifest.json           # Extension configuration
├── background.js           # Service worker (API calls, caching)
├── content/
│   ├── content.js          # YouTube UI injection
│   └── content.css         # Injected styles
├── popup/
│   ├── popup.html          # Settings UI
│   ├── popup.js            # Settings logic
│   └── popup.css           # Settings styles
└── assets/
    └── icons/              # Extension icons
```

## Contributing

Contributions are welcome! Some ideas for improvement:

- [ ] Batch analysis of multiple videos
- [ ] Browser action badge showing clickbait score
- [ ] Export/import settings
- [ ] Firefox support
- [ ] Clickbait blocking mode

## License

MIT License - feel free to use and modify.

---

**Disclaimer**: This tool provides AI-generated analysis and should be used as a guide, not absolute truth. The AI may occasionally misclassify videos.
