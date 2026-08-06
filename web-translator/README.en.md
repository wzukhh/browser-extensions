# Selection Translator - DeepSeek Edition

> English | [简体中文](./README.md)

Selection-based translation browser extension. Select a word, sentence or paragraph on any page and a **floating "Translate" button appears — translation only happens when you click it**, never popping up on its own.

**Core design: "detailed but not verbose"** — the model itself decides which granularity the selection belongs to:

| Granularity | Deciding factor | Displayed content |
| --- | --- | --- |
| Word | Words needing dictionary-grade explanation (model decides) | Phonetics, senses with parts of speech (≤3), example sentences, roots/affixes, memory tips |
| Phrase | Fixed collocations / idioms / common phrases (model decides) | Overall meaning, usage notes, examples, usage scenarios |
| Sentence | Complete sentences / clauses / multi-sentence runs / whole paragraphs (model decides) | Full translation, grammar annotations, unknown words (with phonetics), **in-sentence phrase/collocation explanations**, **necessary background knowledge** (memes / allusions / special meanings), tone |

Granularity is not decided by word count: a single unified prompt lets the model judge by semantics and output JSON with a `type` field, which the frontend renders.

The deeper word/phrase content (roots, examples, etc.) lives in a "More" section — **expanded by default** and collapsible — so cards stay tight but informative. Word examples come with Chinese translations; explained words are bolded.

## Tech stack

- Manifest V3, vanilla JS (bundled with esbuild, no runtime dependencies)
- Translation engine: DeepSeek API (`response_format: json_object`, fixed JSON output structure)
- Cache: `chrome.storage.session` session cache (valid for one browser session, cleared when the browser closes; 1000-entry LRU cap)
- UI: Shadow DOM floating card, styles isolated from the page

## Installation & usage

```bash
npm install
npm run build        # output in extension/
npm run watch        # dev mode
```

1. Build, then open `chrome://extensions` (or `edge://extensions`)
2. Enable "Developer mode" → "Load unpacked" → select the `extension/` directory
3. Click the toolbar icon and enter a DeepSeek API Key (get one at <https://platform.deepseek.com/api_keys>)
4. The model dropdown fetches the latest list from the `/models` API automatically (new DeepSeek models work without code changes); falls back to a default option if fetching fails
5. Select text on any page → click the floating "📖 Translate" button

## Shortcuts / interaction

- Select text → "Translate" button floats **directly above the selection** (**no automatic translation**)
- Click the button → translation card appears (deep content expanded by default)
- Close: click outside the card / ✕ / `Esc` (**scrolling the page does not close the card** — it floats in the viewport as you read)
- ✋ Drag the card **by its top edge** → move it freely (once moved, it stops auto-positioning; new selections re-attach it)
- 📌 Pin the card: clicking outside no longer closes it — keep browsing with it on screen
- 🖊 The card footer shows "Author wzukhh | <wzukhh@163.com>" on the right (can be disabled in settings)
- ⧉ Copy the **entire card's translation content as Markdown** (`#` headings + bold labels + lists/blockquotes; the `**word**` in examples is Markdown bold — paste straight into Obsidian / Typora or similar notes apps)

## Security notes

- The API Key is stored **in plain text** in browser local storage (`chrome.storage.local`); it does not sync across devices with your account. Processes running as the same OS user, or system backups, may be able to read that file — don't use this extension on machines you don't trust, and rotate the Key regularly at [platform.deepseek.com](https://platform.deepseek.com/api_keys)
- The Key is only ever sent to the API base URL you enter on the settings page (default `https://api.deepseek.com`); **changing baseUrl is equivalent to handing your Key to that address** — only use trusted OpenAI-compatible endpoints
- The extension never sends your Key to any other third party

## Directory structure

```
src/
├── manifest.json          # MV3 manifest
├── content/content.js     # Selection listener + popup lifecycle
├── background/background.js  # Cache + API calls (service worker)
├── popup/                 # Settings page
└── lib/
    ├── granularity.js     # Text granularity heuristics (cache key & type fallback only)
    ├── prompt-builder.js  # ★ single big unified prompt: model judges granularity + JSON fallback (core)
    ├── api.js             # DeepSeek calls (translate + listModels)
    ├── cache.js           # Session cache (chrome.storage.session + 1000-entry LRU)
    └── renderer.js        # Shadow DOM card + translate button rendering
```

## Roadmap

- [ ] Hover lookup (small card on hover)
- [ ] Vocabulary book / history
- [ ] Full-paragraph translation shortcut
- [ ] More providers (Gemini / OpenAI-compatible interfaces are already abstracted — just change baseUrl)
- [ ] Bilingual full-page translation

---

This extension was developed with the assistance of the pi agent + DeepSeek V4 Flash (0731).
