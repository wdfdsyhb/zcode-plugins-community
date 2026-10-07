// ClarityKit preview client — embedded VERBATIM into generated pages by preview.mjs.
// Browser-only (module script); guarded so importing it under Node is a no-op.
// Syntax-checked by tests/test-preview-js.mjs via `node --check`.
//
// Responsibilities: theme management (re-render, not CSS filters), explicit mermaid
// render queue with per-card error fallbacks, per-card SVG pan/zoom, drag-to-resize
// bottom bar, editable source with live re-render (temporary, refresh reverts),
// source copy, sidebar nav.
//
// Known-good choices (do not regress):
//   - ZOOM VIA width/height ATTRIBUTES, never CSS transform scale: mermaid nodes
//     carry CSS drop-shadow filters, and browsers rasterize filtered subtrees at
//     layout size — CSS-scaled diagrams blur no matter what. Setting the svg's
//     width/height (viewBox unchanged) forces a crisp vector re-render at any size.
//   - MEASURE VIA viewBox (normalized if missing): getBBox() on the root svg lies
//     for several diagram types (mindmap, quadrantChart) — fits came out small and
//     off-center.
//   - THEME SWITCHING re-renders all diagrams and RESTORES each card's transform
//     (initialize alone cannot restyle existing SVGs; a naive re-render would throw
//     away the user's zoom/pan).
if (typeof document === 'undefined') {
  // Not a browser — nothing to do (this file is data when embedded).
} else {

const CK = window.__CK ?? { cdn: '' };
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

// ---------- theme palettes (mermaid 'base' themeVariables) ----------
const PALETTES = {
  light: {
    background: '#ffffff',
    primaryColor: '#e5ebff', primaryBorderColor: '#7186f0', primaryTextColor: '#1d2433',
    secondaryColor: '#dcf2e9', secondaryBorderColor: '#3fa184', secondaryTextColor: '#173129',
    tertiaryColor: '#fbeecd', tertiaryBorderColor: '#d2a53c', tertiaryTextColor: '#3a2f14',
    lineColor: '#7e87a0', textColor: '#252c3d', mainBkg: '#e5ebff', edgeLabelBackground: '#ffffff',
    nodeBorder: '#7186f0', nodeTextColor: '#1d2433',
    clusterBkg: '#f2f4fb', clusterBorder: '#c2c9e0', titleColor: '#252c3d',
    actorBkg: '#e5ebff', actorBorder: '#7186f0', actorTextColor: '#1d2433',
    actorLineColor: '#b4bccf', signalColor: '#3c4458', signalTextColor: '#3c4458',
    noteBkgColor: '#fbeecd', noteBorderColor: '#d2a53c', noteTextColor: '#3a2f14',
    activationBkgColor: '#dcf2e9', activationBorderColor: '#3fa184',
    labelBoxBkgColor: '#f6d8de', labelBoxBorderColor: '#c25b6c', labelTextColor: '#3c1a21',
    loopTextColor: '#3c4458',
    rowOdd: '#f6f8ff', rowEven: '#edf1fc',
  },
  dark: {
    background: '#10151f',
    primaryColor: '#1e2a47', primaryBorderColor: '#6b86e8', primaryTextColor: '#dfe5f7',
    secondaryColor: '#173830', secondaryBorderColor: '#3fa184', secondaryTextColor: '#cdeee1',
    tertiaryColor: '#3a3018', tertiaryBorderColor: '#c79a37', tertiaryTextColor: '#f2e5c4',
    lineColor: '#828dae', textColor: '#d3daeb', mainBkg: '#1e2a47', edgeLabelBackground: '#10151f',
    nodeBorder: '#6b86e8', nodeTextColor: '#dfe5f7',
    clusterBkg: '#161d2d', clusterBorder: '#2d3a57', titleColor: '#d3daeb',
    actorBkg: '#1e2a47', actorBorder: '#6b86e8', actorTextColor: '#dfe5f7',
    actorLineColor: '#454f68', signalColor: '#b7c0d6', signalTextColor: '#b7c0d6',
    noteBkgColor: '#3a3018', noteBorderColor: '#c79a37', noteTextColor: '#f2e5c4',
    activationBkgColor: '#173830', activationBorderColor: '#3fa184',
    labelBoxBkgColor: '#3d2230', labelBoxBorderColor: '#c25b6c', labelTextColor: '#f2d4dc',
    loopTextColor: '#b7c0d6',
    rowOdd: '#182034', rowEven: '#1c2540',
  },
};

// ---------- theme ----------
const themeBtn = $('#theme-toggle');
function storedTheme() {
  try {
    const t = localStorage.getItem('ck-theme');
    if (t === 'light' || t === 'dark') return t;
  } catch {}
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
let currentTheme = storedTheme();

// ---------- cards ----------
// A `.ck-card` without a `.ck-src` (e.g. the static "generated machine views"
// link card) is not a diagram card — skip it. This must be null-safe: a crash
// here runs at module top level and kills the WHOLE client (no theme button,
// no renders) — that regression shipped once; the DOM test covers it.
const cards = $$('.ck-card').map((el, i) => {
  const srcEl = $('.ck-src', el);
  return {
    el,
    renderId: `ck-mmd-${i}`,
    renderSeq: 0,        // fresh id per render (see renderCard)
    original: srcEl?.value ?? srcEl?.textContent ?? '',
    target: $('.ck-stage', el),
    viewportEl: $('.ck-viewport', el),
    zoomPct: $('.ck-zoom-pct', el),
    errorBox: $('.ck-error', el),
    details: $('.ck-source', el),
    srcEl,
    vp: null,
    base: null,         // { w, h } intrinsic content size (viewBox), set after render
    renderedOnce: false,
    userHeight: null,   // set when the user drags the resize bar
    fsPrev: null,       // transform to restore when leaving fullscreen
    editTimer: null,
  };
}).filter((c) => c.srcEl);
const cardByEl = new Map(cards.map((c) => [c.el, c]));
const codeOf = (card) => (card.srcEl?.value ?? card.original);

// ---------- pan/zoom viewport ----------
const MIN_SCALE = 0.15, MAX_SCALE = 10;
// Small diagrams upscale to fill the viewport (capped so text stays sane); large
// ones scale down. Insets keep content clear of the floating controls (top) and
// the resize/hint bar (bottom).
const FIT_MAX = 2.2;
const INSET_TOP = 48, INSET_BOTTOM = 34, INSET_SIDE = 16;

function makeViewport(rootEl, card) {
  const stage = $('.ck-stage', rootEl);
  const svgEl = () => $('svg', stage);
  const state = { scale: 1, tx: 0, ty: 0 };
  const clamp = (s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  const apply = () => {
    const svg = svgEl();
    if (svg && card.base) {
      // zoom by attribute — a true vector re-render at the new size, never blurry
      svg.setAttribute('width', String(card.base.w * state.scale));
      svg.setAttribute('height', String(card.base.h * state.scale));
    }
    stage.style.transform = `translate(${state.tx}px, ${state.ty}px)`;
    if (card.zoomPct) card.zoomPct.textContent = `${Math.round(state.scale * 100)}%`;
  };

  const fit = () => {
    if (!card.base) return;
    const availW = rootEl.clientWidth - INSET_SIDE * 2;
    const availH = rootEl.clientHeight - INSET_TOP - INSET_BOTTOM;
    state.scale = clamp(Math.min(availW / card.base.w, availH / card.base.h, FIT_MAX));
    const dw = card.base.w * state.scale, dh = card.base.h * state.scale;
    state.tx = (rootEl.clientWidth - dw) / 2;
    state.ty = INSET_TOP + (availH - dh) / 2;
    apply();
  };
  const zoomAt = (px, py, factor) => {
    const ns = clamp(state.scale * factor);
    const k = ns / state.scale;
    state.tx = px - k * (px - state.tx);
    state.ty = py - k * (py - state.ty);
    state.scale = ns;
    apply();
  };
  const center = () => ({ x: rootEl.clientWidth / 2, y: rootEl.clientHeight / 2 });

  rootEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = rootEl.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.00125));
  }, { passive: false });

  // pointer drag + pinch (Pointer Events unify mouse/touch)
  const pointers = new Map();
  let lastPinch = null;
  rootEl.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.ck-vp-controls') || e.target.closest('.ck-resizer')) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    rootEl.setPointerCapture(e.pointerId);
    rootEl.classList.add('dragging');
  });
  rootEl.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      state.tx += e.clientX - prev.x;
      state.ty += e.clientY - prev.y;
      apply();
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (lastPinch) {
        const r = rootEl.getBoundingClientRect();
        zoomAt(mid.x - r.left, mid.y - r.top, dist / lastPinch);
      }
      lastPinch = dist;
    }
  });
  const releasePointer = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) lastPinch = null;
    if (!pointers.size) rootEl.classList.remove('dragging');
  };
  rootEl.addEventListener('pointerup', releasePointer);
  rootEl.addEventListener('pointercancel', releasePointer);

  rootEl.addEventListener('dblclick', (e) => {
    if (e.target.closest('.ck-vp-controls') || e.target.closest('.ck-resizer')) return;
    fit();
  });

  const controls = $('.ck-vp-controls', rootEl);
  if (controls) {
    $('.ck-zin', controls)?.addEventListener('click', () => { const c = center(); zoomAt(c.x, c.y, 1.25); });
    $('.ck-zout', controls)?.addEventListener('click', () => { const c = center(); zoomAt(c.x, c.y, 1 / 1.25); });
    $('.ck-zfit', controls)?.addEventListener('click', fit);
    $('.ck-full', controls)?.addEventListener('click', () => toggleFullscreen(card));
  }

  // bottom bar: hint text that doubles as the drag-to-resize handle
  const resizer = $('.ck-resizer', rootEl);
  if (resizer) {
    resizer.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      resizer.setPointerCapture(e.pointerId);
      const startH = rootEl.clientHeight;
      const startY = e.clientY;
      const move = (ev) => {
        const h = Math.min(Math.max(startH + (ev.clientY - startY), 220), Math.round(window.innerHeight * 0.92));
        card.userHeight = h;
        rootEl.style.height = `${h}px`;
      };
      const up = () => {
        resizer.removeEventListener('pointermove', move);
        resizer.removeEventListener('pointerup', up);
      };
      resizer.addEventListener('pointermove', move);
      resizer.addEventListener('pointerup', up);
    });
  }

  return { fit, apply, state };
}

