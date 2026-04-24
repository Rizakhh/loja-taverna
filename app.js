const ITEMS_PER_PAGE = 9;
const TWITCH_CHANNEL = "rizakh";
const CLIPS_API = "https://falling-cake-b5d5.rizakh-rph.workers.dev/clips";
const TWITCH_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";

let todosProdutos = [];
let paginaAtual = 1;
let totalPaginas = 1;
let filtroAtivo = "all";
let historicoPrecos = {};

// ── Helpers
function fmtDesc(d) {
  return d % 1 === 0 ? d.toString() : d.toFixed(1);
}

function escHtml(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let isLive = false;
let clipIndex = 0;
let lastKnownStatus = null;
let currentIframeSrc = "";

const FALLBACK_CLIPS = [
  "https://clips.twitch.tv/embed?clip=PluckyRoundOx4Head&parent=localhost",
  "https://clips.twitch.tv/embed?clip=FriendlyConfidentMangoPogChamp-jOjwS2W-_dFd-upn&parent=localhost",
  "https://clips.twitch.tv/embed?clip=AverageGoldenPigeonVoteNay&parent=localhost",
  "https://clips.twitch.tv/embed?clip=SmoothElegantPistonVoteYea&parent=localhost",
  "https://clips.twitch.tv/embed?clip=SparklingAbrasiveEyeballJebaited&parent=localhost",
  "https://clips.twitch.tv/embed?clip=IronicElegantSwordBIRB-siQqnUubLgBG82Hq&parent=localhost",
];

let dynamicClips = [];

// 🔄 Busca clips dinâmicos da API
async function carregarClipsDinamicos() {
  try {
    const res = await fetch(`${CLIPS_API}?_=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const urls = await res.json();
    if (Array.isArray(urls) && urls.length) {
      dynamicClips = urls;
      console.log("[Twitch] Clips dinâmicos carregados:", dynamicClips.length);
    } else {
      dynamicClips = [];
    }
  } catch (e) {
    console.warn(
      "[Twitch] Falha ao buscar clips dinâmicos, usando fallback:",
      e,
    );
    dynamicClips = [];
  }
}

// 📺 Obtém URL de um clip (dinâmico ou fallback) com correção de parent/autoplay/muted
function getClipUrl(index) {
  const parent = window.location.hostname || "localhost";
  const lista = dynamicClips.length ? dynamicClips : FALLBACK_CLIPS;
  let clip = lista[index % lista.length];
  clip = clip.replace(/parent=[^&]+/g, "parent=" + parent);
  if (!clip.includes("parent=")) {
    clip += (clip.includes("?") ? "&" : "?") + "parent=" + parent;
  }
  if (!clip.includes("autoplay=")) clip += "&autoplay=true";
  if (!clip.includes("muted=")) clip += "&muted=true";
  return clip;
}

function prevClip() {
  const lista = dynamicClips.length ? dynamicClips : FALLBACK_CLIPS;
  clipIndex = (clipIndex - 1 + lista.length) % lista.length;
  const iframe = document.getElementById("twitch-player");
  if (iframe) iframe.src = getClipUrl(clipIndex);
}

function nextClip() {
  const lista = dynamicClips.length ? dynamicClips : FALLBACK_CLIPS;
  clipIndex = (clipIndex + 1) % lista.length;
  const iframe = document.getElementById("twitch-player");
  if (iframe) iframe.src = getClipUrl(clipIndex);
}

// ✅ Obtém status real da Twitch usando API oficial (sem autenticação)
async function obterStatusLive() {
  // Tentativa 1: API oficial da Twitch (helix)
  try {
    const response = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${TWITCH_CHANNEL}`,
      {
        headers: {
          "Client-ID": TWITCH_CLIENT_ID,
        },
        cache: "no-store",
      },
    );
    if (response.ok) {
      const data = await response.json();
      const isOnline = data.data && data.data.length > 0;
      console.log(`[Twitch] API oficial: ${isOnline ? "online" : "offline"}`);
      return isOnline;
    }
  } catch (e) {
    console.warn("[Twitch] Falha na API oficial, tentando fallback:", e);
  }

  // Tentativa 2: fallback via decapi.me (uptime)
  try {
    const response = await fetch(
      `https://decapi.me/twitch/uptime/${TWITCH_CHANNEL}?_=${Date.now()}`,
      { cache: "no-store" },
    );
    const text = (await response.text()).trim().toLowerCase();
    // Se o retorno for "offline" ou vazio, está offline. Qualquer outra string (ex: "1h 2m") significa online
    const isOnline = !(text === "offline" || text === "");
    console.log(`[Twitch] Decapi (uptime): ${text} → online? ${isOnline}`);
    return isOnline;
  } catch (error) {
    console.error("[Twitch] Erro no fallback de status:", error);
    return false;
  }
}

// 🔄 Verifica e atualiza o player SOMENTE se o status mudou
async function verificarEAtualizarPlayer() {
  const iframe = document.getElementById("twitch-player");
  if (!iframe) return;

  const currentlyLive = await obterStatusLive();
  if (currentlyLive === lastKnownStatus) return;
  lastKnownStatus = currentlyLive;

  console.log(
    "[Twitch] Status mudou para:",
    currentlyLive ? "online" : "offline",
  );

  if (currentlyLive) {
    const parent = window.location.hostname || "localhost";
    const liveUrl = `https://player.twitch.tv/?channel=${TWITCH_CHANNEL}&parent=${parent}&autoplay=true&muted=true`;
    if (iframe.src !== liveUrl) {
      iframe.src = liveUrl;
      currentIframeSrc = liveUrl;
    }
    setLiveBadge(true);
    showClipNav(false);
    if (window.clipTimer) clearInterval(window.clipTimer);
  } else {
    await loadOfflineClip();
  }
}

// 💤 Carrega um clip aleatório (modo offline)
async function loadOfflineClip() {
  const iframe = document.getElementById("twitch-player");
  if (!iframe) return;
  if (!dynamicClips.length) {
    await carregarClipsDinamicos();
  }
  const lista = dynamicClips.length ? dynamicClips : FALLBACK_CLIPS;
  if (!lista.length) return;
  clipIndex = Math.floor(Math.random() * lista.length);
  const novaUrl = getClipUrl(clipIndex);
  if (iframe.src !== novaUrl) {
    iframe.src = novaUrl;
    currentIframeSrc = novaUrl;
  }
  setLiveBadge(false);
  showClipNav(true);

  if (window.clipTimer) clearInterval(window.clipTimer);
  window.clipTimer = setInterval(() => {
    if (!isLive) nextClip();
  }, 45000);
}

// 🎛️ UI helpers (mantidos iguais)
function setLiveBadge(live) {
  const badge = document.getElementById("player-badge");
  if (!badge) return;
  isLive = live;
  badge.innerHTML = live
    ? '<span class="live-dot"></span>AO VIVO'
    : '<span class="offline-dot"></span>Offline';
  badge.style.background = live ? "var(--crimson)" : "#555570";
  updateTwitchLiveIndicator(live);
}

function updateTwitchLiveIndicator(live) {
  const twitchBtns = document.querySelectorAll(".social-btn.twitch");
  twitchBtns.forEach((btn) => {
    const indicator = btn.querySelector(".twitch-live-indicator");
    if (indicator) indicator.style.display = live ? "inline-block" : "none";
    if (live) btn.classList.add("is-live");
    else btn.classList.remove("is-live");
  });
}

function showClipNav(show) {
  const prev = document.getElementById("clip-prev");
  const next = document.getElementById("clip-next");
  if (prev) prev.style.display = show ? "flex" : "none";
  if (next) next.style.display = show ? "flex" : "none";
}

// 🚀 Inicialização do Twitch Player
function initTwitchPlayer() {
  carregarClipsDinamicos();
  // Primeira verificação com pequeno delay para garantir que o DOM está pronto
  setTimeout(() => verificarEAtualizarPlayer(), 500);
  setInterval(verificarEAtualizarPlayer, 120000);
  setInterval(carregarClipsDinamicos, 600000);
}

// HISTÓRICO DE PREÇOS

function carregarHistorico() {
  const script = document.getElementById("preco-history-data");
  if (script) {
    try {
      const data = JSON.parse(script.textContent || "{}");
      if (Object.keys(data).length > 0) {
        historicoPrecos = data;
        console.log(
          "[Loja] Historico carregado (inline):",
          Object.keys(historicoPrecos).length,
          "itens",
        );
        return;
      }
    } catch (e) {}
  }

  fetch("preco_history.json")
    .then((r) => {
      if (!r.ok) throw new Error("Not found");
      return r.json();
    })
    .then((data) => {
      historicoPrecos = data;
      console.log(
        "[Loja] Historico carregado (json):",
        Object.keys(historicoPrecos).length,
        "itens",
      );
    })
    .catch(() => {
      historicoPrecos = {};
      console.log("[Loja] Historico: arquivo nao encontrado");
    });
}

// PRODUTOS

function carregarProdutos() {
  console.log("[Loja] Iniciando carregarProdutos...");
  const script = document.getElementById("produtos-data");
  if (!script) {
    mostrarEmpty();
    return;
  }
  try {
    const dados = JSON.parse(script.textContent);
    if (!dados || dados.length === 0) {
      mostrarEmpty();
      return;
    }

    todosProdutos = dados.map((p) =>
      Object.assign({}, p, {
        vendido: p.estoque === 0 || p.status === "vendido",
        isNovo: p.isNovo && !p.vendido,
        isSale: Number(p.desconto) > 0 && !p.vendido,
      }),
    );

    todosProdutos.sort(cmpProdutos);
    paginaAtual = 1;
    totalPaginas = Math.max(
      1,
      Math.ceil(todosProdutos.length / ITEMS_PER_PAGE),
    );
    renderizarPagina();
    atualizarStats(todosProdutos);
    atualizarFiltros();
  } catch (e) {
    console.error("[Loja] ERRO:", e);
    mostrarEmpty();
  }
}

function cmpProdutos(a, b) {
  if (a.vendido !== b.vendido) return a.vendido ? 1 : -1;
  if (a.isNovo !== b.isNovo) return b.isNovo ? 1 : -1;
  if (a.isSale !== b.isSale) return b.isSale ? 1 : -1;
  return 0;
}

// FILTROS

function configurarFiltros() {
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      filtroAtivo = btn.dataset.filter;
      paginaAtual = 1;
      renderizarPagina();
    });
  });
}

