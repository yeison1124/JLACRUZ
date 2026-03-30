/* ── 1. NAVBAR scroll ── */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

/* ── 2. Hamburger ── */
function toggleMenu() {
  document.getElementById('mobileMenu').classList.toggle('open');
}
document.addEventListener('click', e => {
  const m = document.getElementById('mobileMenu');
  const h = document.querySelector('.hamburger');
  if (!m.contains(e.target) && !h.contains(e.target)) m.classList.remove('open');
});

/* ── 3. Section entry animations via IntersectionObserver ── */
const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      io.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('[data-anim]').forEach(el => io.observe(el));

/* ── 4. CAROUSEL (right-to-left auto-scroll) ── */
function setupCarousel({ outerId, trackId, dotsId, prevId, nextId }) {
  const outer = document.getElementById(outerId);
  const track = document.getElementById(trackId);
  const dotsEl = document.getElementById(dotsId);
  const btnP = prevId ? document.getElementById(prevId) : null;
  const btnN = nextId ? document.getElementById(nextId) : null;
  if (!outer || !track || !dotsEl) return;

  const GAP = 20;
  const CARD_W = 310 + GAP;
  const ORIGINAL_CARDS = Array.from(track.children);
  const REAL_TOTAL = ORIGINAL_CARDS.length;
  const CLONE_COUNT = REAL_TOTAL; // Clonar todas las imágenes para permitir loop infinito en pantallas anchas
  const total = REAL_TOTAL + CLONE_COUNT * 2;

  // Create clones for infinite looping.
  ORIGINAL_CARDS.slice(-CLONE_COUNT).forEach(card => track.insertBefore(card.cloneNode(true), track.firstChild));
  ORIGINAL_CARDS.slice(0, CLONE_COUNT).forEach(card => track.appendChild(card.cloneNode(true)));

  let idx = CLONE_COUNT;
  let autoTimer = null;
  let isDrag = false;
  let startX = 0;
  let startTX = 0;
  let currentTX = 0;

  /* build dots */
  for (let i = 0; i < REAL_TOTAL; i++) {
    const d = document.createElement('div');
    d.className = 'dot' + (i === 0 ? ' active' : '');
    d.addEventListener('click', () => { goTo(CLONE_COUNT + i); resetAuto(); });
    dotsEl.appendChild(d);
  }
  const dots = dotsEl.querySelectorAll('.dot');

  /* card entry animation via stagger */
  Array.from(track.children).forEach((card, i) => {
    card.style.opacity = '0';
    card.style.transform = 'translateX(60px)';
    card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    card.style.transitionDelay = (i * 0.07) + 's';
  });

  const cardIO = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        Array.from(track.children).forEach(card => {
          card.style.opacity = '1';
          card.style.transform = 'translateX(0)';
        });
        cardIO.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  cardIO.observe(outer);

  function realIndex() {
    return ((idx - CLONE_COUNT) % REAL_TOTAL + REAL_TOTAL) % REAL_TOTAL;
  }

  function getTargetTX() { return -(idx * CARD_W); }

  function updateDots() {
    dots.forEach((d, i) => d.classList.toggle('active', i === realIndex()));
  }

  function applyTranslate(tx, animated) {
    track.style.transition = animated
      ? 'transform 0.55s cubic-bezier(.22,1,.36,1)'
      : 'none';
    track.style.transform = `translateX(${tx}px)`;
    currentTX = tx;
  }

  function goTo(i, animated = true) {
    idx = i;
    applyTranslate(getTargetTX(), animated);
    updateDots();
  }

  function adjustInfinity() {
    if (idx >= REAL_TOTAL + CLONE_COUNT) {
      track.style.transition = 'none';
      idx = CLONE_COUNT;
      applyTranslate(getTargetTX(), false);
    }
    if (idx < CLONE_COUNT) {
      track.style.transition = 'none';
      idx = REAL_TOTAL + CLONE_COUNT - 1;
      applyTranslate(getTargetTX(), false);
    }
    updateDots();
  }

  function next() {
    idx += 1;
    applyTranslate(getTargetTX(), true);
    setTimeout(adjustInfinity, 560);
  }

  function prev() {
    idx -= 1;
    applyTranslate(getTargetTX(), true);
    setTimeout(adjustInfinity, 560);
  }

  function startAuto() { autoTimer = setInterval(next, 1800); }
  function stopAuto()  { clearInterval(autoTimer); }
  function resetAuto() { stopAuto(); startAuto(); }

  outer.addEventListener('mouseenter', stopAuto);
  outer.addEventListener('mouseleave', startAuto);

  if (btnN) btnN.addEventListener('click', () => { next(); resetAuto(); });
  if (btnP) btnP.addEventListener('click', () => { prev(); resetAuto(); });

  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { next(); resetAuto(); }
    if (e.key === 'ArrowLeft')  { prev(); resetAuto(); }
  });

  function onDragStart(x) {
    stopAuto();
    isDrag = true; startX = x; startTX = currentTX;
    track.style.transition = 'none';
    outer.style.cursor = 'grabbing';
  }
  function onDragMove(x) {
    if (!isDrag) return;
    const diff = x - startX;
    applyTranslate(startTX + diff, false);
  }
  function onDragEnd(x) {
    if (!isDrag) return;
    isDrag = false; outer.style.cursor = 'grab';
    const diff = x - startX;
    if      (diff < -40) next();
    else if (diff >  40) prev();
    else goTo(idx);
    resetAuto();
  }

  outer.addEventListener('mousedown',  e => onDragStart(e.clientX));
  window.addEventListener('mousemove', e => { if (isDrag) onDragMove(e.clientX); });
  window.addEventListener('mouseup',   e => onDragEnd(e.clientX));

  outer.addEventListener('touchstart', e => onDragStart(e.touches[0].clientX), { passive: true });
  outer.addEventListener('touchmove',  e => onDragMove(e.touches[0].clientX),  { passive: true });
  outer.addEventListener('touchend',   e => { onDragEnd(e.changedTouches[0].clientX); });

  track.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('dragstart', e => e.preventDefault());
  });

  window.addEventListener('resize', () => goTo(idx), { passive: true });

  goTo(CLONE_COUNT, false);
  startAuto();
}

setupCarousel({ outerId:'carouselOuter', trackId:'carouselTrack', dotsId:'carouselDots', prevId:'btnPrev', nextId:'btnNext' });