function toggleFullscreen(card) {
  const vp = card.viewportEl;
  const on = !vp.classList.contains('fullscreen');
  if (on) {
    card.fsPrev = { ...card.vp.state };
    vp.classList.add('fullscreen');
    card.vp.fit();
  } else {
    vp.classList.remove('fullscreen');
    if (card.fsPrev) { Object.assign(card.vp.state, card.fsPrev); card.vp.apply(); }
    else card.vp.fit();
  }
}
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const vp = $('.ck-viewport.fullscreen');
  if (vp) {
    const card = cards.find((c) => c.viewportEl === vp);
    if (card) toggleFullscreen(card);
  }
});

cards.forEach((c) => { c.vp = makeViewport(c.viewportEl, c); });

// ---------- render ----------
let mermaidMod = null;
async function ensureMermaid() {
  if (!mermaidMod) mermaidMod = CK.mermaid ?? (await import(CK.cdn)).default;
  return mermaidMod;
}
function setError(card, err) {
  if (!err) {
    card.errorBox.hidden = true;
    card.errorBox.textContent = '';
    return;
  }
  card.errorBox.hidden = false;
  card.errorBox.textContent = String(err?.message ?? err).split('\n').slice(0, 6).join('\n');
  if (card.details) card.details.open = true;
}
// Normalize the freshly rendered svg: ensure a viewBox (getBBox lies for several
// diagram types — mindmap, quadrantChart — so fit/sizing uses the viewBox), record
// intrinsic size, clear mermaid's sizing styles.
function adoptSvg(card) {
  const svg = $('svg', card.target);
  if (!svg) return null;
  let vb = svg.viewBox?.baseVal;
  if (!vb || !vb.width || !vb.height) {
    const w = parseFloat(svg.getAttribute('width')) || 800;
    const h = parseFloat(svg.getAttribute('height')) || 600;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    vb = svg.viewBox?.baseVal;
    if (!vb || !vb.width || !vb.height) {
      // no viewBox API (or empty): parse the attribute string directly
      const parts = (svg.getAttribute('viewBox') ?? '0 0 800 600').split(/[\s,]+/).map(Number);
      card.base = { w: parts[2] || 800, h: parts[3] || 600 };
      svg.removeAttribute('style');
      svg.style.maxWidth = 'none';
      return svg;
    }
  }
  svg.removeAttribute('style');
  svg.style.maxWidth = 'none';
  card.base = { w: vb.width, h: vb.height };
  return svg;
}
// Viewport height follows the diagram (clamped); a user-set height always wins.
function sizeViewport(card) {
  if (card.userHeight) { card.viewportEl.style.height = `${card.userHeight}px`; return; }
  if (!card.base) return;
  const availW = card.viewportEl.clientWidth - INSET_SIDE * 2;
  const s0 = Math.min(availW / card.base.w, FIT_MAX);
  const h = Math.min(Math.max(card.base.h * s0 + INSET_TOP + INSET_BOTTOM, 300), Math.round(window.innerHeight * 0.7));
  card.viewportEl.style.height = `${h}px`;
}
async function renderCard(card, m, theme, { keepTransform = false } = {}) {
  const keep = keepTransform && card.renderedOnce && card.vp ? { ...card.vp.state } : null;
  try {
    // fresh id per render: mermaid's cleanup of a previous svg with the SAME id
    // (already inserted into our DOM) is fragile across versions — never reuse ids
    const { svg } = await m.render(`${card.renderId}-r${++card.renderSeq}`, codeOf(card));
    card.target.innerHTML = svg;
    setError(card, null);
    adoptSvg(card);
    sizeViewport(card);
    if (keep) { Object.assign(card.vp.state, keep); card.vp.apply(); }
    else card.vp.fit();
    card.renderedOnce = true;
  } catch (err) {
    card.target.innerHTML = '';
    setError(card, err);
  }
}
async function renderAll(theme) {
  const m = await ensureMermaid();
  m.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    themeVariables: PALETTES[theme],
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    fontSize: 14,
    htmlLabels: false,
    flowchart: { useMaxWidth: false },
    class: { useMaxWidth: false },
    state: { useMaxWidth: false },
    sequence: { useMaxWidth: false },
    er: { useMaxWidth: false },
    journey: { useMaxWidth: false },
    mindmap: { useMaxWidth: false },
    quadrantChart: { useMaxWidth: false },
  });
  for (const card of cards) await renderCard(card, m, theme, { keepTransform: true });
}

