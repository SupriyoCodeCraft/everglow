/* ==========================================================================
   CONFIG — everything personal lives here. Edit these values.
   ==========================================================================

   recipientName    Shown beneath "I LOVE YOU". Inserted with textContent.
   openingSentence  The first line of the experience. This one field is
                    rendered as HTML, so only put TRUSTED, developer-authored
                    markup in it (for example an <em> for the gold italic).
   message          The personal message. An array of short lines (or one
                    string with line breaks). Each line is revealed on its
                    own. Inserted with textContent.
   signature        The small closing signature beside the little heart.

   Advanced options below are optional.
   ========================================================================== */
const CONFIG = {
  recipientName: 'My Love',

  openingSentence: 'Some feelings deserve their own <em>little universe.</em>',

  message: [
    'You are the quiet place my heart keeps returning to.',
    'In every ordinary hour, you make the world softer, warmer, and infinitely more beautiful.',
    'Whatever tomorrow becomes, I hope it always has you in it.'
  ],

  signature: 'Always yours',

  /* ---- Advanced ---- */
  headline: ['I LOVE', 'YOU'],   // each entry is a line; lines stack on narrow portrait screens
  timeScale: 1,                  // 1 = designed pacing; 0.9 slower, 1.1 faster
  maxAmbientParticles: 110,      // upper bound for drifting stardust
  maxSparks: 200,                // size of the burst-particle pool (hard cap)
  colors: {                      // RGB triplets used for particle glow sprites
    champagne: [238, 208, 156],
    rose: [214, 122, 142],
    ivory: [255, 240, 214]
  }
};

