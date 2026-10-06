/*
 * Tech Tools Kit - runtime (branding + AI)
 * -------------------------------------------------------------
 * Load after kit-config.js on every kit page:
 *   <link rel="stylesheet" href="assets/kit-theme-dark.css">
 *   <script src="kit-config.js"></script>
 *   <script src="kit-brand.js"></script>
 *
 * What it does
 *   - Turns the district's school colors into the full dark-glass palette
 *   - Swaps in the district logo and watermark
 *   - Replaces {{tokens}} in page text, e.g. {{districtName}}, {{districtShort}}
 *   - KitAI.chat(): calls the district's chosen AI provider straight from the
 *     browser, asking the user for an API key the first time if needed
 *
 * Copyright (c) 2026 Scott Boyer, Systems Coordinator, CLSD Technology Services. MIT License (see LICENSE).
 */
(function () {
  'use strict';

  var LS_CONFIG = 'ttkit.config';
  // Kit root = the folder kit-brand.js lives in, so tools in subfolders resolve assets correctly
  var KIT_ROOT = (document.currentScript && document.currentScript.src) ? new URL('.', document.currentScript.src).href : document.baseURI;
  function kitUrl(p) { return !p || /^(data:|https?:|blob:)/.test(p) ? p : new URL(p, KIT_ROOT).href; }
  var LS_KEY_PREFIX = 'ttkit.key.';

  // ── safe storage ─────────────────────────────────────────────
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { window.localStorage.removeItem(k); } catch (e) {} }

  function deepMerge(base, over) {
    var out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    Object.keys(over || {}).forEach(function (k) {
      var v = over[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && base && typeof base[k] === 'object') out[k] = deepMerge(base[k], v);
      else if (v !== undefined) out[k] = v;
    });
    return out;
  }

  // Config precedence: kit-config.js file, unless this browser holds a newer copy saved by setup.html
  function loadConfig() {
    var fileCfg = window.KIT_CONFIG || {};
    var saved = null;
    try { saved = JSON.parse(lsGet(LS_CONFIG) || 'null'); } catch (e) {}
    if (fileCfg.lockBranding) saved = null; // hosted demo sites keep their own branding
    if (saved && (!fileCfg.savedAt || (saved.savedAt || 0) > fileCfg.savedAt)) return deepMerge(fileCfg, saved);
    return deepMerge({}, fileCfg);
  }

  // ── color math ───────────────────────────────────────────────
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function hexToRgb(hex) {
    hex = String(hex || '').replace('#', '').trim();
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(hex, 16);
    if (isNaN(n) || hex.length !== 6) return null;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    if (s === 0) { var v = Math.round(l * 255); return [v, v, v]; }
    function hue(p, q, t) {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    return [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)].map(function (x) { return Math.round(x * 255); });
  }
  function hex(rgb) { return '#' + rgb.map(function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }
  function rgbStr(rgb) { return rgb.join(', '); }
  function hsl(h, s, l) { return hslToRgb(h, clamp(s, 0, 1), clamp(l, 0, 1)); }
  function rgba(rgb, a) { return 'rgba(' + rgbStr(rgb) + ', ' + a + ')'; }

  // Build the full palette from one or two school colors.
  // Returns { vars: {...css custom props}, notes: [...] }
  function buildPalette(primary, secondary, tint) {
    var notes = [];
    var p = hexToRgb(primary) || [37, 99, 235];
    var ph = rgbToHsl(p[0], p[1], p[2]);
    var H = ph[0], S = ph[1], L = ph[2];

    // Very gray school colors (black/white/silver) - borrow saturation from the secondary if it has some
    if (S < 0.12) {
      var sc = hexToRgb(secondary);
      var sh = sc ? rgbToHsl(sc[0], sc[1], sc[2]) : null;
      if (sh && sh[1] >= 0.2) { H = sh[0]; S = sh[1]; notes.push('Primary color is nearly gray, so accents use your secondary color\'s hue.'); }
    }
    var brandL = clamp(L, 0.24, 0.42);
    if (Math.abs(brandL - L) > 0.02) notes.push('Primary color was ' + (L > brandL ? 'darkened' : 'lightened') + ' slightly so white button text stays readable.');
    var Sb = clamp(S, 0, 0.9);

    var brand = hsl(H, Sb, brandL);
    var pale  = hsl(H, Math.min(Sb + 0.05, 0.9), 0.66);

    // background family
    var bgH = H, bgS;
    if (tint === 'navy') { bgH = 223; bgS = 0.70; }
    else if (tint === 'neutral') { bgS = 0.08; }
    else { bgS = Math.min(Sb, 0.55); }
    var txS = tint === 'neutral' ? 0.10 : Math.min(bgS, 0.45);

    var acc = hexToRgb(secondary) || pale;
    var ah = rgbToHsl(acc[0], acc[1], acc[2]);
    var accent = hsl(ah[0], Math.min(ah[1], 0.9), clamp(ah[2], 0.55, 0.75));

    var vars = {
      '--brand':          hex(brand),
      '--brand-dark':     hex(hsl(H, Sb, brandL * 0.74)),
      '--brand-mid':      hex(hsl(H, Sb, brandL + 0.08)),
      '--brand-light':    hex(hsl(H, Sb, brandL + 0.22)),
      '--brand-pale':     hex(pale),
      '--brand-rgb':      rgbStr(brand),
      '--brand-pale-rgb': rgbStr(pale),
      '--brand-mid-rgb':  rgbStr(hsl(H, Sb, brandL + 0.08)),
      '--brand-light-rgb': rgbStr(hsl(H, Sb, brandL + 0.22)),
      '--border-glass-focus': rgba(hsl(H, Sb, brandL + 0.22), 0.70),
      '--bg-rgb':         rgbStr(hsl(bgH, bgS, 0.07)),
      '--bg-deep-rgb':    rgbStr(hsl(bgH, bgS, 0.035)),
      '--panel-rgb':      rgbStr(hsl(bgH, bgS, 0.127)),
      '--accent':         hex(accent),
      '--bg-base':        hex(hsl(bgH, bgS, 0.07)),
      '--bg-deep':        hex(hsl(bgH, bgS, 0.035)),
      '--bg-elev':        hex(hsl(bgH, bgS, 0.15)),
      '--bg-overlay':     rgba(hsl(bgH, bgS, 0.07), 0.72),
      '--glass-panel':    rgba(hsl(bgH, bgS, 0.127), 0.55),
      '--glass-panel-hover': rgba(hsl(bgH, bgS, 0.20), 0.65),
      '--glass-header':   rgba(hsl(bgH, bgS, 0.133), 0.75),
      '--glass-card':     rgba(hsl(bgH, bgS, 0.15), 0.58),
      '--glass-input':    rgba(hsl(bgH, bgS, 0.07), 0.60),
      '--glass-sidebar':  rgba(hsl(bgH, bgS, 0.094), 0.70),
      '--glass-modal':    rgba(hsl(bgH, bgS, 0.114), 0.82),
      '--glass-footer':   rgba(hsl(bgH, bgS, 0.063), 0.80),
      '--text-primary':   hex(hsl(bgH, txS, 0.94)),
      '--text-secondary': hex(hsl(bgH, txS, 0.74)),
      '--text-muted':     hex(hsl(bgH, txS * 0.6, 0.52)),
      '--text-output':    hex(hsl(bgH, txS, 0.79)),
      '--text-inverse':   hex(hsl(bgH, bgS, 0.07))
    };
    return { vars: vars, notes: notes };
  }

  // ── tokens ───────────────────────────────────────────────────
  function tokens(cfg) {
    var id = cfg.identity || {}, ms = cfg.microsoft || {};
    var t = Object.assign({}, id);
    t.publisher = [id.districtShort, id.deptName].filter(Boolean).join(' ');
    t.author = [id.authorName, id.authorTitle].filter(Boolean).join(', ');
    t.primaryDomain = ms.primaryDomain || '';
    t.year = String(new Date().getFullYear());
    // Attribution: on the original CLSD site the district name already says CLSD Technology Services
    t.credit = cfg.origin ? 'Built by Scott Boyer, Systems Coordinator' : 'Built by Scott Boyer, Systems Coordinator \u00b7 CLSD Technology Services';
    t.groupTagFirst = ((ms.groupTagExamples || 'Staff-HS').split(',')[0] || 'Staff-HS').trim();
    t.groupTagHint = (ms.groupTagExamples || 'Staff-HS, 1to1-MS').split(',').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 3).join(', ');
    return t;
  }
  function fill(str, cfg) {
    var t = tokens(cfg || Kit.config);
    return String(str).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, function (m, k) { return t[k] != null ? t[k] : m; });
  }

  var ATTRS = ['alt', 'title', 'placeholder', 'aria-label', 'content'];
  function applyTokens(root, cfg) {
    root = root || document.body;
    if (!root) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = walker.nextNode())) {
      var p = n.parentNode && n.parentNode.nodeName;
      if (p === 'SCRIPT' || p === 'STYLE' || p === 'TEXTAREA') continue;
      if (n.__kitTpl == null) { if (n.nodeValue.indexOf('{{') === -1) continue; n.__kitTpl = n.nodeValue; }
      n.nodeValue = fill(n.__kitTpl, cfg);
    }
    root.querySelectorAll('*').forEach(function (el) {
      el.__kitAttr = el.__kitAttr || {};
      ATTRS.forEach(function (a) {
        if (el.__kitAttr[a] == null) {
          var v = el.getAttribute(a);
          if (!v || v.indexOf('{{') === -1) return;
          el.__kitAttr[a] = v;
        }
        el.setAttribute(a, fill(el.__kitAttr[a], cfg));
      });
    });
    if (document.__kitTitle == null && document.title.indexOf('{{') !== -1) document.__kitTitle = document.title;
    if (document.__kitTitle != null) document.title = fill(document.__kitTitle, cfg);
  }

  // ── apply branding ───────────────────────────────────────────
  function apply(cfg) {
    cfg = cfg || Kit.config;
    var b = cfg.brand || {};
    var pal = buildPalette(b.primary, b.secondary, b.bgTint);
    var rs = document.documentElement.style;
    Object.keys(pal.vars).forEach(function (k) { rs.setProperty(k, pal.vars[k]); });

    var logo = kitUrl(b.logo || 'assets/kit-logo.svg');
    // CSS resolves url() inside a custom property relative to the stylesheet, so paths are made absolute (kitUrl)
    var wm = b.watermark === 'logo' ? logo : (b.watermark === 'none' || !b.watermark ? '' : kitUrl(b.watermark));
    rs.setProperty('--watermark-url', wm ? 'url("' + wm + '")' : 'none');
    rs.setProperty('--watermark-opacity', String(b.watermarkOpacity != null ? b.watermarkOpacity : 0.06));
    // a logo used as a watermark looks best centered and contained rather than cropped to cover
    rs.setProperty('--watermark-size', b.watermark === 'logo' ? 'min(70vh, 70vw)' : 'cover');

    document.querySelectorAll('img[data-kit-logo], .tt-header__logo').forEach(function (img) { img.src = logo; });
    if (document.body) applyTokens(document.body, cfg);
    return pal;
  }

  function injectBaseCss() {
    if (document.getElementById('ttkit-css')) return;
    var css = [
      '.tt-app::before{background-size:var(--watermark-size,cover)!important}',
      '.tt-header{border-image:linear-gradient(90deg,var(--brand-pale),var(--accent)) 1;border-bottom-width:2px}',
      '.tt-header__badge{color:var(--accent)!important;border-color:color-mix(in srgb,var(--accent) 45%,transparent)!important}',
      '@media (max-width:640px){.tt-header{padding:10px 16px!important;gap:10px!important}.tt-header__subtitle,.tt-header__divider,.tt-header__badge{display:none!important}.tt-header__logo{height:30px!important}.tt-footer{flex-direction:column;gap:4px;padding:10px 16px!important}}',
      '.ttkit-banner{position:relative;z-index:200;display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap;padding:8px 16px;font:500 13px var(--font-ui);color:var(--text-primary);background:rgba(var(--brand-rgb),.55);border-bottom:1px solid var(--border-glass-bright)}',
      '.ttkit-banner a{color:var(--text-primary);font-weight:700}',
      '.ttkit-overlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;background:var(--bg-overlay);backdrop-filter:blur(6px)}',
      '.ttkit-modal{width:min(480px,100%);background:var(--glass-modal);backdrop-filter:var(--blur-modal);border:1px solid var(--border-glass-bright);border-radius:var(--radius-xl);box-shadow:var(--shadow-lg);padding:24px;color:var(--text-primary);font-family:var(--font-ui)}',
      '.ttkit-modal h3{font-size:1.1rem;margin-bottom:6px}',
      '.ttkit-modal p{color:var(--text-secondary);font-size:.85rem;margin-bottom:14px;line-height:1.5}',
      '.ttkit-modal a{color:var(--brand-pale)}',
      '.ttkit-modal input{width:100%;padding:10px 12px;border-radius:var(--radius-md);border:1px solid var(--border-glass);background:var(--glass-input);color:var(--text-primary);font:14px var(--font-mono)}',
      '.ttkit-modal label{display:flex;gap:8px;align-items:center;margin-top:10px;font-size:.8rem;color:var(--text-secondary)}',
      '.ttkit-modal .row{display:flex;gap:8px;justify-content:flex-end;margin-top:18px}',
      '.ttkit-modal .err{color:var(--color-error);font-size:.8rem;margin-top:8px;min-height:1em}'
    ].join('\n');
    var s = document.createElement('style'); s.id = 'ttkit-css'; s.textContent = css;
    document.head.appendChild(s);
  }

  function setupBanner() {
    if (Kit.config.configured || document.documentElement.hasAttribute('data-kit-setup')) return;
    var href = kitUrl('setup.html');
    var d = document.createElement('div');
    d.className = 'ttkit-banner';
    d.innerHTML = 'This kit hasn’t been set up for your district yet. <a href="' + href + '">Run setup →</a>';
    document.body.insertBefore(d, document.body.firstChild);
  }

  // ── AI providers (browser-direct) ────────────────────────────
  function errFrom(provider, res, body) {
    var msg = (body && (body.error && (body.error.message || body.error))) || res.statusText || 'Request failed';
    if (res.status === 401 || res.status === 403) msg = 'The ' + PROVIDERS[provider].label + ' key was rejected (' + res.status + '). Check the key and try again.';
    if (res.status === 429) msg = PROVIDERS[provider].label + ' rate limit or quota reached (429). Wait a moment or check billing on that account.';
    var e = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    e.status = res.status; e.provider = provider;
    return e;
  }
  async function jfetch(provider, url, opts) {
    var res;
    try { res = await fetch(url, opts); }
    catch (e) {
      var ne = new Error('Couldn’t reach ' + PROVIDERS[provider].label + ' from this browser. Check your network or web filter, or pick another provider.');
      ne.provider = provider; ne.network = true; throw ne;
    }
    var body = null;
    try { body = await res.json(); } catch (e) {}
    if (!res.ok) throw errFrom(provider, res, body);
    return body;
  }
  function openAIStyle(base) {
    return {
      listModels: async function (key) {
        var b = await jfetch(this.id, base + '/models', { headers: { Authorization: 'Bearer ' + key } });
        return (b.data || []).map(function (m) { return m.id; }).sort();
      },
      chat: async function (o) {
        var msgs = (o.system ? [{ role: 'system', content: o.system }] : []).concat(o.messages);
        var b = await jfetch(this.id, base + '/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + o.key },
          body: JSON.stringify({ model: o.model, messages: msgs, max_tokens: o.maxTokens || 4000 })
        });
        var ch = b.choices && b.choices[0];
        return { text: (ch && ch.message && ch.message.content) || '', truncated: !!(ch && ch.finish_reason === 'length') };
      }
    };
  }

  var PROVIDERS = {
    anthropic: {
      label: 'Anthropic Claude',
      keyUrl: 'https://console.anthropic.com/settings/keys',
      keyHint: 'sk-ant-…',
      defaultModel: 'claude-sonnet-5',
      listModels: async function (key) {
        var b = await jfetch('anthropic', 'https://api.anthropic.com/v1/models?limit=100', { headers: anthropicHeaders(key) });
        return (b.data || []).map(function (m) { return m.id; });
      },
      chat: async function (o) {
        var b = await jfetch('anthropic', 'https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, anthropicHeaders(o.key)),
          body: JSON.stringify({ model: o.model, max_tokens: o.maxTokens || 4000, system: o.system || undefined, messages: o.messages })
        });
        return { text: (b.content || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join(''), truncated: b.stop_reason === 'max_tokens' };
      }
    },
    openai: Object.assign({ label: 'OpenAI', keyUrl: 'https://platform.openai.com/api-keys', keyHint: 'sk-…', defaultModel: 'gpt-4.1-mini' }, openAIStyle('https://api.openai.com/v1')),
    groq: Object.assign({ label: 'Groq', free: true, keyUrl: 'https://console.groq.com/keys', keyHint: 'gsk_…', defaultModel: 'llama-3.3-70b-versatile' }, openAIStyle('https://api.groq.com/openai/v1')),
    gemini: {
      label: 'Google Gemini',
      free: true,
      keyUrl: 'https://aistudio.google.com/app/apikey',
      keyHint: 'AIza…',
      defaultModel: 'gemini-2.5-flash',
      listModels: async function (key) {
        var b = await jfetch('gemini', 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=' + encodeURIComponent(key), {});
        return (b.models || []).filter(function (m) { return (m.supportedGenerationMethods || []).indexOf('generateContent') !== -1; })
          .map(function (m) { return m.name.replace(/^models\//, ''); });
      },
      chat: async function (o) {
        var body = {
          contents: o.messages.map(function (m) { return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }; }),
          generationConfig: { maxOutputTokens: o.maxTokens || 4000 }
        };
        if (o.system) body.systemInstruction = { parts: [{ text: o.system }] };
        var b = await jfetch('gemini', 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(o.model) + ':generateContent?key=' + encodeURIComponent(o.key), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        var c = b.candidates && b.candidates[0];
        return { text: c && c.content && c.content.parts ? c.content.parts.map(function (p) { return p.text || ''; }).join('') : '', truncated: !!(c && c.finishReason === 'MAX_TOKENS') };
      }
    }
  };
  Object.keys(PROVIDERS).forEach(function (k) { PROVIDERS[k].id = k; });
  function anthropicHeaders(key) {
    return { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
  }

  function getKey(provider) {
    var ai = Kit.config.ai || {};
    if (ai.keyStorage === 'config' && ai.keys && ai.keys[provider]) return ai.keys[provider];
    return lsGet(LS_KEY_PREFIX + provider) || '';
  }
  function setKey(provider, key) { if (key) lsSet(LS_KEY_PREFIX + provider, key); else lsDel(LS_KEY_PREFIX + provider); }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // Ask the user for a key. Resolves to the key, or null if they cancel.
  // Concurrent callers (e.g. two AI requests fired together) share one dialog.
  var pendingPrompts = {};
  function promptForKey(provider, reason) {
    if (pendingPrompts[provider]) return pendingPrompts[provider];
    var P = PROVIDERS[provider];
    injectBaseCss();
    var pr = new Promise(function (resolve) {
      var ov = document.createElement('div');
      ov.className = 'ttkit-overlay';
      ov.innerHTML =
        '<div class="ttkit-modal" role="dialog" aria-modal="true" aria-labelledby="ttkitKeyTitle">' +
        '<h3 id="ttkitKeyTitle">' + esc(P.label) + ' API key needed</h3>' +
        '<p>' + esc(reason || 'This tool uses AI to generate scripts.') + ' Paste a key from ' +
        '<a href="' + P.keyUrl + '" target="_blank" rel="noopener">' + esc(P.label) + '</a>' + (P.free ? ' (free tier available)' : '') +
        '. It’s saved only in this browser and sent only to ' + esc(P.label) + '.</p>' +
        '<input type="password" id="ttkitKeyInput" autocomplete="off" spellcheck="false" placeholder="' + esc(P.keyHint) + '">' +
        '<label><input type="checkbox" id="ttkitKeyShow" style="width:auto"> Show key</label>' +
        '<div class="err" id="ttkitKeyErr"></div>' +
        '<div class="row"><button class="tt-btn tt-btn--ghost" id="ttkitKeyCancel">Cancel</button>' +
        '<button class="tt-btn tt-btn--primary" id="ttkitKeySave">Test &amp; save</button></div></div>';
      document.body.appendChild(ov);
      var input = ov.querySelector('#ttkitKeyInput'), err = ov.querySelector('#ttkitKeyErr'), save = ov.querySelector('#ttkitKeySave');
      input.focus();
      ov.querySelector('#ttkitKeyShow').onchange = function (e) { input.type = e.target.checked ? 'text' : 'password'; };
      function done(v) { ov.remove(); resolve(v); }
      ov.querySelector('#ttkitKeyCancel').onclick = function () { done(null); };
      ov.addEventListener('keydown', function (e) { if (e.key === 'Escape') done(null); if (e.key === 'Enter') save.click(); });
      save.onclick = async function () {
        var k = input.value.trim();
        if (!k) { err.textContent = 'Paste a key first.'; return; }
        save.disabled = true; err.textContent = ''; save.textContent = 'Testing…';
        try { await P.listModels(k); setKey(provider, k); done(k); }
        catch (e) { err.textContent = e.message; save.disabled = false; save.textContent = 'Test & save'; }
      };
    });
    pendingPrompts[provider] = pr;
    pr.then(function () { delete pendingPrompts[provider]; });
    return pr;
  }

  async function ensureKey(provider, reason) {
    return getKey(provider) || (await promptForKey(provider, reason));
  }

  // KitAI.chat({ system, messages:[{role,content}], prompt, maxTokens, reason })
  // -> { text, truncated, provider, providerLabel, model, usedFallback }
  async function chat(o) {
    var ai = Kit.config.ai || {};
    var messages = o.messages || [{ role: 'user', content: o.prompt || '' }];
    var chain = [{ p: ai.provider || 'anthropic', m: ai.model }];
    if (ai.fallbackProvider && PROVIDERS[ai.fallbackProvider]) chain.push({ p: ai.fallbackProvider, m: ai.fallbackModel });
    var lastErr;
    for (var i = 0; i < chain.length; i++) {
      var P = PROVIDERS[chain[i].p];
      if (!P) continue;
      var key = i === 0 ? await ensureKey(P.id, o.reason) : getKey(P.id);
      if (!key) { lastErr = lastErr || new Error('No API key provided for ' + P.label + '.'); continue; }
      var model = chain[i].m || P.defaultModel;
      try {
        var out = await P.chat({ key: key, model: model, system: o.system, messages: messages, maxTokens: o.maxTokens });
        return { text: out.text, truncated: out.truncated, provider: P.id, providerLabel: P.label, model: model, usedFallback: i > 0 };
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('No AI provider is configured. Run setup.html.');
  }

  // Blank-kit defaults. setup.html starts from these, even on a demo site with its own branding.
  var NEUTRAL = {
    configured: false, version: 1,
    identity: { districtName: 'Your School District', districtShort: 'YSD', deptName: 'Technology Services', portalName: 'Tech Tools', authorName: 'IT Department', authorTitle: '', supportEmail: '', logFolder: 'YSD' },
    brand: { primary: '#2563eb', secondary: '#60a5fa', bgTint: 'brand', logo: 'assets/kit-logo.svg', watermark: 'logo', watermarkOpacity: 0.06 },
    microsoft: { tenantId: '', clientId: '', primaryDomain: '', groupTagExamples: 'Staff-HS, 1to1-MS, Cart-ES' },
    ai: { provider: 'anthropic', model: '', fallbackProvider: '', fallbackModel: '', keyStorage: 'browser', keys: {} }
  };

  // ── public API ───────────────────────────────────────────────
  var Kit = window.Kit = {
    config: loadConfig(),
    buildPalette: buildPalette,
    apply: function (cfg) { if (cfg) Kit.config = cfg; return apply(Kit.config); },
    fill: function (s) { return fill(s, Kit.config); },
    tokens: function () { return tokens(Kit.config); },
    saveToBrowser: function (cfg) { cfg.savedAt = Date.now(); Kit.config = cfg; return lsSet(LS_CONFIG, JSON.stringify(cfg)); },
    clearBrowserConfig: function () { lsDel(LS_CONFIG); },
    NEUTRAL: NEUTRAL,
    root: KIT_ROOT,
    url: kitUrl,
    isLive: function () { var m = Kit.config.microsoft || {}; return !!(m.tenantId && m.clientId); },
    LS_CONFIG: LS_CONFIG
  };
  window.KitAI = {
    providers: PROVIDERS,
    chat: chat,
    getKey: getKey,
    setKey: setKey,
    promptForKey: promptForKey,
    ensureKey: ensureKey,
    test: function (provider, key) { return PROVIDERS[provider].listModels(key); }
  };

  // apply palette immediately (before paint), tokens/logo once the DOM is ready
  apply(Kit.config);
  function onReady() { injectBaseCss(); apply(Kit.config); setupBanner(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady);
  else onReady();
})();
