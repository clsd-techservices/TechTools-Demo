/*
 * Tech Tools Kit - demo mode + presenter panel
 * -------------------------------------------------------------
 * Demo mode runs a tool against built-in sample data with scripted outcomes,
 * so it can be shown (or tried) without a Microsoft 365 tenant or an AI key.
 *
 * Demo mode is on when any of these is true:
 *   - kit-config.js has  demo: true        (a hosted demo site; can't be turned off)
 *   - the URL has  ?demo=1
 *   - the user clicked "Try with sample data" (remembered for this browser tab)
 *
 * Presenter panel: a small floating panel with sample-data shortcuts, speed and
 * reset. Toggle it with the button or Ctrl+Shift+D.
 *
 * Copyright (c) 2026 Scott Boyer, Systems Coordinator, CLSD Technology Services. MIT License (see LICENSE).
 */
(function () {
  'use strict';
  var SS_DEMO = 'ttkit.demo', SS_SPEED = 'ttkit.demo.speed', SS_PANEL = 'ttkit.demo.panel';
  function ssGet(k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) {} }
  function ssDel(k) { try { window.sessionStorage.removeItem(k); } catch (e) {} }

  var forced = !!(window.Kit && Kit.config && Kit.config.demo === true);
  var params = new URLSearchParams(location.search);
  var active = forced || params.get('demo') === '1' || ssGet(SS_DEMO) === '1';
  if (params.get('demo') === '1') ssSet(SS_DEMO, '1');

  // speed multipliers applied to every scripted delay
  var SPEEDS = { fast: { label: 'Fast', x: 0.35 }, normal: { label: 'Normal', x: 1 }, real: { label: 'Realistic', x: 3.5 } };
  var speed = SPEEDS[ssGet(SS_SPEED)] ? ssGet(SS_SPEED) : 'normal';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var css = [
    '.ttdemo-banner{position:relative;z-index:150;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;padding:7px 16px;font:600 12.5px var(--font-ui);color:var(--text-primary);background:linear-gradient(90deg,rgba(var(--brand-rgb),.55),rgba(var(--brand-rgb),.25));border-bottom:1px solid var(--border-glass-bright)}',
    '.ttdemo-banner .dot{width:8px;height:8px;border-radius:50%;background:var(--color-warning);box-shadow:0 0 8px var(--color-warning)}',
    '.ttdemo-banner a,.ttdemo-banner button{color:var(--text-primary);font:700 12px var(--font-ui);background:none;border:0;text-decoration:underline;cursor:pointer;padding:0}',
    '.ttdemo-fab{position:fixed;left:16px;bottom:16px;z-index:9000;display:flex;align-items:center;gap:8px;padding:9px 14px;border-radius:var(--radius-full);border:1px solid var(--border-glass-bright);background:var(--glass-modal);backdrop-filter:var(--blur-modal);color:var(--text-primary);font:700 12px var(--font-ui);cursor:pointer;box-shadow:var(--shadow-lg)}',
    '.ttdemo-fab:hover{border-color:var(--brand-pale)}',
    '.ttdemo-panel{position:fixed;left:16px;bottom:64px;z-index:9001;width:min(330px,calc(100vw - 32px));max-height:calc(100vh - 100px);overflow:auto;padding:16px;border-radius:var(--radius-xl);border:1px solid var(--border-glass-bright);background:var(--glass-modal);backdrop-filter:var(--blur-modal);box-shadow:var(--shadow-lg);color:var(--text-primary);font-family:var(--font-ui)}',
    '.ttdemo-panel h4{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted);margin:14px 0 8px}',
    '.ttdemo-panel h4:first-child{margin-top:0}',
    '.ttdemo-panel .grid{display:grid;gap:6px}',
    '.ttdemo-panel .chips{display:flex;flex-wrap:wrap;gap:6px}',
    '.ttdemo-panel .chip{padding:5px 10px;border-radius:var(--radius-full);border:1px solid var(--border-glass);background:var(--glass-input);color:var(--text-secondary);font:600 11.5px var(--font-ui);cursor:pointer;text-align:left}',
    '.ttdemo-panel .chip:hover{border-color:var(--brand-pale);color:var(--text-primary)}',
    '.ttdemo-panel .chip small{display:block;font-weight:500;color:var(--text-muted);font-size:10.5px}',
    '.ttdemo-panel .act{width:100%;justify-content:flex-start;text-align:left}',
    '.ttdemo-panel .seg{display:flex;border:1px solid var(--border-glass);border-radius:var(--radius-md);overflow:hidden}',
    '.ttdemo-panel .seg button{flex:1;padding:7px 4px;border:0;background:var(--glass-input);color:var(--text-secondary);font:600 12px var(--font-ui);cursor:pointer}',
    '.ttdemo-panel .seg button+button{border-left:1px solid var(--border-glass)}',
    '.ttdemo-panel .seg button.on{background:rgba(var(--brand-rgb),.6);color:var(--text-primary)}',
    '.ttdemo-panel .kbd{font:11px var(--font-mono);color:var(--text-muted);margin-top:12px}'
  ].join('\n');

  function injectCss() {
    if (document.getElementById('ttdemo-css')) return;
    var s = document.createElement('style'); s.id = 'ttdemo-css'; s.textContent = css; document.head.appendChild(s);
  }

  var panelOpts = null, panelEl = null, fabEl = null;

  function renderBanner() {
    if (!active || document.querySelector('.ttdemo-banner')) return;
    injectCss();
    var b = document.createElement('div');
    b.className = 'ttdemo-banner';
    b.innerHTML = '<span class="dot"></span><span>Demo mode: sample data with scripted results. Nothing here touches a real tenant.</span>' +
      (forced ? '' : '<button type="button" id="ttdemoExit">Exit demo</button>');
    var app = document.querySelector('.tt-app') || document.body;
    var header = app.querySelector('.tt-header');
    if (header && header.nextSibling) app.insertBefore(b, header.nextSibling); else app.insertBefore(b, app.firstChild);
    var x = b.querySelector('#ttdemoExit');
    if (x) x.onclick = function () { KitDemo.exit(); };
  }

  function renderPanel() {
    if (!active || !panelOpts) return;
    injectCss();
    if (!fabEl) {
      fabEl = document.createElement('button');
      fabEl.type = 'button';
      fabEl.className = 'ttdemo-fab';
      fabEl.setAttribute('aria-expanded', 'false');
      fabEl.innerHTML = '🎬 Presenter';
      fabEl.onclick = function () { toggle(); };
      document.body.appendChild(fabEl);
      panelEl = document.createElement('div');
      panelEl.className = 'ttdemo-panel';
      panelEl.setAttribute('role', 'dialog');
      panelEl.setAttribute('aria-label', 'Presenter panel');
      panelEl.style.display = 'none';
      document.body.appendChild(panelEl);
      document.addEventListener('keydown', function (e) { if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) { e.preventDefault(); toggle(); } });
      if (ssGet(SS_PANEL) === '1') toggle(true);
    }
    var o = panelOpts, h = '';
    (o.sections || []).forEach(function (sec, si) {
      h += '<h4>' + esc(sec.title) + '</h4>';
      if (sec.chips) {
        h += '<div class="chips">' + sec.chips.map(function (c, ci) {
          return '<button type="button" class="chip" data-s="' + si + '" data-c="' + ci + '">' + esc(c.label) + (c.hint ? '<small>' + esc(c.hint) + '</small>' : '') + '</button>';
        }).join('') + '</div>';
      }
      if (sec.actions) {
        h += '<div class="grid">' + sec.actions.map(function (a, ai) {
          return '<button type="button" class="tt-btn tt-btn--secondary act" data-s="' + si + '" data-a="' + ai + '">' + esc(a.label) + '</button>';
        }).join('') + '</div>';
      }
    });
    h += '<h4>Speed</h4><div class="seg">' + Object.keys(SPEEDS).map(function (k) {
      return '<button type="button" data-speed="' + k + '" class="' + (k === speed ? 'on' : '') + '">' + SPEEDS[k].label + '</button>';
    }).join('') + '</div>';
    h += '<h4>Reset</h4><button type="button" class="tt-btn tt-btn--danger act" id="ttdemoReset">Reset this demo</button>';
    h += '<div class="kbd">Ctrl+Shift+D toggles this panel</div>';
    panelEl.innerHTML = h;
    panelEl.onclick = function (e) {
      var t = e.target.closest('button'); if (!t) return;
      var sec = o.sections && o.sections[+t.dataset.s];
      // close after a sample action so the panel doesn't cover what it just triggered
      if (t.dataset.c != null && sec) { toggle(false); sec.chips[+t.dataset.c].onClick(); }
      else if (t.dataset.a != null && sec) { toggle(false); sec.actions[+t.dataset.a].onClick(); }
      else if (t.dataset.speed) { speed = t.dataset.speed; ssSet(SS_SPEED, speed); renderPanel(); }
      else if (t.id === 'ttdemoReset' && o.onReset) { toggle(false); o.onReset(); }
    };
  }
  function toggle(force) {
    var open = force != null ? force : panelEl.style.display === 'none';
    panelEl.style.display = open ? '' : 'none';
    fabEl.setAttribute('aria-expanded', String(open));
    ssSet(SS_PANEL, open ? '1' : '0');
  }

  window.KitDemo = {
    get active() { return active; },
    get forced() { return forced; },
    get speed() { return speed; },
    // scaled delay: KitDemo.wait(1200) waits ~1.2s at Normal speed
    wait: function (ms) { return new Promise(function (r) { setTimeout(r, Math.round(ms * SPEEDS[speed].x)); }); },
    scale: function (ms) { return Math.round(ms * SPEEDS[speed].x); },
    enter: function () { ssSet(SS_DEMO, '1'); location.reload(); },
    exit: function () {
      ssDel(SS_DEMO);
      var u = new URL(location.href); u.searchParams.delete('demo');
      location.href = u.toString();
    },
    // KitDemo.panel({ sections:[{title, chips:[{label,hint,onClick}], actions:[{label,onClick}]}], onReset })
    panel: function (opts) { panelOpts = opts; if (document.body) renderPanel(); },
    // deterministic pseudo-random helpers for sample data
    rng: function (seedStr) {
      var h = 2166136261;
      for (var i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
      return function () { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1e9) / 1e9; };
    },
    download: function (name, text, type) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' }));
      a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    }
  };

  function onReady() { renderBanner(); renderPanel(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady); else onReady();
})();
