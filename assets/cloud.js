/* =============================================================================
   Облако слов — сфера, а не список.

   Слова живут в разметке (`.cloud .tag`): их читает поисковик, их видит
   посетитель без JS, и в них же уже записана иерархия — `tag--lg`, `tag--md`
   и всё остальное. Скрипт забирает оттуда текст и ярус, прячет список и
   строит из тех же слов вращающуюся сферу. Ничего не дублируется: чтобы
   поменять облако, правят разметку.

   Рисуем в два холста. Задний лежит под содержимым страницы, передний — над
   ним, и слово попадает в тот или другой в зависимости от того, на какой оно
   сейчас полусфере. Поэтому слова проходят за заголовком и перед ним, а не
   поверх всего подряд. Колонка с отсчётом при этом защищена: слово переднего
   плана, попавшее на неё, почти гасится — читаемость важнее эффекта.

   Центр и размер задаются в разметке (`data-cx`, `data-cy`, `data-scale`) и
   правятся мышью: перетащить центр, колесо или щипок — размер, двойной клик —
   вернуть авторские значения. Настройка посетителя живёт в его localStorage,
   а подсказка показывает готовую строку атрибутов — чтобы понравившееся
   положение можно было перенести обратно в HTML и зафиксировать для всех.
   ========================================================================== */

