/* ════════════════════════════════════════════════════════════
   Taverna do Rizakh — app.js
   - Lê produtos via /api/produtos (HttpListener C#)
   - Toggle demo (9 produtos fictícios)
   - Filtros, tags (Novo/Sale/Esgotado)
   - Botão "Comprar" copia !loja comprar <id> para o clipboard
   ════════════════════════════════════════════════════════════ */

const API_URL = '/api/produtos';

const DEMO_PRODUTOS = [
  { id:'steam10',  nome:'Gift Card Steam R$10',      preco:500,  precoFinal:500,  desconto:0,  youtubeId:'', isNovo:true,  estoque:5 },
  { id:'steam20',  nome:'Gift Card Steam R$20',      preco:900,  precoFinal:810,  desconto:10, youtubeId:'', isNovo:false, estoque:3 },
  { id:'steam50',  nome:'Gift Card Steam R$50',      preco:2000, precoFinal:2000, desconto:0,  youtubeId:'', isNovo:false, estoque:2 },
  { id:'xbox10',   nome:'Xbox Gift Card R$10',       preco:500,  precoFinal:425,  desconto:15, youtubeId:'', isNovo:true,  estoque:4 },
  { id:'xbox25',   nome:'Xbox Gift Card R$25',       preco:1200, precoFinal:1200, desconto:0, youtubeId:'', isNovo:false, estoque:0 },
  { id:'psn20',    nome:'PSN Gift Card R$20',        preco:950,  precoFinal:950,  desconto:0,  youtubeId:'', isNovo:false, estoque:1 },
  { id:'elden',    nome:'Elden Ring',                 preco:5000, precoFinal:3500, desconto:30, youtubeId:'', isNovo:false, estoque:1 },
  { id:'hades2',   nome:'Hades II',                  preco:3000, precoFinal:3000, desconto:0,  youtubeId:'', isNovo:true,  estoque:2 },
  { id:'discord',  nome:'Discord Nitro 1 mês',         preco:800,  precoFinal:800,  desconto:0,  youtubeId:'', isNovo:false, estoque:0 },
];

let produtosReais  = [];
let modoDemo       = false;
let filtroAtivo    = 'all';

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  carregarProdutos();
  configurarFiltros();
  configurarToggleDemo();
});

// ── Carregar produtos ────────────────────────────────────────
async function carregarProdutos() {
  try {
    const resp  = await fetch(API_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    produtosReais = await resp.json();

    if (produtosReais.length === 0) {
      mostrarToggleDemo(true);
      modoDemo = true;
      document.getElementById('demo-check').checked = true;
      renderizarProdutos(DEMO_PRODUTOS);
    } else {
      mostrarToggleDemo(false);
      modoDemo = false;
      renderizarProdutos(filtrarProdutos(produtosReais));
    }
  } catch {
    produtosReais = [];
    mostrarToggleDemo(true);
    modoDemo = true;
    document.getElementById('demo-check').checked = true;
    renderizarProdutos(DEMO_PRODUTOS);
  }
}

// ── Toggle demo ─────────────────────────────────────────────
function configurarToggleDemo() {
  const chk = document.getElementById('demo-check');
  if (!chk) return;
  chk.addEventListener('change', () => {
    modoDemo = chk.checked;
    const lista = modoDemo ? DEMO_PRODUTOS : filtrarProdutos(produtosReais);
    renderizarProdutos(lista);
  });
}

function mostrarToggleDemo(v) {
  const el = document.getElementById('demo-toggle');
  if (el) el.style.display = v ? 'block' : 'none';
}

// ── Filtros ─────────────────────────────────────────────────
function configurarFiltros() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filtroAtivo = btn.dataset.filter;
      const lista = modoDemo ? DEMO_PRODUTOS : filtrarProdutos(produtosReais);
      renderizarProdutos(lista);
    });
  });
}

function filtrarProdutos(lista) {
  switch (filtroAtivo) {
    case 'disponivel': return lista.filter(p => p.estoque > 0);
    case 'sale':       return lista.filter(p => p.desconto > 0);
    case 'novo':       return lista.filter(p => p.isNovo);
    default:           return lista;
  }
}

