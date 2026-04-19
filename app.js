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

// ── Helpers ─────────────────────────────────────────────────
function fmtDesc(d) { return d % 1 === 0 ? d.toString() : d.toFixed(1); }

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
  // Try loading from inline script first
  const script = document.getElementById('preco-history-data');
  if (script) {
    try {
      const data = JSON.parse(script.textContent || '{}');
      if (Object.keys(data).length > 0) {
        historicoPrecos = data;
        console.log('[Loja] Historico carregado (inline):', Object.keys(historicoPrecos).length, 'itens');
        return;
      }
    } catch (e) {}
  }
  
  // Fallback: fetch preco_history.json
  fetch('preco_history.json')
    .then(r => {
      if (!r.ok) throw new Error('Not found');
      return r.json();
    })
    .then(data => {
      historicoPrecos = data;
      console.log('[Loja] Historico carregado (json):', Object.keys(historicoPrecos).length, 'itens');
    })
    .catch(() => {
      historicoPrecos = {};
      console.log('[Loja] Historico: arquivo nao encontrado');
    });
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
      isSale:   Number(p.desconto) > 0 && !p.vendido
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
  if (p.isSale) tags += '<span class="tag tag-sale">Sale</span>';

  // Video
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
    const precoBruto = e.preco || 0;
    const desconto = e.desconto || 0;
    const precoFinal = desconto > 0 ? Math.ceil(precoBruto * (1 - desconto / 100)) : precoBruto;
    const preco = precoFinal.toLocaleString('pt-BR');
    const off = desconto > 0 ? ` <span class="hist-off">(${fmtDesc(desconto)}% off)</span>` : '';
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
  if (empty) {
    empty.style.display = 'block';
    // Update empty icon to SVG
    const emptyIcon = empty.querySelector('.empty-icon');
    if (emptyIcon) {
      emptyIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>`;
    }
  }
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

// ═══════════════════════════════════════════════════════════════
// THREE.JS 3D PARTICLES
// ═══════════════════════════════════════════════════════════════
function initThreeParticles() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas || !window.THREE) return;

  // Scene setup
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ 
    canvas, 
    alpha: true, 
    antialias: true,
    transparent: true 
  });
  
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Create particles
  const particleCount = 800;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);

  const goldColor = new THREE.Color(0xffd700);
  const goldLight = new THREE.Color(0xffe066);
  const copperColor = new THREE.Color(0xc9a227);

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 50;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 50;

    const mixColor = Math.random() > 0.5 ? goldColor : copperColor;
    colors[i * 3] = mixColor.r;
    colors[i * 3 + 1] = mixColor.g;
    colors[i * 3 + 2] = mixColor.b;

    sizes[i] = Math.random() * 3 + 1;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  // Particle material
  const material = new THREE.PointsMaterial({
    size: 0.15,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });

  const particles = new THREE.Points(geometry, material);
  scene.add(particles);

  // Add ambient glow
  const glowGeometry = new THREE.SphereGeometry(15, 32, 32);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd700,
    transparent: true,
    opacity: 0.03,
    side: THREE.BackSide
  });
  const glowSphere = new THREE.Mesh(glowGeometry, glowMaterial);
  scene.add(glowSphere);

  camera.position.z = 20;

  // Mouse interaction
  let mouseX = 0;
  let mouseY = 0;
  let targetX = 0;
  let targetY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX - window.innerWidth / 2) * 0.001;
    mouseY = (e.clientY - window.innerHeight / 2) * 0.001;
  });

  // Animation
  function animate() {
    requestAnimationFrame(animate);

    targetX += (mouseX - targetX) * 0.02;
    targetY += (mouseY - targetY) * 0.02;

    particles.rotation.y += 0.0005;
    particles.rotation.x += 0.0002;
    particles.rotation.y += targetX * 0.01;
    particles.rotation.x += targetY * 0.01;

    glowSphere.rotation.y += 0.001;
    glowSphere.rotation.x += 0.0005;

    // Floating animation for particles
    const time = Date.now() * 0.001;
    const positionAttribute = geometry.getAttribute('position');
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positionAttribute.array[i3 + 1] += Math.sin(time + i * 0.1) * 0.002;
    }
    positionAttribute.needsUpdate = true;

    renderer.render(scene, camera);
  }

  animate();

  // Handle resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// ═══════════════════════════════════════════════════════════════
// GSAP SCROLL ANIMATIONS
// ═══════════════════════════════════════════════════════════════
function initGSAPScrollAnimations() {
  if (!window.gsap || !window.ScrollTrigger) return;

  gsap.registerPlugin(ScrollTrigger);

  // Hero section animations
  gsap.from('.hero-badge', {
    scrollTrigger: {
      trigger: '.hero',
      start: 'top 80%',
      toggleActions: 'play none none reverse'
    },
    y: -50,
    opacity: 0,
    duration: 1,
    ease: 'power3.out'
  });

  gsap.from('.hero-emblem', {
    scrollTrigger: {
      trigger: '.hero',
      start: 'top 80%',
      toggleActions: 'play none none reverse'
    },
    scale: 0,
    rotation: -180,
    duration: 1.2,
    ease: 'elastic.out(1, 0.5)'
  });

  gsap.from('.hero-title', {
    scrollTrigger: {
      trigger: '.hero',
      start: 'top 70%',
      toggleActions: 'play none none reverse'
    },
    y: 100,
    opacity: 0,
    duration: 1,
    delay: 0.3,
    ease: 'power3.out'
  });

  // Step cards stagger animation
  gsap.from('.step-card', {
    scrollTrigger: {
      trigger: '.how-section',
      start: 'top 70%',
      toggleActions: 'play none none reverse'
    },
    y: 80,
    opacity: 0,
    duration: 0.8,
    stagger: 0.2,
    ease: 'power3.out'
  });

  // Step arrows
  gsap.from('.step-arrow', {
    scrollTrigger: {
      trigger: '.how-section',
      start: 'top 60%',
      toggleActions: 'play none none reverse'
    },
    scale: 0,
    opacity: 0,
    duration: 0.5,
    stagger: 0.15,
    ease: 'back.out(1.7)'
  });

  // Live section
  gsap.from('.player-frame', {
    scrollTrigger: {
      trigger: '.live-section',
      start: 'top 70%',
      toggleActions: 'play none none reverse'
    },
    y: 50,
    opacity: 0,
    scale: 0.95,
    duration: 1,
    ease: 'power3.out'
  });

  // Shop title
  gsap.from('.shop-title-wrap', {
    scrollTrigger: {
      trigger: '.shop-section',
      start: 'top 80%',
      toggleActions: 'play none none reverse'
    },
    y: -30,
    opacity: 0,
    duration: 0.8,
    ease: 'power3.out'
  });

  // Filter bar
  gsap.from('.filter-bar', {
    scrollTrigger: {
      trigger: '.shop-section',
      start: 'top 70%',
      toggleActions: 'play none none reverse'
    },
    y: -20,
    opacity: 0,
    duration: 0.6,
    delay: 0.2,
    ease: 'power3.out'
  });

  // Product cards stagger
  gsap.from('.product-card', {
    scrollTrigger: {
      trigger: '.shop-grid',
      start: 'top 80%',
      toggleActions: 'play none none reverse'
    },
    y: 60,
    opacity: 0,
    scale: 0.9,
    rotation: 5,
    duration: 0.7,
    stagger: {
      amount: 0.5,
      from: 'start'
    },
    ease: 'power3.out'
  });

  // Footer
  gsap.from('.footer-inner', {
    scrollTrigger: {
      trigger: '.footer',
      start: 'top 80%',
      toggleActions: 'play none none reverse'
    },
    y: 50,
    opacity: 0,
    duration: 1,
    ease: 'power3.out'
  });
}

// ═══════════════════════════════════════════════════════════════
// ANIMATED GRADIENT BACKGROUNDS
// ═══════════════════════════════════════════════════════════════
function initAnimatedGradients() {
  // Hero gradient animation
  const hero = document.querySelector('.hero');
  if (hero) {
    hero.style.background = `
      radial-gradient(ellipse at 20% 0%, rgba(255, 215, 0, 0.15) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 0%, rgba(201, 162, 39, 0.1) 0%, transparent 40%),
      radial-gradient(ellipse at 50% 100%, rgba(13, 11, 30, 0.9) 0%, transparent 60%),
      linear-gradient(180deg, #0a0818 0%, #06050f 100%)
    `;
    
    // Animate gradient position
    gsap.to(hero, {
      backgroundPosition: '200% 50%',
      duration: 20,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut'
    });
  }

  // How section gradient
  const howSection = document.querySelector('.how-section');
  if (howSection) {
    // Add animated overlay
    const gradientOverlay = document.createElement('div');
    gradientOverlay.className = 'gradient-overlay';
    gradientOverlay.style.cssText = `
      position: absolute;
      inset: 0;
      background: 
        radial-gradient(ellipse at 0% 0%, rgba(255, 215, 0, 0.08) 0%, transparent 50%),
        radial-gradient(ellipse at 100% 100%, rgba(201, 162, 39, 0.06) 0%, transparent 50%);
      pointer-events: none;
      animation: gradientShift 15s ease-in-out infinite;
    `;
    howSection.style.position = 'relative';
    howSection.style.overflow = 'hidden';
    howSection.insertBefore(gradientOverlay, howSection.firstChild);
  }

  // Live section gradient
  const liveSection = document.querySelector('.live-section');
  if (liveSection) {
    liveSection.style.background = `
      radial-gradient(ellipse at 50% 50%, rgba(255, 215, 0, 0.05) 0%, transparent 60%),
      linear-gradient(180deg, #06050f 0%, #0a0818 50%, #06050f 100%)
    `;
  }

  // Shop section gradient
  const shopSection = document.querySelector('.shop-section');
  if (shopSection) {
    shopSection.style.background = `
      radial-gradient(ellipse at 50% 0%, rgba(255, 215, 0, 0.1) 0%, transparent 50%),
      radial-gradient(ellipse at 0% 100%, rgba(13, 11, 30, 0.8) 0%, transparent 50%),
      radial-gradient(ellipse at 100% 100%, rgba(26, 20, 53, 0.6) 0%, transparent 50%),
      linear-gradient(180deg, #06050f 0%, #0d0b1e 50%, #06050f 100%)
    `;
  }

  // Add CSS for gradient animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes gradientShift {
      0%, 100% {
        background: 
          radial-gradient(ellipse at 0% 0%, rgba(255, 215, 0, 0.08) 0%, transparent 50%),
          radial-gradient(ellipse at 100% 100%, rgba(201, 162, 39, 0.06) 0%, transparent 50%);
        opacity: 0.6;
      }
      50% {
        background: 
          radial-gradient(ellipse at 100% 0%, rgba(255, 215, 0, 0.1) 0%, transparent 50%),
          radial-gradient(ellipse at 0% 100%, rgba(201, 162, 39, 0.08) 0%, transparent 50%);
        opacity: 1;
      }
    }
    
    .gradient-overlay {
      animation: gradientShift 15s ease-in-out infinite;
    }
  `;
  document.head.appendChild(style);
}

// ═══════════════════════════════════════════════════════════════
// 3D CARD TILT EFFECT
// ═══════════════════════════════════════════════════════════════
function initCardTilt() {
  const cards = document.querySelectorAll('.product-card');
  
  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = (y - centerY) / 10;
      const rotateY = (centerX - x) / 10;
      
      card.style.setProperty('--tilt-x', `${rotateX}deg`);
      card.style.setProperty('--tilt-y', `${rotateY}deg`);
      card.classList.add('tilt');
    });
    
    card.addEventListener('mouseleave', () => {
      card.classList.remove('tilt');
      card.style.setProperty('--tilt-x', '0deg');
      card.style.setProperty('--tilt-y', '0deg');
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// PARALLAX SCROLL EFFECT
// ═══════════════════════════════════════════════════════════════
function initParallaxScroll() {
  if (!window.gsap || !window.ScrollTrigger) return;
  
  gsap.registerPlugin(ScrollTrigger);
  
  // Hero parallax
  gsap.to('.hero-glow', {
    scrollTrigger: {
      trigger: '.hero',
      start: 'top top',
      end: 'bottom top',
      scrub: 1
    },
    y: 200,
    scale: 1.2,
    opacity: 0.5
  });
  
  // Hero emblem parallax
  gsap.to('.hero-emblem', {
    scrollTrigger: {
      trigger: '.hero',
      start: 'top top',
      end: 'bottom top',
      scrub: 1.5
    },
    y: 150,
    rotation: 10,
    scale: 0.8
  });
  
  // How section parallax
  gsap.from('.how-section', {
    scrollTrigger: {
      trigger: '.how-section',
      start: 'top bottom',
      end: 'bottom top',
      scrub: 1
    },
    y: -50,
    opacity: 0.8
  });
  
  // Live section parallax
  gsap.to('.live-section .player-frame', {
    scrollTrigger: {
      trigger: '.live-section',
      start: 'top bottom',
      end: 'bottom top',
      scrub: 1
    },
    y: -30,
    scale: 1.02
  });
  
  // Shop cards parallax stagger
  document.querySelectorAll('.product-card').forEach((card, i) => {
    gsap.to(card, {
      scrollTrigger: {
        trigger: card,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1
      },
      y: i % 2 === 0 ? -30 : 30,
      rotation: i % 2 === 0 ? -2 : 2,
      scale: 0.95
    });
  });
  
  // Footer parallax
  gsap.to('.footer', {
    scrollTrigger: {
      trigger: '.footer',
      start: 'top bottom',
      end: 'bottom bottom',
      scrub: 1
    },
    y: 50,
    opacity: 0.8
  });
}

// ═══════════════════════════════════════════════════════════════
// MOBILE MENU DRAWER
// ═══════════════════════════════════════════════════════════════
function initMobileMenu() {
  // Create mobile menu button if not exists
  const existingToggle = document.querySelector('.mobile-menu-toggle');
  if (!existingToggle) {
    const header = document.querySelector('.hero-header');
    if (header) {
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'mobile-menu-toggle';
      toggleBtn.setAttribute('aria-label', 'Menu');
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
  
  // Create mobile menu drawer
  const existingDrawer = document.querySelector('.mobile-drawer');
  if (!existingDrawer) {
    const drawer = document.createElement('div');
    drawer.className = 'mobile-drawer';
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
    
    // Style the drawer
    const style = document.createElement('style');
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
    
    // Event listeners
    const toggle = document.querySelector('.mobile-menu-toggle');
    const closeBtn = document.querySelector('.drawer-close');
    const drawerEl = document.querySelector('.mobile-drawer');
    
    if (toggle && closeBtn && drawerEl) {
      toggle.addEventListener('click', () => {
        drawerEl.classList.add('open');
      });
      
      closeBtn.addEventListener('click', () => {
        drawerEl.classList.remove('open');
      });
      
      // Close on link click
      drawerEl.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          drawerEl.classList.remove('open');
        });
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// PRODUCT DETAIL MODAL
// ═══════════════════════════════════════════════════════════════
function openProductModal(id) {
  const p = todosProdutos.find(prod => prod.id == id);
  if (!p) return;
  
  function fmt(n) { return n.toLocaleString('pt-BR'); }
  
  const steamHref = p.steamAppId
    ? `https://store.steampowered.com/app/${p.steamAppId}`
    : `https://store.steampowered.com/search/?term=${encodeURIComponent(p.nome)}`;
  
  let tagsHtml = '';
  if (p.vendido) tagsHtml += '<span class="tag tag-sold">Vendido</span>';
  else if (p.isNovo) tagsHtml += '<span class="tag tag-novo">Novo</span>';
  if (p.isSale) tagsHtml += '<span class="tag tag-sale">Sale</span>';
  
  let priceHtml = '';
  if (p.isSale) {
    priceHtml = `<div class="modal-price">
      <span class="modal-price-current">${fmt(p.precoFinal)}</span>
      <span class="modal-price-original">${fmt(p.preco)}</span>
      <span class="modal-price-badge">-${fmtDesc(p.desconto)}%</span>
    </div>`;
  } else {
    priceHtml = `<div class="modal-price">
      <span class="modal-price-current">${fmt(p.precoFinal)}</span>
    </div>`;
  }
  
  let stockHtml = '';
  if (p.vendido) stockHtml = '<div class="modal-stock sold">Vendido</div>';
  else if (p.estoque <= 2 && p.estoque > 0) stockHtml = `<div class="modal-stock low">Apenas ${p.estoque} restantes</div>`;
  else if (p.estoque > 0) stockHtml = '<div class="modal-stock available">Disponivel</div>';
  else stockHtml = '<div class="modal-stock out">Esgotado</div>';
  
  const modal = document.createElement('div');
  modal.className = 'product-modal';
  modal.id = 'product-modal';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="closeProductModal()"></div>
    <div class="modal-content">
      <button class="modal-close" onclick="closeProductModal()">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div class="modal-tags">${tagsHtml}</div>
      <h2 class="modal-title">${escHtml(p.nome)}</h2>
      <div class="modal-id">ID: ${escHtml(p.id)}</div>
      ${p.descricao ? `<p class="modal-description">${escHtml(p.descricao)}</p>` : ''}
      ${priceHtml}
      ${stockHtml}
      <div class="modal-actions">
        ${p.vendido ? '' : `<button class="btn-buy" data-cmd="!loja comprar ${escHtml(p.id)}" onclick="copiarComando(this)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
          </svg>
          Comprar Agora
        </button>`}
        <a href="${steamHref}" target="_blank" rel="noopener" class="btn-steam">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><use href="#steam-icon"/></svg>
          Ver na Steam
        </a>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
  
  modal.querySelector('.modal-backdrop').addEventListener('click', closeProductModal);
  modal.querySelector('.modal-close').addEventListener('click', closeProductModal);
  
  setTimeout(() => modal.classList.add('open'), 10);
}

function closeProductModal() {
  const modal = document.getElementById('product-modal');
  if (modal) {
    modal.classList.remove('open');
    setTimeout(() => modal.remove(), 300);
    document.body.style.overflow = '';
  }
}

// Update cardHTML to add click handler for modal
// ═══════════════════════════════════════════════════════════════
// ADVANCED SEARCH SYSTEM
// ═══════════════════════════════════════════════════════════════
let searchQuery = '';
let priceMin = 0;
let priceMax = 1000000;

function initAdvancedSearch() {
  const searchBar = document.getElementById('search-input');
  if (!searchBar) return;
  
  // Search input handler
  searchBar.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    paginaAtual = 1;
    renderizarPagina();
  });
  
  // Price range slider
  const priceRange = document.getElementById('price-range');
  if (priceRange) {
    priceRange.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      document.getElementById('price-max').value = value;
      document.getElementById('price-value').textContent = `Max: ${value.toLocaleString('pt-BR')}`;
      priceMax = value;
      paginaAtual = 1;
      renderizarPagina();
    });
  }
  
  // Price min input
  const priceMinInput = document.getElementById('price-min');
  if (priceMinInput) {
    priceMinInput.addEventListener('input', (e) => {
      priceMin = parseInt(e.target.value) || 0;
      paginaAtual = 1;
      renderizarPagina();
    });
  }
  
  // Price max input
  const priceMaxInput = document.getElementById('price-max');
  if (priceMaxInput) {
    priceMaxInput.addEventListener('input', (e) => {
      const value = parseInt(e.target.value) || 0;
      priceMax = value;
      document.getElementById('price-range').value = value;
      document.getElementById('price-value').textContent = `Max: ${value.toLocaleString('pt-BR')}`;
      paginaAtual = 1;
      renderizarPagina();
    });
  }
}

function filtrarProdutos() {
  return todosProdutos.filter(p => {
    // Search query
    if (searchQuery && !p.nome.toLowerCase().includes(searchQuery) && !p.id.toLowerCase().includes(searchQuery)) {
      return false;
    }
    
    // Price range
    if (p.precoFinal < priceMin || p.precoFinal > priceMax) {
      return false;
    }
    
    // Status filter
    if (filtroAtivo === 'disponivel' && p.vendido) return false;
    if (filtroAtivo === 'sale' && !p.isSale) return false;
    if (filtroAtivo === 'novo' && !p.isNovo) return false;
    if (filtroAtivo === 'vendido' && !p.vendido) return false;
    
    return true;
  });
}

// Override renderizarPagina to use advanced search
const originalRenderizarPagina = renderizarPagina;
renderizarPagina = function() {
  filtrado = filtrarProdutos();
  totalPaginas = Math.max(1, Math.ceil(filtrado.length / ITEMS_PER_PAGE));
  
  const grid = document.getElementById('shop-grid');
  if (!grid) return;
  
  // Update filter counts
  document.querySelectorAll('.filter-count').forEach(el => {
    const count = el.dataset.count;
    if (count === 'all') el.textContent = todosProdutos.length;
    else if (count === 'disponivel') el.textContent = todosProdutos.filter(p => !p.vendido).length;
    else if (count === 'sale') el.textContent = todosProdutos.filter(p => p.isSale).length;
    else if (count === 'novo') el.textContent = todosProdutos.filter(p => p.isNovo).length;
    else if (count === 'vendido') el.textContent = todosProdutos.filter(p => p.vendido).length;
  });
  
  if (!filtrado.length) {
    grid.innerHTML = '';
    const empty = document.getElementById('empty-state');
    if (empty) empty.style.display = 'flex';
    const pgCtrl = document.getElementById('pagination-controls');
    if (pgCtrl) pgCtrl.style.display = 'none';
    const info = document.getElementById('pagination-info');
    if (info) info.style.display = 'none';
    return;
  }
  
  const empty = document.getElementById('empty-state');
  if (empty) empty.style.display = 'none';
  
  const inicio = (paginaAtual - 1) * ITEMS_PER_PAGE;
  const pedacos = filtrado.slice(inicio, inicio + ITEMS_PER_PAGE);
  
  grid.innerHTML = pedacos.map(p => cardHTML(p)).join('');
  
  grid.querySelectorAll('.btn-buy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copiarComando(btn);
    });
  });

  const info = document.getElementById('pagination-info');
  const txt = document.getElementById('pagination-text');
  const dots = document.getElementById('page-dots');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  
  if (info && txt) {
    info.style.display = 'block';
    txt.textContent = `Mostrando ${filtrado.length} itens — Pagina ${paginaAtual} de ${totalPaginas}`;
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
};



// ═══════════════════════════════════════════════════════════════
// CONTACT FORM
// ═══════════════════════════════════════════════════════════════
function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;
  
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const nome = document.getElementById('contact-nome')?.value.trim();
    const email = document.getElementById('contact-email')?.value.trim();
    const tipo = document.getElementById('contact-tipo')?.value;
    const mensagem = document.getElementById('contact-mensagem')?.value.trim();
    
    let hasErrors = false;
    
    // Validate name
    const nomeInput = document.getElementById('contact-nome');
    if (!nome || nome.length < 2) {
      nomeInput?.classList.add('error');
      hasErrors = true;
    } else {
      nomeInput?.classList.remove('error');
      nomeInput?.classList.add('valid');
    }
    
    // Validate email
    const emailInput = document.getElementById('contact-email');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      emailInput?.classList.add('error');
      hasErrors = true;
    } else {
      emailInput?.classList.remove('error');
      emailInput?.classList.add('valid');
    }
    
    // Validate tipo
    if (!tipo) {
      document.getElementById('contact-tipo')?.classList.add('error');
      hasErrors = true;
    } else {
      document.getElementById('contact-tipo')?.classList.remove('error');
    }
    
    // Validate mensagem
    const msgInput = document.getElementById('contact-mensagem');
    if (!mensagem || mensagem.length < 10) {
      msgInput?.classList.add('error');
      hasErrors = true;
    } else {
      msgInput?.classList.remove('error');
      msgInput?.classList.add('valid');
    }
    
    if (hasErrors) {
      mostrarToast('Por favor, preencha todos os campos corretamente.');
      return;
    }
    
    // Simulate sending (in real implementation, send to backend)
    mostrarToast('Mensagem enviada com sucesso! Entraremos em contato em breve.');
    form.reset();
    
    // Remove valid classes
    form.querySelectorAll('.valid').forEach(el => el.classList.remove('valid'));
  });
}

