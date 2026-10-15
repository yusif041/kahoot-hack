const MAX_IMAGE_LENGTH = 5_000_000;
const MAX_REQUEST_LENGTH = 6_000_000;
const MAX_PROMPT_LENGTH = 2_000;
const MODEL_NAME = "qwen/qwen3.8-27b";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

async function handleGenerate(request, env) {
  if (!env.GROQ_API_KEY || !env.TURNSTILE_SECRET_KEY) {
    return jsonResponse({ error: "Server setup is incomplete. Configure GROQ_API_KEY and TURNSTILE_SECRET_KEY." }, 503);
  }

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_REQUEST_LENGTH) {
    return jsonResponse({ error: "The captured image is too large. Try sharing a smaller screen or window." }, 413);
  }

  let payload;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_LENGTH) {
      return jsonResponse({ error: "The captured image is too large. Try sharing a smaller screen or window." }, 413);
    }
    payload = JSON.parse(body);
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  const { image, prompt, turnstileToken } = payload || {};
  if (typeof image !== "string" || image.length === 0 || image.length > MAX_IMAGE_LENGTH
      || image.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(image)) {
    return jsonResponse({ error: "The captured image is missing or invalid." }, 400);
  }
  if (typeof prompt !== "string" || prompt.trim().length === 0 || prompt.length > MAX_PROMPT_LENGTH) {
    return jsonResponse({ error: "Prompt must contain 1 to 2,000 characters." }, 400);
  }
  if (typeof turnstileToken !== "string" || turnstileToken.length === 0 || turnstileToken.length > 2_048) {
    return jsonResponse({ error: "Complete the Cloudflare security check and try again." }, 400);
  }

  const verificationForm = new FormData();
  verificationForm.set("secret", env.TURNSTILE_SECRET_KEY);
  verificationForm.set("response", turnstileToken);
  const clientIp = request.headers.get("CF-Connecting-IP");
  if (clientIp) verificationForm.set("remoteip", clientIp);

  let verification;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: verificationForm
    });
    if (!response.ok) {
      return jsonResponse({ error: "Could not verify the security check. Please try again." }, 502);
    }
    verification = await response.json();
  } catch {
    return jsonResponse({ error: "Could not verify the security check. Please try again." }, 502);
  }

  if (!verification.success || verification.hostname !== new URL(request.url).hostname) {
    return jsonResponse({ error: "Security check failed or expired. Complete it again and retry." }, 403);
  }

  let groqResponse;
  try {
    groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt.trim() },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image}` } }
          ]
        }]
      })
    });
  } catch {
    return jsonResponse({ error: "Could not connect to Groq. Please try again." }, 502);
  }

  let groqData;
  try {
    groqData = await groqResponse.json();
  } catch {
    return jsonResponse({ error: "Groq returned an invalid response." }, 502);
  }

  if (!groqResponse.ok) {
    return jsonResponse(
      { error: groqData.error?.message || "Groq could not process this capture." },
      groqResponse.status === 429 ? 429 : 502
    );
  }

  const text = groqData.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    return jsonResponse({ error: "Groq returned no text for this capture." }, 502);
  }
  return jsonResponse({ text: text.trim() });
}

export async function onRequest(context) {
  const { request, env } = context;
  const { pathname } = new URL(request.url);

  if (pathname === "/api/config") {
    if (request.method !== "GET") {
      return jsonResponse({ error: "Method not allowed." }, 405);
    }
    if (!env.TURNSTILE_SITE_KEY) {
      return jsonResponse({ error: "Server setup is incomplete. Configure TURNSTILE_SITE_KEY." }, 503);
    }
    return jsonResponse({ turnstileSiteKey: env.TURNSTILE_SITE_KEY });
  }

  if (pathname === "/api/generate") {
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed." }, 405);
    }
    return handleGenerate(request, env);
  }

  return context.next();
}
