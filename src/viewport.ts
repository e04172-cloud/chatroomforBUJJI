/**
 * Keeps --app-h equal to the visible height. On phones the on-screen keyboard shrinks the visual viewport,
 * so a full-height chat shrinks with it and the composer stays just above the keyboard.
 */
export function trackViewport(): void {
  const vv = window.visualViewport;
  const update = () => {
    const h = vv ? vv.height : window.innerHeight;
    document.documentElement.style.setProperty('--app-h', `${Math.round(h)}px`);
    // iOS scrolls the whole page to reveal a focused input; pin it so the pot header stays put.
    if (vv && vv.offsetTop > 0 && document.querySelector('.screen.fixed')) window.scrollTo(0, 0);
  };
  update();
  vv?.addEventListener('resize', update);
  vv?.addEventListener('scroll', update);
  window.addEventListener('resize', update);
}
