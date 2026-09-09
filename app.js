const PRICE_PER_EMOJI = 0.02;
const MAX_SELECTION = 100;
const BLACK_TEMPLATES = [
  ...Array.from({ length: 30 }, (_, i) => String(i + 1).padStart(2, "0")),
  ...Array.from({ length: 20 }, (_, i) => String(i + 51).padStart(2, "0")),
];
const COLOR_TEMPLATES = [
  ...Array.from({ length: 20 }, (_, i) => String(i + 31).padStart(2, "0")),
  ...Array.from({ length: 30 }, (_, i) => String(i + 71).padStart(2, "0")),
];
const START_PAYLOAD_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const TEMPLATE_ASSETS = window.ART_EMOJI_TEMPLATES || {};
const normalizeTemplateId = (id) => String(id).padStart(2, "0");
const templateAssetPath = (id, extension) => {
  const folder = Number(id) <= 50 ? "templates1" : "templates2";
  return new URL(`./${folder}/${normalizeTemplateId(id)}.${extension}`, document.baseURI).href;
};
const templateAssetCandidates = (id, extension) => {
  const folder = Number(id) <= 50 ? "templates1" : "templates2";
  const names = [...new Set([String(id), normalizeTemplateId(id)])];
  return names.map((name) => new URL(`./${folder}/${name}.${extension}`, document.baseURI).href);
};
const query = new URLSearchParams(window.location.search);
const API_BASE_URL = String(query.get("api") || window.ART_EMOJI_API_URL || "").replace(/\/+$/, "");
const state = { selected: new Set(), previewAnimations: new Map(), promo: null };
let sendingOrder = false;

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
    if (data.ok) {
      state.promo = data.promo || null;
      setProfile(data.user, data.balance, data.starsBalance);
      updatePurchase();
    }
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
  const selected = state.selected.has(id);
  const asset = TEMPLATE_ASSETS[id];
  return `
    <button class="template-card ${selected ? "selected" : ""}" data-template="${id}" type="button">
      <div class="template-card__preview">
        <img class="template-card__poster" data-template-poster="${id}" src="${asset?.preview || templateAssetPath(id, "png")}" alt="Шаблон ${id}" loading="lazy" />
        ${selected
          ? `<div class="template-card__lottie" data-lottie-template="${id}" aria-label="Анимация шаблона ${id}"></div>`
          : ""}
      </div>
    </button>
  `;
}

function bindPreviewFallbacks() {
  document.querySelectorAll("[data-template-poster]").forEach((image) => {
    const id = image.dataset.templatePoster;
    const asset = TEMPLATE_ASSETS[id];
    const candidates = [
      ...(asset?.preview ? [asset.preview] : []),
      ...templateAssetCandidates(id, "png"),
    ];
    let candidateIndex = Math.max(0, candidates.indexOf(image.src));
    image.addEventListener("error", () => {
      candidateIndex += 1;
      if (candidateIndex < candidates.length) {
        image.src = candidates[candidateIndex];
        return;
      }
      image.alt = `Шаблон ${id} недоступен`;
      image.classList.add("template-card__poster--missing");
    });
  });
}

function renderTemplates() {
  $("#template-count").textContent = "100";
  $("#template-grid").innerHTML = `
    <section class="template-group">
      <div class="template-group-heading"><strong>ЧЁРНЫЕ</strong><span>${BLACK_TEMPLATES.length}</span></div>
      <div class="template-group-grid">${BLACK_TEMPLATES.map(templateCard).join("")}</div>
    </section>
    <section class="template-group">
      <div class="template-group-heading"><strong>ЦВЕТНЫЕ</strong><span>${COLOR_TEMPLATES.length}</span></div>
      <div class="template-group-grid">${COLOR_TEMPLATES.map(templateCard).join("")}</div>
    </section>
  `;
  document.querySelectorAll(".template-card").forEach((card) => {
    card.addEventListener("click", () => toggleTemplate(card.dataset.template));
  });
  bindPreviewFallbacks();
  mountSelectedAnimations();
}

function toggleTemplate(id) {
  if (state.selected.has(id)) state.selected.delete(id);
  else if (state.selected.size < MAX_SELECTION) state.selected.add(id);
  else return showToast("Можно выбрать не больше 100 эмодзи");
  renderTemplates();
  updatePurchase();
}

function mountSelectedAnimations() {
  for (const animation of state.previewAnimations.values()) animation.destroy();
  state.previewAnimations.clear();
  if (!window.lottie) return;
  document.querySelectorAll("[data-lottie-template]").forEach((container) => {
    const id = container.dataset.lottieTemplate;
    const card = container.closest(".template-card");
    const poster = card?.querySelector(".template-card__poster");
    const hidePoster = () => poster?.classList.add("template-card__poster--covered");
    const showPoster = () => poster?.classList.remove("template-card__poster--covered");
    hidePoster();
    const animation = window.lottie.loadAnimation({
      container,
      renderer: "svg",
      loop: true,
      autoplay: true,
      ...(TEMPLATE_ASSETS[id]?.animation
        ? { animationData: TEMPLATE_ASSETS[id].animation }
        : { path: templateAssetPath(id, "json") }),
    });
    state.previewAnimations.set(id, animation);
    animation.addEventListener("data_ready", hidePoster);
    animation.addEventListener("DOMLoaded", hidePoster);
    animation.addEventListener("data_failed", showPoster);
  });
}

