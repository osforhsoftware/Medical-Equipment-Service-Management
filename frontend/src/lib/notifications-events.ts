export const NOTIFICATIONS_UPDATED = "mesms:notifications-updated";

export function emitNotificationsUpdated() {
  window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED));
}
