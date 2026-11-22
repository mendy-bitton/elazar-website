/* Small pieces of page state that several parts read without re-rendering:
   whether the menu or the video popup is open, and how to close the menu. */
export const ui = {
  menuOpen: false,
  modalOpen: false,
  closeMenu: () => {}
};

/* The intro: the hero waits for the loader's curtain to lift before it plays.
   When the loader isn't shown (another page was opened first), it plays at once. */
let booted = false;
const waiters = new Set();
export const isBooted = () => booted;
export function markBooted() {
  if (booted) return;
  booted = true;
  waiters.forEach(fn => fn());
  waiters.clear();
}
export function whenBooted(fn) {
  if (booted) { fn(); return () => {}; }
  waiters.add(fn);
  return () => waiters.delete(fn);
}
