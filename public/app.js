/* ════════════════════════════════════════════════════════════
   Taverna do Rizakh — app.js
   - Fonte primária: dados embutidos no HTML (produtos-data)
   - Suporta paginação (8 por página), ordenação, filtros
   - Cards mostram: id original, preço, data adição,
     comprador + data se vendido
   ════════════════════════════════════════════════════════════ */

const ITEMS_PER_PAGE = 8;
const TWITCH_CHANNEL = 'rizakh';

let todosProdutos   = [];
let paginaAtual     = 1;
let totalPaginas     = 1;
let filtroAtivo      = 'all';

document.addEventListener('DOMContentLoaded', () => {
  initTwitchPlayer();
  carregarProdutos();
  configurarFiltros();
});

// ── Twitch Player ────────────────────────────────────────────
function initTwitchPlayer() {
  const iframe = document.getElementById('twitch-player');
  if (!iframe) return;
  const parent = window.location.hostname || 'localhost';
  iframe.src = `https://player.twitch.tv/?channel=${TWITCH_CHANNEL}&parent=${parent}&autoplay=false`;
}

// ── Carregar produtos ────────────────────────────────────────
function carregarProdutos() {
  const script = document.getElementById('produtos-data');
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
    // Parse: adiciona campos derivados
    todosProdutos = dados.map(p => Object.assign({}, p, {
      vendido: p.estoque === 0 || p.status === 'vendido',
      isNovo:  p.isNovo  && !p.vendido,
      isSale:  p.desconto > 0 && !p.vendido
    }));
    todosProdutos.sort(cmpProdutos);
    paginaAtual   = 1;
    totalPaginas  = Math.max(1, Math.ceil(todosProdutos.length / ITEMS_PER_PAGE));
    renderizarPagina();
    atualizarStats(todosProdutos);
  } catch (e) {
    mostrarEmpty();
  }
}

// Ordenação: disponiveis primeiro, depois vendidos
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
    default:           return lista;
  }
}