// ═══════════════════════════════════════════════════════════════
// VISUAL ENHANCEMENTS - All premium effects
// ═══════════════════════════════════════════════════════════════
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
}

function initNavScroll() {
  const nav = document.querySelector('.main-nav');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('nav-scrolled', window.scrollY > 80);
  }, { passive: true });
}

function initEmblemPulse() {
  const emblem = document.querySelector('.hero-emblem');
  if (!emblem || !window.gsap) return;
  gsap.to(emblem, {
    filter: 'drop-shadow(0 0 30px rgba(255, 215, 0, 0.8))',
    scale: 1.03,
    duration: 2,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut'
  });
}

function initStatCounters() {
  const statEls = document.querySelectorAll('.stat-value');
  if (!statEls.length || !window.gsap || !window.ScrollTrigger) return;
  statEls.forEach(el => { el.dataset.counted = 'false'; });
  ScrollTrigger.create({
    trigger: '.hero-stats',
    start: 'top 90%',
    once: true,
    onEnter: () => {
      statEls.forEach(el => {
        const target = parseInt(el.textContent);
        if (isNaN(target) || el.dataset.counted === 'true') return;
        el.dataset.counted = 'true';
        gsap.fromTo(el, { textContent: 0 }, {
          textContent: target,
          duration: 1.5,
          ease: 'power2.out',
          snap: { textContent: 1 },
          onUpdate: function() {
            el.textContent = Math.round(gsap.getProperty(el, 'textContent')).toLocaleString('pt-BR');
          }
        });
      });
    }
  });
}