function filtrar(lista) {
  switch (filtroAtivo) {
    case "disponivel":
      return lista.filter((p) => !p.vendido);
    case "sale":
      return lista.filter((p) => p.isSale);
    case "novo":
      return lista.filter((p) => p.isNovo);
    case "vendido":
      return lista.filter((p) => p.vendido);
    default:
      return lista;
  }
}

// RENDERIZAÇÃO

function renderizarPagina() {
  const filtrado = filtrarProdutos();
  totalPaginas = Math.max(1, Math.ceil(filtrado.length / ITEMS_PER_PAGE));
  if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;

  const grid = document.getElementById("shop-grid");
  const empty = document.getElementById("empty-state");

  if (filtrado.length === 0) {
    if (grid) grid.innerHTML = "";
    if (empty) empty.style.display = "block";
    const pgCtrl = document.getElementById("pagination-controls");
    const pgInfo = document.getElementById("pagination-info");
    if (pgCtrl) pgCtrl.style.display = "none";
    if (pgInfo) pgInfo.style.display = "none";
    return;
  }

  if (empty) empty.style.display = "none";

  const inicio = (paginaAtual - 1) * ITEMS_PER_PAGE;
  const pedacos = filtrado.slice(inicio, inicio + ITEMS_PER_PAGE);

  grid.innerHTML = pedacos.map((p) => cardHTML(p)).join("");

  grid.querySelectorAll(".btn-buy").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      copiarComando(btn);
    });
  });

  applyCardTiltToContainer(grid);

  const info = document.getElementById("pagination-info");
  const txt = document.getElementById("pagination-text");
  const dots = document.getElementById("page-dots");
  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");

  if (info && txt) {
    info.style.display = "block";
    txt.textContent = `Mostrando ${filtrado.length} itens — Pagina ${paginaAtual} de ${totalPaginas}`;
  }

  const pgCtrl = document.getElementById("pagination-controls");
  if (pgCtrl) {
    pgCtrl.style.display = totalPaginas > 1 ? "flex" : "none";
    if (btnPrev) btnPrev.disabled = paginaAtual <= 1;
    if (btnNext) btnNext.disabled = paginaAtual >= totalPaginas;
  }

  if (dots) {
    let html = "";
    for (let i = 1; i <= totalPaginas; i++) {
      html += `<span class="page-dot${i === paginaAtual ? " active" : ""}" onclick="goToPage(${i})">${i}</span>`;
    }
    dots.innerHTML = html;
  }
}

