# Changelog

All notable changes to CLUETUBE are documented here.

---

## [4.2.0] - 2026-01-17

### Changed
- **Gemini Button UX**: Refined "Deep Dive" → "Gemini" button behavior
  - Delayed open for Gemini (copies prompt first, then opens after brief delay)
  - "Copied" state feedback directly on button with distinct styling
  - Removed subtext hint for cleaner UI

---

## [4.1.0] - 2026-01-16

### Added
- **Auto-Analysis on Watch Page**: Videos now automatically analyzed when page loads
- **Inline Results Display**: Analysis results shown directly in sidebar box (no separate slide panel)
- **Loading States**: Spinner and loading indicator within sidebar during analysis
- **Error Handling**: Error states displayed inline within sidebar box

### Changed
- Cached analysis data now displays inline on page load
- Eliminated need for manual "Check" button click on watch pages

---

## [4.0.1] - 2026-01-15

### Changed
- **Popup Refinements**:
  - Removed conclusion title and sentiment badge
  - Kept conclusion text with border styling
  - Increased close button size for easier interaction
  - Fixed hover behavior on video title (no longer highlights/opens link when hovering close button)

---

## [4.0.0] - 2026-01-16

### Added
- **Hybrid UI**: Best of both worlds
  - v2.0.0 button injection (reliable, always visible "Check" button)
  - V4 slide panel (non-blocking, slides from right)
  - Cache badges (🟢🟡🔴 replace buttons after analysis)
  - Keyboard: `Escape` to close panel
  - Context menu: Right-click → "Analyze with CLUETUBE"

### Technical
- `setInterval` scanning every 1 second (proven reliable)
- CSS variables for theming
- Animated slide panel transitions

---

## [3.2.0] - 2026-01-16

### Reverted
- Restored **v2.0.0 button technique** - always-visible blue "Check" button with text
- Uses `setInterval` scanning (1 second) for reliable button injection
- Full-screen modal overlay for results

### Why
V4's minimal icon approach had visibility issues across different YouTube layouts.
The original v2.0.0 technique is proven and reliable.

---

## [3.1.0] - 2026-01-16

### Changed
- **Minimal Icon**: Replaced hover-based button with always-visible 24px circular icon
- Icon appears at 60% opacity, brightens on hover
- No hover delay timing - simpler, more reliable
- After analysis, icon is replaced by colored cache badge

### Why This Change
Hover-based buttons were difficult to implement reliably across YouTube's dynamic DOM.
The minimal icon approach is simpler and always accessible.

### Files Changed
- `content/content.js` - Simplified injection via MutationObserver
- `content/content.css` - Minimal icon styling (24px circle)

---

## [3.0.0] - 2026-01-16

### Added
- **Slide-in Panel**: Results now display in a 420px side panel instead of full-screen modal
- **Hover-based Check Button**: Button appears after 500ms hover delay, disappears when mouse leaves
- **Cache Badges**: Colored dots on analyzed thumbnails (🟢 LOW, 🟡 MEDIUM, 🔴 HIGH)
- **Keyboard Shortcuts**: Press `T` to analyze, `Escape` to close panel
- **Context Menu**: Right-click any YouTube link → "Analyze with CLUETUBE"
- **CSS Variables**: Theming system for consistent styling

### Changed
- UI is now non-blocking - YouTube remains visible while viewing results
- Check button no longer permanently visible on all thumbnails
- Updated description: "Know what's in a video before you commit your time."

### Files Changed
- `manifest.json` - Added `contextMenus` permission, version bump
- `background.js` - Added context menu handlers
- `content/content.js` - Complete rewrite for new UI paradigm
- `content/content.css` - Complete rewrite with CSS variables and slide panel

---

## [2.0.0] - 2026-01-15

### Added
- Python backend server (`server.py`) for robust transcript fetching
- `youtube-transcript-api` integration with cookie support
- Timestamped transcripts for accurate video referencing
- Multi-provider support: Gemini, OpenAI, Anthropic
- 24-hour response caching

### Features
- Full-screen modal overlay for results
- Always-visible "Check" button on all thumbnails
- Key takeaways with timestamp links
- "So What?" conclusion section
- Clickbait verdict: LOW / MEDIUM / HIGH

### Files
- Backup available at `versions/v2.0.0/`

---

## Rollback Instructions

### Restore v2.0.0
```powershell
cd CLUETUBE-extension
Copy-Item -Recurse -Force versions\v2.0.0\* .
```
Then reload extension at `chrome://extensions`.
