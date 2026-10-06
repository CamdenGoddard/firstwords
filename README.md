# Firstwords — Interview Practice

A small web app that helps people practice for job interviews. You enter the role you're interviewing for and a bit about your background, and it generates realistic interview questions, lets you answer them, and gives you specific, honest feedback on each answer — what's working, what's missing, and a concrete way to improve it.

**Live site:** https://thefirstwords.netlify.app

## How it works

- **Frontend** (`index.html`): A single self-contained HTML/CSS/JS page. No frameworks — just vanilla JS, so it's easy to read end-to-end. It collects the role and background, requests interview questions, displays them one at a time, collects answers, and renders feedback.
- **Backend** (`netlify/functions/ask.mjs`): A small serverless function deployed on Netlify at `/api/ask`. The frontend never calls the Anthropic API directly. It sends structured fields (role, background, question, answer), and the function builds the prompt, adds the API key (stored as an environment variable, never in code), and forwards the request to Claude.
- **Abuse protection:** prompts are built server-side so the endpoint can't be used as a general Claude proxy, every input is length-capped, and Netlify's code-based rate limiting allows 12 requests per IP every 3 minutes (one session is 4 requests).
- **Config** (`netlify.toml`): Tells Netlify where to find the function so it actually gets deployed alongside the site.

```
User's browser  →  index.html  →  /api/ask  →  Anthropic API (Claude)
                  (no API key)      (API key lives here,
                                      server-side only)
```

## A real problem I ran into (and what I'd do differently)

My first deploy worked for the frontend but the AI features silently fell back to placeholder content. I'd assumed dragging the three files into Netlify's deploy zone was enough — but Netlify only recognizes a serverless function if it's nested in a specific folder structure (`netlify/functions/ask.js`), and my files had landed flat/loose instead. There was no error message pointing at this directly; I had to check whether a "Functions" tab even existed in the dashboard to figure out the function never deployed at all.

If I were redoing this, I'd write a small deploy-check script up front (or just test the function endpoint immediately after every deploy) rather than assuming a successful-looking deploy meant everything was wired up correctly. I also shipped the first version without rate limiting, and the function accepted any prompt from the browser, so anyone could have used it as a free proxy to Claude on my API key. I've since moved prompt construction to the server and added per-IP rate limiting; next time I'd build those in from day one.

## Running it yourself

1. Clone this repo
2. Get an API key from [console.anthropic.com](https://console.anthropic.com)
3. Deploy to Netlify (drag the folder onto [app.netlify.com/drop](https://app.netlify.com/drop), or connect this repo via Netlify's GitHub integration)
4. In your Netlify site settings, add an environment variable: `ANTHROPIC_API_KEY` = your key
5. Redeploy so the function picks up the variable

## What's next

- More question variety (currently 3 per session, could expand or let the user choose)
- Saving session history so someone can track improvement over multiple practice rounds
- Voice input, so practice feels closer to an actual spoken interview

## Tech

Vanilla HTML/CSS/JS frontend, Netlify Functions (Node.js) backend, Anthropic API (Claude) for question generation and feedback.
