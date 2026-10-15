const MAX_IMAGE_LENGTH = 5_000_000;
const MAX_REQUEST_LENGTH = 6_000_000;
const MAX_PROMPT_LENGTH = 2_000;
const MODEL_NAME = "qwen/qwen3.8-27b";
let nextGroqKeyIndex = 0;

const PAGE = String.raw`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>Groq Tab Assistant</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: Inter, "Segoe UI", sans-serif;
      font-synthesis: none;
      text-rendering: optimizeLegibility;
      --page: #0b1020;
      --panel: #121a2b;
      --field: #0b1220;
      --border: #263249;
      --text: #edf2fb;
      --muted: #9aa9c0;
      --accent: #5793ff;
    }
    * { box-sizing: border-box; }
    body {
      min-width: 320px;
      min-height: 100vh;
      margin: 0;
      padding: 48px 20px;
      background: radial-gradient(ellipse at 50% -20%, rgba(55,105,190,.2), transparent 55%), var(--page);
      color: var(--text);
    }
    button, textarea { font: inherit; }
    .app { width: min(100%, 920px); margin: 0 auto; }
    .page-header { margin-bottom: 28px; text-align: center; }
    .eyebrow { margin: 0 0 10px; color: #78a8ff; font-size: .72rem; font-weight: 750; letter-spacing: .16em; }
    h1 { margin: 0; font-size: clamp(2rem, 6vw, 2.8rem); letter-spacing: -.045em; }
    .subtitle { margin: 10px 0 0; color: var(--muted); font-size: .98rem; }
    .panel {
      min-width: 0;
      padding: 22px;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: rgba(18,26,43,.94);
      box-shadow: 0 16px 45px rgba(0,0,0,.14);
    }
    .controls { display: grid; gap: 20px; }
    .section-title { margin: 0; color: #d8e2f2; font-size: .78rem; font-weight: 750; letter-spacing: .1em; text-transform: uppercase; }
    .field { display: grid; gap: 8px; }
    .field label, .field-label { color: #c3cfe0; font-size: .88rem; font-weight: 650; }
    textarea {
      width: 100%;
      min-height: 92px;
      resize: vertical;
      padding: 12px 14px;
      border: 1px solid var(--border);
      border-radius: 10px;
      outline: none;
      background: var(--field);
      color: var(--text);
      line-height: 1.5;
    }
    textarea::placeholder { color: #718098; }
    textarea:focus-visible { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(87,147,255,.18); }
    .turnstile-widget { min-height: 65px; }
    .field-help { margin: -3px 0 0; color: var(--muted); font-size: .78rem; }
    .button-row { display: flex; gap: 12px; }
    .button {
      min-height: 44px;
      padding: 0 16px;
      border: 1px solid transparent;
      border-radius: 10px;
      color: #fff;
      font-weight: 700;
      cursor: pointer;
      transition: background-color 120ms ease, border-color 120ms ease, transform 120ms ease;
    }
    .button:not(:disabled):active { transform: translateY(1px); }
    .button:focus-visible { outline: 3px solid rgba(120,168,255,.65); outline-offset: 2px; }
    .button-primary { flex: 1; background: #2563d9; }
    .button-primary:not(:disabled):hover { background: #3476ee; }
    .button-secondary { flex: 1; border-color: var(--border); background: #1a263b; }
    .button-secondary:not(:disabled):hover { background: #243552; }
    .button:disabled { color: #748198; cursor: not-allowed; background: #1a2232; }
    .results { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 18px; margin-top: 18px; }
    .result-panel { display: flex; min-height: 310px; flex-direction: column; gap: 14px; }
    .preview, .answer {
      flex: 1;
      min-height: 230px;
      overflow: auto;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--field);
    }
    .preview { display: grid; place-items: center; padding: 10px; }
    .preview video, .preview img { display: block; max-width: 100%; max-height: 420px; object-fit: contain; }
    .preview [hidden] { display: none; }
    .placeholder { color: #7c8ba2; font-size: .9rem; }
    .answer { padding: 16px; color: #d8e2f2; font-size: .92rem; line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; }
    @media (max-width: 680px) {
      body { padding: 30px 14px; }
      .panel { padding: 17px; }
      .results { grid-template-columns: 1fr; }
      .result-panel { min-height: 280px; }
    }
    @media (max-width: 460px) { .button-row { flex-direction: column; } }
  </style>
</head>
<body>
  <main class="app">
    <header class="page-header">
      <p class="eyebrow">SCREEN ASSISTANT</p>
      <h1>Groq Tab Assistant</h1>
      <p class="subtitle">Capture a browser tab and ask Groq about what’s on screen.</p>
    </header>
    <section class="panel controls" aria-labelledby="controls-title">
      <h2 id="controls-title" class="section-title">Set up your request</h2>
      <div class="field">
        <label for="userPrompt">Prompt</label>
        <textarea id="userPrompt" maxlength="2000" rows="3" placeholder="What would you like to know about this tab?" value="Only tell me exactly answers in this picture."></textarea>
      </div>
      <div class="field">
        <span class="field-label">Abuse protection</span>
        <div id="turnstileWidget" class="turnstile-widget"></div>
        <p class="field-help">Complete the check before sending a screenshot.</p>
      </div>
      <div class="button-row">
        <button id="selectBtn" class="button button-primary" type="button">Choose browser tab</button>
        <button id="resendBtn" class="button button-secondary" type="button" disabled>Capture and ask again</button>
      </div>
    </section>
    <section class="results" aria-label="Capture and answer">
      <article class="panel result-panel">
        <h2 class="section-title">Captured frame</h2>
        <div class="preview">
          <video id="video" autoplay muted playsinline hidden></video>
          <img id="previewImg" alt="Preview of the captured browser tab" hidden>
          <p id="previewPlaceholder" class="placeholder">No capture yet</p>
        </div>
      </article>
      <article class="panel result-panel">
        <h2 class="section-title">Groq answer</h2>
        <div id="outputBox" class="answer" role="status" aria-live="polite">Loading Cloudflare settings…</div>
      </article>
    </section>
  </main>
  <canvas id="canvas" hidden></canvas>
  <script>
    (() => {
      let activeStream = null;
      let turnstileWidgetId = null;
      let turnstileToken = "";

      const element = (id) => document.getElementById(id);
      const output = () => element("outputBox");

      element("selectBtn").addEventListener("click", selectAndCapture);
      element("resendBtn").addEventListener("click", captureCurrentFrame);

      window.initializeAssistant = async () => {
        try {
          const response = await fetch("/api/config", { cache: "no-store" });
          const config = await response.json();
          if (!response.ok || !config.turnstileSiteKey) {
            throw new Error(config.error || "Could not load Cloudflare Turnstile settings.");
          }
          if (!window.turnstile) throw new Error("Turnstile did not load. Check your connection or content blocker.");
          turnstileWidgetId = window.turnstile.render("#turnstileWidget", {
            sitekey: config.turnstileSiteKey,
            callback: (token) => { turnstileToken = token; },
            "expired-callback": () => { turnstileToken = ""; },
            "error-callback": () => {
              turnstileToken = "";
              output().textContent = "Turnstile could not connect. Check that this hostname is allowed for the site key.";
            }
          });
          output().textContent = "Complete the security check, enter a prompt, then choose a browser tab.";
        } catch (error) {
          output().textContent = error.message || "Could not initialize the app.";
        }
      };

      async function selectAndCapture() {
        if (turnstileWidgetId === null) {
          output().textContent = "Security check has not loaded. Refresh the page; if this continues, check the Worker settings and Turnstile site key.";
          return;
        }
        if (!turnstileToken) {
          output().textContent = "Complete the Cloudflare security check before choosing a tab.";
          return;
        }
        if (!navigator.mediaDevices?.getDisplayMedia) {
          output().textContent = "Tab capture is unavailable in this browser. Try a desktop browser over HTTPS.";
          return;
        }
        try {
          output().textContent = "Choose a browser tab in the sharing dialog...";
          if (activeStream) activeStream.getTracks().forEach((track) => track.stop());
          activeStream = await navigator.mediaDevices.getDisplayMedia({
            video: { displaySurface: "browser" },
            audio: false,
            preferCurrentTab: true,
            monitorTypeSurfaces: "exclude"
          });
          const track = activeStream.getVideoTracks()[0];
          if (!track || track.getSettings().displaySurface !== "browser") {
            activeStream.getTracks().forEach((item) => item.stop());
            activeStream = null;
            throw new Error("Select a browser tab in the sharing dialog.");
          }
          track.addEventListener("ended", () => {
            element("resendBtn").disabled = true;
            output().textContent = "Tab sharing stopped. Choose a browser tab to start again.";
          }, { once: true });
          const video = element("video");
          video.srcObject = activeStream;
          video.hidden = false;
          await video.play();
          if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
            await new Promise((resolve) => video.addEventListener("loadeddata", resolve, { once: true }));
          }
          element("previewImg").hidden = true;
          element("previewPlaceholder").hidden = true;
          element("resendBtn").disabled = false;
          await captureCurrentFrame();
        } catch (error) {
          output().textContent = error.name === "NotAllowedError"
            ? "Capture cancelled or permission denied."
            : "Could not capture the tab: " + error.message;
        }
      }

      async function captureCurrentFrame() {
        const prompt = element("userPrompt").value.trim();
        const video = element("video");
        if (!turnstileToken) {
          output().textContent = "Complete the Cloudflare security check before sending a capture.";
          return;
        }
        if (!prompt) {
          output().textContent = "Enter a prompt before sending the screenshot to Groq.";
          element("userPrompt").focus();
          return;
        }
        if (!activeStream?.active) {
          output().textContent = "No active tab share. Choose a browser tab first.";
          element("resendBtn").disabled = true;
          return;
        }
        if (!video.videoWidth || !video.videoHeight) {
          output().textContent = "The shared tab is not ready yet. Try again in a moment.";
          return;
        }
        try {
          const canvas = element("canvas");
          const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
          canvas.width = Math.round(video.videoWidth * scale);
          canvas.height = Math.round(video.videoHeight * scale);
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Could not prepare the captured image.");
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageUrl = canvas.toDataURL("image/jpeg", 0.85);
          element("previewImg").src = imageUrl;
          element("previewImg").hidden = false;
          await requestAnswer(imageUrl.replace(/^data:image\/jpeg;base64,/, ""), prompt);
        } catch (error) {
          resetTurnstile();
          output().textContent = "Could not capture the frame: " + error.message;
        }
      }

      async function requestAnswer(image, prompt) {
        const token = turnstileToken;
        turnstileToken = "";
        output().textContent = "Sending the screenshot to Groq...";
        try {
          const response = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image, prompt, turnstileToken: token })
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "The request failed.");
          output().textContent = data.text || "Groq returned no text for this capture.";
        } catch (error) {
          output().textContent = "Request failed: " + error.message;
        } finally {
          resetTurnstile();
        }
      }

      function resetTurnstile() {
        turnstileToken = "";
        if (turnstileWidgetId !== null && window.turnstile) {
          window.turnstile.reset(turnstileWidgetId);
        }
      }
    })();
  </script>
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=initializeAssistant" async defer></script>
</body>
</html>`;

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
  if (!env.GROQ_API_KEY_1 || !env.GROQ_API_KEY_2 || !env.TURNSTILE_SECRET_KEY) {
    return jsonResponse({
      error: "Server setup is incomplete. Configure GROQ_API_KEY_1, GROQ_API_KEY_2, and TURNSTILE_SECRET_KEY."
    }, 503);
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
    if (!response.ok) return jsonResponse({ error: "Could not verify the security check. Please try again." }, 502);
    verification = await response.json();
  } catch {
    return jsonResponse({ error: "Could not verify the security check. Please try again." }, 502);
  }

  if (!verification.success || verification.hostname !== new URL(request.url).hostname) {
    return jsonResponse({ error: "Security check failed or expired. Complete it again and retry." }, 403);
  }

  const groqApiKey = nextGroqKeyIndex === 0 ? env.GROQ_API_KEY_1 : env.GROQ_API_KEY_2;
  nextGroqKeyIndex = 1 - nextGroqKeyIndex;

  let groqResponse;
  try {
    groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqApiKey}`
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/config") {
      if (request.method !== "GET") return jsonResponse({ error: "Method not allowed." }, 405);
      if (!env.TURNSTILE_SITE_KEY) {
        return jsonResponse({ error: "Server setup is incomplete. Configure TURNSTILE_SITE_KEY." }, 503);
      }
      return jsonResponse({ turnstileSiteKey: env.TURNSTILE_SITE_KEY });
    }
    if (url.pathname === "/api/generate") {
      if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);
      return handleGenerate(request, env);
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed.", { status: 405, headers: { Allow: "GET, HEAD" } });
    }

    return new Response(PAGE, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  }
};
