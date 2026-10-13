/**
 * Sprite generation with Google's Gemini image models, called straight from
 * the browser with the PLAYER's own API key.
 *
 * There is no server: the key is only ever sent to generativelanguage.googleapis.com.
 * It's kept in memory, or in this browser's localStorage if the player opts in.
 */

export const MODELS = [
  { id: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image (“Nano Banana”)' },
  { id: 'gemini-3.1-flash-image-preview', label: 'Gemini 3.1 Flash Image (preview)' },
];
export const DEFAULT_MODEL = MODELS[0].id;

const ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

// ---------------------------------------------------------------------------
// API key storage
// ---------------------------------------------------------------------------

const KEY_STORAGE = 'bb.geminiKey';
const MODEL_STORAGE = 'bb.geminiModel';
let sessionKey = '';

export function getApiKey() {
  if (sessionKey) return sessionKey;
  try { return localStorage.getItem(KEY_STORAGE) || ''; } catch { return ''; }
}

export function isKeyRemembered() {
  try { return !!localStorage.getItem(KEY_STORAGE); } catch { return false; }
}

export function setApiKey(key, remember) {
  sessionKey = key.trim();
  try {
    if (remember && sessionKey) localStorage.setItem(KEY_STORAGE, sessionKey);
    else localStorage.removeItem(KEY_STORAGE);
  } catch { /* storage blocked — memory only */ }
}

export function getModel() {
  try { return localStorage.getItem(MODEL_STORAGE) || DEFAULT_MODEL; } catch { return DEFAULT_MODEL; }
}

export function setModel(model) {
  try { localStorage.setItem(MODEL_STORAGE, model); } catch {}
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function buildPrompt({ keyColor, hasHeroImage, hasPowerupImage, heroText, powerupText }) {
  const refs = [];
  if (hasHeroImage) refs.push(`Image ${refs.length + 1} is the Base Character`);
  if (hasPowerupImage) refs.push(`Image ${refs.length + 1} is the Power-up Item`);
  const hero = heroText ? ` The Base Character is: ${heroText}.` : '';
  const item = powerupText ? ` The Power-up Item is: ${powerupText}.` : '';

  return (
    `You are an expert pixel artist. Generate a strict 5-column × 5-row pixel art sprite sheet on a solid, ${keyColor.name} (${keyColor.hex}) background. ` +
    (refs.length ? `I have provided reference images: ${refs.join('. ')}. ` : '') +
    hero + item + ' ' +
    'Row 1: Base Character ONLY - idle breathing cycle. STRICTLY RIGHT-FACING PROFILE. Movement between these 5 frames must be minimal, just breathing. Head and feet must remain locked in place. ' +
    'Row 2: Base Character ONLY - walk cycle. STRICTLY RIGHT-FACING PROFILE. ' +
    'Row 3: Base Character ONLY - jump arc. STRICTLY RIGHT-FACING PROFILE. ' +
    'Row 4: Powered-up Character - the Base Character visually transformed by the Power-up Item. STRICTLY RIGHT-FACING PROFILE in an active pose. ' +
    'Row 5: Power-up Item ONLY - the isolated item, featuring a spinning or floating animation cycle. ' +
    `CRITICAL GLOBAL CONSTRAINTS: The character must NEVER face the camera; keep a consistent 2D side-scrolling perspective across all rows. The background must remain a solid ${keyColor.name} (${keyColor.hex}) — DO NOT use this color anywhere on the character or item. Authentic NES-era 8-bit pixel art, crisp 1px black outlines, flat colors. Maintain perfectly uniform cell dimensions and spacing across all 25 frames. Output ONLY the generated image.`
  );
}

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

function splitDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error('Expected a base64 data URL');
  return { mimeType: m[1], data: m[2] };
}

/** Turn Google's error responses into something a player can act on. */
function friendlyError(status, body) {
  const msg = body?.error?.message || '';
  const reason = body?.error?.details?.find?.((d) => d.reason)?.reason || body?.error?.status || '';
  if (reason === 'API_KEY_INVALID' || /API key not valid/i.test(msg)) return 'Google rejected that API key. Double-check it in Settings.';
  if (status === 429) return 'Rate limit or quota reached for this key. Wait a minute, or check your quota in Google AI Studio.';
  if (status === 403) return `This key isn't allowed to use that model (${msg || 'permission denied'}). Image models may need billing enabled.`;
  if (status === 404) return `Model not found: ${msg || 'try the other model in Settings'}.`;
  return msg ? `Gemini error ${status}: ${msg}` : `Gemini request failed (${status}).`;
}

/**
 * Generate one 5×5 sprite sheet.
 * @returns {Promise<string>} data URL of the generated sheet image
 */
export async function generateSpritesheet({ apiKey, model, heroImage, powerupImage, heroText, powerupText, keyColor, signal }) {
  if (!apiKey) throw new Error('Add your Gemini API key first.');

  const parts = [{ text: buildPrompt({ keyColor, hasHeroImage: !!heroImage, hasPowerupImage: !!powerupImage, heroText, powerupText }) }];
  if (heroImage) parts.push({ inlineData: splitDataUrl(heroImage) });
  if (powerupImage) parts.push({ inlineData: splitDataUrl(powerupImage) });

  let res;
  try {
    res = await fetch(ENDPOINT(model || DEFAULT_MODEL), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
      }),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error('Could not reach Google. Check your connection and try again.');
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(friendlyError(res.status, body));

  const candidate = body?.candidates?.[0];
  const image = candidate?.content?.parts?.find((p) => p.inlineData?.data);
  if (!image) {
    const why = candidate?.finishReason && candidate.finishReason !== 'STOP' ? ` (${candidate.finishReason})` : '';
    throw new Error(`The model didn't return an image${why}. Try re-rolling or tweaking your description.`);
  }
  return `data:${image.inlineData.mimeType || 'image/png'};base64,${image.inlineData.data}`;
}