function updatePurchase() {
  const count = state.selected.size;
  const stars = count;
  const discount = state.promo?.type === "emoji"
    ? Math.max(0, Math.min(100, Number(state.promo.percent || 0)))
    : 0;
  const usd = (count * PRICE_PER_EMOJI * (1 - discount / 100)).toFixed(2);
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
  const packTitle = $("#pack-title");
  if (!packTitle.value.trim()) packTitle.value = `ART_EMOJI ${text}`;
  $("#payment-modal").classList.remove("hidden");
}

async function sendToBot(payload) {
  if (sendingOrder) return false;
  sendingOrder = true;
  document.querySelectorAll(".payment-choice").forEach((button) => {
    button.disabled = true;
    button.classList.add("is-sending");
  });
  try {
    const botUsername = String(query.get("bot") || "").replace(/^@/, "").trim();
    const openBotLink = (url) => {
      if (telegram?.openTelegramLink) {
        telegram.openTelegramLink(url);
        return true;
      }
      if (window.location?.assign) {
        window.location.assign(url);
        return true;
      }
      return false;
    };
    const openOrderStartLink = () => {
      if (payload.action !== "create_order" || !botUsername) return false;
      const startPayload = orderStartPayload(payload.text, payload.paymentMethod);
      if (startPayload.length > 64) return false;
      return openBotLink(`https://t.me/${botUsername}?start=${encodeURIComponent(startPayload)}`);
    };

    if (API_BASE_URL && telegram?.initData) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7000);
        const response = await fetch(`${API_BASE_URL}/api/webapp`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "X-Telegram-Init-Data": telegram.initData,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || "Сервер не принял данные");

        // The bot has already sent the invoice to this chat. Open the chat
        // explicitly instead of relying only on WebApp.close(), which can
        // leave the user on the Mini App screen in some Telegram clients.
        if (botUsername && telegram?.openTelegramLink) {
          telegram.openTelegramLink(`https://t.me/${botUsername}`);
        } else {
          telegram.close?.();
        }
        return true;
      } catch (error) {
        // Continue to the transport fallbacks below. In particular, Stars
        // orders use a /start link because sendData is not guaranteed for
        // Mini Apps opened from an inline button.
        if (payload.action !== "create_order" && !telegram?.sendData) {
          showToast(`Не удалось передать заказ: ${error.message}`);
          return false;
        }
      }
    }

    // A deep link is the reliable fallback for an order. For Stars, use it
    // before sendData: some Telegram clients expose sendData but silently
    // drop it when the Mini App was opened from an inline web_app button.
    if (payload.action === "create_order" && payload.paymentMethod === "stars" && openOrderStartLink()) {
      return true;
    }

    if (telegram?.sendData) {
      telegram.sendData(JSON.stringify(payload));
      return true;
    }
    if (openOrderStartLink()) return true;
    showToast("Не настроен API бота для Mini App");
    return false;
  } finally {
    sendingOrder = false;
    document.querySelectorAll(".payment-choice").forEach((button) => {
      button.disabled = false;
      button.classList.remove("is-sending");
    });
  }
}

function encodeBase64Url(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function orderStartPayload(text, method) {
  let bits = 0n;
  for (const id of state.selected) {
    const index = Number(id) - 1;
    if (index >= 0 && index < 100) bits |= 1n << BigInt(index);
  }
  let templates = "";
  for (let chunkIndex = 0; chunkIndex < 17; chunkIndex++) {
    const chunk = Number((bits >> BigInt(chunkIndex * 6)) & 63n);
    templates += START_PAYLOAD_ALPHABET[chunk];
  }
  return `a${templates}${encodeBase64Url(text)}${method === "stars" ? "s" : "c"}`;
}

async function choosePayment(method) {
  const text = $("#emoji-text").value.trim();
  const packTitle = $("#pack-title").value.trim();
  if (!packTitle) {
    showToast("Введи название пака");
    $("#pack-title").focus();
    return;
  }
  if (packTitle.length > 64) {
    showToast("Название пака должно быть не длиннее 64 символов");
    return;
  }
  const accepted = await sendToBot({
    action: "create_order",
    clientOrderId: globalThis.crypto?.randomUUID?.() || `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    templates: [...state.selected].sort(),
    text,
    packTitle,
    paymentMethod: method,
  });
  if (accepted) $("#payment-modal").classList.add("hidden");
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
  $("#promo-submit").addEventListener("click", () => {
    const code = $("#promo-code").value.trim();
    if (!code) {
      showToast("Введи промокод");
      $("#promo-code").focus();
      return;
    }
    sendToBot({ action: "redeem_promo", code });
  });
  $("#promo-code").addEventListener("keydown", (event) => {
    if (event.key === "Enter") $("#promo-submit").click();
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