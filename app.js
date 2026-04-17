/* ════════════════════════════════════════════════════════════
   Taverna do Rizakh — app.js
   - Fonte: dados embutidos no HTML (produtos-data)
   - Paginação (9/página), ordenação, filtros
   - Cards: id, nome, preço, tags, video, data, comprador, steam
   - Histórico de preços no hover
   ════════════════════════════════════════════════════════════ */

const ITEMS_PER_PAGE = 9;
const TWITCH_CHANNEL = 'rizakh';

let todosProdutos = [];
let paginaAtual = 1;
let totalPaginas = 1;
let filtroAtivo = 'all';
let historicoPrecos = {}; // { id: [ {data, preco, desconto}, ... ] }

document.addEventListener('DOMContentLoaded', () => {
  initTwitchPlayer();
  carregarHistorico();
  carregarProdutos();
  configurarFiltros();
});

// ── Twitch Player ────────────────────────────────────────────
let isLive = false;
let clipIndex = 0;

const OFFLINE_CLIPS = [
  'https://clips.twitch.tv/embed?clip=PluckyRoundOx4Head&parent=localhost',
  'https://clips.twitch.tv/embed?clip=FriendlyConfidentMangoPogChamp-jOjwS2W-_dFd-upn&parent=localhost',
  'https://clips.twitch.tv/embed?clip=AverageGoldenPigeonVoteNay&parent=localhost',
  'https://clips.twitch.tv/embed?clip=SmoothElegantPistonVoteYea&parent=localhost',
  'https://clips.twitch.tv/embed?clip=SparklingAbrasiveEyeballJebaited&parent=localhost',
  'https://clips.twitch.tv/embed?clip=IronicElegantSwordBIRB-siQqnUubLgBG82Hq&parent=localhost',
];

function getClipUrl(index) {
  const parent = window.location.hostname || 'localhost';
  const clip = OFFLINE_CLIPS[index % OFFLINE_CLIPS.length];
  return clip.replace('parent=localhost', 'parent=' + parent) + '&autoplay=true&muted=false';
}

function setLiveBadge(live) {
  const badge = document.getElementById('player-badge');
  if (!badge) return;
  isLive = live;
  badge.innerHTML = live
    ? '<span class="live-dot"></span>AO VIVO'
    : '<span class="offline-dot"></span>Offline';
  badge.style.background = live ? 'var(--crimson)' : '#555570';
  updateTwitchLiveIndicator(live);
}

function updateTwitchLiveIndicator(live) {
  const twitchBtns = document.querySelectorAll('.social-btn.twitch');
  twitchBtns.forEach(btn => {
    const indicator = btn.querySelector('.twitch-live-indicator');
    if (indicator) {
      indicator.style.display = live ? 'inline-block' : 'none';
    }
    if (live) {
      btn.classList.add('is-live');
    } else {
      btn.classList.remove('is-live');
    }
  });
}

function showClipNav(show) {
  const prev = document.getElementById('clip-prev');
  const next = document.getElementById('clip-next');
  if (prev) prev.style.display = show ? 'flex' : 'none';
  if (next) next.style.display = show ? 'flex' : 'none';
}

function prevClip() {
  clipIndex = (clipIndex - 1 + OFFLINE_CLIPS.length) % OFFLINE_CLIPS.length;
  const iframe = document.getElementById('twitch-player');
  if (iframe) iframe.src = getClipUrl(clipIndex);
}

function nextClip() {
  clipIndex = (clipIndex + 1) % OFFLINE_CLIPS.length;
  const iframe = document.getElementById('twitch-player');
  if (iframe) iframe.src = getClipUrl(clipIndex);
}

function initTwitchPlayer() {
  const iframe = document.getElementById('twitch-player');
  if (!iframe) return;
  const parent = window.location.hostname || 'localhost';
  // O embed da Twitch detecta live/offline automaticamente — sem CORS
  iframe.src = `https://player.twitch.tv/?channel=${TWITCH_CHANNEL}&parent=${parent}&autoplay=true&muted=false`;
  setLiveBadge(false); // Assume offline até o player indicar
  showClipNav(true);
}