// ── Renderização com paginação ─────────────────────────────
function renderizarPagina() {
  const filtrado  = filtrar(todosProdutos);
  totalPaginas    = Math.max(1, Math.ceil(filtrado.length / ITEMS_PER_PAGE));
  if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;

  const grid  = document.getElementById('shop-grid');
  const empty = document.getElementById('empty-state');

  if (filtrado.length === 0) {
    grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
    if (document.getElementById('pagination-controls')) {
      document.getElementById('pagination-controls').style.display = 'none';
    }
    if (document.getElementById('pagination-info')) {
      document.getElementById('pagination-info').style.display = 'none';
    }
    return;
  }

  if (empty) empty.style.display = 'none';

  const inicio = (paginaAtual - 1) * ITEMS_PER_PAGE;
  const pedacos = filtrado.slice(inicio, inicio + ITEMS_PER_PAGE);

  grid.innerHTML = pedacos.map(p => cardHTML(p)).join('');

  grid.querySelectorAll('.btn-buy').forEach(btn => {
    btn.addEventListener('click', () => copiarComando(btn));
  });

  // Controles de paginação
  const info   = document.getElementById('pagination-info');
  const ctrl   = document.getElementById('pagination-controls');
  const txt    = document.getElementById('pagination-text');
  const dots   = document.getElementById('page-dots');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');

  if (info) {
    info.style.display = 'block';
    txt.textContent = `Pagina ${paginaAtual} de ${totalPaginas} (${filtrado.length} itens)`;
  }
  if (ctrl) {
    ctrl.style.display = totalPaginas > 1 ? 'flex' : 'none';
    btnPrev.disabled = paginaAtual <= 1;
    btnNext.disabled = paginaAtual >= totalPaginas;
  }
  if (dots) {
    let dotsHtml = '';
    for (let i = 1; i <= totalPaginas; i++) {
      dotsHtml += `<span class="page-dot${i === paginaAtual ? ' active' : ''}" onclick="goToPage(${i})">${i}</span>`;
    }
    dots.innerHTML = dotsHtml;
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
  document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
}

// ── Card HTML ────────────────────────────────────────────────
function cardHTML(p) {
  let tags = '';
  if (p.vendido) tags += '<span class="tag tag-sold">Vendido</span>';
  else if (p.isNovo)  tags += '<span class="tag tag-novo">Novo</span>';
  if (p.isSale)  tags += `<span class="tag tag-sale">${p.desconto}% OFF</span>`;

  // Video
  const videoHtml = p.youtubeId
    ? `<iframe src="https://www.youtube.com/embed/${p.youtubeId}?rel=0&modestbranding=1&enablejsapi=1"
        title="${escHtml(p.nome)}"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowfullscreen loading="eager"></iframe>`
    : `<div class="video-placeholder"><span>+</span><span>Sem trailer</span></div>`;

  // Preço
  let precoHtml = '';
  if (p.isSale) {
    precoHtml = `<div class="card-price">
      <div class="price-sale-wrapper">
        <span class="price-current">${p.precoFinal}</span>
        <span class="price-original">${p.preco}</span>
        <span class="price-badge">-${p.desconto}%</span>
      </div>
    </div>`;
  } else {
    precoHtml = `<div class="card-price"><div class="price-current">${p.precoFinal}</div></div>`;
  }

  // Info extra: data adição ou dados da compra
  let extraHtml = '';
  if (p.vendido) {
    if (p.compradoPor || p.dataCompraBr) {
      const buyer = p.compradoPor ? escHtml(p.compradoPor) : 'Anónimo';
      const date  = p.dataCompraBr ? p.dataCompraBr : '';
      extraHtml = `<div class="card-extra">
        <div class="sold-info">Vendido para ${buyer}${date ? ` em ${date}` : ''}</div>
      </div>`;
    }
  } else {
    if (p.dataAdicBr) {
      extraHtml = `<div class="card-extra">
        <div class="added-info">Adicionado em ${p.dataAdicBr}</div>
      </div>`;
    }
  }

  // Estoque / status
  let estoqueHtml = '';
  if (p.vendido) {
    estoqueHtml = '<div class="card-stock stock-zero">Vendido</div>';
  } else if (p.estoque <= 2 && p.estoque > 0) {
    estoqueHtml = `<div class="card-stock stock-low">Ultimas ${p.estoque} unid.</div>`;
  } else if (p.estoque > 0) {
    estoqueHtml = `<div class="card-stock stock-ok">${p.estoque} em estoque</div>`;
  } else {
    estoqueHtml = '<div class="card-stock stock-zero">Esgotado</div>';
  }

  const btnHtml = p.vendido
    ? '<button class="btn-buy" disabled>Esgotado</button>'
    : `<button class="btn-buy" data-cmd="!loja comprar ${escHtml(p.id)}">Comprar</button>`;

  const filterAttr = ['all'];
  if (!p.vendido) filterAttr.push('disponivel');
  if (p.isSale)   filterAttr.push('sale');
  if (p.isNovo)   filterAttr.push('novo');

  return `<div class="product-card${p.vendido ? ' sold' : ''}" data-filter="${filterAttr.join(' ')}">
    <div class="card-tags">${tags}</div>
    <div class="card-video">${videoHtml}</div>
    <div class="card-body">
      <div class="card-id">${escHtml(p.id)}</div>
      <div class="card-name">${escHtml(p.nome)}</div>
      ${precoHtml}
      ${estoqueHtml}
      ${extraHtml}
      <div class="card-buy">${btnHtml}</div>
    </div>
  </div>`;
}

// ── Copiar comando ───────────────────────────────────────────
function copiarComando(btn) {
  const cmd = btn.dataset.cmd;
  if (!cmd) return;

  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = cmd;
    ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(cmd).then(() => mostarFeedback(btn)).catch(fallback);
  } else {
    fallback();
    mostarFeedback(btn);
  }
}

function mostarFeedback(btn) {
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
  const disp  = produtos.filter(p => !p.vendido);
  const promo = disp.filter(p => p.isSale);
  const menor  = disp.reduce((m, p) => p.precoFinal < m ? p.precoFinal : m, Infinity);

  const et = document.getElementById('stat-produtos');
  const ep = document.getElementById('stat-promocoes');
  const em = document.getElementById('stat-pts-min');
  if (et) et.textContent = disp.length;
  if (ep) ep.textContent = promo.length;
  if (em && menor !== Infinity) em.textContent = menor;
}

// ── Empty state ─────────────────────────────────────────────
function mostrarEmpty() {
  const grid  = document.getElementById('shop-grid');
  const empty = document.getElementById('empty-state');
  if (grid)  grid.innerHTML = '';
  if (empty) empty.style.display = 'block';
  if (document.getElementById('pagination-controls')) {
    document.getElementById('pagination-controls').style.display = 'none';
  }
  if (document.getElementById('pagination-info')) {
    document.getElementById('pagination-info').style.display = 'none';
  }
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