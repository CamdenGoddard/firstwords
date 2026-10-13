# Firstwords

Interview practice in the browser. Type the role you're interviewing for (and a little about yourself if you want), answer three questions, and get feedback on each answer: what worked, what was missing, and how to make it better.

Live: https://thefirstwords.netlify.app

## How it works

The frontend is one `index.html` with plain JS. It never calls the Anthropic API directly. It sends the role, question and answer to a Netlify function (`netlify/functions/ask.mjs`), which builds the prompt, adds the API key from an environment variable, and calls Claude.

The function also caps the length of every input and is rate limited to 12 requests per IP every 3 minutes, so nobody can use it as a free proxy on my key.

## A problem I ran into

My first deploy looked fine, but the AI parts kept showing placeholder content. I had dragged the files into Netlify's deploy page loose, and Netlify only picks up a function if it's in a `netlify/functions/` folder. There was no error. I only figured it out when I noticed the Functions tab was empty. Now I test the endpoint right after every deploy.

The first version also had no rate limit and let the browser send any prompt it wanted. I moved the prompts to the server and added the limit later, but next time I'd do that from the start.

## Running it yourself

1. Clone the repo and connect it to Netlify
2. Add an `ANTHROPIC_API_KEY` environment variable in the site settings
3. Deploy

## Ideas for later

- Pick how many questions you get
- Save past sessions to track improvement
- Voice answers