function goPage(dir) {
  paginaAtual = Math.max(1, Math.min(totalPaginas, paginaAtual + dir));
  renderizarPagina();
  scrollToShop();
}

function goToPage(n) {
  paginaAtual = n;
  renderizarPagina();
  scrollToShop();
}

function scrollToShop() {
  const shop = document.getElementById("shop");
  if (shop) shop.scrollIntoView({ behavior: "smooth" });
}

// CARD HTML

function cardHTML(p) {
  let tags = "";
  if (p.vendido) tags += '<span class="tag tag-sold">Vendido</span>';
  else if (p.isNovo) tags += '<span class="tag tag-novo">Novo</span>';
  if (p.isSale) tags += '<span class="tag tag-sale">Sale</span>';

  const videoHtml = p.youtubeId
    ? `<iframe src="https://www.youtube.com/embed/${p.youtubeId}?rel=0&modestbranding=1"
        title="${escHtml(p.nome)}"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowfullscreen loading="eager"></iframe>`
    : `<div class="video-placeholder">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        <span>Sem trailer</span>
      </div>`;

  const steamHref = p.steamAppId
    ? `https://store.steampowered.com/app/${p.steamAppId}`
    : `https://store.steampowered.com/search/?term=${encodeURIComponent(p.nome)}`;
  const steamBtnHtml = `<a class="steam-store-btn" href="${steamHref}" target="_blank" rel="noopener" title="${p.steamAppId ? "Ver na Steam" : "Buscar na Steam"}">
    <svg class="steam-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><use href="#steam-icon"/></svg>
    Ver na Loja
  </a>`;

  function fmt(n) {
    return n.toLocaleString("pt-BR");
  }

  let precoHtml = "";
  if (p.isSale) {
    precoHtml = `<div class="card-price">
      <div class="price-box">
        <span class="price-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.5 9.5c0-1.1.9-2 2-2h1a2 2 0 0 1 0 4h-1a2 2 0 0 0 0 4h1a2 2 0 0 1 0 4h-1a2 2 0 0 1-2-2"/>
            <path d="M12 6v2"/>
            <path d="M12 16v2"/>
          </svg>
        </span>
        <span class="price-current">${fmt(p.precoFinal)}</span>
      </div>
      <span class="price-original">${fmt(p.preco)}</span>
      <span class="price-badge">-${fmtDesc(p.desconto)}%</span>
    </div>`;
  } else {
    precoHtml = `<div class="card-price">
      <div class="price-box">
        <span class="price-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.5 9.5c0-1.1.9-2 2-2h1a2 2 0 0 1 0 4h-1a2 2 0 0 0 0 4h1a2 2 0 0 1 0 4h-1a2 2 0 0 1-2-2"/>
            <path d="M12 6v2"/>
            <path d="M12 16v2"/>
          </svg>
        </span>
        <span class="price-current">${fmt(p.precoFinal)}</span>
      </div>
    </div>`;
  }

  let extraHtml = "";
  if (p.vendido) {
    if (p.compradoPor || p.dataCompraBr) {
      const buyer = p.compradoPor ? escHtml(p.compradoPor) : "Anonimo";
      const date = p.dataCompraBr ? p.dataCompraBr : "";
      extraHtml = `<div class="card-extra sold-info">Vendido para ${buyer}${date ? ` em ${date}` : ""}</div>`;
    }
  } else {
    const addedLine = p.dataAdicBr
      ? `<span class="added-info">Adicionado ${p.dataAdicBr}</span>`
      : "";
    const histBtn = `<button class="hist-btn" onclick="toggleHistory('${p.id}')">Histórico</button>`;
    if (addedLine || histBtn) {
      extraHtml = `<div class="card-footer-row">${addedLine}${histBtn}</div>`;
    }
  }

  let estoqueHtml = "";
  if (p.vendido) {
    estoqueHtml = '<div class="card-stock stock-zero">Vendido</div>';
  } else if (p.estoque <= 2 && p.estoque > 0) {
    estoqueHtml = `<div class="card-stock stock-low">Restam ${p.estoque}</div>`;
  } else if (p.estoque > 0) {
    estoqueHtml = '<div class="card-stock stock-ok">Disponivel</div>';
  } else {
    estoqueHtml = '<div class="card-stock stock-zero">Esgotado</div>';
  }

  const btnHtml = p.vendido
    ? `<button class="btn-buy" disabled>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        Esgotado
      </button>`
    : `<button class="btn-buy" data-cmd="!loja comprar ${escHtml(p.id)}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
        </svg>
        Comprar
      </button>`;

  return `<div class="product-card${p.vendido ? " sold" : ""}" data-id="${escHtml(p.id)}">
    <div class="card-tags">${tags}</div>
    <div class="card-video">${videoHtml}</div>
    <div class="card-body">
      <div class="card-top-row">
        <div class="card-id">ID: ${escHtml(p.id)}</div>
        ${steamBtnHtml}
      </div>
      <div class="card-name">${escHtml(p.nome)}</div>
      ${precoHtml}
      ${estoqueHtml}
      ${extraHtml}
      <div class="card-buy">${btnHtml}</div>
    </div>
  </div>`;
}