/* ==========================================================================
   Experience
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- Geometry ---------- */
  // Single source of truth for the heart. Start/end at the top notch so the
  // light can trace: notch -> left lobe -> bottom point -> right lobe -> notch.
  const HEART_PATH =
    'M100 40 C92 22 76 8 54 8 C30 8 8 24 8 52 C8 84 40 120 100 168 ' +
    'C160 120 192 84 192 52 C192 24 170 8 146 8 C124 8 108 22 100 40 Z';
  const VIEW = { x: 0, y: -2, w: 200, h: 180 };       // matches the SVG viewBox
  const HEART_CENTER = { x: 100, y: 88 };
  const HEART_NOTCH = { x: 100, y: 40 };

  /* ---------- Helpers ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const TAU = Math.PI * 2;
  const reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Elements ---------- */
  const els = {
    stage: $('#stage'),
    glow: $('#glow'),
    drifts: $('#drifts'),
    intro: $('#intro'),
    introText: $('#introText'),
    heart: $('#heart'),
    head: $('#head'),
    core: $('#core'),
    fill: $('.heart__fill'),
    echo: $('.heart__echo'),
    aura: $('.heart__aura'),
    line: $('.heart__line'),
    hot: $('.heart__hot'),
    comet: $('.heart__comet'),
    finale: $('#finale'),
    titleWrap: $('#titleWrap'),
    title: $('#title'),
    beam: $('#beam'),
    name: $('#name'),
    nameText: $('#nameText'),
    nameRules: $$('.name__rule'),
    message: $('#message'),
    coda: $('#coda'),
    codaHeart: $('#codaHeart'),
    signature: $('#signature'),
    replay: $('#replay')
  };

  // Apply the shared heart geometry to every [data-heart] path
  $$('[data-heart]').forEach(function (p) { p.setAttribute('d', HEART_PATH); });
  const heartMeasure = $('#heartMeasure');

  /* ==========================================================================
     Sky — one canvas, one loop: ambient stardust + pooled sparks
     ========================================================================== */
  const Sky = (function () {
    const canvas = $('#sky');
    const ctx = canvas.getContext('2d');
    const fx = { alpha: 0, pulse: 0, attract: 0, cx: 0, cy: 0 };
    const sprites = {};
    const sparks = [];
    let ambient = [];
    let W = 0, H = 0, DPR = 1;
    let raf = 0, last = 0, still = false, cursor = 0;

    function makeSprite(rgb) {
      const s = 64, c = document.createElement('canvas');
      c.width = c.height = s;
      const g = c.getContext('2d'), r = s / 2;
      const grad = g.createRadialGradient(r, r, 0, r, r, r);
      const col = rgb[0] + ',' + rgb[1] + ',' + rgb[2];
      grad.addColorStop(0, 'rgba(' + col + ',1)');
      grad.addColorStop(0.18, 'rgba(' + col + ',.85)');
      grad.addColorStop(0.45, 'rgba(' + col + ',.22)');
      grad.addColorStop(1, 'rgba(' + col + ',0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
      return c;
    }
    Object.keys(CONFIG.colors).forEach(function (k) { sprites[k] = makeSprite(CONFIG.colors[k]); });

    for (let i = 0; i < CONFIG.maxSparks; i++) {
      sparks.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, drag: 1, g: 0, a: 1, sprite: null, streak: false });
    }

    function makeAmbient() {
      const z = Math.pow(Math.random(), 1.6) * 0.85 + 0.15; // 0.15 (far) .. 1 (near)
      return {
        x: rand(0, W), y: rand(0, H), z: z,
        r: 0.45 + z * 1.5,
        a: 0.25 + z * 0.6,
        vx: rand(-2, 2) * z,
        vy: -(2.5 + z * 9) * rand(0.5, 1.2),
        sway: rand(2, 9) * z,
        sw: rand(0.2, 0.7),
        ph: rand(0, TAU),
        tw: rand(0.6, 1.6),
        t: rand(0, 100),
        ox: 0, oy: 0,
        sprite: Math.random() < 0.72 ? sprites.champagne : sprites.rose
      };
    }

    function targetCount() {
      return clamp(Math.round((W * H) / 15000), 40, CONFIG.maxAmbientParticles);
    }

    function resize() {
      const nw = canvas.clientWidth || window.innerWidth;
      const nh = canvas.clientHeight || window.innerHeight;
      const sx = W ? nw / W : 1, sy = H ? nh / H : 1;
      W = nw; H = nh;
      DPR = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ambient.forEach(function (p) { p.x *= sx; p.y *= sy; });
      const n = targetCount();
      while (ambient.length < n) ambient.push(makeAmbient());
      if (ambient.length > n) ambient.length = n;
      fx.cx = W / 2; fx.cy = H / 2;
      if (still) render(0);
    }

    function take() {
      for (let i = 0; i < sparks.length; i++) {
        cursor = (cursor + 1) % sparks.length;
        if (!sparks[cursor].on) return sparks[cursor];
      }
      return null; // pool exhausted: respect the cap
    }

    function emit(x, y, n, o) {
      o = o || {};
      const sprite = sprites[o.sprite] || sprites.champagne;
      for (let i = 0; i < n; i++) {
        const s = take();
        if (!s) return;
        const ang = o.angle === undefined ? rand(0, TAU) : o.angle + rand(-0.5, 0.5) * (o.spread || 0);
        const sp = o.speed ? rand(o.speed[0], o.speed[1]) : rand(20, 60);
        s.on = true; s.x = x; s.y = y;
        s.vx = Math.cos(ang) * sp; s.vy = Math.sin(ang) * sp;
        s.life = 0;
        s.max = o.life ? rand(o.life[0], o.life[1]) : rand(1, 2);
        s.size = o.size ? rand(o.size[0], o.size[1]) : rand(0.6, 1.4);
        s.drag = o.drag === undefined ? 1.2 : o.drag;
        s.g = o.g || 0;
        s.a = o.alpha || 0.9;
        s.sprite = sprite;
        s.streak = !!o.streak;
      }
    }

    function render(dt) {
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      const fa = fx.alpha;
      if (fa > 0.001) {
        const k = 1 - Math.exp(-dt * 2.6);
        for (let i = 0; i < ambient.length; i++) {
          const p = ambient[i];
          if (dt > 0) {
            p.t += dt;
            p.x += (p.vx + Math.sin(p.t * p.sw + p.ph) * p.sway) * dt;
            p.y += p.vy * dt;
            if (p.y < -12) { p.y = H + 12; p.x = rand(0, W); }
            else if (p.y > H + 12) { p.y = -12; p.x = rand(0, W); }
            if (p.x < -12) p.x = W + 12; else if (p.x > W + 12) p.x = -12;

            // Offsets: gentle pull toward the centre, and an outward push on pulses
            let tx = 0, ty = 0;
            const dx = p.x - fx.cx, dy = p.y - fx.cy;
            if (fx.attract > 0.001) {
              const f = fx.attract * (0.55 + 0.45 * p.z);
              tx -= dx * f; ty -= dy * f;
            }
            if (fx.pulse > 0.001) {
              const d = Math.sqrt(dx * dx + dy * dy) || 1;
              const push = fx.pulse * 16 * p.z;
              tx += (dx / d) * push; ty += (dy / d) * push;
            }
            p.ox += (tx - p.ox) * k;
            p.oy += (ty - p.oy) * k;
          }
          const tw = 0.62 + 0.38 * Math.sin(p.t * p.tw * 2 + p.ph);
          let a = p.a * tw * fa * (1 + fx.pulse * 0.9);
          if (a <= 0.01) continue;
          if (a > 1) a = 1;
          const rr = p.r * (1 + fx.pulse * 0.3) * 3.2;
          ctx.globalAlpha = a;
          ctx.drawImage(p.sprite, p.x + p.ox - rr, p.y + p.oy - rr, rr * 2, rr * 2);
        }
      }

      for (let i = 0; i < sparks.length; i++) {
        const s = sparks[i];
        if (!s.on) continue;
        if (dt > 0) {
          s.life += dt;
          if (s.life >= s.max) { s.on = false; continue; }
          const damp = Math.exp(-s.drag * dt);
          s.vx *= damp; s.vy *= damp;
          s.vy += s.g * dt;
          s.x += s.vx * dt; s.y += s.vy * dt;
        }
        const t = s.life / s.max;
        const a = s.a * Math.pow(1 - t, 1.4) * (t < 0.08 ? t / 0.08 : 1);
        if (a <= 0.01) continue;
        const r = s.size * (1 - 0.35 * t) * 3;
        ctx.globalAlpha = a;
        if (s.streak) {
          const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
          const len = Math.min(r * 0.8 + sp * 0.06, 40);
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(Math.atan2(s.vy, s.vx));
          ctx.drawImage(s.sprite, -len, -r * 0.5, len * 2, r);
          ctx.restore();
        } else {
          ctx.drawImage(s.sprite, s.x - r, s.y - r, r * 2, r * 2);
        }
      }
      ctx.globalAlpha = 1;
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      render(dt);
    }

    function start() {
      if (raf || still) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }
    function clearSparks() { sparks.forEach(function (s) { s.on = false; }); }
    function reset() {
      clearSparks();
      fx.alpha = 0; fx.pulse = 0; fx.attract = 0;
      ambient.forEach(function (p) { p.ox = 0; p.oy = 0; });
    }
    function setStill(v) {
      still = v;
      if (v) { stop(); clearSparks(); render(0); }
      else start();
    }

    return { fx: fx, emit: emit, resize: resize, setStill: setStill, reset: reset };
  })();

  /* ==========================================================================
     Content (built once from CONFIG)
     ========================================================================== */
  let introWords = [], chars = [], glyphs = [], msgLines = [];

  function splitWords(root) {
    const spans = [];
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(' '));
            } else {
              const s = document.createElement('span');
              s.className = 'w';
              s.textContent = part;
              frag.appendChild(s);
              spans.push(s);
            }
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    })(root);
    return spans;
  }

  function buildContent() {
    // Opening sentence — the only trusted-HTML field
    els.introText.innerHTML = CONFIG.openingSentence;
    introWords = splitWords(els.introText);

    // Headline
    els.title.textContent = '';
    els.title.setAttribute('aria-label', CONFIG.headline.join(' ').toLowerCase().replace(/^i /, 'I '));
    CONFIG.headline.forEach(function (lineText) {
      const line = document.createElement('span');
      line.className = 'line';
      line.setAttribute('aria-hidden', 'true');
      lineText.split(/\s+/).filter(Boolean).forEach(function (w) {
        const word = document.createElement('span');
        word.className = 'word';
        w.split('').forEach(function (c) {
          const ch = document.createElement('span');
          ch.className = 'ch';
          const g = document.createElement('span');
          g.className = 'ch__g';
          g.textContent = c;
          ch.appendChild(g);
          word.appendChild(ch);
        });
        line.appendChild(word);
      });
      els.title.appendChild(line);
    });
    chars = $$('.ch', els.title);
    glyphs = $$('.ch__g', els.title);

    // Name
    els.nameText.textContent = CONFIG.recipientName || '';
    if (!CONFIG.recipientName) els.name.style.display = 'none';

    // Message — one paragraph per line
    const lines = (Array.isArray(CONFIG.message) ? CONFIG.message : String(CONFIG.message || '').split(/\n+/))
      .map(function (l) { return String(l).trim(); }).filter(Boolean);
    els.message.textContent = '';
    lines.forEach(function (l) {
      const p = document.createElement('p');
      p.className = 'message__line';
      p.textContent = l;
      els.message.appendChild(p);
    });
    msgLines = $$('.message__line', els.message);

    // Signature
    els.signature.textContent = CONFIG.signature || '';
    if (!CONFIG.signature) els.signature.style.display = 'none';
  }

  /* ==========================================================================
     Measuring
     ========================================================================== */
  const geo = { letters: [], sheen: [], cx: 0, cy: 0, offset: 0, beamW: 0, heartRect: null, len: 0 };

  // Per-glyph gradient offsets keep the champagne gradient continuous across
  // all letters, and record each letter's position relative to the title centre.
  function measureTitle() {
    const tr = els.title.getBoundingClientRect();
    const tcx = tr.left + tr.width / 2, tcy = tr.top + tr.height / 2;
    geo.letters = chars.map(function (ch, i) {
      const r = ch.getBoundingClientRect();
      const g = glyphs[i].getBoundingClientRect();
      glyphs[i].style.setProperty('--bx', (tr.left - g.left) + 'px');
      glyphs[i].style.setProperty('--by', (tr.top - g.top) + 'px');
      glyphs[i].style.setProperty('--bw', tr.width + 'px');
      glyphs[i].style.setProperty('--bh', tr.height + 'px');
      const lx = r.left + r.width / 2 - tcx, ly = r.top + r.height / 2 - tcy;
      return { cx: lx, dx: -lx * 0.92, dy: -ly * 0.92 };
    });
    geo.sheen = glyphs
      .map(function (g, i) { return { g: g, x: geo.letters[i].cx }; })
      .sort(function (a, b) { return a.x - b.x; })
      .map(function (o) { return o.g; });
  }

  function toClient(x, y, r) {
    return {
      x: r.left + ((x - VIEW.x) / VIEW.w) * r.width,
      y: r.top + ((y - VIEW.y) / VIEW.h) * r.height
    };
  }

  /* ==========================================================================
     Per-run preparation (also the reset used by replay)
     ========================================================================== */
  function clearDash(el) {
    el.style.removeProperty('stroke-dasharray');
    el.style.removeProperty('stroke-dashoffset');
  }

  function prepare() {
    const animated = [].concat(
      [els.glow, els.drifts, els.intro, els.heart, els.head, els.fill, els.hot, els.comet,
        els.echo, els.core, els.finale, els.title, els.beam, els.name, els.coda,
        els.codaHeart, els.signature],
      els.nameRules, introWords, chars, glyphs, msgLines
    );
    gsap.set(animated, { clearProps: 'all' });
    [els.line, els.aura, els.comet].forEach(clearDash);
    els.title.style.setProperty('--halo', '0');
    glyphs.forEach(function (g) { g.style.setProperty('--lit', '0'); });

    // Measure with a clean, untransformed layout
    measureTitle();
    const sr = els.stage.getBoundingClientRect();
    geo.cx = sr.left + sr.width / 2;
    geo.cy = sr.top + sr.height / 2;
    const tw = els.titleWrap.getBoundingClientRect();
    geo.offset = geo.cy - (tw.top + tw.height / 2); // places the headline exactly where the heart was
    geo.beamW = tw.width * 1.36;
    geo.len = heartMeasure.getTotalLength();

    // Initial (hidden) states — nothing can flash before its moment
    gsap.set(els.glow, { opacity: 0, scale: 0.6 });
    gsap.set(els.drifts, { opacity: 0 });
    gsap.set(els.intro, { opacity: 0 });
    gsap.set(introWords, { opacity: 0, y: 16, filter: 'blur(12px)' });
    gsap.set(els.heart, { opacity: 0 });
    gsap.set(els.head, { opacity: 0, scale: 0, x: HEART_CENTER.x, y: HEART_CENTER.y });
    gsap.set([els.fill, els.hot, els.comet, els.echo], { opacity: 0 });
    gsap.set(els.core, { opacity: 0, scale: 0.2 });
    gsap.set(els.finale, { y: geo.offset });
    gsap.set(els.title, { clipPath: 'inset(50% -8% 50% -8%)' });
    gsap.set(chars, { opacity: 0 });
    gsap.set(els.beam, { opacity: 0, scaleX: 0.04 });
    gsap.set(els.name, { opacity: 0, y: 14, filter: 'blur(8px)' });
    gsap.set(els.nameRules, { scaleX: 0 });
    gsap.set(msgLines, { opacity: 0, y: 14, filter: 'blur(6px)' });
    gsap.set(els.coda, { opacity: 1 });
    gsap.set(els.codaHeart, { opacity: 0, scale: 0.5 });
    gsap.set(els.signature, { opacity: 0, y: 8 });
  }

  /* ==========================================================================
     Timeline
     ========================================================================== */
  let tl = null;
  const state = { running: false };

  function onComplete() {
    state.running = false;
    els.stage.classList.add('is-complete');
  }

  function buildTimeline() {
    const fx = Sky.fx;
    const draw = { p: 0 };
    const release = { p: 0 };

    // Master timings (seconds) — tweak pacing here
    const T = {
      intro: 0.7,        // opening sentence appears
      introOut: 3.2,     // ...and dissolves
      light: 3.6,        // the first point of light
      draw: 4.7,         // heart starts being traced
      drawDur: 2.3,
      beat: 7.45,        // heartbeat
      transform: 9.5,    // heart -> I LOVE YOU
      message: 13.5      // name + message
    };
    const drawEnd = T.draw + T.drawDur;

    /* ----- Draw callbacks ----- */
    function onDrawStart() {
      geo.heartRect = els.heart.getBoundingClientRect();
    }
    function onDraw() {
      const p = draw.p;
      els.line.style.strokeDashoffset = 1 - p;
      els.aura.style.strokeDashoffset = 1 - p;
      els.comet.style.strokeDashoffset = 0.1 - p;
      const pt = heartMeasure.getPointAtLength(p * geo.len);
      gsap.set(els.head, { x: pt.x, y: pt.y });
      if (geo.heartRect && Math.random() < 0.6) {
        const c = toClient(pt.x, pt.y, geo.heartRect);
        Sky.emit(c.x, c.y, 1, {
          speed: [6, 26], life: [0.8, 1.7], size: [0.5, 1.2],
          drag: 1.2, g: -5, sprite: Math.random() < 0.75 ? 'champagne' : 'rose'
        });
      }
    }
    function onDrawEnd() {
      els.line.style.strokeDasharray = 'none';
      els.aura.style.strokeDasharray = 'none';
    }

    /* ----- Heartbeat sparks ----- */
    function beatBurst() {
      const r = els.heart.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      for (let i = 0; i < 22; i++) {
        const pt = heartMeasure.getPointAtLength(rand(0, geo.len));
        const c = toClient(pt.x, pt.y, r);
        Sky.emit(c.x, c.y, 1, {
          angle: Math.atan2(c.y - cy, c.x - cx), spread: 0.5,
          speed: [25, 95], life: [1, 2.2], size: [0.6, 1.5],
          drag: 1.5, g: -4, sprite: i % 3 ? 'champagne' : 'rose'
        });
      }
    }

    /* ----- Light released along the beam ----- */
    function onRelease() {
      const half = geo.beamW / 2;
      const n = Math.random() < 0.5 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const x = geo.cx + (Math.random() + Math.random() - 1) * half;
        const up = Math.random() < 0.5;
        Sky.emit(x, geo.cy + rand(-1, 1), 1, {
          angle: up ? -Math.PI / 2 : Math.PI / 2, spread: 1.1,
          speed: [14, 70], life: [0.9, 2], size: [0.5, 1.3],
          drag: 1.1, g: -6, sprite: Math.random() < 0.8 ? 'champagne' : 'ivory'
        });
      }
      if (Math.random() < 0.25) {
        const dir = Math.random() < 0.5 ? 0 : Math.PI;
        Sky.emit(geo.cx + (dir ? -1 : 1) * rand(0, geo.beamW * 0.35), geo.cy, 1, {
          angle: dir, spread: 0.2, speed: [60, 140], life: [0.5, 1], size: [0.8, 1.4],
          drag: 2.2, streak: true, sprite: 'ivory'
        });
      }
    }

    const t = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' }, onComplete: onComplete });
    t.timeScale(CONFIG.timeScale || 1);

    /* ===== Scene 1 — darkness comes alive ===== */
    t.to(fx, { alpha: 1, duration: 3.4, ease: 'sine.inOut' }, 0)
     .to(els.drifts, { opacity: 1, duration: 4, ease: 'sine.inOut' }, 0)
     .to(els.glow, { opacity: 0.8, scale: 1, duration: 3.8, ease: 'sine.inOut' }, 0.3)
     .set(els.intro, { opacity: 1 }, T.intro)
     .to(introWords, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.6, stagger: 0.17 }, T.intro)
     .to(introWords, {
        opacity: 0, y: -12, filter: 'blur(10px)', duration: 1.1,
        stagger: { each: 0.06, from: 'center' }, ease: 'power1.in'
      }, T.introOut)
     .set(els.intro, { opacity: 0 }, T.introOut + 1.9);

    /* ===== Scene 2 — light begins to form a heart ===== */
    t.set(els.heart, { opacity: 1 }, T.light)
     .to(els.head, { opacity: 1, scale: 1, duration: 1.0 }, T.light)
     .to(els.head, { y: HEART_NOTCH.y, duration: 0.9, ease: 'power2.inOut' }, T.light + 0.9)
     .to(draw, {
        p: 1, duration: T.drawDur, ease: 'sine.inOut',
        onStart: onDrawStart, onUpdate: onDraw, onComplete: onDrawEnd
      }, T.draw)
     .to(els.comet, { opacity: 1, duration: 0.4 }, T.draw)
     .to(els.comet, { opacity: 0, duration: 0.5, ease: 'power1.in' }, drawEnd - 0.1)
     .to(els.head, { scale: 2.6, opacity: 0, duration: 0.8 }, drawEnd - 0.05)
     .to(els.fill, { opacity: 1, duration: 1.4, ease: 'sine.inOut' }, drawEnd - 0.5);

    /* ===== Scene 3 — the heartbeat ===== */
    const B = T.beat;
    t.to(els.heart, { scale: 0.955, duration: 0.42, ease: 'sine.inOut' }, B)               // breath in
     .to(els.heart, { scale: 1.085, duration: 0.16, ease: 'power3.out' }, B + 0.42)        // lub
     .to(els.heart, { scale: 0.992, duration: 0.2, ease: 'sine.inOut' }, B + 0.58)
     .to(els.heart, { scale: 1.05, duration: 0.14, ease: 'power3.out' }, B + 0.78)         // dub
     .to(els.heart, { scale: 1, duration: 0.7, ease: 'power2.out' }, B + 0.92)             // release
     .call(beatBurst, null, B + 0.42)
     .fromTo(els.echo, { opacity: 0.6, scale: 1 }, { opacity: 0, scale: 1.55, duration: 1.4 }, B + 0.42)
     .to(fx, { pulse: 1, duration: 0.14, ease: 'power3.out' }, B + 0.42)
     .to(fx, { pulse: 0.15, duration: 0.3, ease: 'power2.out' }, B + 0.56)
     .to(fx, { pulse: 0.55, duration: 0.12, ease: 'power3.out' }, B + 0.78)
     .to(fx, { pulse: 0, duration: 1.3, ease: 'power2.out' }, B + 0.9)
     .to(els.glow, { scale: 1.12, opacity: 1, duration: 0.2 }, B + 0.42)
     .to(els.glow, { scale: 1, opacity: 0.85, duration: 1.4 }, B + 0.64);
    // ...then a brief, deliberate stillness before the transformation.

    /* ===== Scene 4 — the transformation ===== */
    const X = T.transform;
    // Gather: light and dust are drawn inward, the outline turns white-hot
    t.to(fx, { attract: 0.8, duration: 1.1, ease: 'power2.inOut' }, X)
     .to(els.heart, { scale: 0.8, duration: 1.1, ease: 'power2.inOut' }, X)
     .to(els.hot, { opacity: 1, duration: 0.9, ease: 'sine.in' }, X)
     .to(els.glow, { scale: 0.72, opacity: 1, duration: 1.1, ease: 'power2.inOut' }, X)
     .to(els.core, { opacity: 1, scale: 1, duration: 0.9, ease: 'power2.in' }, X + 0.4)
     // Compress: the heart flattens into a single horizontal line of light
     .to(els.heart, { scaleY: 0.02, scaleX: 1.25, duration: 0.6, ease: 'power3.in' }, X + 1.1)
     .to(els.fill, { opacity: 0, duration: 0.4 }, X + 1.1)
     .to(els.core, { scaleX: 5, scaleY: 0.25, opacity: 0, duration: 0.6, ease: 'power3.out' }, X + 1.7)
     .to(els.heart, { opacity: 0, duration: 0.3, ease: 'power1.in' }, X + 1.75)
     // Release: the beam stretches out across the stage
     .to(els.beam, { opacity: 1, scaleX: 1, duration: 0.9, ease: 'expo.out' }, X + 1.6)
     .to(release, { p: 1, duration: 1.3, ease: 'none', onUpdate: onRelease }, X + 1.7)
     .to(fx, { attract: 0, duration: 1.8, ease: 'power3.out' }, X + 1.7)
     .to(fx, { pulse: 0.8, duration: 0.2, ease: 'power2.out' }, X + 1.7)
     .to(fx, { pulse: 0, duration: 1.4, ease: 'power2.out' }, X + 1.9)
     .to(els.glow, { scale: 1.12, duration: 0.8, ease: 'power2.out' }, X + 1.7)
     // Reveal: a slit of light opens, and the letters unfold from it
     .to(els.title, { clipPath: 'inset(-40% -12% -40% -12%)', duration: 1.15, ease: 'power3.inOut' }, X + 1.75)
     .fromTo(chars, {
        opacity: 0,
        x: function (i) { return geo.letters[i].dx; },
        y: function (i) { return geo.letters[i].dy; },
        scale: 0.86,
        filter: 'blur(14px)'
      }, {
        opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)',
        duration: 1.6, ease: 'expo.out',
        stagger: { each: 0.06, from: 'center' },
        clearProps: 'filter'
      }, X + 1.85)
     .to(els.beam, { opacity: 0, duration: 1.1, ease: 'power2.inOut' }, X + 2.9);

    /* ===== Scene 5 — I LOVE YOU settles ===== */
    t.to(geo.sheen, { '--lit': 1, duration: 0.35, stagger: 0.07, ease: 'sine.out' }, X + 2.8)
     .to(geo.sheen, { '--lit': 0, duration: 0.8, stagger: 0.07, ease: 'sine.inOut' }, X + 3.0)
     .to(els.title, { '--halo': 1, duration: 1.6, ease: 'sine.inOut' }, X + 3.1)
     .to(els.glow, { scale: 1, opacity: 0.85, duration: 2, ease: 'sine.inOut' }, X + 2.5);

    /* ===== Scene 6 — the personal message ===== */
    const M = T.message;
    const lineStep = 0.8;
    const linesStart = M + 1.9;
    const linesEnd = linesStart + lineStep * Math.max(0, msgLines.length - 1) + 1.4;
    t.to(els.finale, { y: 0, duration: 1.6, ease: 'power3.inOut' }, M)
     .to(els.name, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.4, clearProps: 'filter' }, M + 0.7)
     .to(els.nameRules, { scaleX: 1, duration: 1.4, ease: 'power3.out' }, M + 0.9)
     .to(msgLines, {
        opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.4,
        stagger: lineStep, clearProps: 'filter'
      }, linesStart)
     .to(els.codaHeart, { opacity: 1, scale: 1, duration: 1.2, ease: 'back.out(1.6)' }, linesEnd - 0.4)
     .to(els.signature, { opacity: 1, y: 0, duration: 1.3 }, linesEnd - 0.1);

    return t;
  }

  /* ==========================================================================
     Run / replay
     ========================================================================== */
  function showStatic() {
    state.running = false;
    Sky.reset();
    Sky.fx.alpha = 1;
    Sky.setStill(reducedMQ.matches);
    els.stage.classList.remove('is-complete', 'is-static');
    void els.stage.offsetWidth; // restart the CSS fade-in on replay
    els.stage.classList.add('is-static', 'is-complete');
    measureTitle();
  }

  function run() {
    if (tl) { tl.kill(); tl = null; }
    Sky.reset();
    els.stage.classList.remove('is-complete', 'is-static');

    if (reducedMQ.matches || !window.gsap) {
      showStatic();
      return;
    }

    Sky.setStill(false);
    prepare();
    tl = buildTimeline();
    state.running = true;
    tl.play(0);
  }

  /* ==========================================================================
     Init (all listeners are attached exactly once)
     ========================================================================== */
  let resizeTimer = 0;
  let lastWidth = window.innerWidth;

  function onResizeSettled() {
    const w = window.innerWidth;
    if (state.running && w !== lastWidth) {
      lastWidth = w;
      run(); // layout changed mid-sequence (e.g. rotation): restart cleanly
      return;
    }
    lastWidth = w;
    if (!state.running) measureTitle();
  }

  function init() {
    if (window.gsap) gsap.config({ nullTargetWarn: false });

    buildContent();
    Sky.resize();

    window.addEventListener('resize', function () {
      Sky.resize();
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(onResizeSettled, 180);
    });
    els.replay.addEventListener('click', run);

    const onMotionChange = function () { run(); };
    if (reducedMQ.addEventListener) reducedMQ.addEventListener('change', onMotionChange);
    else if (reducedMQ.addListener) reducedMQ.addListener(onMotionChange);

    // Wait briefly for the web fonts so measurements are accurate, then begin.
    const fontsReady = (document.fonts && document.fonts.load)
      ? Promise.all([
          document.fonts.load('400 48px "Cormorant Garamond"'),
          document.fonts.load('italic 300 32px "Cormorant Garamond"'),
          document.fonts.load('300 16px "DM Sans"')
        ]).catch(function () {})
      : Promise.resolve();
    const timeout = new Promise(function (res) { setTimeout(res, 2000); });
    Promise.race([fontsReady, timeout]).then(run);
  }

  init();
})();
