/* Minimal placeholder service worker.
 * Prevents 404 for old/stale SW registrations that still request /service-worker.js.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});