function initStepStagger() {
  const steps = document.querySelectorAll('.step-card');
  if (!steps.length || !window.gsap || !window.ScrollTrigger) return;
  gsap.from(steps, {
    scrollTrigger: {
      trigger: '.steps-rpg',
      start: 'top 85%',
      toggleActions: 'play none none none'
    },
    y: 60,
    opacity: 0,
    scale: 0.9,
    duration: 0.7,
    stagger: 0.15,
    ease: 'back.out(1.2)'
  });
}

function initFooterGlow() {
  const gem = document.querySelector('.footer-gem');
  if (!gem || !window.gsap) return;
  gsap.to(gem, {
    filter: 'drop-shadow(0 0 20px rgba(255, 215, 0, 0.7))',
    duration: 2.5,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut'
  });
}

function initFloatingRunes() {
  const runes = ['✦', '◈', '⬡', '◇', '✧', '⟡', '⬢', '◆'];
  const container = document.createElement('div');
  container.className = 'floating-runes';
  container.setAttribute('aria-hidden', 'true');
  document.body.appendChild(container);
  for (let i = 0; i < 12; i++) {
    const rune = document.createElement('span');
    rune.className = 'rune-particle';
    rune.textContent = runes[Math.floor(Math.random() * runes.length)];
    rune.style.left = Math.random() * 100 + '%';
    rune.style.animationDuration = (15 + Math.random() * 25) + 's';
    rune.style.animationDelay = (Math.random() * 20) + 's';
    rune.style.fontSize = (0.6 + Math.random() * 0.8) + 'rem';
    rune.style.opacity = 0.03 + Math.random() * 0.06;
    container.appendChild(rune);
  }
}

function initHeroParallaxLayers() {
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.to('.hero-badge', {
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 },
    y: 80, opacity: 0.3
  });
  gsap.to('.hero-title', {
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1.2 },
    y: 120, opacity: 0.2
  });
  gsap.to('.hero-tagline', {
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1.5 },
    y: 160, opacity: 0.1
  });
  gsap.to('.hero-stats', {
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 2 },
    y: 200, opacity: 0
  });
}

function observeDynamicCards() {
  const grid = document.getElementById('shop-grid');
  if (!grid || !window.gsap) return;
  const observer = new MutationObserver(() => {
    const cards = grid.querySelectorAll('.product-card');
    cards.forEach((card, i) => {
      if (!card.dataset.revealed) {
        card.dataset.revealed = 'true';
        gsap.from(card, { y: 40, opacity: 0, duration: 0.6, delay: i * 0.05, ease: 'power2.out' });
      }
    });
  });
  observer.observe(grid, { childList: true });
}

document.addEventListener('DOMContentLoaded', () => {
  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(registration => {
        console.log('[SW] Registered:', registration.scope);
      })
      .catch(error => {
        console.log('[SW] Registration failed:', error);
      });
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