// HISTÓRICO

function toggleHistory(id) {
  const existing = document.getElementById("hist-modal-" + id);
  if (existing) {
    existing.remove();
    return;
  }

  const p = todosProdutos.find((prod) => prod.id == id);
  if (!p) return;

  const entries = historicoPrecos[p.id] || [];
  const ultimas = entries.slice(-10).reverse();

  const rows = ultimas
    .map((e) => {
      const data = e.data || "—";
      const precoBruto = e.preco || 0;
      const desconto = e.desconto || 0;
      const precoFinal =
        desconto > 0
          ? Math.ceil(precoBruto * (1 - desconto / 100))
          : precoBruto;
      const preco = precoFinal.toLocaleString("pt-BR");
      const off =
        desconto > 0
          ? ` <span class="hist-off">(${fmtDesc(desconto)}% off)</span>`
          : "";
      return `<tr><td class="hist-data">${data}</td><td class="hist-preco">${preco}${off}</td></tr>`;
    })
    .join("");

  const tbody =
    rows || '<td><td colspan="2" class="hist-empty">Sem registros</td></tr>';

  const modal = document.createElement("div");
  modal.id = "hist-modal-" + id;
  modal.className = "hist-modal";
  modal.innerHTML = `
    <div class="hist-modal-content">
      <div class="hist-modal-header">
        <span>Histórico de Preços — ${escHtml(p.nome)}</span>
        <button class="hist-modal-close" onclick="toggleHistory('${id}')">×</button>
      </div>
      <table class="hist-table">
        <thead><tr><th>Data</th><th>Preço</th></tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
}

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("hist-modal")) e.target.remove();
});

function copiarComando(btn) {
  const cmd = btn.dataset.cmd;
  if (!cmd) return;
  const fallback = () => {
    const ta = document.createElement("textarea");
    ta.value = cmd;
    ta.style.cssText = "position:fixed;opacity:0;left:-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard
      .writeText(cmd)
      .then(() => mostrarFeedback(btn))
      .catch(fallback);
  } else {
    fallback();
    mostrarFeedback(btn);
  }
}

function mostrarFeedback(btn) {
  const orig = btn.innerHTML;
  btn.innerHTML = "Copiado!";
  btn.classList.add("copied");
  btn.disabled = true;
  mostrarToast("Cole no chat: " + btn.dataset.cmd);
  setTimeout(() => {
    btn.innerHTML = orig;
    btn.classList.remove("copied");
    btn.disabled = false;
  }, 2500);
}

// TOAST

let toastTimer = null;
function mostrarToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3500);
}

// STATS E FILTROS

function atualizarStats(produtos) {
  const disp = produtos.filter((p) => !p.vendido);
  const promo = disp.filter((p) => p.isSale);
  const menor = disp.reduce(
    (m, p) => (p.precoFinal < m ? p.precoFinal : m),
    Infinity,
  );

  const et = document.getElementById("stat-produtos");
  const ep = document.getElementById("stat-promocoes");
  const em = document.getElementById("stat-pts-min");
  if (et) et.textContent = disp.length;
  if (ep) ep.textContent = promo.length;
  if (em && menor !== Infinity) em.textContent = menor;
}

function atualizarFiltros() {
  const total = todosProdutos.length;
  const disp = todosProdutos.filter((p) => !p.vendido).length;
  const promo = todosProdutos.filter((p) => p.isSale).length;
  const novo = todosProdutos.filter((p) => p.isNovo).length;
  const vendidos = todosProdutos.filter((p) => p.vendido).length;

  const counts = {
    all: total,
    disponivel: disp,
    sale: promo,
    novo: novo,
    vendido: vendidos,
  };
  document.querySelectorAll(".filter-count").forEach((el) => {
    const key = el.dataset.count;
    if (key && counts[key] !== undefined) el.textContent = counts[key];
  });
}

function mostrarEmpty() {
  const grid = document.getElementById("shop-grid");
  const empty = document.getElementById("empty-state");
  if (grid) grid.innerHTML = "";
  if (empty) {
    empty.style.display = "block";
    const emptyIcon = empty.querySelector(".empty-icon");
    if (emptyIcon && emptyIcon.innerHTML.trim() !== "") {
      emptyIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>`;
    }
  }
  const pgCtrl = document.getElementById("pagination-controls");
  const pgInfo = document.getElementById("pagination-info");
  if (pgCtrl) pgCtrl.style.display = "none";
  if (pgInfo) pgInfo.style.display = "none";
}

