const PRICE_PER_EMOJI = 0.02;
const BLACK_TEMPLATES = Array.from({ length: 30 }, (_, i) => String(i + 1).padStart(2, "0"));
const COLOR_TEMPLATES = Array.from({ length: 20 }, (_, i) => String(i + 31).padStart(2, "0"));
const query = new URLSearchParams(window.location.search);
const API_BASE_URL = String(query.get("api") || window.ART_EMOJI_API_URL || "").replace(/\/+$/, "");
const state = { selected: new Set(), previewAnimations: new Map() };

const $ = (selector) => document.querySelector(selector);
const telegram = window.Telegram?.WebApp;

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function setProfile(user, balance = null, starsBalance = null) {
  const displayName = user
    ? user.username
      ? `@${user.username}`
      : [user.firstName || user.first_name, user.lastName || user.last_name].filter(Boolean).join(" ") || "ART_EMOJI"
    : "ART_EMOJI";
  $("#account-name").textContent = displayName;
  $("#profile-name").textContent = displayName;
  if (starsBalance !== null) $("#top-balance").textContent = Number(starsBalance).toFixed(0);
  if (starsBalance !== null) $("#profile-balance").textContent = Number(starsBalance).toFixed(0);
  if (!user) return;
  const username = String(user.username || "").replace(/^@/, "");
  const photoUrl = user.photoUrl
    || user.photo_url
    || (username ? `https://t.me/i/userpic/320/${encodeURIComponent(username)}.jpg` : "");
  if (photoUrl) {
    const avatar = $("#profile-avatar");
    avatar.textContent = "";
    const image = document.createElement("img");
    image.src = photoUrl;
    image.alt = "Аватар Telegram";
    image.onerror = () => {
      avatar.textContent = (displayName.replace("@", "").slice(0, 1) || "A").toUpperCase();
    };
    avatar.appendChild(image);
  } else {
    $("#profile-avatar").textContent = (displayName.replace("@", "").slice(0, 1) || "A").toUpperCase();
  }
}

async function syncProfile() {
  const telegramUser = telegram?.initDataUnsafe?.user;
  const urlUser = {
    username: query.get("username") || "",
    firstName: query.get("first_name") || "",
    lastName: query.get("last_name") || "",
    photoUrl: query.get("photo_url") || "",
  };
  const profileUser = telegramUser ? { ...urlUser, ...telegramUser } : urlUser;
  const urlBalance = query.get("balance");
  const urlStars = query.get("stars");
  setProfile(
    profileUser,
    urlBalance === null ? null : Number(urlBalance),
    urlStars === null ? null : Number(urlStars),
  );
  if (!API_BASE_URL || !telegram?.initData) return;
  try {
    const response = await fetch(`${API_BASE_URL}/api/profile`, {
      headers: { "X-Telegram-Init-Data": telegram.initData },
    });
    if (!response.ok) return;
    const data = await response.json();
    if (data.ok) setProfile(data.user, data.balance, data.starsBalance);
  } catch {
    // The interface remains usable if the optional profile API is temporarily unavailable.
  }
}

function randomLoader() {
  const options = [
    ["🎨", "Подбираем эмодзи для тебя"],
    ["🪄", "Готовим анимированные эмодзи"],
    ["💎", "Загружаем коллекцию ART_EMOJI"],
    ["🚀", "Почти готово, ещё чуть-чуть"],
    ["🧩", "Собираем лучшие шаблоны"],
  ];
  let index = 0;
  const update = () => {
    const [emoji, text] = options[index++ % options.length];
    $("#loader-emoji").textContent = emoji;
    $("#loader-text").textContent = text;
  };
  update();
  const interval = setInterval(update, 430);
  setTimeout(() => {
    clearInterval(interval);
    $("#loader").classList.add("hidden");
    $("#app").classList.remove("hidden");
  }, 1700);
}

function setupTelegram() {
  if (!telegram) return;
  telegram.ready();
  telegram.expand();
  telegram.setHeaderColor?.("#1478dc");
  telegram.setBackgroundColor?.("#f5f7fa");
}

function templateCard(id) {
  return `
    <button class="template-card ${state.selected.has(id) ? "selected" : ""}" data-template="${id}" type="button">
      <div class="template-card__preview">
        <img src="./templates/${id}.png" alt="Шаблон ${id}" loading="lazy" />
        ${state.selected.has(id) ? `<div class="template-card__lottie" data-lottie-template="${id}"></div>` : ""}
      </div>
    </button>
  `;
}

