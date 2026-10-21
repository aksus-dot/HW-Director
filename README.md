[README.md](https://github.com/user-attachments/files/33764840/README.md)
# HW Director: Direct Homework & Essay Generator (Gemini 3.8 Flash)

## Files
| File | What it is |
|---|---|
| `Direct_Homework_Generator.html` | The website |
| `server.js` | Local server that talks to Gemini and keeps your key private |
| `.env` | Your key (you create this from `.env.example`; never share it) |
| `package.json` | Lets hosting sites run the server (`npm start`) |
| `gemini-proxy-worker.js` | Optional: Cloudflare Worker for a public website |

## Answer types
Classic: Essay Writer, Step-by-Step Solver, MDP Project, Direct Q&A, Flashcards / Quiz, Direct Summary.
Study Studio: Research Report (uses Google Search, lists sources), Infographic, Mind Map (click to collapse branches),
Slide Deck (Previous/Next, Listen reads the narration), Data Table, Study Guide, Briefing Doc,
Audio Overview (two-host script; Listen reads it aloud with your browser's voices).
Attach a file or paste a link to give any of them your own source material.

## Run on your computer (needs Node.js 18+ from nodejs.org)
1. Put all files in one folder.
2. Get a key at https://aistudio.google.com ("Get API key").
3. Create a file named `.env` containing one line: `GEMINI_API_KEY=your-key-here`
4. In that folder open Command Prompt (type `cmd` in the folder's address bar) and run: `node server.js`
5. Open http://localhost:3000

## Settings (optional, in `.env`)
- `GEMINI_MODEL=gemini-3.8-flash`
- `GEMINI_THINKING=low` (or `medium` / `high`: smarter but slower and uses more of your limit)

## Troubleshooting
- "GEMINI_API_KEY is missing": `.env` is misnamed, in the wrong folder, or the server wasn't restarted.
- "Free-tier limit reached": wait a minute; the free tier has strict per-minute and daily limits.
- "Gemini is busy": temporary; try again.
