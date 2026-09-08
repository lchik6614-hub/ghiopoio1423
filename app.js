const PRICE_PER_EMOJI = 0.02;
const BLACK_TEMPLATES = Array.from({ length: 30 }, (_, i) => String(i + 1).padStart(2, "0"));
const COLOR_TEMPLATES = Array.from({ length: 20 }, (_, i) => String(i + 31).padStart(2, "0"));
const state = {
  category: "black",
  selected: new Set(),
  activeTemplate: null,
  lottie: null,
};

const $ = (selector) => document.querySelector(selector);
const telegram = window.Telegram?.WebApp;

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function randomLoader() {
  const options = [
    ["🎨", "Подбираем стиль для тебя"],
    ["🪄", "Готовим анимированные эмодзи"],
    ["💎", "Загружаем коллекцию ARTEMOJI"],
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

function renderTemplates() {
  const ids = state.category === "black" ? BLACK_TEMPLATES : COLOR_TEMPLATES;
  $("#template-count").textContent = state.category === "black" ? "30" : "20";
  $("#template-grid").innerHTML = ids.map((id) => `
    <button class="template-card ${state.selected.has(id) ? "selected" : ""}" data-template="${id}" type="button">
      <img src="./templates/${id}.png" alt="Шаблон ${id}" loading="lazy" />
    </button>
  `).join("");
  document.querySelectorAll(".template-card").forEach((card) => {
    card.addEventListener("click", () => openPreview(card.dataset.template));
  });
}

function openPreview(id) {
  state.activeTemplate = id;
  $("#modal-title").textContent = `Шаблон ${id}`;
  $("#preview-modal").classList.remove("hidden");
  const container = $("#lottie-preview");
  container.innerHTML = "";
  if (state.lottie) state.lottie.destroy();
  if (window.lottie) {
    state.lottie = window.lottie.loadAnimation({
      container,
      renderer: "svg",
      loop: true,
      autoplay: true,
      path: `./templates/${id}.json`,
    });
  } else {
    container.innerHTML = `<img src="./templates/${id}.png" alt="Шаблон ${id}" />`;
  }
  $("#modal-select").textContent = state.selected.has(id) ? "УБРАТЬ ИЗ ВЫБОРА" : "ВЫБРАТЬ";
}

function closePreview() {
  $("#preview-modal").classList.add("hidden");
  if (state.lottie) {
    state.lottie.destroy();
    state.lottie = null;
  }
}

function toggleTemplate(id) {
  if (state.selected.has(id)) state.selected.delete(id);
  else if (state.selected.size < 50) state.selected.add(id);
  else return showToast("Можно выбрать не больше 50 эмодзи");
  renderTemplates();
  updatePurchase();
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
  if (telegram?.sendData) {
    telegram.sendData(JSON.stringify(payload));
    return;
  }
  showToast("Демо-режим: открой мини‑апп через Telegram");
  console.log("Mini App payload", payload);
}

function choosePayment(method) {
  const text = $("#emoji-text").value.trim();
  const payload = {
    action: "create_order",
    templates: [...state.selected].sort(),
    text,
    packTitle: `Art Emoji ${text}`,
    paymentMethod: method,
  };
  sendToBot(payload);
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
  $("#modal-select").addEventListener("click", () => {
    toggleTemplate(state.activeTemplate);
    closePreview();
  });
  $("#close-modal").addEventListener("click", closePreview);
  $("#preview-modal .modal__backdrop").addEventListener("click", closePreview);
  $("#close-payment").addEventListener("click", () => $("#payment-modal").classList.add("hidden"));
  $("#payment-modal .modal__backdrop").addEventListener("click", () => $("#payment-modal").classList.add("hidden"));
  document.querySelectorAll(".payment-choice").forEach((button) => {
    button.addEventListener("click", () => choosePayment(button.dataset.payment));
  });
  document.querySelectorAll(".category-tab").forEach((button) => {
    button.addEventListener("click", () => {
      state.category = button.dataset.category;
      document.querySelectorAll(".category-tab").forEach((item) => item.classList.toggle("active", item === button));
      renderTemplates();
    });
  });
  document.querySelectorAll(".nav-button[data-view]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });
  document.querySelectorAll(".payment-option").forEach((button) => {
    button.addEventListener("click", () => {
      const method = button.dataset.topup;
      if (method === "crypto" || method === "stars") sendToBot({ action: "topup", method });
      else showToast("Этот способ пополнения скоро будет доступен");
    });
  });
}

setupTelegram();
renderTemplates();
initEvents();
updatePurchase();
randomLoader();