(function wordSphere() {
  const host = document.getElementById("cloud");
  if (!host || !host.querySelector(".tag")) return;

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  /* ── слова и ярусы из разметки ──────────────────────────────────────── */

  const words = [...host.querySelectorAll(".tag")].map((el) => ({
    text: el.textContent.trim(),
    tier: el.classList.contains("tag--lg")
      ? "hero"
      : el.classList.contains("tag--md")
      ? "mid"
      : "tiny",
  }));

  host.hidden = true; // список отработал: дальше говорит сфера

  /* ── холсты ─────────────────────────────────────────────────────────── */

  const make = (z) => {
    const c = document.createElement("canvas");
    c.className = "cloud-layer";
    c.style.zIndex = z;
    document.body.append(c);
    return c;
  };
  const back = make(0);
  const front = make(2);
  const bctx = back.getContext("2d");
  const fctx = front.getContext("2d");

  let W = 0, H = 0;
  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    for (const c of [back, front]) {
      c.width = Math.round(W * DPR);
      c.height = Math.round(H * DPR);
      c.style.width = W + "px";
      c.style.height = H + "px";
      c.getContext("2d").setTransform(DPR, 0, 0, DPR, 0, 0);
    }
  }
  resize();
  addEventListener("resize", resize);

  /* ── положение и размер ─────────────────────────────────────────────── */

  const ds = host.dataset;
  const authored = {
    x: parseFloat(ds.cx) || 0,
    y: parseFloat(ds.cy) || 0,
    s: parseFloat(ds.scale) || 1,
  };
  const STORE = "modulthon_cloud";

  let tf = { ...authored };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || "null");
    if (saved && typeof saved.s === "number") tf = { x: +saved.x || 0, y: +saved.y || 0, s: saved.s };
    // Узкий экран: колонки схлопнулись, справа места нет. Опускаем сферу
    // в пустую полосу под текстом — там она видна и никому не мешает.
    else if (W < 900) tf = { x: 0, y: 0.27, s: 0.76 };
  } catch {
    /* приватный режим — просто работаем без сохранения */
  }
  const save = () => {
    try { localStorage.setItem(STORE, JSON.stringify(tf)); } catch {}
  };

  function geometry() {
    const minWH = Math.min(W, H);
    const n = words.length || 1;
    const nFactor = clamp(Math.sqrt(n / 18), 0.8, 1.35);
    const R = clamp(minWH * 0.3 * nFactor * tf.s, minWH * 0.14, minWH * 0.66);
    return {
      cx: W / 2 + tf.x * W,
      cy: H / 2 + tf.y * H,
      R,
      sizeScale: clamp(minWH / 900, 0.55, 1.4) * tf.s,
    };
  }

  /* ── частицы ────────────────────────────────────────────────────────── */

  const now0 = performance.now();
  let heroSeen = 0;
  const particles = words.map((w) => {
    const u = Math.random(), v = Math.random();
    const accent = w.tier === "hero" && heroSeen++ % 3 === 1; // каждый третий крупный — песочный

    // Полюса чуть поджаты, иначе слова слипаются сверху и снизу.
    const phi = Math.acos((2 * u - 1) * 0.94);
    // Часть слов ближе к сердцевине, часть — по оболочке: так сфера читается
    // объёмной, а не полой скорлупой.
    const rf = 0.42 + 0.58 * Math.pow(Math.random(), 0.55);

    const size =
      w.tier === "hero" ? 27 + Math.random() * 15
      : w.tier === "mid" ? 14 + Math.random() * 6
      : 9.5 + Math.random() * 2.5;

    return {
      text: w.text,
      style: accent ? "accent" : w.tier,
      phi,
      theta: 2 * Math.PI * v,
      rf,
      size,
      spin: (Math.random() - 0.5) * 0.05, // у каждого слова своя скорость
      ja: 0.03 + Math.random() * 0.05,    // дрейф по вертикали
      jp: Math.random() * Math.PI * 2,
      js: 0.2 + Math.random() * 0.4,
      born: now0 + Math.random() * 700,   // слова проявляются каскадом
    };
  });

  /* ── спрайты ────────────────────────────────────────────────────────── */

  const SANS = '"Inter Tight", -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  const MONO = '"IBM Plex Mono", ui-monospace, SFMono-Regular, monospace';

  const STYLES = {
    hero:   { font: (px) => `200 ${px}px ${SANS}`, color: "#f2efe9", track: -0.035 },
    accent: { font: (px) => `200 ${px}px ${SANS}`, color: "#c69a65", track: -0.035 },
    mid:    { font: (px) => `300 ${px}px ${SANS}`, color: "rgba(242,239,233,0.62)", track: -0.02 },
    tiny:   { font: (px) => `400 ${px}px ${MONO}`, color: "rgba(242,239,233,0.34)", track: 0.16, caps: true },
  };

  const sprites = new Map();
  function sprite(text, size, style, soft) {
    const px = Math.round(size / 2) * 2; // ведро по 2px — кэш не разрастается
    const key = text + "|" + px + "|" + style + (soft ? "|s" : "");
    const hit = sprites.get(key);
    if (hit) return hit;

    const st = STYLES[style];
    const label = st.caps ? text.toUpperCase() : text;
    const pad = Math.ceil(px * 0.4) + 4; // запас под размытие

    const m = document.createElement("canvas").getContext("2d");
    m.font = st.font(px);
    if (st.track) m.letterSpacing = px * st.track + "px";
    const tw = Math.ceil(m.measureText(label).width);

    const c = document.createElement("canvas");
    const w = tw + pad * 2, h = Math.ceil(px * 1.5) + pad * 2;
    c.width = Math.max(1, Math.round(w * DPR));
    c.height = Math.max(1, Math.round(h * DPR));
    const g = c.getContext("2d");
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.font = st.font(px);
    if (st.track) g.letterSpacing = px * st.track + "px";
    g.textAlign = "center";
    g.textBaseline = "middle";
    if (soft) g.filter = `blur(${Math.max(1, px * 0.08)}px)`; // глубина резкости
    g.fillStyle = st.color;
    g.fillText(label, w / 2, h / 2);

    const sp = { c, w, h };
    sprites.set(key, sp);
    return sp;
  }

  // Пока грузится веб-шрифт, спрайты нарисованы системным. Дождаться и сбросить.
  if (document.fonts?.ready) document.fonts.ready.then(() => sprites.clear());

  /* ── защита колонки с отсчётом ──────────────────────────────────────── */

  // Всё, что человек должен прочитать: отсчёт с кнопкой и абзац про приз.
  let guards = [];
  const measureGuards = () => {
    guards = [".lead", ".prize"]
      .map((sel) => document.querySelector(sel))
      .filter(Boolean)
      .map((el) => el.getBoundingClientRect());
  };
  measureGuards();
  addEventListener("resize", measureGuards);
  addEventListener("scroll", measureGuards, { passive: true });

  /* ── ручка центра ───────────────────────────────────────────────────── */

  const handle = document.createElement("button");
  handle.id = "cloudHandle";
  handle.type = "button";
  handle.setAttribute("aria-label", ds.labelHandle ||
    "Move the cloud. Wheel to resize, double-click to reset");
  document.body.append(handle);

  const hint = document.createElement("div");
  hint.id = "cloudHint";
  document.body.append(hint);

  let hintTimer = 0;
  function flash(text, ms = 2600) {
    hint.textContent = text;
    hint.classList.add("show");
    handle.classList.add("active");
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => {
      hint.classList.remove("show");
      handle.classList.remove("active");
    }, ms);
  }
  // Готовая строка атрибутов: перетащили как нравится — перенесли в разметку.
  const readout = () =>
    `data-cx="${tf.x.toFixed(3)}" data-cy="${tf.y.toFixed(3)}" data-scale="${tf.s.toFixed(2)}"`;

  function syncHandle(cx, cy, R) {
    const d = clamp(R * 0.5, 80, 220);
    handle.style.left = cx + "px";
    handle.style.top = cy + "px";
    handle.style.width = d + "px";
    handle.style.height = d + "px";
  }

  let dragId = null, prev = null;
  handle.addEventListener("pointerdown", (e) => {
    if (touches.size >= 1) return; // двумя пальцами — это щипок
    dragId = e.pointerId;
    prev = { x: e.clientX, y: e.clientY };
    handle.setPointerCapture(dragId);
    handle.classList.add("grabbing");
  });
  handle.addEventListener("pointermove", (e) => {
    if (e.pointerId !== dragId) return;
    tf.x = clamp(tf.x + (e.clientX - prev.x) / W, -0.5, 0.5);
    tf.y = clamp(tf.y + (e.clientY - prev.y) / H, -0.5, 0.5);
    prev = { x: e.clientX, y: e.clientY };
    flash(readout(), 8000);
  });
  const endDrag = (e) => {
    if (e.pointerId !== dragId) return;
    dragId = null;
    handle.classList.remove("grabbing");
    save();
    flash(readout());
  };
  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);

  handle.addEventListener("dblclick", () => {
    tf = { ...authored };
    save();
    flash(ds.labelReset || "cloud put back");
  });

  let saveTimer = 0;
  addEventListener(
    "wheel",
    (e) => {
      // Колесо над формой прокручивает форму, а не масштабирует облако.
      // Проверять надо именно наличие предка-формы: у события, пришедшего
      // не от элемента, closest нет вовсе, и это не повод ничего не делать.
      if (e.target instanceof Element && e.target.closest("form, .brief")) return;
      e.preventDefault();
      tf.s = clamp(tf.s * (e.deltaY < 0 ? 1.06 : 1 / 1.06), 0.4, 2.6);
      flash(readout());
      clearTimeout(saveTimer);
      saveTimer = setTimeout(save, 400);
    },
    { passive: false }
  );

  const touches = new Map();
  let pinch = 0;
  addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") touches.set(e.pointerId, e);
  });
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "touch" || !touches.has(e.pointerId)) return;
    touches.set(e.pointerId, e);
    if (touches.size !== 2) return;
    dragId = null; // щипок отменяет перетаскивание
    const [a, b] = [...touches.values()];
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    if (!pinch) { pinch = dist; return; }
    tf.s = clamp(tf.s * (dist / pinch), 0.4, 2.6);
    pinch = dist;
    flash(readout());
  });
  const drop = (e) => {
    touches.delete(e.pointerId);
    if (touches.size < 2 && pinch) { pinch = 0; save(); }
  };
  addEventListener("pointerup", drop);
  addEventListener("pointercancel", drop);

  /* ── наклон за курсором ─────────────────────────────────────────────── */

  let tiltT = 0, tilt = 0, panT = 0, pan = 0;
  if (!reduced) {
    addEventListener("pointermove", (e) => {
      tiltT = (e.clientY / H - 0.45) * 0.28;
      panT = (e.clientX / W - 0.5) * 0.2;
    });
  }

  /* ── кадр ───────────────────────────────────────────────────────────── */

  let rotY = 0, last = performance.now();

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!reduced) {
      rotY += dt * 0.1;
      tilt += (tiltT - tilt) * 0.04;
      pan += (panT - pan) * 0.04;
    }

    const { cx, cy, R, sizeScale } = geometry();
    syncHandle(cx, cy, R);

    const t = now / 1000;
    bctx.clearRect(0, 0, W, H);
    fctx.clearRect(0, 0, W, H);

    // Тёплое свечение в сердцевине — сфера должна казаться освещённой изнутри.
    const glow = bctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.9);
    glow.addColorStop(0, "rgba(198,154,101,0.10)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    bctx.fillStyle = glow;
    bctx.fillRect(cx - R * 2.2, cy - R * 2.2, R * 4.4, R * 4.4);

    const Rx = R, Ry = R * 0.92;
    const cosT = Math.cos(tilt), sinT = Math.sin(tilt);
    const rot = rotY + pan;

    for (const p of particles) {
      const phi = p.phi + (reduced ? 0 : Math.sin(t * p.js + p.jp) * p.ja);
      const th = p.theta + rot + (reduced ? 0 : p.spin * t);
      const sinP = Math.sin(phi);
      const x = sinP * Math.cos(th);
      const z = sinP * Math.sin(th);
      const y = Math.cos(phi);
      const y2 = y * cosT - z * sinT;
      const z2 = y * sinT + z * cosT;

      const d = (1 - z2) / 2; // 1 — передний план
      const breathe = reduced ? 1 : 1 + 0.03 * Math.sin(t * 0.35 + p.jp);
      const sx = cx + x * Rx * p.rf * breathe;
      const sy = cy + y2 * Ry * p.rf * breathe;

      const fade = Math.min(1, Math.max(0, (now - p.born) / 700));
      let a = (0.05 + 0.95 * Math.pow(d, 2.4)) * fade;

      // Переднее слово, накрывшее колонку с отсчётом, почти гасим.
      const inFront = z2 < 0;
      if (inFront) {
        for (const g of guards) {
          if (sx > g.left - 18 && sx < g.right + 18 &&
              sy > g.top - 18 && sy < g.bottom + 18) { a *= 0.1; break; }
        }
      }
      if (a < 0.015) continue;

      const sc = (0.45 + 0.62 * d) * sizeScale;
      const sp = sprite(p.text, p.size, p.style, d < 0.38); // дальние размыты
      const ctx = inFront ? fctx : bctx;
      ctx.globalAlpha = a;
      ctx.drawImage(sp.c, sx - (sp.w * sc) / 2, sy - (sp.h * sc) / 2, sp.w * sc, sp.h * sc);
    }
    bctx.globalAlpha = 1;
    fctx.globalAlpha = 1;

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Один раз показать, что облако можно двигать, — иначе ручку не найдут.
  setTimeout(
    () => flash(ds.labelHint || "drag the centre to move the cloud · wheel to resize", 4200),
    1600
  );
})();