// 3D CARD TILT

function applyCardTiltToContainer(container) {
  if (!container) return;
  const cards = container.querySelectorAll(".product-card");
  cards.forEach((card) => {
    if (card.dataset.tiltApplied === "true") return;
    card.dataset.tiltApplied = "true";

    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = (y - centerY) / 10;
      const rotateY = (centerX - x) / 10;
      card.style.setProperty("--tilt-x", `${rotateX}deg`);
      card.style.setProperty("--tilt-y", `${rotateY}deg`);
      card.classList.add("tilt");
    });

    card.addEventListener("mouseleave", () => {
      card.classList.remove("tilt");
      card.style.setProperty("--tilt-x", "0deg");
      card.style.setProperty("--tilt-y", "0deg");
    });
  });
}

function initCardTilt() {
  const grid = document.getElementById("shop-grid");
  if (grid) applyCardTiltToContainer(grid);
}

// BUSCA AVANÇADA

let searchQuery = "";
let priceMin = 0;
let priceMax = 1000000;

function initAdvancedSearch() {
  const searchBar = document.getElementById("search-input");
  if (!searchBar) return;

  searchBar.addEventListener("input", (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    paginaAtual = 1;
    renderizarPagina();
  });

  const priceRange = document.getElementById("price-range");
  if (priceRange) {
    priceRange.addEventListener("input", (e) => {
      const value = parseInt(e.target.value);
      document.getElementById("price-max").value = value;
      document.getElementById("price-value").textContent =
        `Max: ${value.toLocaleString("pt-BR")}`;
      priceMax = value;
      paginaAtual = 1;
      renderizarPagina();
    });
  }

  const priceMinInput = document.getElementById("price-min");
  if (priceMinInput) {
    priceMinInput.addEventListener("input", (e) => {
      priceMin = parseInt(e.target.value) || 0;
      paginaAtual = 1;
      renderizarPagina();
    });
  }

  const priceMaxInput = document.getElementById("price-max");
  if (priceMaxInput) {
    priceMaxInput.addEventListener("input", (e) => {
      const value = parseInt(e.target.value) || 0;
      priceMax = value;
      document.getElementById("price-range").value = value;
      document.getElementById("price-value").textContent =
        `Max: ${value.toLocaleString("pt-BR")}`;
      paginaAtual = 1;
      renderizarPagina();
    });
  }
}

function filtrarProdutos() {
  return todosProdutos.filter((p) => {
    if (
      searchQuery &&
      !p.nome.toLowerCase().includes(searchQuery) &&
      !p.id.toLowerCase().includes(searchQuery)
    )
      return false;
    if (p.precoFinal < priceMin || p.precoFinal > priceMax) return false;
    if (filtroAtivo === "disponivel" && p.vendido) return false;
    if (filtroAtivo === "sale" && !p.isSale) return false;
    if (filtroAtivo === "novo" && !p.isNovo) return false;
    if (filtroAtivo === "vendido" && !p.vendido) return false;
    return true;
  });
}

// FORMULÁRIO DE CONTATO

