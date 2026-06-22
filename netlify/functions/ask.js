// netlify/functions/ask.js
//
// This is a small serverless function. It runs on Netlify's servers,
// not in the browser — so the API key stays hidden from anyone visiting
// the site. The frontend (index.html) sends it a prompt, this function
// adds the secret key and forwards the request to Anthropic, then
// sends the answer back.

exports.handler = async function (event) {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const { prompt } = JSON.parse(event.body);

    if (!prompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing 'prompt' in request body" })
      };
    }

    // The key is read from an environment variable set in the Netlify
    // dashboard — it is never written in this file or sent to the browser.
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Server is missing ANTHROPIC_API_KEY. Add it in Netlify > Site configuration > Environment variables."
        })
      };
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: "Anthropic API error", details: errText })
      };
    }

    const data = await response.json();
    const textBlock = data.content.find((b) => b.type === "text");

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: textBlock ? textBlock.text : "" })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Function error", details: err.message })
    };
  }
};
