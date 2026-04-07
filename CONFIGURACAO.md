# CONFIGURAÇÃO — Taverna do Rizakh (Loja Streamer.bot)

> Atualizado — v5.0 — Clip Slugs + Bug Fix + GitHub Pages

---

## Índice

1. [Arquivos do Projeto](#1-arquivos-do-projeto)
2. [Hospedagem — GitHub Pages](#2-hospedagem--github-pages)
3. [Variáveis Globais no Streamer.bot](#3-variáveis-globais-no-streamerbot)
4. [Comandos da Loja](#4-comandos-da-loja)
5. [Estrutura do chaves.txt](#5-estrutura-do-chavestxt)
6. [Sincronização Automática (sync-watch.ps1)](#6-sincronização-automática-sync-watchps1)
7. [API HTTP (Loja_HttpServer.cs)](#7-api-http-loja_httpservercs)
8. [E-mail (Gmail App Password)](#8-e-mail-gmail-app-password)
9. [Segurança](#9-segurança)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Arquivos do Projeto

```
C:\Users\Rizakh\Documents\Projetos AI\
├── loja_streamerbot\          ← Scripts C# e automação
│   ├── scripts\
│   │   ├── Loja_Principal.cs     (!loja, !loja comprar, !loja item, !loja sale)
│   │   ├── Loja_RegistrarEmail.cs (!email)
│   │   ├── Loja_ChangeEmail.cs    (!changemail — mod/broadcaster)
│   │   ├── Loja_AdminAddKey.cs    (!loja add — broadcaster)
│   │   └── Loja_HttpServer.cs     (porta 3000 + /api/produtos)
│   ├── sync-watch.ps1             (FileSystemWatcher — sync auto GitHub)
│   ├── auto-start.bat             (inicialização)
│   └── CONFIGURACAO.md
│
└── loja_web\public\           ← Site estático (publicado no GitHub Pages)
    ├── index.html
    ├── style.css
    └── app.js

C:\Stream Setup\Streamer.bot\loja\   ← Dados (NÃO é o site publicado)
├── chaves.txt          (PRODUTOS — fonte de dados)
├── transacoes.txt      (LOG de compras)
├── emails.txt          (e-mails dos usuários)
└── backups\           (backups automáticos)
```

---

## 2. Hospedagem — GitHub Pages

> O Netlify foi substituído pelo **GitHub Pages** (ilimitado, integrado ao GitHub).

### Como Ativar

1. Acesse seu repositório: `https://github.com/Rizakhh/loja-taverna`
2. Vá em **Settings > Pages** (na barra lateral)
3. Em **Source**, selecione:
   - **Branch:** `main`
   - **Folder:** `/ (root)`
4. Clique em **Save**
5. Aguarde 2-5 minutos — o site estará em:
   **`https://rizakhh.github.io/loja-taverna/`**

> Se quiser usar domínio próprio (ex: `loja.seusite.com`), configure em **Custom Domain** no mesmo painel.

### Publish Confirmation

O `sync-watch.ps1` faz push automático para a **raiz** do repo (não dentro de `public/`). O GitHub Pages serve diretamente do branch `main`.

> **Paginação:** A loja exibe **9 produtos por página**, com navegação (Anterior/Próxima + indicadores de página).

### Atualizando o Site

O `sync-watch.ps1` (executado pelo `auto-start.bat`) monitora o `chaves.txt` e:
1. Atualiza o JSON no `index.html` local
2. Faz push para o GitHub via API
3. O GitHub Pages detecta a mudança e republica automaticamente

---

## 3. Variáveis Globais no Streamer.bot

| Variável | Descrição |
|---|---|
| `loja_smtp_remetente` | Seu Gmail para envio de chaves |
| `loja_smtp_apppassword` | App Password Gmail (16 caracteres) |
| `loja_cooldown_segundos` | Cooldown mínimo entre compras (ex: `60`) |
| `loja_url` | URL pública do site (ex: `https://rizakhh.github.io/loja-taverna/`) |

---

## 4. Comandos da Loja

| Comando | Acesso | Descrição |
|---|---|---|
| `!email seu@email.com` | Todos | Registra e-mail do usuário |
| `!loja` | Todos | Exibe link do site da loja |
| `!loja comprar <id>` | Todos | Compra um produto |
| `!loja item <id>` | Todos | Ver detalhes de um item |
| `!loja sale <id> <0-99>` | Broadcaster | Aplica desconto % a um item |
| `!loja vid <id> <youtubeID>` | Broadcaster | Define trailer do YouTube |
| `!loja add <id> <nome> <preco> <chave>` | Broadcaster | Adiciona produto |
| `!changemail <userId> <novoEmail>` | Mod/Broadcaster | Altera e-mail de usuário |

---

## 5. Estrutura do chaves.txt

> **IMPORTANTE:** O `chaves.txt` é a **única fonte de dados**. Mantenha-o sempre atualizado.

**Formato (10 colunas, separadas por vírgula):**

```
ID_Item,Nome_Jogo,Preco,Chave,YoutubeID,Status,CompradoPor,DataCompra,DiscountPercent,DataAdicionado
```

| # | Campo | Descrição | Exemplo |
|---|---|---|---|
| 0 | `ID_Item` | Identificador único (número ou texto) | `0`, `1`, `eldenring` |
| 1 | `Nome_Jogo` | Nome do produto/jogo | `Elden Ring` |
| 2 | `Preco` | Preço em pontos (inteiro) | `10000` |
| 3 | `Chave` | Chave/gift card (ou vazio se indisponível) | `XXXX-YYYY-ZZZZ` |
| 4 | `YoutubeID` | **ID do vídeo do YouTube** (11 caracteres) | `UAO2urG23S4` |
| 5 | `Status` | `disponivel` ou `vendido` | `disponivel` |
| 6 | `CompradoPor` | Nome do usuário que comprou (ou vazio) | `rizakh` |
| 7 | `DataCompra` | Data/hora da compra (ou vazio) | `2026-04-07 05:11:16` |
| 8 | `DiscountPercent` | Desconto 0-99 (ou 0) | `0`, `30` |
| 9 | `DataAdicionado` | Data em que foi adicionado ao catálogo | `2026-04-07 04:46:41` |

### Como Obter o YouTube ID

1. Vá no YouTube e busque: `Nome do Jogo + release trailer`
2. Clique no vídeo desejado
3. Na URL, copie o código de 11 caracteres após `?v=`
   - Exemplo: `youtube.com/watch?v=UAO2urG23S4` → ID = `UAO2urG23S4`

> **Nota:** A busca automática por YouTube requer uma **YouTube Data API v3 Key** (gratuita). Veja a seção abaixo para configurar.

### Como Obter uma YouTube Data API v3 Key (Gratuito)

A API do YouTube permite busca automática de vídeos. É gratuita para até **10.000 requisições/dia**.

**Passo a Passo:**

1. Acesse: https://console.cloud.google.com/
2. Faça login com sua conta Google
3. No topo, clique em **"Select a project"** → **"New project"**
   - Nome: `youtube-search`
   - ID: `youtube-search-api` (ou similar)
4. Clique em **"APIs & Services"** → **"Library"**
5. Busque por **"YouTube Data API v3"** e clique nele
6. Clique em **"Enable"**
7. Vá em **"APIs & Services"** → **"Credentials"**
8. Clique em **"Create Credentials"** → **"API Key"**
9. Copie a chave (exemplo: `AIzaSy...xxxxx`)
10. **Limite a chave** (opcional mas recomendado):
    - Em "API restrictions", selecione "YouTube Data API v3"

**Colando no script (sync-watch.ps1):**

1. Abra `sync-watch.ps1` no Bloco de Notas
2. Na linha 14, cole sua chave:
   ```powershell
   [string]$YouTubeApiKey = "AIzaSy...xxxxx"
   ```
3. Salve o arquivo — a partir de agora, a busca automática funcionará!

> **Sem a API key:** a busca automática usa oEmbed (menos confiável). Com a API key: usa YouTube Data API v3 (10.000 requisições/dia, muito mais confiável).

**Custo:** Gratuito para até 10.000 buscas/dia (cada busca = 1 unidade). Para uso normal de loja, é mais que suficiente.

> **Nota:** Sem a API key, a busca automática não funciona — APIs externas como Invidious são bloqueadas frequentemente. Sempre use `!loja vid <id> <youtubeId>` para definir trailers manualmente.

### Como Adicionar um Produto

```
!loja add <id> <nome> <preco> <chave>
```

Exemplo:
```
!loja add 2 "Cyberpunk 2077" 15000 XXXX-YYYY-ZZZZ-AAAA
```

Depois, use `!loja vid 2 UAO2urG23S4` para definir o trailer do YouTube.

---

## 6. Sincronização Automática (sync-watch.ps1)

O script `sync-watch.ps1` monitora alterações no `chaves.txt` e sincroniza automaticamente com o GitHub.

### Como Executar

```powershell
cd C:\Users\Rizakh\Documents\Projetos AI\loja_streamerbot
.\sync-watch.ps1
```

Ou use `auto-start.bat` que inicia o watcher automaticamente.

### O que ele faz

1. **Monitora** `C:\Stream Setup\Streamer.bot\loja\chaves.txt`
2. **Busca YouTube** para itens sem `YoutubeID` (pode falhar — vide troubleshooting)
3. **Gera JSON** dos produtos a partir do CSV
4. **Atualiza** `index.html` local com o JSON
5. **Faz push** para o GitHub via API (sem precisar de Git instalado)

### Configurações (no início do script)

```powershell
$RepoDir  = "C:\Users\Rizakh\Documents\Projetos AI\loja_web"
$GitToken = "ghp_..."     # Seu token GitHub
$Owner    = "Rizakhh"
$Repo     = "loja-taverna"
$DebounceMs = 2000        # ms de espera após mudança
```

---

## 7. API HTTP (Loja_HttpServer.cs)

O servidor HTTP roda na porta **3000** e serve:

| Endpoint | Descrição |
|---|---|
| `GET /` | Página inicial do site |
| `GET /api/produtos` | Lista todos os produtos em JSON |
| `GET /api/produtos?id=X` | Detalhes de um produto |
| `POST /api/sync-git` | Força sync com GitHub |

> Para expor externally, use **Cloudflare Tunnel** ou **ngrok**:
> ```
> cloudflare tunnel --url http://localhost:3000
> ```

---

## 8. E-mail (Gmail App Password)

### Passo a Passo

1. Ative a **Verificação em 2 Etapas** na sua conta Google
2. Acesse: `https://myaccount.google.com/apppasswords`
3. Crie um App Password novo (nome: `StreamerBot`)
4. Copie a senha de 16 caracteres (ex: `abcd efgh ijkl mnop`)
5. Cole no campo `loja_smtp_apppassword` no Streamer.bot

### Formato do E-mail Enviado

```text
Olá {userName}!
Compra confirmada na Taverna do Rizakh!
🎮 JOGO: {itemName}
🔑 CHAVE: {gameKey}
💎 PREÇO PAGO: {finalPrice} pts{(isOnSale ? $" ({discountPercent}% OFF)" : "")}

📌 ATIVAR: Games > Activate a Product on Steam > Cole: {gameKey}
Obrigado por apoiar a stream! 🙏
---
A Taverna do Rizakh | twitch.tv/rizakh
```

---

## 9. Segurança

| Risco | Mitigação |
|---|---|
| Chave no chat | Nunca exposta — apenas whisper (Twitch) ou e-mail |
| Race condition | Operações de arquivo são sequenciais (lock) |
| Admin via whisper | Flag `isBroadcaster` + fallback hardcoded `rizakh` |
| E-mail exposto | Máscara parcial no log (ex: `jo***@gmail.com`) |
| App Password exposto | Armazenado em Global Variable, não em código |

---

## 10. Troubleshooting

| Problema | Solução |
|---|---|
| `Acesso negado` porta 3000 | Execute como admin: `netsh http add urlacl url=http://localhost:3000/ user=%username%` |
| Site GitHub Pages não atualiza | Aguarde 2-5 min. Force rebuild em Settings > Pages |
| Hollow Knight sem trailer | O script de busca pode falhar — use `!loja vid 1 UAO2urG23S4` manualmente |
| YouTube ID não encontrado | APIs externas (Invidious) podem estar bloqueadas. Adicione manualmente via `!loja vid` |
| GitHub push falha | Verifique se o token ainda é válido em `sync-watch.ps1` |
| `Matriz não pode ser nula` no upload | `$newContent` deve ser `$novoConteudo` no sync-watch.ps1 linha 256 |
| `chaves.txt` não encontrado | O watcher monitora `C:\Stream Setup\Streamer.bot\loja\chaves.txt` — caminho fixo |
| Pagination errors no site | Elemento `<span id="pagination-text">` dentro de `#pagination-info` — ver app.js |

---

## Cronograma de Comandos (!loja)

```
!loja                          → Exibe link da loja
!loja comprar <id>             → Compra produto (whisper + e-mail)
!loja item <id>                → Detalhes do produto
!loja sale <id> <0-99>        → Aplica desconto (broadcaster)
!loja vid <id> <youtubeId>     → Define trailer (broadcaster)
!loja add <id> <nome> <preco> <chave>  → Adiciona produto (broadcaster)
```

## Fluxo do Usuário

```
1. !email seu@email.com
       ↓
2. !loja  (abre o site)
       ↓
3. !loja comprar <id>
       ↓
4. Recebe a chave via whisper (Twitch) + e-mail (YouTube/fallback)

---

## Player da Twitch — Live/Offline com Clips

O site detecta automaticamente se você está online via **Helix API** (`api.twitch.tv/helix/streams`):

- **Online:** exibe o player ao vivo com badge "AO VIVO"
- **Offline:** exibe um **clip aleatório** do seu canal (6 clips configurados em `app.js`)

### Configurar os Clips

Edite o array `OFFLINE_CLIPS` em `app.js`:

```javascript
const OFFLINE_CLIPS = [
  'https://clips.twitch.tv/embed?clip=PluckyRoundOx4Head&parent=localhost',
  'https://clips.twitch.tv/embed?clip=FriendlyConfidentMangoPogChamp-jOjwS2W-_dFd-upn&parent=localhost',
  // ... até 6 slugs
];
```

Para obter o slug de um clip: abra a URL do clip e copie o final.
Ex: `twitch.tv/rizakh/clip/PluckyRoundOx4Head` → slug = `PluckyRoundOx4Head`

> **Importante:** O `parent` na URL deve corresponde ao domínio do site (ex: `rizakhh.github.io`). O código substitui automaticamente `parent=localhost` pelo domínio real do visitante.