function initContactForm() {
  const form = document.getElementById("contact-form");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const nome = document.getElementById("contact-nome")?.value.trim();
    const email = document.getElementById("contact-email")?.value.trim();
    const tipo = document.getElementById("contact-tipo")?.value;
    const mensagem = document.getElementById("contact-mensagem")?.value.trim();

    let hasErrors = false;

    const nomeInput = document.getElementById("contact-nome");
    if (!nome || nome.length < 2) {
      nomeInput?.classList.add("error");
      hasErrors = true;
    } else {
      nomeInput?.classList.remove("error");
      nomeInput?.classList.add("valid");
    }

    const emailInput = document.getElementById("contact-email");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      emailInput?.classList.add("error");
      hasErrors = true;
    } else {
      emailInput?.classList.remove("error");
      emailInput?.classList.add("valid");
    }

    if (!tipo) {
      document.getElementById("contact-tipo")?.classList.add("error");
      hasErrors = true;
    } else {
      document.getElementById("contact-tipo")?.classList.remove("error");
    }

    const msgInput = document.getElementById("contact-mensagem");
    if (!mensagem || mensagem.length < 10) {
      msgInput?.classList.add("error");
      hasErrors = true;
    } else {
      msgInput?.classList.remove("error");
      msgInput?.classList.add("valid");
    }

    if (hasErrors) {
      mostrarToast("Por favor, preencha todos os campos corretamente.");
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "Enviando...";
    submitBtn.disabled = true;

    fetch("https://formspree.io/f/mqewbybg", {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" },
    })
      .then((response) => {
        if (response.ok) {
          mostrarToast(
            "Mensagem enviada com sucesso! Entraremos em contato em breve.",
          );
          form.reset();
          form
            .querySelectorAll(".valid")
            .forEach((el) => el.classList.remove("valid"));
        } else {
          mostrarToast("Erro ao enviar. Tente novamente mais tarde.");
        }
      })
      .catch(() => {
        mostrarToast("Erro de conexao. Tente novamente mais tarde.");
      })
      .finally(() => {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      });
  });
}

function initVisualEnhancements() {
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
  }
  initNavScroll();
  initEmblemPulse();
  initStatCounters();
  initStepStagger();
  initFooterGlow();
  initFloatingRunes();
  initHeroParallaxLayers();
  observeDynamicCards();
  initGSAPScrollAnimations();
  initParallaxScroll();
  initAnimatedGradients();
}

function initNavScroll() {
  const nav = document.querySelector(".main-nav");
  if (!nav) return;
  window.addEventListener(
    "scroll",
    () => {
      nav.classList.toggle("nav-scrolled", window.scrollY > 80);
    },
    { passive: true },
  );
}

function initEmblemPulse() {
  const emblem = document.querySelector(".hero-emblem");
  if (!emblem || !window.gsap) return;
  gsap.to(emblem, {
    filter: "drop-shadow(0 0 30px rgba(255, 215, 0, 0.8))",
    scale: 1.03,
    duration: 2,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut",
  });
}

function initStatCounters() {
  const statEls = document.querySelectorAll(".stat-value");
  if (!statEls.length || !window.gsap || !window.ScrollTrigger) return;
  statEls.forEach((el) => {
    el.dataset.counted = "false";
  });
  ScrollTrigger.create({
    trigger: ".hero-stats",
    start: "top 90%",
    once: true,
    onEnter: () => {
      statEls.forEach((el) => {
        const target = parseInt(el.textContent);
        if (isNaN(target) || el.dataset.counted === "true") return;
        el.dataset.counted = "true";
        gsap.fromTo(
          el,
          { textContent: 0 },
          {
            textContent: target,
            duration: 1.5,
            ease: "power2.out",
            snap: { textContent: 1 },
            onUpdate: function () {
              el.textContent = Math.round(
                gsap.getProperty(el, "textContent"),
              ).toLocaleString("pt-BR");
            },
          },
        );
      });
    },
  });
}

function initStepStagger() {
  const steps = document.querySelectorAll(".step-card");
  if (!steps.length || !window.gsap || !window.ScrollTrigger) return;
  gsap.from(steps, {
    scrollTrigger: {
      trigger: ".steps-rpg",
      start: "top 85%",
      toggleActions: "play none none none",
    },
    y: 60,
    opacity: 0,
    scale: 0.9,
    duration: 0.7,
    stagger: 0.15,
    ease: "back.out(1.2)",
  });
}

function initFooterGlow() {
  const gem = document.querySelector(".footer-gem");
  if (!gem || !window.gsap) return;
  gsap.to(gem, {
    filter: "drop-shadow(0 0 20px rgba(255, 215, 0, 0.7))",
    duration: 2.5,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut",
  });
}

function initFloatingRunes() {
  const runes = ["✦", "◈", "⬡", "◇", "✧", "⟡", "⬢", "◆"];
  const container = document.createElement("div");
  container.className = "floating-runes";
  container.setAttribute("aria-hidden", "true");
  document.body.appendChild(container);
  for (let i = 0; i < 12; i++) {
    const rune = document.createElement("span");
    rune.className = "rune-particle";
    rune.textContent = runes[Math.floor(Math.random() * runes.length)];
    rune.style.left = Math.random() * 100 + "%";
    rune.style.animationDuration = 15 + Math.random() * 25 + "s";
    rune.style.animationDelay = Math.random() * 20 + "s";
    rune.style.fontSize = 0.6 + Math.random() * 0.8 + "rem";
    rune.style.opacity = 0.03 + Math.random() * 0.06;
    container.appendChild(rune);
  }
}