// ---------- theme application ----------
const glyph = () => (currentTheme === 'dark' ? '☀' : '☾');
async function applyTheme(theme, { rerender = true } = {}) {
  currentTheme = theme;
  document.documentElement.dataset.theme = theme;
  if (themeBtn) themeBtn.textContent = glyph();
  try { localStorage.setItem('ck-theme', theme); } catch {}
  if (rerender && cards.length) await renderAll(theme);
}
themeBtn?.addEventListener('click', () => {
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
});

// ---------- editable source: live re-render (temporary — refresh reverts) ----------
// Event delegation: one document-level dispatcher, immune to per-element wiring
// order — buttons work no matter when/where they were created.
async function reInitMermaid(m) {
  m.initialize({
    startOnLoad: false, securityLevel: 'strict', theme: 'base',
    themeVariables: PALETTES[currentTheme],
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    fontSize: 14,
    htmlLabels: false,
    flowchart: { useMaxWidth: false },
    class: { useMaxWidth: false },
    state: { useMaxWidth: false },
    sequence: { useMaxWidth: false },
    er: { useMaxWidth: false },
    journey: { useMaxWidth: false },
    mindmap: { useMaxWidth: false },
    quadrantChart: { useMaxWidth: false },
  });
  return m;
}
document.addEventListener('input', (e) => {
  const ta = e.target;
  if (!ta.classList?.contains('ck-src') || ta.tagName !== 'TEXTAREA') return;
  const card = cards.find((c) => c.srcEl === ta);
  if (!card) return;
  clearTimeout(card.editTimer);
  card.editTimer = setTimeout(async () => {
    try {
      const m = await reInitMermaid(await ensureMermaid());
      await renderCard(card, m, currentTheme); // content changed size → refit
    } catch (err) { setError(card, err); }
  }, 600);
});
document.addEventListener('click', async (e) => {
  const btn = e.target.closest?.('.ck-revert, .ck-copy');
  if (!btn) return;
  const cardEl = btn.closest('.ck-card');
  const card = cardByEl.get(cardEl);
  if (!card) return;
  try {
    if (btn.classList.contains('ck-revert')) {
      card.srcEl.value = card.original;
      const m = await reInitMermaid(await ensureMermaid());
      await renderCard(card, m, currentTheme);
    } else {
      try {
        await navigator.clipboard.writeText(codeOf(card));
        btn.textContent = 'copied';
      } catch {
        btn.textContent = 'copy failed';
      }
      setTimeout(() => { btn.textContent = 'copy source'; }, 1200);
    }
  } catch (err) { setError(card, err); }
});

// ---------- sidebar active-section highlight ----------
const navLinks = $$('.ck-nav a[href^="#"]');
if ('IntersectionObserver' in window && navLinks.length) {
  const byId = new Map(navLinks.map((a) => [a.getAttribute('href').slice(1), a]));
  const obs = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting) {
        navLinks.forEach((a) => a.classList.remove('active'));
        byId.get(en.target.id)?.classList.add('active');
      }
    }
  }, { rootMargin: '-20% 0px -70% 0px' });
  cards.forEach((c) => obs.observe(c.el));
}

// ---------- boot ----------
document.documentElement.dataset.theme = currentTheme;
if (themeBtn) themeBtn.textContent = glyph();
if (cards.length) renderAll(currentTheme).catch((err) => {
  document.body.insertAdjacentHTML('afterbegin',
    `<div class="ck-boot-error">mermaid failed to load from ${CK.cdn} — ${String(err?.message ?? err)}</div>`);
});

}