function loadOfflineClip() {
  const iframe = document.getElementById('twitch-player');
  if (!iframe) return;
  clipIndex = Math.floor(Math.random() * OFFLINE_CLIPS.length);
  iframe.src = getClipUrl(clipIndex);
  setLiveBadge(false);
  showClipNav(true);
}

// ── Histórico de preços ─────────────────────────────────────
function carregarHistorico() {
  const script = document.getElementById('preco-history-data');
  if (!script) return;
  try {
    historicoPrecos = JSON.parse(script.textContent || '{}');
    console.log('[Loja] Historico carregado:', Object.keys(historicoPrecos).length, 'itens');
  } catch (e) {
    historicoPrecos = {};
  }
}

// ── Carregar produtos ───────────────────────────────────────
function carregarProdutos() {
  console.log('[Loja] Iniciando carregarProdutos...');
  const script = document.getElementById('produtos-data');
  if (!script) { mostrarEmpty(); return; }
  try {
    const dados = JSON.parse(script.textContent);
    if (!dados || dados.length === 0) { mostrarEmpty(); return; }

    todosProdutos = dados.map(p => Object.assign({}, p, {
      vendido:  p.estoque === 0 || p.status === 'vendido',
      isNovo:   p.isNovo && !p.vendido,
      isSale:   p.desconto > 0 && !p.vendido
    }));

    todosProdutos.sort(cmpProdutos);
    paginaAtual = 1;
    totalPaginas = Math.max(1, Math.ceil(todosProdutos.length / ITEMS_PER_PAGE));
    renderizarPagina();
    atualizarStats(todosProdutos);
    atualizarFiltros();
  } catch (e) {
    console.error('[Loja] ERRO:', e);
    mostrarEmpty();
  }
}

function cmpProdutos(a, b) {
  if (a.vendido !== b.vendido) return a.vendido ? 1 : -1;
  if (a.isNovo  !== b.isNovo)  return b.isNovo  ? 1 : -1;
  if (a.isSale  !== b.isSale)  return b.isSale  ? 1 : -1;
  return 0;
}

// ── Filtros ─────────────────────────────────────────────────
function configurarFiltros() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filtroAtivo = btn.dataset.filter;
      paginaAtual = 1;
      renderizarPagina();
    });
  });
}

function filtrar(lista) {
  switch (filtroAtivo) {
    case 'disponivel': return lista.filter(p => !p.vendido);
    case 'sale':       return lista.filter(p => p.isSale);
    case 'novo':       return lista.filter(p => p.isNovo);
    case 'vendido':     return lista.filter(p => p.vendido);
    default:            return lista;
  }
}

