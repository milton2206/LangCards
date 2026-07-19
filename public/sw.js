// Минимальный service worker для устанавливаемости PWA (Android «Установить»).
// Намеренно НЕ кэширует запросы — работает как прозрачный прокси, поэтому
// контент никогда не устаревает. Оффлайн-кэш можно добавить позже при желании.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("fetch", () => {
  // Пусто: браузер обрабатывает запросы как обычно (без перехвата).
});
