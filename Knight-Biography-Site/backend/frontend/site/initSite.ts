// @ts-nocheck
/**
 * Copy of the inline script in ./index.html, used only by the in-app preview
 * (the editor's CSP blocks inline scripts). Keep the two in sync.
 */
export function initSite(scope: HTMLElement): () => void {
  const doc = document;
  const win = window;
  const root = doc.documentElement;
  const $ = (sel) => scope.querySelector(sel);
  const $$ = (sel) => Array.from(scope.querySelectorAll(sel));
  const reduce = win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = win.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const cleanups = [];
  const timers = [];
  const listen = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    cleanups.push(() => target.removeEventListener(type, fn, opts));
  };
  const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
  let rafId = 0;

  scope.classList.remove('is-ready', 'is-settled');

  /* ---------- 1. Разбивка текста на буквы и слова ---------- */
  $$('[data-split]').forEach((el) => {
    if (el.dataset.splitDone) return;
    el.dataset.splitDone = '1';
    const text = el.textContent.trim();
    el.textContent = '';
    Array.from(text).forEach((ch, i) => {
      const span = doc.createElement('span');
      span.className = 'char';
      span.style.setProperty('--i', String(i));
      span.textContent = ch;
      el.appendChild(span);
    });
  });

  $$('[data-words]').forEach((el) => {
    if (el.dataset.splitDone) return;
    el.dataset.splitDone = '1';
    Array.from(el.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const frag = doc.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(doc.createTextNode(part)); return; }
          const span = doc.createElement('span');
          span.className = 'word';
          span.textContent = part;
          frag.appendChild(span);
        });
        node.replaceWith(frag);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        node.classList.add('word');
      }
    });
  });
  const wordGroups = $$('[data-words]').map((el) => ({ el, words: Array.from(el.querySelectorAll('.word')), lit: -1 }));

  /* ---------- 2. Эффект «расшифровки» девиза ---------- */
  function scramble() {
    if (reduce) return;
    const alphabet = 'абвгдежзиклмнопрстуфхцчшэюя';
    $$('[data-scramble]').forEach((el) => {
      const final = el.dataset.final || el.textContent;
      el.dataset.final = final;
      const total = 26;
      let frame = 0;
      const id = setInterval(() => {
        frame += 1;
        const shown = Math.floor((frame / total) * final.length);
        el.textContent = Array.from(final).map((c, i) => {
          if (c === ' ' || i < shown) return c;
          return alphabet[Math.floor(Math.random() * alphabet.length)];
        }).join('');
        if (frame >= total) { clearInterval(id); el.textContent = final; }
      }, 40);
      cleanups.push(() => { clearInterval(id); el.textContent = final; });
    });
  }

  /* ---------- 3. Прелоадер ---------- */
  const loader = $('[data-loader]');
  const countEl = $('[data-count]');
  const barEl = $('[data-loader-bar]');
  const startPage = () => {
    scope.classList.add('is-ready');
    later(() => scope.classList.add('is-settled'), 2300);
    later(scramble, 900);
  };
  if (loader && !reduce) {
    loader.classList.remove('is-done', 'is-gone');
    root.style.overflow = 'hidden';
    const t0 = performance.now();
    const duration = 1900;
    let loadRaf = 0;
    const tick = (now) => {
      const t = clamp((now - t0) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      if (countEl) countEl.textContent = String(Math.round(eased * 100));
      if (barEl) barEl.style.transform = 'scaleX(' + eased + ')';
      if (t < 1) { loadRaf = requestAnimationFrame(tick); return; }
      loader.classList.add('is-done');
      root.style.overflow = '';
      later(startPage, 250);
      later(() => loader.classList.add('is-gone'), 1300);
    };
    loadRaf = requestAnimationFrame(tick);
    cleanups.push(() => cancelAnimationFrame(loadRaf));
  } else {
    if (loader) loader.classList.add('is-gone');
    startPage();
  }

  /* ---------- 4. Появление блоков ---------- */
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealIO.unobserve(entry.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
  $$('[data-reveal]').forEach((el) => revealIO.observe(el));
  cleanups.push(() => revealIO.disconnect());

  /* ---------- 5. Меню ---------- */
  const header = $('[data-header]');
  const menuBtn = $('[data-menu-toggle]');
  const menu = $('[data-menu]');
  let menuOpen = false;
  function setMenu(open) {
    menuOpen = open;
    scope.classList.toggle('menu-open', open);
    if (menuBtn) {
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    }
    if (menu) menu.setAttribute('aria-hidden', String(!open));
    root.style.overflow = open ? 'hidden' : '';
  }
  if (menuBtn) listen(menuBtn, 'click', () => setMenu(!menuOpen));
  listen(doc, 'keydown', (e) => { if (e.key === 'Escape' && menuOpen) setMenu(false); });

  /* ---------- 6. Уведомление и копирование ---------- */
  const toast = $('[data-toast]');
  let toastTimer = 0;
  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-shown');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-shown'), 2200);
  }
  cleanups.push(() => clearTimeout(toastTimer));
  function fallbackCopy(text) {
    const area = doc.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    doc.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = doc.execCommand('copy'); } catch (err) { ok = false; }
    doc.body.removeChild(area);
    return ok;
  }
  function copyText(text) {
    const done = (ok) => showToast(ok ? 'Адрес скопирован ✠' : 'Не удалось скопировать');
    if (navigator.clipboard && win.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => done(true), () => done(fallbackCopy(text)));
    } else {
      done(fallbackCopy(text));
    }
  }

  /* ---------- 7. Клики: якоря и копирование ---------- */
  listen(scope, 'click', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const copyBtn = target.closest('[data-copy]');
    if (copyBtn) { copyText(copyBtn.getAttribute('data-copy') || ''); return; }
    const link = target.closest('a[href^="#"]');
    if (!link) return;
    const id = (link.getAttribute('href') || '').slice(1);
    const section = id ? doc.getElementById(id) : null;
    if (!section) return;
    e.preventDefault();
    if (menuOpen) setMenu(false);
    const top = id === 'top' ? 0 : section.getBoundingClientRect().top + win.scrollY;
    win.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
    if (history.replaceState) history.replaceState(null, '', '#' + id);
  });

  /* ---------- 8. Курсор ---------- */
  const cDot = $('[data-cursor-dot]');
  const cRing = $('[data-cursor-ring]');
  const cLabel = $('[data-cursor-label]');
  const mouse = { x: -9999, y: -9999 };
  const ringPos = { x: -9999, y: -9999 };
  const cursorOn = finePointer && !reduce && !!cDot && !!cRing;
  if (finePointer) {
    listen(win, 'mousemove', (e) => {
      if (ringPos.x === -9999) { ringPos.x = e.clientX; ringPos.y = e.clientY; }
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      if (cursorOn) scope.classList.add('cursor-visible');
    }, { passive: true });
  }
  if (cursorOn) {
    scope.classList.add('has-cursor');
    listen(root, 'mouseleave', () => scope.classList.remove('cursor-visible'));
    listen(scope, 'mouseover', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      const interactive = t ? t.closest('a, button, [data-tilt]') : null;
      const labelled = t ? t.closest('[data-cursor-text]') : null;
      scope.classList.toggle('cursor-hover', !!interactive);
      scope.classList.toggle('cursor-labelled', !!labelled);
      if (cLabel) cLabel.textContent = labelled ? labelled.getAttribute('data-cursor-text') : '';
    });
  }

  /* ---------- 9. Магнитные кнопки и 3D-наклон ---------- */
  if (finePointer && !reduce) {
    $$('[data-magnetic]').forEach((el) => {
      const strength = parseFloat(el.getAttribute('data-magnetic')) || 0.3;
      listen(el, 'mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        el.style.transform = 'translate(' + (x * strength).toFixed(1) + 'px,' + (y * strength).toFixed(1) + 'px)';
      });
      listen(el, 'mouseleave', () => { el.style.transform = ''; });
    });
    $$('[data-tilt]').forEach((el) => {
      listen(el, 'mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.style.setProperty('--rx', ((0.5 - py) * 10).toFixed(2) + 'deg');
        el.style.setProperty('--ry', ((px - 0.5) * 12).toFixed(2) + 'deg');
        el.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
        el.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
        el.classList.add('is-tilting');
      });
      listen(el, 'mouseleave', () => {
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
        el.classList.remove('is-tilting');
      });
    });
  }

  /* ---------- 10. Параллакс главного экрана ---------- */
  const hero = $('[data-hero]');
  const heroTarget = { x: 0, y: 0 };
  const heroPos = { x: 0, y: 0 };
  if (hero && finePointer && !reduce) {
    listen(hero, 'mousemove', (e) => {
      const r = hero.getBoundingClientRect();
      heroTarget.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      heroTarget.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    });
    listen(hero, 'mouseleave', () => { heroTarget.x = 0; heroTarget.y = 0; });
  }

  /* ---------- 11. Искры на canvas ---------- */
  const canvas = $('[data-sparks]');
  let sparks = null;
  if (canvas && canvas.getContext && !reduce) {
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(win.devicePixelRatio || 1, 2);
    const parts = [];
    let w = 0;
    let h = 0;
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const spawn = (p, anywhere) => {
      p.ash = Math.random() < 0.28;
      p.x = Math.random() * w;
      if (p.ash) {
        p.y = anywhere ? Math.random() * h : -10;
        p.base = Math.random() * 0.35 + 0.15;
        p.r = Math.random() * 1.4 + 0.6;
      } else {
        p.y = anywhere ? Math.random() * h : h * (0.5 + Math.random() * 0.55);
        p.base = -(Math.random() * 0.8 + 0.3);
        p.r = Math.random() * 1.4 + 0.5;
      }
      p.vy = p.base;
      p.vx = (Math.random() - 0.5) * 0.3;
      p.life = 0;
      p.max = 280 + Math.random() * 460;
      p.phase = Math.random() * 6.28;
    };
    resize();
    const count = w < 768 ? 45 : 100;
    for (let i = 0; i < count; i += 1) {
      const p = {};
      spawn(p, true);
      p.life = Math.random() * p.max;
      parts.push(p);
    }
    listen(win, 'resize', resize);
    sparks = {
      visible: true,
      draw() {
        const rect = canvas.getBoundingClientRect();
        const mx = mouse.x - rect.left;
        const my = mouse.y - rect.top;
        ctx.clearRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        for (const p of parts) {
          p.life += 1;
          p.phase += 0.05;
          const dx = p.x - mx;
          const dy = p.y - my;
          const d2 = dx * dx + dy * dy;
          if (d2 < 16000) {
            const d = Math.sqrt(d2) || 1;
            const f = (1 - d2 / 16000) * 0.6;
            p.vx += (dx / d) * f;
            p.vy += (dy / d) * f;
          }
          p.vx *= 0.96;
          p.vy += (p.base - p.vy) * 0.04;
          p.x += p.vx + Math.sin(p.phase) * (p.ash ? 0.5 : 0.25);
          p.y += p.vy;
          if (p.y < -20 || p.y > h + 20 || p.life > p.max || p.x < -20 || p.x > w + 20) { spawn(p, false); continue; }
          const fade = Math.sin(Math.PI * (p.life / p.max));
          if (p.ash) {
            const ashAlpha = fade * 0.35;
            ctx.fillStyle = 'rgba(170,165,160,' + ashAlpha.toFixed(3) + ')';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, 6.283);
            ctx.fill();
            continue;
          }
          const a = fade * (0.55 + 0.45 * Math.sin(p.phase * 3));
          if (a <= 0) continue;
          ctx.fillStyle = 'rgba(255,90,30,' + (a * 0.14).toFixed(3) + ')';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 5, 0, 6.283);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,190,120,' + a.toFixed(3) + ')';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, 6.283);
          ctx.fill();
        }
      },
    };
    const sparkIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { sparks.visible = entry.isIntersecting; });
    });
    sparkIO.observe(canvas);
    cleanups.push(() => sparkIO.disconnect());
  }

  /* ---------- 12. Бегущие ленты ---------- */
  const marquees = $$('[data-marquee]').map((band) => {
    const track = band.querySelector('.tape__track');
    if (!track.dataset.cloned) { track.innerHTML += track.innerHTML; track.dataset.cloned = '1'; }
    return { track, dir: parseFloat(band.getAttribute('data-marquee')) || 1, x: 0 };
  });

  /* ---------- 13. Горизонтальный скролл принципов ---------- */
  const hs = $('[data-hscroll]');
  const hTrack = $('[data-hscroll-track]');
  const hBar = $('[data-hscroll-bar]');
  const wideMQ = win.matchMedia('(min-width: 900px)');
  let pinned = false;
  let hDist = 0;
  let hCur = 0;
  function layoutH() {
    if (!hs || !hTrack) return;
    pinned = wideMQ.matches && !reduce;
    hs.classList.toggle('is-pinned', pinned);
    if (pinned) {
      hDist = Math.max(0, hTrack.offsetWidth - win.innerWidth);
      hs.style.height = (win.innerHeight + hDist) + 'px';
    } else {
      hDist = 0;
      hs.style.height = '';
      hTrack.style.transform = '';
    }
  }
  layoutH();
  listen(win, 'resize', layoutH);
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(layoutH);
  later(layoutH, 700);

  /* ---------- 14. Линия пути ---------- */
  const timeline = $('[data-timeline]');
  const tlFill = $('[data-timeline-fill]');
  const steps = $$('[data-step]');
  const progressEl = $('[data-progress]');

  /* ---------- 15. Главный цикл анимации ---------- */
  let lastY = win.scrollY;
  let vel = 0;
  let scrollDir = 1;
  function frame() {
    const y = win.scrollY;
    const vh = win.innerHeight;
    const dy = y - lastY;
    lastY = y;
    vel = lerp(vel, dy, 0.15);
    if (dy !== 0) scrollDir = dy > 0 ? 1 : -1;

    if (progressEl) {
      const max = root.scrollHeight - vh;
      progressEl.style.transform = 'scaleX(' + (max > 0 ? clamp(y / max, 0, 1) : 0) + ')';
    }

    if (header) {
      header.classList.toggle('is-scrolled', y > 40);
      if (!menuOpen) {
        if (dy > 3 && y > vh * 0.6) header.classList.add('is-hidden');
        else if (dy < -3 || y < 80) header.classList.remove('is-hidden');
      }
    }

    if (cursorOn) {
      ringPos.x = lerp(ringPos.x, mouse.x, 0.16);
      ringPos.y = lerp(ringPos.y, mouse.y, 0.16);
      cDot.style.transform = 'translate3d(' + mouse.x + 'px,' + mouse.y + 'px,0)';
      cRing.style.transform = 'translate3d(' + ringPos.x.toFixed(1) + 'px,' + ringPos.y.toFixed(1) + 'px,0)';
    }

    if (hero) {
      heroPos.x = lerp(heroPos.x, heroTarget.x, 0.06);
      heroPos.y = lerp(heroPos.y, heroTarget.y, 0.06);
      hero.style.setProperty('--mx', heroPos.x.toFixed(3));
      hero.style.setProperty('--my', heroPos.y.toFixed(3));
      hero.style.setProperty('--hs', clamp(y / vh, 0, 1).toFixed(3));
    }

    if (sparks && sparks.visible) sparks.draw();

    if (!reduce) {
      const speed = 0.8 + Math.min(Math.abs(vel) * 0.35, 14);
      marquees.forEach((m) => {
        const half = m.track.offsetWidth / 2;
        if (!half) return;
        m.x -= speed * m.dir * scrollDir;
        if (m.x <= -half) m.x += half;
        if (m.x > 0) m.x -= half;
        m.track.style.transform = 'translate3d(' + m.x.toFixed(2) + 'px,0,0)';
      });
    }

    wordGroups.forEach((g) => {
      const r = g.el.getBoundingClientRect();
      const p = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.35), 0, 1);
      const lit = reduce ? g.words.length : Math.round(p * g.words.length);
      if (lit === g.lit) return;
      g.lit = lit;
      g.words.forEach((word, i) => word.classList.toggle('is-lit', i < lit));
    });

    if (pinned && hDist > 0 && hs && hTrack) {
      const r = hs.getBoundingClientRect();
      const target = clamp(-r.top / hDist, 0, 1) * hDist;
      hCur = lerp(hCur, target, 0.1);
      if (Math.abs(target - hCur) < 0.1) hCur = target;
      hTrack.style.transform = 'translate3d(' + (-hCur).toFixed(1) + 'px,0,0)';
      if (hBar) hBar.style.transform = 'scaleX(' + (hCur / hDist).toFixed(4) + ')';
    }

    if (timeline && tlFill) {
      const r = timeline.getBoundingClientRect();
      const p = clamp((vh * 0.6 - r.top) / r.height, 0, 1);
      tlFill.style.transform = 'scaleY(' + p.toFixed(4) + ')';
      steps.forEach((s) => s.classList.toggle('is-active', s.getBoundingClientRect().top + 30 < vh * 0.6));
    }

    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);

  /* ---------- 16. Год в подвале ---------- */
  $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

  return () => {
    cancelAnimationFrame(rafId);
    timers.forEach(clearTimeout);
    cleanups.forEach((fn) => fn());
    root.style.overflow = '';
    scope.classList.remove('has-cursor', 'cursor-visible', 'cursor-hover', 'cursor-labelled', 'menu-open');
  };
}
