(() => {
  'use strict';

  const CIRCUMFERENCE = 2 * Math.PI * 34;

  const STYLE_CYCLE = [
    { shape: 'pill',  mode: 'elapsed'   },
    { shape: 'pill',  mode: 'remaining' },
    { shape: 'ring',  mode: 'elapsed'   },
    { shape: 'ring',  mode: 'remaining' },
  ];

  let overlay    = null;
  let video      = null;
  let rafId      = null;
  let domObserver = null;
  let visible    = true;
  let styleIndex = 0;
  let lastTick   = 0;

  const currentStyle = () => STYLE_CYCLE[styleIndex];

  function formatTime(totalSeconds) {
    if (!isFinite(totalSeconds) || totalSeconds < 0) return '--:--';
    const t  = Math.floor(totalSeconds);
    const h  = Math.floor(t / 3600);
    const m  = Math.floor((t % 3600) / 60);
    const s  = t % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  function createOverlay() {
    const el = document.createElement('div');
    el.id = 'yt-timer-overlay';
    el.setAttribute('data-style', 'pill');
    el.title = 'Y: show/hide  •  Shift+Y: cycle styles';

    const pillText = document.createElement('span');
    pillText.className   = 'yt-pill-text';
    pillText.textContent = '--:-- / --:--';

    const ringWrap = document.createElement('div');
    ringWrap.className = 'yt-ring-wrap';

    const NS  = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 80 80');
    svg.setAttribute('width',   '80');
    svg.setAttribute('height',  '80');

    const diskCircle = document.createElementNS(NS, 'circle');
    diskCircle.setAttribute('cx',    '40');
    diskCircle.setAttribute('cy',    '40');
    diskCircle.setAttribute('r',     '39');
    diskCircle.setAttribute('class', 'yt-ring-disk');

    const bgCircle = document.createElementNS(NS, 'circle');
    bgCircle.setAttribute('cx',    '40');
    bgCircle.setAttribute('cy',    '40');
    bgCircle.setAttribute('r',     '34');
    bgCircle.setAttribute('class', 'yt-ring-bg');

    const progressCircle = document.createElementNS(NS, 'circle');
    progressCircle.setAttribute('cx',    '40');
    progressCircle.setAttribute('cy',    '40');
    progressCircle.setAttribute('r',     '34');
    progressCircle.setAttribute('class', 'yt-ring-progress');
    progressCircle.style.strokeDasharray  = CIRCUMFERENCE;
    progressCircle.style.strokeDashoffset = CIRCUMFERENCE;

    svg.appendChild(diskCircle);
    svg.appendChild(bgCircle);
    svg.appendChild(progressCircle);

    const ringLabel = document.createElement('div');
    ringLabel.className = 'yt-ring-label';

    const ringCurrent = document.createElement('span');
    ringCurrent.className   = 'yt-ring-current';
    ringCurrent.textContent = '--:--';

    const ringTotal = document.createElement('span');
    ringTotal.className   = 'yt-ring-total';
    ringTotal.textContent = '--:--';

    ringLabel.appendChild(ringCurrent);
    ringLabel.appendChild(ringTotal);
    ringWrap.appendChild(svg);
    ringWrap.appendChild(ringLabel);

    el.appendChild(pillText);
    el.appendChild(ringWrap);
    return el;
  }

  function attachOverlay() {
    const player = document.querySelector('#movie_player');
    if (!player) return;
    if (overlay && overlay.parentNode === player) return;
    if (!overlay) overlay = createOverlay();
    overlay.style.display = visible ? '' : 'none';
    player.appendChild(overlay);
  }

  function updateOverlay() {
    if (!video || !overlay) return;

    const current  = video.currentTime;
    const duration = video.duration;
    const { shape, mode } = currentStyle();
    const rem = mode === 'remaining';

    const displayTime = rem && isFinite(duration) ? duration - current : current;
    const prefix      = rem && isFinite(duration) ? '-' : '';

    if (shape === 'pill') {
      const textEl = overlay.querySelector('.yt-pill-text');
      const text   = `${prefix}${formatTime(displayTime)} / ${formatTime(duration)}`;
      if (textEl.textContent !== text) textEl.textContent = text;

    } else {
      const progressCircle = overlay.querySelector('.yt-ring-progress');
      const ringCurrent    = overlay.querySelector('.yt-ring-current');
      const ringTotal      = overlay.querySelector('.yt-ring-total');

      const progress = isFinite(duration) && duration > 0 ? current / duration : 0;
      progressCircle.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);

      const currentText = `${prefix}${formatTime(displayTime)}`;
      const totalText   = formatTime(duration);
      if (ringCurrent.textContent !== currentText) ringCurrent.textContent = currentText;
      if (ringTotal.textContent   !== totalText)   ringTotal.textContent   = totalText;
    }
  }

  function applyStyle() {
    if (!overlay) return;
    overlay.setAttribute('data-style', currentStyle().shape);
    lastTick = 0;
  }

  function loop(timestamp) {
    rafId = requestAnimationFrame(loop);
    if (timestamp - lastTick < 500) return;
    lastTick = timestamp;
    updateOverlay();
  }

  function startLoop() {
    if (rafId === null) rafId = requestAnimationFrame(loop);
  }

  function findAndAttach() {
    const vid = document.querySelector('video.html5-main-video')
             || document.querySelector('video');
    if (!vid) return false;
    video = vid;
    attachOverlay();
    startLoop();
    return true;
  }

  function watchForVideo() {
    if (domObserver) domObserver.disconnect();
    domObserver = new MutationObserver(() => {
      if (findAndAttach()) {
        domObserver.disconnect();
        domObserver = null;
      }
    });
    domObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  function init() {
    video = null;
    if (!findAndAttach()) watchForVideo();
  }

  function onKeydown(e) {
    const active = document.activeElement;
    if (active && (
      active.tagName === 'INPUT'    ||
      active.tagName === 'TEXTAREA' ||
      active.isContentEditable
    )) return;

    if (e.key !== 'y' && e.key !== 'Y') return;

    if (e.shiftKey) {
      styleIndex = (styleIndex + 1) % STYLE_CYCLE.length;
      applyStyle();
    } else {
      visible = !visible;
      if (overlay) overlay.style.display = visible ? '' : 'none';
    }
  }

  document.addEventListener('keydown', onKeydown, true);
  window.addEventListener('yt-navigate-finish', () => setTimeout(init, 300));
  init();

})();