// ── Renderização ────────────────────────────────────────────
function renderizarPagina() {
  const filtrado = filtrar(todosProdutos);
  totalPaginas = Math.max(1, Math.ceil(filtrado.length / ITEMS_PER_PAGE));
  if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;

  const grid  = document.getElementById('shop-grid');
  const empty = document.getElementById('empty-state');

  if (filtrado.length === 0) {
    grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
    const pgCtrl = document.getElementById('pagination-controls');
    const pgInfo = document.getElementById('pagination-info');
    if (pgCtrl) pgCtrl.style.display = 'none';
    if (pgInfo) pgInfo.style.display = 'none';
    return;
  }

  if (empty) empty.style.display = 'none';

  const inicio = (paginaAtual - 1) * ITEMS_PER_PAGE;
  const pedacos = filtrado.slice(inicio, inicio + ITEMS_PER_PAGE);

  grid.innerHTML = pedacos.map(p => cardHTML(p)).join('');

  grid.querySelectorAll('.btn-buy').forEach(btn => {
    btn.addEventListener('click', () => copiarComando(btn));
  });

  const info   = document.getElementById('pagination-info');
  const txt    = document.getElementById('pagination-text');
  const dots   = document.getElementById('page-dots');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');

  if (info && txt) {
    info.style.display = 'block';
    txt.textContent = `Pagina ${paginaAtual} de ${totalPaginas} — ${filtrado.length} itens`;
  }

  const pgCtrl = document.getElementById('pagination-controls');
  if (pgCtrl) {
    pgCtrl.style.display = totalPaginas > 1 ? 'flex' : 'none';
    if (btnPrev) btnPrev.disabled = paginaAtual <= 1;
    if (btnNext) btnNext.disabled = paginaAtual >= totalPaginas;
  }

  if (dots) {
    let html = '';
    for (let i = 1; i <= totalPaginas; i++) {
      html += `<span class="page-dot${i === paginaAtual ? ' active' : ''}" onclick="goToPage(${i})">${i}</span>`;
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
  const shop = document.getElementById('shop');
  if (shop) shop.scrollIntoView({ behavior: 'smooth' });
}

// ── Card HTML ───────────────────────────────────────────────
function cardHTML(p) {
  let tags = '';
  if (p.vendido) tags += '<span class="tag tag-sold">Vendido</span>';
  else if (p.isNovo) tags += '<span class="tag tag-novo">Novo</span>';
  if (p.isSale) tags += `<span class="tag tag-sale">${p.desconto}% OFF</span>`;

  // Video
  const videoHtml = p.youtubeId
    ? `<iframe src="https://www.youtube.com/embed/${p.youtubeId}?rel=0&modestbranding=1"
        title="${escHtml(p.nome)}"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowfullscreen loading="eager"></iframe>`
    : `<div class="video-placeholder"><span>🎮</span><span>Sem trailer</span></div>`;

  // Steam button — link direto por AppId ou busca
  const steamHref = p.steamAppId
    ? `https://store.steampowered.com/app/${p.steamAppId}`
    : `https://store.steampowered.com/search/?term=${encodeURIComponent(p.nome)}`;
  const steamBtnHtml = `<a class="steam-store-btn" href="${steamHref}" target="_blank" rel="noopener" title="${p.steamAppId ? 'Ver na Steam' : 'Buscar na Steam'}">
    <svg class="steam-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><use href="#steam-icon"/></svg>
    Ver na Loja
  </a>`;

  // Formatacao
  function fmt(n) { return n.toLocaleString('pt-BR'); }

  // Preço
  let precoHtml = '';
  if (p.isSale) {
    precoHtml = `<div class="card-price">
      <div class="price-box">
        <span class="price-icon">💎</span>
        <span class="price-current">${fmt(p.precoFinal)}</span>
      </div>
      <span class="price-original">${fmt(p.preco)}</span>
      <span class="price-badge">-${p.desconto}%</span>
    </div>`;
  } else {
    precoHtml = `<div class="card-price">
      <div class="price-box">
        <span class="price-icon">💎</span>
        <span class="price-current">${fmt(p.precoFinal)}</span>
      </div>
    </div>`;
  }

  // Extra info — adicionado em | vendido para | historico
  let extraHtml = '';
  if (p.vendido) {
    if (p.compradoPor || p.dataCompraBr) {
      const buyer = p.compradoPor ? escHtml(p.compradoPor) : 'Anonimo';
      const date = p.dataCompraBr ? p.dataCompraBr : '';
      extraHtml = `<div class="card-extra sold-info">Vendido para ${buyer}${date ? ` em ${date}` : ''}</div>`;
    }
  } else {
    const addedLine = p.dataAdicBr ? `<span class="added-info">Adicionado ${p.dataAdicBr}</span>` : '';
    const histBtn = `<button class="hist-btn" onclick="toggleHistory('${p.id}')">Histórico</button>`;
    if (addedLine || histBtn) {
      extraHtml = `<div class="card-footer-row">${addedLine}${histBtn}</div>`;
    }
  }

  // Stock
  let estoqueHtml = '';
  if (p.vendido) {
    estoqueHtml = '<div class="card-stock stock-zero">Vendido</div>';
  } else if (p.estoque <= 2 && p.estoque > 0) {
    estoqueHtml = `<div class="card-stock stock-low">Restam ${p.estoque}</div>`;
  } else if (p.estoque > 0) {
    estoqueHtml = `<div class="card-stock stock-ok">Disponivel</div>`;
  } else {
    estoqueHtml = '<div class="card-stock stock-zero">Esgotado</div>';
  }

  // Buy button
  const btnHtml = p.vendido
    ? '<button class="btn-buy" disabled><span>🔒</span> Esgotado</button>'
    : `<button class="btn-buy" data-cmd="!loja comprar ${escHtml(p.id)}"><span>🔑</span> Comprar</button>`;

  const filterAttr = ['all'];
  if (!p.vendido) filterAttr.push('disponivel');
  if (p.isSale)   filterAttr.push('sale');
  if (p.isNovo)   filterAttr.push('novo');

  return `<div class="product-card${p.vendido ? ' sold' : ''}" data-filter="${filterAttr.join(' ')}" data-id="${escHtml(p.id)}">
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

// ── Toggle histórico de preços (modal) ───────────────────────
function toggleHistory(id) {
  const existing = document.getElementById('hist-modal-' + id);
  if (existing) { existing.remove(); return; }

  const p = todosProdutos.find(prod => prod.id == id);
  if (!p) return;

  const entries = historicoPrecos[p.id] || [];
  const ultimas = entries.slice(-10).reverse();

  const rows = ultimas.map(e => {
    const data = e.data || '—';
    const preco = (e.preco || 0).toLocaleString('pt-BR');
    const off = e.desconto > 0 ? ` <span class="hist-off">(${e.desconto}% off)</span>` : '';
    return `<tr><td class="hist-data">${data}</td><td class="hist-preco">${preco}${off}</td></tr>`;
  }).join('');

  const tbody = rows || '<tr><td colspan="2" class="hist-empty">Sem registros</td></tr>';

  const modal = document.createElement('div');
  modal.id = 'hist-modal-' + id;
  modal.className = 'hist-modal';
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
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// Fecha modal ao clicar fora
document.addEventListener('click', e => {
  if (e.target.classList.contains('hist-modal')) e.target.remove();
});

// ── Copiar comando ───────────────────────────────────────────
function copiarComando(btn) {
  const cmd = btn.dataset.cmd;
  if (!cmd) return;
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = cmd; ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(cmd).then(() => mostrarFeedback(btn)).catch(fallback);
  } else { fallback(); mostrarFeedback(btn); }
}

function mostrarFeedback(btn) {
  const orig = btn.innerHTML;
  btn.innerHTML = 'Copiado!';
  btn.classList.add('copied');
  btn.disabled = true;
  mostrarToast('Cole no chat: ' + btn.dataset.cmd);
  setTimeout(() => {
    btn.innerHTML = orig;
    btn.classList.remove('copied');
    btn.disabled = false;
  }, 2500);
}

// ── Toast ───────────────────────────────────────────────────
let toastTimer = null;
function mostrarToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

// ── Stats ───────────────────────────────────────────────────
function atualizarStats(produtos) {
  const disp = produtos.filter(p => !p.vendido);
  const promo = disp.filter(p => p.isSale);
  const menor = disp.reduce((m, p) => p.precoFinal < m ? p.precoFinal : m, Infinity);

  const et = document.getElementById('stat-produtos');
  const ep = document.getElementById('stat-promocoes');
  const em = document.getElementById('stat-pts-min');
  if (et) et.textContent = disp.length;
  if (ep) ep.textContent = promo.length;
  if (em && menor !== Infinity) em.textContent = menor;
}

// ── Filtros ─────────────────────────────────────────────────
function atualizarFiltros() {
  const total     = todosProdutos.length;
  const disp      = todosProdutos.filter(p => !p.vendido).length;
  const promo     = todosProdutos.filter(p => p.isSale).length;
  const novo      = todosProdutos.filter(p => p.isNovo).length;
  const vendidos  = todosProdutos.filter(p => p.vendido).length;

  const counts = { all: total, disponivel: disp, sale: promo, novo: novo, vendido: vendidos };

  document.querySelectorAll('.filter-count').forEach(el => {
    const key = el.dataset.count;
    if (key && counts[key] !== undefined) el.textContent = counts[key];
  });
}

// ── Empty state ─────────────────────────────────────────────
function mostrarEmpty() {
  const grid = document.getElementById('shop-grid');
  const empty = document.getElementById('empty-state');
  if (grid) grid.innerHTML = '';
  if (empty) empty.style.display = 'block';
  const pgCtrl = document.getElementById('pagination-controls');
  const pgInfo = document.getElementById('pagination-info');
  if (pgCtrl) pgCtrl.style.display = 'none';
  if (pgInfo) pgInfo.style.display = 'none';
}

// ── Util ─────────────────────────────────────────────────────
function escHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
