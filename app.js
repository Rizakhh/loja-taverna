/* ════════════════════════════════════════════════════════════
   Taverna do Rizakh — app.js
   - Fonte primária: dados embutidos no HTML (id="produtos-data")
   - API local (/api/produtos) como fallback apenas para testes locais
   - Toggle demo REMOVIDO — site é sempre dinâmico com dados reais
   ════════════════════════════════════════════════════════════ */

const API_URL  = '/api/produtos';
const TWITCH_CHANNEL = 'rizakh';

let todosProdutos = [];

// ── Init ─────────────────────────────────────────────────────
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

// ── Carregar produtos ───────────────────────────────────────
function carregarProdutos() {
  // 1. Tenta API local (localhost:3000 — só funciona em desenvolvimento)
  fetch(API_URL)
    .then(r => r.ok ? r.json() : null)
    .then(dados => {
      if (dados && dados.length > 0) {
        todosProdutos = dados;
        renderizar(todosProdutos);
        atualizarStats(todosProdutos);
      } else {
        carregarDadosEstaticos();
      }
    })
    .catch(() => carregarDadosEstaticos());
}

function carregarDadosEstaticos() {
  const script = document.getElementById('produtos-data');
  if (script) {
    try {
      const dados = JSON.parse(script.textContent);
      if (dados && dados.length > 0) {
        todosProdutos = dados;
        renderizar(todosProdutos);
        atualizarStats(todosProdutos);
        return;
      }
    } catch (e) { /* JSON inválido */ }
  }
  // Nenhum dado disponível
  const grid = document.getElementById('shop-grid');
  const empty = document.getElementById('empty-state');
  if (grid) grid.innerHTML = '';
  if (empty) empty.style.display = 'block';
}

// ── Atualizar stats do hero ──────────────────────────────────
function atualizarStats(produtos) {
  const total   = produtos.length;
  const emPromo = produtos.filter(p => p.desconto > 0).length;
  const menorPreco = produtos.reduce((min, p) => {
    const pf = p.precoFinal;
    return pf < min ? pf : min;
  }, Infinity);

  const elTotal  = document.getElementById('stat-produtos');
  const elPromo  = document.getElementById('stat-promocoes');
  const elMenor  = document.getElementById('stat-pts-min');

  if (elTotal)  elTotal.textContent  = total;
  if (elPromo)  elPromo.textContent  = emPromo;
  if (elMenor && menorPreco !== Infinity)
    elMenor.textContent = menorPreco + ' pts';
}

// ── Filtros ─────────────────────────────────────────────────
let filtroAtivo = 'all';

function configurarFiltros() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filtroAtivo = btn.dataset.filter;
      renderizar(filtrar(todosProdutos));
    });
  });
}

function filtrar(lista) {
  switch (filtroAtivo) {
    case 'disponivel': return lista.filter(p => p.estoque > 0);
    case 'sale':       return lista.filter(p => p.desconto > 0);
    case 'novo':       return lista.filter(p => p.isNovo);
    default:           return lista;
  }
}

// ── Renderizar ─────────────────────────────────────────────
function renderizar(lista) {
  const grid  = document.getElementById('shop-grid');
  const empty = document.getElementById('empty-state');

  if (!lista || lista.length === 0) {
    if (grid) grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }

  if (empty) empty.style.display = 'none';
  if (grid) grid.innerHTML = lista.map(p => cardHTML(p)).join('');

  grid.querySelectorAll('.btn-buy').forEach(btn => {
    btn.addEventListener('click', () => copiarComando(btn));
  });
}

// ── Card HTML ────────────────────────────────────────────────
function cardHTML(p) {
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

  let estoqueTxt = '';
  let estoqueClass = 'stock-ok';
  if (vendido)                   { estoqueClass = 'stock-zero'; estoqueTxt = 'Sem estoque'; }
  else if (p.estoque <= 2)       { estoqueClass = 'stock-low';  estoqueTxt = `Últimas ${p.estoque} unid.`; }
  else                            { estoqueTxt = `${p.estoque} em estoque`; }

  const btnLabel  = vendido ? '❌ Esgotado' : '⚔️ Comprar';
  const disabled = vendido ? 'disabled ' : '';
  const dataCmd  = `!loja comprar ${escHtml(p.id)}`;

  return `
  <div class="product-card${vendido ? ' sold' : ''}" data-filter="${getFilter(p, vendido)}">
    <div class="card-tags">${tags}</div>
    <div class="card-video">${videoHtml}</div>
    <div class="card-body">
      <div class="card-id">${escHtml(p.id)}</div>
      <div class="card-name">${escHtml(p.nome)}</div>
      ${precoHtml}
      <div class="card-stock ${estoqueClass}">${estoqueTxt}</div>
      <div class="card-buy">
        <button class="btn-buy" data-cmd="${dataCmd}" ${disabled}>
          ${btnLabel}
        </button>
      </div>
    </div>
  </div>`;
}

function getFilter(p, vendido) {
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
    }, 2500);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = cmd;
    ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    mostrarToast(`Cole no chat: ${cmd}`);
  });
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

// ── Util ─────────────────────────────────────────────────────
function escHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
