/**
 * Extra safety net on top of the CSS `touch-action: none` / `user-select:
 * none` rules in style.css: some older mobile browsers still fire
 * scroll/zoom/selection gestures unless these are also blocked at the JS
 * level. Call once from main.ts.
 */
export function preventUnwantedGestures(): void {
  const passiveFalse: AddEventListenerOptions = { passive: false };

  document.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length > 1) event.preventDefault(); // pinch-zoom
    },
    passiveFalse
  );

  // iOS Safari pinch-zoom gesture events (not covered by touchmove alone).
  document.addEventListener('gesturestart', (event) => event.preventDefault());

  document.addEventListener('dblclick', (event) => event.preventDefault());

  document.addEventListener('contextmenu', (event) => event.preventDefault());
}