function initHeroParallaxLayers() {
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.to(".hero-badge", {
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: "bottom top",
      scrub: 1,
    },
    y: 80,
    opacity: 0.3,
  });
  gsap.to(".hero-title", {
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: "bottom top",
      scrub: 1.2,
    },
    y: 120,
    opacity: 0.2,
  });
  gsap.to(".hero-tagline", {
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: "bottom top",
      scrub: 1.5,
    },
    y: 160,
    opacity: 0.1,
  });
  gsap.to(".hero-stats", {
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: "bottom top",
      scrub: 2,
    },
    y: 200,
    opacity: 0,
  });
}

function observeDynamicCards() {
  const grid = document.getElementById("shop-grid");
  if (!grid || !window.gsap) return;
  const observer = new MutationObserver(() => {
    const cards = grid.querySelectorAll(".product-card");
    cards.forEach((card, i) => {
      if (!card.dataset.revealed) {
        card.dataset.revealed = "true";
        gsap.from(card, {
          y: 40,
          opacity: 0,
          duration: 0.6,
          delay: i * 0.05,
          ease: "power2.out",
        });
      }
    });
    applyCardTiltToContainer(grid);
  });
  observer.observe(grid, { childList: true });
}

function initGSAPScrollAnimations() {
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  gsap.from(".hero-badge", {
    scrollTrigger: {
      trigger: ".hero",
      start: "top 80%",
      toggleActions: "play none none reverse",
    },
    y: -50,
    opacity: 0,
    duration: 1,
    ease: "power3.out",
  });
  gsap.from(".hero-emblem", {
    scrollTrigger: {
      trigger: ".hero",
      start: "top 80%",
      toggleActions: "play none none reverse",
    },
    scale: 0,
    rotation: -180,
    duration: 1.2,
    ease: "elastic.out(1, 0.5)",
  });
  gsap.from(".hero-title", {
    scrollTrigger: {
      trigger: ".hero",
      start: "top 70%",
      toggleActions: "play none none reverse",
    },
    y: 100,
    opacity: 0,
    duration: 1,
    delay: 0.3,
    ease: "power3.out",
  });
  gsap.from(".step-card", {
    scrollTrigger: {
      trigger: ".how-section",
      start: "top 70%",
      toggleActions: "play none none reverse",
    },
    y: 80,
    opacity: 0,
    duration: 0.8,
    stagger: 0.2,
    ease: "power3.out",
  });
  gsap.from(".step-arrow", {
    scrollTrigger: {
      trigger: ".how-section",
      start: "top 60%",
      toggleActions: "play none none reverse",
    },
    scale: 0,
    opacity: 0,
    duration: 0.5,
    stagger: 0.15,
    ease: "back.out(1.7)",
  });
  gsap.from(".player-frame", {
    scrollTrigger: {
      trigger: ".live-section",
      start: "top 70%",
      toggleActions: "play none none reverse",
    },
    y: 50,
    opacity: 0,
    scale: 0.95,
    duration: 1,
    ease: "power3.out",
  });
  gsap.from(".shop-title-wrap", {
    scrollTrigger: {
      trigger: ".shop-section",
      start: "top 80%",
      toggleActions: "play none none reverse",
    },
    y: -30,
    opacity: 0,
    duration: 0.8,
    ease: "power3.out",
  });
  gsap.from(".filter-bar", {
    scrollTrigger: {
      trigger: ".shop-section",
      start: "top 70%",
      toggleActions: "play none none reverse",
    },
    y: -20,
    opacity: 0,
    duration: 0.6,
    delay: 0.2,
    ease: "power3.out",
  });
  gsap.from(".product-card", {
    scrollTrigger: {
      trigger: ".shop-grid",
      start: "top 80%",
      toggleActions: "play none none reverse",
    },
    y: 60,
    opacity: 0,
    scale: 0.9,
    rotation: 5,
    duration: 0.7,
    stagger: { amount: 0.5, from: "start" },
    ease: "power3.out",
  });
}

function initParallaxScroll() {
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  gsap.to(".hero-glow", {
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: "bottom top",
      scrub: 1,
    },
    y: 200,
    scale: 1.2,
    opacity: 0.5,
  });
  gsap.to(".hero-emblem", {
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: "bottom top",
      scrub: 1.5,
    },
    y: 150,
    rotation: 10,
    scale: 0.8,
  });
  gsap.from(".how-section", {
    scrollTrigger: {
      trigger: ".how-section",
      start: "top bottom",
      end: "bottom top",
      scrub: 1,
    },
    y: -50,
    opacity: 0.8,
  });
  gsap.to(".live-section .player-frame", {
    scrollTrigger: {
      trigger: ".live-section",
      start: "top bottom",
      end: "bottom top",
      scrub: 1,
    },
    y: -30,
    scale: 1.02,
  });
  document.querySelectorAll(".product-card").forEach((card, i) => {
    gsap.to(card, {
      scrollTrigger: {
        trigger: card,
        start: "top bottom",
        end: "bottom top",
        scrub: 1,
      },
      y: i % 2 === 0 ? -30 : 30,
      rotation: i % 2 === 0 ? -2 : 2,
      scale: 0.95,
    });
  });
  if (document.querySelector(".footer"))
    gsap.to(".footer", {
      scrollTrigger: {
        trigger: ".footer",
        start: "top bottom",
        end: "bottom bottom",
        scrub: 1,
      },
      y: 50,
      opacity: 0.8,
    });
}

