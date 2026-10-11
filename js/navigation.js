// Navigation gestures stay inside the bar so page scrolling and fields are unaffected.
let navigationClickBlockedUntil = 0;
if (document.addEventListener) document.addEventListener('click', event => {
  if (Date.now() < navigationClickBlockedUntil && event.target.closest?.('.nav')) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);

function bindNavigationSwipe() {
  const bar = document.querySelector('.nav');
  if (!bar || bar.dataset.swipeBound) return;
  bar.dataset.swipeBound = 'true';
  const buttons = [...bar.querySelectorAll('button[data-page]')];
  const activeIndex = buttons.findIndex(button => button.dataset.page === state.page);
  bar.style.setProperty('--nav-count', buttons.length);
  bar.style.setProperty('--nav-index', Math.max(0, activeIndex));
  bar.classList.toggle('has-selection', activeIndex >= 0);
  buttons.forEach((button, index) => {
    if (index === activeIndex) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  let gesture = null;
  const preview = index => {
    bar.classList.add('has-selection');
    bar.style.setProperty('--nav-index', index);
    buttons.forEach((button, i) => button.classList.toggle('active', i === index));
  };
  const restore = () => {
    bar.classList.remove('swiping');
    bar.classList.toggle('has-selection', activeIndex >= 0);
    bar.style.setProperty('--nav-index', Math.max(0, activeIndex));
    buttons.forEach((button, i) => button.classList.toggle('active', i === activeIndex));
  };
  bar.addEventListener('pointerdown', event => {
    if (gesture || event.isPrimary === false || event.button !== 0) return;
    gesture = {id:event.pointerId, x:event.clientX, y:event.clientY, dragging:false, index:activeIndex};
    bar.setPointerCapture?.(event.pointerId);
  });
  bar.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (!gesture.dragging) {
      if (Math.abs(dy) > 12 && Math.abs(dy) >= Math.abs(dx)) {
        gesture = null;
        restore();
        return;
      }
      if (Math.abs(dx) < 12 || Math.abs(dx) <= Math.abs(dy)) return;
      gesture.dragging = true;
      bar.classList.add('swiping');
    }
    const bounds = bar.getBoundingClientRect();
    // The indicator uses the same inner width as the equally spaced buttons.
    const width = Math.max(1, bounds.width - 12);
    gesture.index = Math.max(0, Math.min(buttons.length - 1, Math.floor((event.clientX - bounds.left - 6) / width * buttons.length)));
    preview(gesture.index);
  });
  const finish = (event, cancelled) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const completed = gesture;
    gesture = null;
    restore();
    if (!completed.dragging) return;
    navigationClickBlockedUntil = Date.now() + 500;
    if (cancelled) return;
    event.preventDefault();
    const page = buttons[completed.index]?.dataset.page;
    if (page && page !== state.page) go(page);
  };
  bar.addEventListener('pointerup', event => finish(event, false));
  bar.addEventListener('pointercancel', event => finish(event, true));
  bar.addEventListener('lostpointercapture', event => finish(event, true));
}