function renderTemplates() {
  $("#template-count").textContent = "50";
  $("#template-grid").innerHTML = `
    <section class="template-group">
      <div class="template-group-heading"><strong>ЧЁРНЫЕ</strong><span>30</span></div>
      <div class="template-group-grid">${BLACK_TEMPLATES.map(templateCard).join("")}</div>
    </section>
    <section class="template-group">
      <div class="template-group-heading"><strong>ЦВЕТНЫЕ</strong><span>20</span></div>
      <div class="template-group-grid">${COLOR_TEMPLATES.map(templateCard).join("")}</div>
    </section>
  `;
  document.querySelectorAll(".template-card").forEach((card) => {
    card.addEventListener("click", () => toggleTemplate(card.dataset.template));
  });
  mountSelectedAnimations();
}

function toggleTemplate(id) {
  if (state.selected.has(id)) state.selected.delete(id);
  else if (state.selected.size < 50) state.selected.add(id);
  else return showToast("Можно выбрать не больше 50 эмодзи");
  renderTemplates();
  updatePurchase();
}

function mountSelectedAnimations() {
  for (const animation of state.previewAnimations.values()) animation.destroy();
  state.previewAnimations.clear();
  if (!window.lottie) return;
  document.querySelectorAll("[data-lottie-template]").forEach((container) => {
    const id = container.dataset.lottieTemplate;
    const animation = window.lottie.loadAnimation({
      container,
      renderer: "svg",
      loop: true,
      autoplay: true,
      path: `./templates/${id}.json`,
    });
    state.previewAnimations.set(id, animation);
  });
}

function updatePurchase() {
  const count = state.selected.size;
  const stars = count;
  const usd = (count * PRICE_PER_EMOJI).toFixed(2);
  $("#summary-text").textContent = $("#emoji-text").value.trim() || "—";
  $("#summary-cost").textContent = `${stars} ⭐`;
  $("#selected-count").textContent = `${count} эмодзи`;
  $("#purchase-stars").textContent = `${stars} ⭐`;
  $("#purchase-usd").textContent = `$${usd}`;
  $("#payment-stars").textContent = `${stars} ⭐`;
  $("#payment-usd").textContent = `${usd} USDT`;
  $("#purchase-panel").classList.toggle("hidden", count === 0);
}

function openPayment() {
  const text = $("#emoji-text").value.trim();
  if (!text) {
    showToast("Сначала введи текст для эмодзи");
    $("#emoji-text").focus();
    return;
  }
  if (text.length > 16) {
    showToast("Текст должен быть не длиннее 16 символов");
    return;
  }
  $("#payment-description").textContent = `Выбрано ${state.selected.size} эмодзи. После выбора откроется бот и выставит счёт.`;
  $("#payment-modal").classList.remove("hidden");
}

function sendToBot(payload) {
  if (!telegram?.sendData) return;
  telegram.sendData(JSON.stringify(payload));
}

function choosePayment(method) {
  const text = $("#emoji-text").value.trim();
  sendToBot({
    action: "create_order",
    templates: [...state.selected].sort(),
    text,
    packTitle: `ART_EMOJI ${text}`,
    paymentMethod: method,
  });
  $("#payment-modal").classList.add("hidden");
}

function switchView(viewId) {
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("hidden", view.id !== viewId));
  document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.view === viewId));
  $("#purchase-panel").classList.toggle("hidden", viewId !== "create-view" || state.selected.size === 0);
}

function initEvents() {
  $("#emoji-text").addEventListener("input", updatePurchase);
  $("#buy-button").addEventListener("click", openPayment);
  $("#close-payment").addEventListener("click", () => $("#payment-modal").classList.add("hidden"));
  $("#payment-modal .modal__backdrop").addEventListener("click", () => $("#payment-modal").classList.add("hidden"));
  document.querySelectorAll(".payment-choice").forEach((button) => {
    button.addEventListener("click", () => choosePayment(button.dataset.payment));
  });
  document.querySelectorAll(".nav-button[data-view]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });
  document.querySelectorAll(".payment-option").forEach((button) => {
    button.addEventListener("click", () => sendToBot({ action: "topup", method: button.dataset.topup }));
  });
}

setupTelegram();
setProfile({
  username: query.get("username") || "",
  firstName: query.get("first_name") || "",
  lastName: query.get("last_name") || "",
  photoUrl: query.get("photo_url") || "",
}, null, query.get("stars") === null ? null : Number(query.get("stars")));
renderTemplates();
initEvents();
updatePurchase();
syncProfile();
randomLoader();