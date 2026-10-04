// Service worker for event reminders (web push). Kept dependency-free.
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Acacia", {
      body: data.body || "",
      icon: "/icon-mark",
      data: { url: data.url || "/dashboard/events" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