function initAnimatedGradients() {
  const style = document.createElement("style");
  style.textContent = `
    @keyframes gradientShift { 0%,100% { background: radial-gradient(ellipse at 0% 0%, rgba(255,215,0,0.08) 0%, transparent 50%), radial-gradient(ellipse at 100% 100%, rgba(201,162,39,0.06) 0%, transparent 50%); opacity:0.6; } 50% { background: radial-gradient(ellipse at 100% 0%, rgba(255,215,0,0.1) 0%, transparent 50%), radial-gradient(ellipse at 0% 100%, rgba(201,162,39,0.08) 0%, transparent 50%); opacity:1; } }
    .gradient-overlay { animation: gradientShift 15s ease-in-out infinite; }
  `;
  document.head.appendChild(style);
  const hero = document.querySelector(".hero");
  if (hero) {
    hero.style.background = `radial-gradient(ellipse at 20% 0%, rgba(255,215,0,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 0%, rgba(201,162,39,0.1) 0%, transparent 40%), radial-gradient(ellipse at 50% 100%, rgba(13,11,30,0.9) 0%, transparent 60%), linear-gradient(180deg, #0a0818 0%, #06050f 100%)`;
    if (window.gsap)
      gsap.to(hero, {
        backgroundPosition: "200% 50%",
        duration: 20,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
  }
}
// MOBILE MENU DRAWER (mantido intacto)
function initMobileMenu() {
  const existingToggle = document.querySelector(".mobile-menu-toggle");
  if (!existingToggle) {
    const header = document.querySelector(".hero-header");
    if (header) {
      const toggleBtn = document.createElement("button");
      toggleBtn.className = "mobile-menu-toggle";
      toggleBtn.setAttribute("aria-label", "Menu");
      toggleBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      `;
      header.appendChild(toggleBtn);
    }
  }

  const existingDrawer = document.querySelector(".mobile-drawer");
  if (!existingDrawer) {
    const drawer = document.createElement("div");
    drawer.className = "mobile-drawer";
    drawer.innerHTML = `
      <div class="drawer-content">
        <button class="drawer-close" aria-label="Fechar">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <nav class="drawer-nav">
          <a href="#loja">Loja</a>
          <a href="#como-participar">Como Participar</a>
          <a href="#live">Live</a>
        </nav>
      </div>
    `;
    document.body.appendChild(drawer);

    const style = document.createElement("style");
    style.textContent = `
      .mobile-menu-toggle {
        display: none;
        background: transparent;
        border: none;
        color: var(--gold);
        cursor: pointer;
        padding: 8px;
        z-index: 1001;
      }
      @media (max-width: 768px) {
        .mobile-menu-toggle { display: block; }
        .hero-header nav { display: none; }
      }
      .mobile-drawer {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(6, 5, 15, 0.95);
        backdrop-filter: blur(20px);
        z-index: 10000;
        transform: translateX(100%);
        transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .mobile-drawer.open {
        transform: translateX(0);
      }
      .drawer-content {
        padding: 40px;
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      .drawer-close {
        align-self: flex-end;
        background: transparent;
        border: none;
        color: var(--gold);
        cursor: pointer;
        padding: 12px;
        margin-bottom: 40px;
      }
      .drawer-nav {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }
      .drawer-nav a {
        font-family: 'Cinzel', serif;
        font-size: 1.5rem;
        color: var(--gold);
        text-decoration: none;
        transition: var(--transition);
        opacity: 0;
        transform: translateX(30px);
      }
      .mobile-drawer.open .drawer-nav a {
        opacity: 1;
        transform: translateX(0);
      }
      .mobile-drawer.open .drawer-nav a:nth-child(1) { transition-delay: 0.1s; }
      .mobile-drawer.open .drawer-nav a:nth-child(2) { transition-delay: 0.2s; }
      .mobile-drawer.open .drawer-nav a:nth-child(3) { transition-delay: 0.3s; }
      .drawer-nav a:hover {
        color: var(--gold-light);
        transform: translateX(10px);
      }
    `;
    document.head.appendChild(style);

    const toggle = document.querySelector(".mobile-menu-toggle");
    const closeBtn = document.querySelector(".drawer-close");
    const drawerEl = document.querySelector(".mobile-drawer");

    if (toggle && closeBtn && drawerEl) {
      toggle.addEventListener("click", () => drawerEl.classList.add("open"));
      closeBtn.addEventListener("click", () =>
        drawerEl.classList.remove("open"),
      );
      drawerEl.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => drawerEl.classList.remove("open"));
      });
    }
  }
}

// INICIALIZAÇÃO
document.addEventListener("DOMContentLoaded", () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./sw.js", { scope: "./" })
      .then((reg) => console.log("[SW] Registered:", reg.scope))
      .catch((err) => console.log("[SW] Registration failed:", err));
  }
  initTwitchPlayer();
  carregarHistorico();
  carregarProdutos();
  configurarFiltros();
  initCardTilt();
  initParallaxScroll();
  initMobileMenu();
  initAdvancedSearch();
  initContactForm();
  initVisualEnhancements();
});
