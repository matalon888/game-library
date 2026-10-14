import { CONFIG } from "./config.js";
import { DOM } from "./dom.js";

export function setVisibility(elements, displayValue) {
  elements.forEach((element) => {
    element.style.display = displayValue;
  });
}

export function updateStatusMessage(message, statusType) {
  DOM.statusMsg.className = "";

  // Hide and clear if empty message
  if (message === "") {
    DOM.statusMsg.classList.add("is-hidden");
    DOM.statusMsg.textContent = "";
    return;
  }

  // Show message with appropriate styling
  DOM.statusMsg.textContent = message;
  if (statusType) {
    DOM.statusMsg.classList.add(`is-${statusType}`);
  }
}

export function normalizeText(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // Remove accents
    .replace(/[^\p{L}\p{N}\s]/gu, "") // Keep only letters, numbers, spaces
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim();
}

export function resetSearchButton() {
  DOM.searchBtn.disabled = false;
  DOM.searchBtn.removeAttribute("aria-busy");
  DOM.searchBtn.innerHTML =
    '<i class="fa-solid fa-magnifying-glass"></i>Search';
}

export function showPointsUpdate(points) {
  const notification = DOM.pointsNotification;

  const sign = points >= 0 ? "+" : "";
  notification.textContent = `${sign}${points}`;

  notification.classList.remove("positive", "negative");
  notification.classList.add(points >= 0 ? "positive" : "negative");

  notification.classList.add("show");

  setTimeout(() => {
    notification.classList.remove("show");
  }, CONFIG.GAME.NOTIFICATION_TIMEOUT);
}

export function setSearchButtonLoading() {
  DOM.searchBtn.disabled = true;
  DOM.searchBtn.setAttribute("aria-busy", "true");
  DOM.searchBtn.innerHTML = '<i class="fa-solid fa-spinner"></i>Loading...';
}