// ── Renderizar grid ──────────────────────────────────────────
function renderizarProdutos(lista) {
  const grid  = document.getElementById('shop-grid');
  const empty = document.getElementById('empty-state');

  if (!lista || lista.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  grid.innerHTML = lista.map(p => criarCardHTML(p)).join('');

  grid.querySelectorAll('.btn-buy').forEach(btn => {
    btn.addEventListener('click', () => copiarComando(btn));
  });
}

// ── Card HTML ────────────────────────────────────────────────
function criarCardHTML(p) {
  const vendido = p.estoque === 0;
  const isNovo  = p.isNovo  && !vendido;
  const isSale  = p.desconto > 0 && !vendido;

  let tags = '';
  if (vendido) tags += `<span class="tag tag-sold">Esgotado</span>`;
  if (isNovo)  tags += `<span class="tag tag-novo">Novo</span>`;
  if (isSale)  tags += `<span class="tag tag-sale">${p.desconto}% OFF</span>`;

  const videoHtml = p.youtubeId
    ? `<iframe src="https://www.youtube.com/embed/${p.youtubeId}?rel=0&modestbranding=1&enablejsapi=1"
        title="${escHtml(p.nome)}"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowfullscreen loading="eager"></iframe>`
    : `<div class="video-placeholder"><span>🎮</span><span>Trailer em breve</span></div>`;

  let precoHtml = '';
  if (isSale) {
    precoHtml =
      `<div class="card-price">
        <span class="price-current">${p.precoFinal} pts</span>
        <span class="price-original">${p.preco} pts</span>
        <span class="price-badge">-${p.desconto}%</span>
      </div>`;
  } else {
    precoHtml = `<div class="card-price"><span class="price-current">${p.precoFinal} pts</span></div>`;
  }

  let estoqueClass = 'stock-ok';
  let estoqueTxt    = `${p.estoque} em estoque`;
  if (vendido)                  { estoqueClass = 'stock-zero'; estoqueTxt = 'Sem estoque'; }
  else if (p.estoque <= 2)     { estoqueClass = 'stock-low';  estoqueTxt = `⚠️ Últimas ${p.estoque} unidades!`; }

  const btnLabel  = vendido ? '❌ Esgotado' : 'Comprar';
  const btnAttrib = vendido ? 'disabled ' : '';
  const dataCmd   = `!loja comprar ${escHtml(p.id)}`;

  return `
  <div class="product-card${vendido ? ' sold' : ''}" data-id="${escHtml(p.id)}" data-filter="${getDataFilter(p, vendido)}">
    <div class="card-tags">${tags}</div>
    <div class="card-video">${videoHtml}</div>
    <div class="card-body">
      <div class="card-name">${escHtml(p.nome)}</div>
      ${precoHtml}
      <div class="card-stock ${estoqueClass}">${estoqueTxt}</div>
      <div class="card-buy">
        <button class="btn-buy" data-cmd="${dataCmd}" ${btnAttrib}>
          ${btnLabel}
        </button>
      </div>
    </div>
  </div>`;
}

function getDataFilter(p, vendido) {
  const t = ['all'];
  if (!vendido) t.push('disponivel');
  if (p.desconto > 0 && !vendido) t.push('sale');
  if (p.isNovo && !vendido) t.push('novo');
  return t.join(' ');
}

// ── Copiar comando ────────────────────────────────────────────
function copiarComando(btn) {
  const cmd = btn.dataset.cmd;
  if (!cmd) return;

  navigator.clipboard.writeText(cmd).then(() => {
    const original = btn.innerHTML;
    btn.innerHTML = '✅ Copiado!';
    btn.classList.add('copied');
    btn.disabled = true;
    mostrarToast(`Cole no chat: ${cmd}`);
    setTimeout(() => {
      btn.innerHTML = original;
      btn.classList.remove('copied');
      btn.disabled = false;
    }, 2200);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = cmd;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    mostrarToast(`Cole no chat: ${cmd}`);
  });
}

// ── Toast ─────────────────────────────────────────────────────
let toastTimer = null;
function mostrarToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

// ── Util ──────────────────────────────────────────────────────
function escHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
