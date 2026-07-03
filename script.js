// =============================
// SOCKET (MULTIPLAYER)
// =============================
// Forçando o backend do Render para os testes locais funcionarem diretamente online
const FRONTEND_SOCKET_BASE_URL = "https://card-clash-backend.onrender.com";

const FRONTEND_IS_LOCAL =
  window.location.protocol === "file:" ||
  ["localhost", "127.0.0.1"].includes(window.location.hostname);

const socket = io(FRONTEND_SOCKET_BASE_URL, {
  // Mantemos apenas ["websocket"] já que o Render lida muito melhor com ele diretamente
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  timeout: 20000
});

let currentMatch = null;

socket.on("connect", () => {
  console.log("Socket conectado:", socket.id);

  if (currentPlayer?.id) {
    socket.emit("restore_session", {
      playerId: currentPlayer.id
    });
  }
});
socket.on("disconnect", (reason) => {
  console.log("❌ Socket desconectado:", reason);
});

socket.on("connect_error", (err) => {
  console.log("❌ Erro de conexão socket:", err.message);
});

socket.io.on("reconnect", (attempt) => {
  console.log("🔄 Socket reconectado. Tentativa:", attempt);
  console.log("Novo socket.id:", socket.id);

  showWarning("Reconectado. Aguarde sincronizar a partida.");
});
socket.io.on("reconnect_attempt", (attempt) => {
  console.log("🔄 Tentando reconectar socket...", attempt);
});

socket.on("match_found", (match) => {
  currentMatch = match;

  initGame();
  showScreen("game-screen");

  // Pega o deck atual do jogador
  let deckAtual = getCurrentDeck();

  // CORREÇÃO: Se o deck estiver vazio ou não existir, o jogo cria um deck padrão de teste
  // com as cartas iniciais (ex: P001, P002, P003...) para o jogo não quebrar online.
  if (!deckAtual || !Array.isArray(deckAtual) || deckAtual.length === 0) {
    console.warn("Nenhum deck selecionado ou deck vazio! Usando deck padrão de teste.");
    
    // Altere esses IDs ("P001", "P002", etc.) pelos IDs reais que você tem no seu CARD_DB
    deckAtual = ["P001", "P001", "P002", "P002", "P003", "P003", "P004", "P004", "P005", "P005"];
    
    alert("Aviso: Você não selecionou um deck ativo. Iniciando com um deck padrão de teste!");
  }

  // Envia o deck corrigido para o servidor
  socket.emit("set_match_deck", {
    matchId: match.id,
    deck: deckAtual
  });

  alert("Adversário encontrado!");

  updateTurnUIOnline(match);
});



// =============================
// PLAYER / STORAGE
// =============================
let currentPlayer = JSON.parse(localStorage.getItem("player")) || null;
let selectedEffectIndex = null;
let waitingEffectTarget = false;
let colecao = JSON.parse(localStorage.getItem("colecao")) || {};
let decks = JSON.parse(localStorage.getItem("decks")) || [
  { nome: "Deck 1", cartas: [] }
];

let currentDeckIndex = parseInt(localStorage.getItem("currentDeckIndex") || "0");

function getCurrentDeck() {
  if (!decks[currentDeckIndex]) {
    decks[currentDeckIndex] = {
      nome: `Deck ${currentDeckIndex + 1}`,
      cartas: []
    };
  }
  return decks[currentDeckIndex].cartas;
}




// =============================
// ELEMENTOS HTML
// =============================
const startGameBtn = document.getElementById("start-game-btn");
const playerHandElement = document.getElementById("player-hand");

// =============================
// BOTÃO START (MATCHMAKING)
// =============================
if (startGameBtn) {
  startGameBtn.addEventListener("click", () => {
    if (!currentPlayer) {
      alert("Faça login primeiro.");
      return;
    }

    socket.emit("find_match", {
      id: currentPlayer.id,
      username: currentPlayer.username
    });

    alert("Procurando adversário...");
  });
}

// =============================
// CONFIG DO TABULEIRO
// =============================
const ZONES = ["bancoPlayer", "campo1", "campo2", "bancoEnemy"];

const LIMITS = {
  bancoPlayer: 6,
  campo1: 4,
  campo2: 4,
  bancoEnemy: 6
};

// =============================
// ESTADO DO JOGO
// =============================
let board = {
  bancoPlayer: [],
  campo1: [],
  campo2: [],
  bancoEnemy: []
};

let playerHand = [];
let enemyHand = [];

let selected = null;
let actionMode = null;

let currentTurn = "player";
let turnNumber = 1;

// =============================
// VIDA E ENERGIA
// =============================
let playerLife = 4;
let enemyLife = 4;

let playerPE = 0;
let maxPE = 0;
const maxPELimit = 10;

// =============================
// FUNÇÕES BÁSICAS
// =============================
function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach(s => {
    s.classList.remove("active");
    s.classList.add("hidden");
  });

  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add("active");
    target.classList.remove("hidden");
  }
}

function showWarning(text) {
  const el = document.getElementById("game-warning");
  if (!el) return;

  el.textContent = text;
  el.classList.add("show");

  setTimeout(() => {
    el.classList.remove("show");
  }, 2000);
}

// =============================
// INICIAR JOGO
// =============================
function initGame() {
  board = {
    bancoPlayer: [],
    campo1: [],
    campo2: [],
    bancoEnemy: []
  };

  playerHand = [];
  enemyHand = [];

  selected = null;
  actionMode = null;

  ZONES.forEach((z) => {
    const zoneEl = document.getElementById(z);
    if (!zoneEl) return;

    if (zoneEl.dataset.bound === "1") return;
    zoneEl.dataset.bound = "1";

    zoneEl.addEventListener("click", (e) => {
      console.log("CLICOU NA ZONA:", z);
      
      // Se clicou na zona inimiga querendo atacar direto o banco
      if (z === "bancoEnemy" && selected && actionMode === "attack") {
        directAttackBancoEnemy(selected.zone, selected.index);
        actionMode = null;
        selected = null;
        hideCardMenu();
        return;
      }

      // Se clicou na zona vazia querendo mover a carta para cá
      if (actionMode === "move" && selected) {
        tryMoveToZone(z);
        actionMode = null;
        selected = null;
        hideCardMenu();
        return;
      }
    });
  });

  renderBoard();
}

function playHandToBanco(handIndex) {
  if (!isMyTurn()) {
    showWarning("Não é seu turno.");
    return;
  }

  if (!currentMatch?.id) {
    showWarning("Partida não encontrada.");
    return;
  }

  const card = playerHand[handIndex];
  if (!card) {
    showWarning("Carta inválida.");
    return;
  }

  // carta de efeito
  if (card.cardClass === "effect") {
    playEffectFromHand(handIndex);
    return;
  }

  // unidade
  socket.emit("play_card_to_bench", {
    matchId: currentMatch.id,
    playerId: currentPlayer.id,
    handIndex: handIndex
  });
}

// =============================
// TURNOS ONLINE
// =============================
function updateTurnUIOnline(match) {
  const turnDisplay = document.getElementById("turn-display");
  if (!turnDisplay) return;

  const isMyTurn = match.turnPlayerId === currentPlayer?.id;

  console.log("UI TURN CHECK");
  console.log("match.turnPlayerId:", match.turnPlayerId);
  console.log("socket.id:", socket.id);
  console.log("isMyTurnNow:", isMyTurn);

  const turnNumberOnline = match.turnNumber || 1;

  turnDisplay.textContent = isMyTurn
    ? `Seu turno (${turnNumberOnline})`
    : `Turno do adversário (${turnNumberOnline})`;
}

// =============================
// PREPARAR ÁREA DAS ZONAS
// =============================
function prepareZoneContainer(zoneElement) {
  if (!zoneElement) return null;

  let cardsContainer = zoneElement.querySelector(".card-zone");

  if (!cardsContainer) {
    cardsContainer = document.createElement("div");
    cardsContainer.className = "card-zone";
    zoneElement.appendChild(cardsContainer);
  }

  cardsContainer.innerHTML = "";
  return cardsContainer;
}

// =============================
// VER SE É MEU TURNO
// =============================
function isMyTurn() {
  if (currentMatch && currentMatch.turnPlayerId && currentPlayer?.id) {
    return currentMatch.turnPlayerId === currentPlayer.id;
  }

  return currentTurn === "player";
}

// =============================
// PEGAR CUSTO DE INVOCAR
// =============================
function getSummonCost(card) {
  return Math.max(0, card?.cost || 0);
}

// =============================
// BADGE DO TIPO
// =============================
const TYPE_META = {
  Pusher: { color: "#7CFF5B", icon: "♦" },
  Juggernaut: { color: "#FF3B3B", icon: "⬟" },
  Equalizer: { color: "#4DA3FF", icon: "▲" },
  Effect: { color: "#FFD54A", icon: "▣" }
};

function typeBadgeHTML(type) {
  const meta = TYPE_META[type] || { color: "#fff", icon: "?" };

  return `
    <div class="type-badge" style="border-color:${meta.color}; color:${meta.color}">
      <span class="type-icon">${meta.icon}</span>
      <span class="type-text">${type || "Carta"}</span>
    </div>
  `;
}

// =============================
// RARIDADE CSS
// =============================
function getRarityClass(card) {
  const rarity = String(card?.rarity || card?.raridade || "Básico")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (rarity === "basico") return "rarity-basico";
  if (rarity === "comum") return "rarity-comum";
  if (rarity === "especial") return "rarity-especial";
  if (rarity === "extraordinario") return "rarity-extraordinario";
  if (rarity === "elite") return "rarity-elite";

  return "rarity-basico";
}

// =============================
// HTML DA CARTA
// =============================
function getCardHTML(card, options = {}) {
  const summonCost = options.summonCost ?? card.cost ?? 0;
  const showSummon = options.showSummon ?? false;
  const showAttack = options.showAttack ?? true;
  const atkCost = card.attackCost ?? 0;

  if (card.cardClass === "effect") {
    return `
      <div class="card-inner card-effect ${getRarityClass(card)}">
        <div class="card-name">${card.name}</div>
        <div class="card-emoji">${card.emoji || "✨"}</div>
        ${typeBadgeHTML(card.type || "Effect")}
        <div class="card-effect-text">${card.text || "Carta de efeito."}</div>

        <div class="card-costs">
          <span class="cost-badge cost-summon">🔵 ${summonCost}</span>
          <span class="cost-badge cost-attack ${atkCost === 0 ? "zero" : ""}">🔥 ${atkCost}</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="card-inner ${getRarityClass(card)}">
      <div class="card-name">${card.name}</div>
      <div class="card-emoji">${card.emoji || "🃏"}</div>
      ${typeBadgeHTML(card.type || "Unidade")}

      <div class="card-stats">
        <span class="stat-badge stat-atk"><span>⚔</span><span>${card.attack ?? 0}</span></span>
        <span class="stat-badge stat-def"><span>🛡</span><span>${card.defense ?? 0}</span></span>
      </div>

      <div class="card-costs">
        ${showSummon ? `<span class="cost-badge cost-summon">🔵 ${summonCost}</span>` : ""}
        ${showAttack ? `<span class="cost-badge cost-attack ${atkCost === 0 ? "zero" : ""}">🔥 ${atkCost}</span>` : ""}
      </div>
    </div>
  `;
}


// =============================
// MENU DA CARTA (Campo)
// =============================
const btnCancel = document.getElementById("cancel-btn");
const btnMove = document.getElementById("move-btn");
const btnAttack = document.getElementById("attack-btn");
const btnEffect = document.getElementById("effect-btn");
const btnInfo = document.getElementById("info-btn");



let menuTarget = null;

function showCardMenu(x, y, zone, index) {
  const menu = document.getElementById("card-menu");
  if (!menu) return;

  console.log("showCardMenu chamado");

  menu.style.position = "fixed";
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.style.display = "flex";
  menu.style.zIndex = "99999";
  menu.classList.remove("hidden");

  menuTarget = { zone, index };
}

function hideCardMenu() {
  const menu = document.getElementById("card-menu");
  if (menu) {
    menu.style.display = "none";
    menu.classList.add("hidden");
  }

  menuTarget = null;
}

// =============================
// MENU DA CARTA NA MÃO
// =============================
const handCardMenu = document.getElementById("hand-card-menu");
const handPlayBtn = document.getElementById("hand-play-btn");
const handInfoBtn = document.getElementById("hand-info-btn");
const handCancelBtn = document.getElementById("hand-cancel-btn");

let handMenuTarget = null;

function showHandCardMenu(x, y, handIndex) {
  if (!handCardMenu) return;

  handCardMenu.style.left = `${x}px`;
  handCardMenu.style.top = `${y}px`;
  handCardMenu.style.display = "flex";
  handCardMenu.classList.remove("hidden");

  handMenuTarget = { handIndex };
}

function hideHandCardMenu() {
  if (!handCardMenu) return;

  handCardMenu.style.display = "none";
  handCardMenu.classList.add("hidden");
  handMenuTarget = null;
}

if (handPlayBtn) {
  handPlayBtn.onclick = () => {
    if (!handMenuTarget) return;

    const handIndex = handMenuTarget.handIndex;
    const card = playerHand[handIndex];
    if (!card) {
      hideHandCardMenu();
      return;
    }

    if (card.cardClass === "effect") {
      playEffectFromHand(handIndex);
    } else {
      playHandToBanco(handIndex);
    }

    hideHandCardMenu();
  };
}

if (handInfoBtn) {
  handInfoBtn.onclick = () => {
    if (!handMenuTarget) return;

    const card = playerHand[handMenuTarget.handIndex];
    if (!card) {
      hideHandCardMenu();
      return;
    }

    openDeckCardInfo(card);
    hideHandCardMenu();
  };
}

if (handCancelBtn) {
  handCancelBtn.onclick = () => {
    hideHandCardMenu();
  };
}

// =============================
// RENDER DA MÃO
// =============================
function renderHand() {
  if (!playerHandElement) return;

  playerHandElement.innerHTML = "";

  playerHand.forEach((c, idx) => {
    const summonCost = getSummonCost(c);

    const el = document.createElement("div");
    el.className = "card hand-card";
    el.dataset.handIndex = idx;

    el.innerHTML = getCardHTML(c, {
      showSummon: true,
      showAttack: c.cardClass !== "effect",
      summonCost
    });

    el.addEventListener("click", (e) => {
      e.stopPropagation();

      // se estiver esperando alvo, não abre menu da mão
      if (waitingEffectTarget) {
        showWarning("Escolha uma unidade alvo no campo.");
        return;
      }

      // effect
      if (c.cardClass === "effect") {
        showHandCardMenu(e.clientX, e.clientY, idx);
        return;
      }

      // unidade
      showHandCardMenu(e.clientX, e.clientY, idx);
    });

    playerHandElement.appendChild(el);
  });
}


// =============================
// RENDER DO CAMPO
// =============================
function renderBoard() {
  ZONES.forEach(zone => {
    const zoneEl = document.getElementById(zone);
    if (!zoneEl) return;

    const wrap = prepareZoneContainer(zoneEl);
    if (!wrap) return;

    wrap.innerHTML = "";

    board[zone].forEach((obj, idx) => {
      const c = obj.card;
      if (!c) return;

      const el = document.createElement("div");
      el.className = "card";

      if (selected && selected.zone === zone && selected.index === idx) {
        el.classList.add("selected");
      }

      const summonCost = getSummonCost(c);

      el.innerHTML = getCardHTML(c, {
        showSummon: c.cardClass !== "effect",
        showAttack: c.cardClass !== "effect",
        summonCost
      });

      el.addEventListener("click", (e) => {
        e.stopPropagation();

        if (waitingEffectTarget) {
          tryUseEffectOnTarget(zone, idx);
          return;
        }

        // Verifica o dono da carta baseado no socket.id
        const isMyCard = obj.owner === socket.id;
        const isEnemyCard = obj.owner !== socket.id;

        // SE FOR CARTA INIMIGA E EU ESTIVER ATACANDO:
        if (isEnemyCard && selected && actionMode === "attack") {
          console.log(`Atacando unidade inimiga na zona ${zone}, index ${idx}`);
          attackUnit(selected.zone, selected.index, zone, idx);
          actionMode = null;
          selected = null;
          renderBoard();
          return;
        }

        // SE FOR MINHA CARTA: Abre o menu de opções
        if (isMyCard) {
          if (!isMyTurn()) {
            showWarning("Não é seu turno.");
            return;
          }
          showCardMenu(e.clientX, e.clientY, zone, idx);
        }
      });

      wrap.appendChild(el);
    });
  });
}
// =============================
// RENDER GERAL
// =============================
function renderAll() {
  renderHand();
  renderBoard();
}

// =============================
// AÇÕES PLACEHOLDER
// =============================
function tryMoveToZone(targetZone) {
  console.log("tryMoveToZone chamado");
  console.log("targetZone:", targetZone);
  console.log("selected:", selected);
  console.log("currentMatch:", currentMatch);

  if (!selected || !currentMatch?.id) return;

  if (!isMyTurn()) {
    showWarning("Não é seu turno.");
    return;
  }

  socket.emit("move_card", {
    matchId: currentMatch.id,
    fromZone: selected.zone,
    fromIndex: selected.index,
    toZone: targetZone,
    playerId: currentPlayer.id
  });

  console.log("Evento move_card enviado");
}

function attackUnit(fromZone, fromIndex, targetZone, targetIndex) {
  if (!currentMatch?.id) return;

  if (!isMyTurn()) {
    showWarning("Não é seu turno.");
    return;
  }

  socket.emit("attack_card", {
    matchId: currentMatch.id,
    fromZone,
    fromIndex,
    targetZone,
    targetIndex,
    playerId: currentPlayer.id
  });
}

function directAttackBancoEnemy(fromZone, fromIndex) {
  if (!currentMatch?.id) return;

  if (!isMyTurn()) {
    showWarning("Não é seu turno.");
    return;
  }

  socket.emit("direct_attack", {
    matchId: currentMatch.id,
    fromZone,
    fromIndex,
    playerId: currentPlayer.id
  });
}
// =============================
// ELEMENTOS DO MENU DA CARTA
// =============================


// =============================
// MODAL DE INFO
// =============================
const cardInfoModal = document.getElementById("card-info-modal");
const cardInfoContent = document.getElementById("card-info-content");
const closeCardInfo = document.getElementById("close-card-info");

function openDeckCardInfo(card) {
  if (!card || !cardInfoModal || !cardInfoContent) return;

  cardInfoContent.innerHTML = `
    <h2>${card.emoji || "🃏"} ${card.name || "Carta"}</h2>
    <p><strong>Tipo:</strong> ${card.type || "-"}</p>
    <p><strong>Raridade:</strong> ${card.rarity || card.raridade || "-"}</p>
    <p><strong>Custo:</strong> ${card.cost ?? "-"}</p>
    <p><strong>Custo de ataque:</strong> ${card.attackCost ?? "-"}</p>
    <p><strong>Ataque:</strong> ${card.attack ?? "-"}</p>
    <p><strong>Defesa:</strong> ${card.defense ?? "-"}</p>
    <p><strong>Descrição:</strong> ${card.text || "Sem descrição."}</p>
  `;

  cardInfoModal.classList.remove("hidden");
}

function openCardInfo(card) {
  openDeckCardInfo(card);
}

function closeCardInfoModal() {
  if (!cardInfoModal) return;
  cardInfoModal.classList.add("hidden");
}

if (closeCardInfo) {
  closeCardInfo.onclick = closeCardInfoModal;
}

if (cardInfoModal) {
  cardInfoModal.addEventListener("click", (e) => {
    if (e.target === cardInfoModal) {
      closeCardInfoModal();
    }
  });
}

// =============================
// MENU DA CARTA - BOTÕES
// =============================
// =============================
// MENU DA CARTA - BOTÕES CORRIGIDOS
// =============================
if (btnCancel) {
  btnCancel.onclick = () => {
    actionMode = null;
    selected = null;
    hideCardMenu();
    renderBoard();
  };
}

if (btnMove) {
  btnMove.onclick = () => {
    if (!menuTarget) return;

    actionMode = "move";
    selected = { ...menuTarget }; // Salva a carta de origem selecionada
    hideCardMenu();
    renderBoard();

    showWarning("🔵 Clique em uma zona válida para mover");
  };
}

if (btnAttack) {
  btnAttack.onclick = () => {
    if (!menuTarget) return;

    actionMode = "attack";
    selected = { ...menuTarget }; // Salva a carta atacante selecionada
    hideCardMenu();
    renderBoard();

    showWarning("⚔ Clique em uma carta inimiga ou no Banco Inimigo para atacar");
  };
}

// =============================
// FECHAR MENU CLICANDO FORA
// =============================
document.addEventListener("click", (e) => {
  const fieldMenu = document.getElementById("card-menu");

  if (
    fieldMenu &&
    fieldMenu.style.display === "flex" &&
    !e.target.closest("#card-menu") &&
    !e.target.closest(".card")
  ) {
    hideCardMenu();
  }

  if (
    handCardMenu &&
    handCardMenu.style.display === "flex" &&
    !e.target.closest("#hand-card-menu") &&
    !e.target.closest(".hand-card")
  ) {
    hideHandCardMenu();
  }
});

// =============================
// PE UI
// =============================
function updatePEUI() {
  const manaText = document.getElementById("mana-text");
  const manaFill = document.getElementById("mana-fill");

  if (manaText) {
    manaText.textContent = `${playerPE}/${maxPE}`;
  }

  if (manaFill) {
    const percent = maxPE > 0 ? (playerPE / maxPE) * 100 : 0;
    manaFill.style.width = `${percent}%`;
  }
}

// =============================
// VIDA UI
// =============================
function updateLifeUI() {
  const playerLifeText = document.getElementById("player-life-text");
  const enemyLifeText = document.getElementById("enemy-life-text");

  const playerLifeBar = document.getElementById("player-life-bar");
  const enemyLifeBar = document.getElementById("enemy-life-bar");

  if (playerLifeText) playerLifeText.textContent = playerLife;
  if (enemyLifeText) enemyLifeText.textContent = enemyLife;

  if (playerLifeBar) {
    playerLifeBar.style.width = `${(playerLife / 4) * 100}%`;
  }

  if (enemyLifeBar) {
    enemyLifeBar.style.width = `${(enemyLife / 4) * 100}%`;
  }
}


// =============================
// UPDATE PE ONLINE
// =============================
function updateOnlinePE(match) {
  if (!match || !currentPlayer) return;

  const me = match.players.find((p) => p.player.id === currentPlayer.id);
  const enemy = match.players.find((p) => p.player.id !== currentPlayer.id);

  if (me) {
    playerPE = me.pe || 0;
    maxPE = me.maxPE || 0;
  }

  if (me) {
    playerLife = me.life ?? playerLife;
  }

  if (enemy) {
    enemyLife = enemy.life ?? enemyLife;
  }

  updatePEUI();
  updateLifeUI();
}

// =============================
// MATCH UPDATE (GARANTE O CERTO)
// =============================
socket.off("match_update");

socket.off("match_update");

socket.on("match_update", (match) => {
  console.log("MATCH_UPDATE recebido");
  console.log("match.turnPlayerId:", match.turnPlayerId);
  console.log("currentPlayer.id:", currentPlayer?.id);
  currentMatch = match;

  board = match.board || {
    bancoPlayer: [],
    campo1: [],
    campo2: [],
    bancoEnemy: []
  };

  playerHand = Array.isArray(match.playerHand) ? match.playerHand : [];
  enemyHand = [];

  graveyardPlayer = Array.isArray(match.graveyards?.player) ? match.graveyards.player : [];
  graveyardEnemy = Array.isArray(match.graveyards?.enemy) ? match.graveyards.enemy : [];

  updateGraveyardUI();
  updateOnlinePE(match);
  updateTurnUIOnline(match);

  syncGlobals();
  renderAll();
});

// =============================
// OPPONENT LEFT
// =============================
socket.on("match_finished", (data) => {
  alert(data?.message || "A partida foi encerrada.");
  currentMatch = null;
  showScreen("start-screen");
});

socket.on("opponent_left", (data) => {
  alert(data?.message || "O adversário saiu da partida.");
  showScreen("start-screen");
});
// =============================
// DECK / COLEÇÃO CONFIG
// =============================
const MAX_DECK_SIZE = 20;

const DECK_LIMITS_BY_RARITY = {
  "Básico": 4,
  "Comum": 3,
  "Especial": 2,
  "Extraordinário": 1,
  "Elite": 1
};

// =============================
// ELEMENTOS DO DECK BUILDER
// =============================
const deckSearchInput = document.getElementById("deck-search");
const deckFilterRarity = document.getElementById("deck-filter-rarity");
const deckFilterType = document.getElementById("deck-filter-type");
const deckFilterOwned = document.getElementById("deck-filter-owned");

const deckCardsDropZone = document.getElementById("deck-cards");
const autoBuildBtn = document.getElementById("auto-build-btn");
const clearDeckBtn = document.getElementById("clear-deck-btn");
const saveDeckBtn = document.getElementById("save-deck-btn");

const openDeckBuilderBtn = document.getElementById("open-deck-builder");
const backToMenuDeckBtn = document.getElementById("back-to-menu-deck");

const deckActionMenu = document.getElementById("deck-action-menu");
const deckActionAdd = document.getElementById("deck-action-add");
const deckActionInfo = document.getElementById("deck-action-info");

let deckMenuCardId = null;
let deckMenuCardData = null;

// =============================
// SALVAR / CARREGAR
// =============================
function salvarDados() {
  localStorage.setItem("colecao", JSON.stringify(colecao));
  localStorage.setItem("decks", JSON.stringify(decks));
  localStorage.setItem("currentDeckIndex", String(currentDeckIndex));
}

function getOwnedCopies(cardId) {
  return Number(colecao[String(cardId)] || 0);
}

function getCopiesInDeck(cardId) {
  const deckAtual = getCurrentDeck();
  return deckAtual.filter(id => String(id) === String(cardId)).length;
}

function getNormalizedRarity(card) {
  const rarity = card?.rarity || card?.raridade || "Básico";

  if (rarity === "Basico") return "Básico";
  if (rarity === "Extraordinario") return "Extraordinário";

  return rarity;
}

function getCardType(card) {
  if (card?.type) return card.type;
  if (card?.cardType) return card.cardType;
  if (card?.cardClass === "effect") return "Effect";
  if (card?.cardClass === "unit") return card.type || "Unidade";
  return "Sem tipo";
}

// =============================
// REGRAS DO DECK
// =============================
function canAddCardToDeck(cardId) {
  const card = CARD_DB[cardId];
  const deckAtual = getCurrentDeck();

  if (!card) return false;

  if (deckAtual.length >= MAX_DECK_SIZE) {
    showWarning("Deck cheio!");
    return false;
  }

  const rarity = getNormalizedRarity(card);
  const limitByRarity = DECK_LIMITS_BY_RARITY[rarity] || 1;
  const copiesInDeck = getCopiesInDeck(cardId);
  const ownedCopies = getOwnedCopies(cardId);

  if (ownedCopies <= 0) {
    showWarning("Você não possui essa carta.");
    return false;
  }

  if (copiesInDeck >= ownedCopies) {
    showWarning("Você não tem mais cópias dessa carta.");
    return false;
  }

  if (copiesInDeck >= limitByRarity) {
    showWarning(`Limite de ${limitByRarity} cópia(s) para essa raridade.`);
    return false;
  }

  return true;
}

function addCardToDeck(cardId) {
  cardId = String(cardId);

  if (!canAddCardToDeck(cardId)) return;

  const deckAtual = getCurrentDeck();
  deckAtual.push(cardId);

  salvarDados();
  renderDeckBuilder();
}

function removeCardFromDeck(index) {
  const deckAtual = getCurrentDeck();

  if (index < 0 || index >= deckAtual.length) return;

  deckAtual.splice(index, 1);

  salvarDados();
  renderDeckBuilder();
}

function clearDeck() {
  if (!decks[currentDeckIndex]) return;

  decks[currentDeckIndex].cartas = [];
  salvarDados();
  renderDeckBuilder();
}

// =============================
// AUTO BUILD
// =============================
function autoBuildDeckFromCollection() {
  const novoDeck = [];
  const copiesInDeck = {};
  const cardIds = Object.keys(colecao).filter(id => CARD_DB[id]);

  if (cardIds.length === 0) {
    decks[currentDeckIndex].cartas = [];
    salvarDados();
    return;
  }

  while (novoDeck.length < MAX_DECK_SIZE) {
    const cartasValidas = cardIds.filter(cardId => {
      const card = CARD_DB[cardId];
      if (!card) return false;

      const owned = getOwnedCopies(cardId);
      const rarity = getNormalizedRarity(card);
      const limit = DECK_LIMITS_BY_RARITY[rarity] || 1;
      const inDeck = copiesInDeck[cardId] || 0;

      return inDeck < owned && inDeck < limit;
    });

    if (cartasValidas.length === 0) break;

    const randomId = cartasValidas[Math.floor(Math.random() * cartasValidas.length)];
    novoDeck.push(String(randomId));
    copiesInDeck[randomId] = (copiesInDeck[randomId] || 0) + 1;
  }

  novoDeck.sort(() => Math.random() - 0.5);

  decks[currentDeckIndex].cartas = novoDeck;
  salvarDados();
}

// =============================
// MENU DA CARTA DO BUILDER
// =============================
function showDeckActionMenu(x, y, cardId, cardData, isOwned = true) {
  if (!deckActionMenu) return;

  deckMenuCardId = String(cardId);
  deckMenuCardData = cardData;

  deckActionMenu.style.left = `${x}px`;
  deckActionMenu.style.top = `${y}px`;
  deckActionMenu.style.position = "fixed";
  deckActionMenu.style.zIndex = "99999";

  if (deckActionAdd) {
    if (isOwned) {
      deckActionAdd.style.display = "block";
      deckActionAdd.textContent = "➕ Colocar no deck";
      deckActionAdd.disabled = false;
    } else {
      deckActionAdd.style.display = "block";
      deckActionAdd.textContent = "🔒 Não possui";
      deckActionAdd.disabled = true;
    }
  }

  deckActionMenu.classList.remove("hidden");
}

function hideDeckActionMenu() {
  if (!deckActionMenu) return;

  deckActionMenu.classList.add("hidden");
  deckMenuCardId = null;
  deckMenuCardData = null;
}

if (deckActionAdd) {
  deckActionAdd.addEventListener("click", () => {
    if (deckMenuCardId) {
      addCardToDeck(deckMenuCardId);
    }
    hideDeckActionMenu();
  });
}

if (deckActionInfo) {
  deckActionInfo.addEventListener("click", () => {
    if (deckMenuCardData) {
      openDeckCardInfo(deckMenuCardData);
    }
    hideDeckActionMenu();
  });
}

document.addEventListener("click", (e) => {
  if (!deckActionMenu) return;
  if (deckActionMenu.classList.contains("hidden")) return;

  if (!e.target.closest(".builder-card") && !e.target.closest("#deck-action-menu")) {
    hideDeckActionMenu();
  }
});

// =============================
// RENDER COLEÇÃO PREVIEW
// =============================
function renderCollectionPreview() {
  const list = document.getElementById("collection-preview-list");
  if (!list) return;

  list.innerHTML = "";

  const ids = Object.keys(colecao);

  if (ids.length === 0) {
    list.innerHTML = "<p>Nenhuma carta ainda.</p>";
    return;
  }

  ids.forEach(id => {
    const card = CARD_DB[id];
    if (!card) return;

    const item = document.createElement("div");
    item.className = "collection-item";
    item.innerHTML = `
      <span>${card.name}</span>
      <span>x${colecao[id]}</span>
    `;
    list.appendChild(item);
  });
}

// =============================
// RENDER DECK BUILDER
// =============================
function renderDeckBuilder() {
  const deckAtual = getCurrentDeck();

  const collectionDiv = document.getElementById("collection-cards");
  const deckDiv = document.getElementById("deck-cards");
  const deckCountEl = document.getElementById("deck-count");
  const deckSelect = document.getElementById("deck-select");
  const deckNameInput = document.getElementById("deck-name-input");

  if (!collectionDiv || !deckDiv || !deckCountEl) return;

  if (deckSelect) {
    deckSelect.innerHTML = "";

    decks.forEach((d, index) => {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = d.nome;
      if (index === currentDeckIndex) option.selected = true;
      deckSelect.appendChild(option);
    });
  }

  if (deckNameInput && decks[currentDeckIndex]) {
    deckNameInput.value = decks[currentDeckIndex].nome;
  }

  const search = (deckSearchInput?.value || "").toLowerCase().trim();
  const selectedRarity = deckFilterRarity?.value || "all";
  const selectedType = deckFilterType?.value || "all";
  const selectedOwnedMode = deckFilterOwned?.value || "owned";

  collectionDiv.innerHTML = "";
  deckDiv.innerHTML = "";
  deckCountEl.textContent = `${deckAtual.length}/${MAX_DECK_SIZE}`;

  const sourceIds =
    selectedOwnedMode === "all"
      ? Object.keys(CARD_DB)
      : Object.keys(colecao);

  const collectionIds = sourceIds
    .filter(id => CARD_DB[id])
    .sort((a, b) => {
      const cardA = CARD_DB[a];
      const cardB = CARD_DB[b];
      return (cardA.name || "").localeCompare(cardB.name || "");
    });

  const filteredIds = collectionIds.filter(id => {
    const card = CARD_DB[id];
    if (!card) return false;

    const cardName = (card.name || "").toLowerCase();
    const rarity = getNormalizedRarity(card);
    const type = getCardType(card);

    const matchesSearch = !search || cardName.includes(search);
    const matchesRarity = selectedRarity === "all" || rarity === selectedRarity;
    const matchesType = selectedType === "all" || type === selectedType;

    return matchesSearch && matchesRarity && matchesType;
  });

  if (filteredIds.length === 0) {
    collectionDiv.innerHTML = `<div class="builder-card">Nenhuma carta encontrada.</div>`;
  }

  filteredIds.forEach(id => {
    const card = CARD_DB[id];
    const ownedCopies = getOwnedCopies(id);
    const copiesInDeck = getCopiesInDeck(id);
    const rarity = getNormalizedRarity(card);
    const type = getCardType(card);
    const limit = DECK_LIMITS_BY_RARITY[rarity] || 1;
    const isOwned = ownedCopies > 0;

    const el = document.createElement("div");
    el.className = "builder-card";
    el.draggable = isOwned;
    el.dataset.cardId = id;

    el.innerHTML = `
      <div class="builder-emoji">${card.emoji || "🃏"}</div>
      <div class="builder-name">${card.name}</div>
      <div class="builder-info">${rarity}</div>
      <div class="builder-info">${type}</div>
      <div class="builder-copies">
        Coleção: ${ownedCopies} | Deck: ${copiesInDeck}/${limit}
      </div>
    `;

    if (!isOwned) {
      el.style.opacity = "0.45";
      el.style.filter = "grayscale(0.85)";
    }

    el.addEventListener("click", (e) => {
      e.stopPropagation();
      showDeckActionMenu(e.clientX, e.clientY, id, card, isOwned);
    });

    if (isOwned) {
      el.addEventListener("dragstart", () => {
        el.classList.add("dragging");
      });

      el.addEventListener("dragend", () => {
        el.classList.remove("dragging");
      });
    }

    collectionDiv.appendChild(el);
  });

  const groupedDeck = {};

  deckAtual.forEach((cardId, index) => {
    const id = String(cardId);
    const card = CARD_DB[id];
    if (!card) return;

    if (!groupedDeck[id]) {
      groupedDeck[id] = {
        card,
        indexes: [],
        copies: 0
      };
    }

    groupedDeck[id].indexes.push(index);
    groupedDeck[id].copies++;
  });

  if (deckAtual.length === 0) {
    deckDiv.innerHTML = `<div class="builder-card">Arraste cartas aqui ou clique para montar.</div>`;
    return;
  }

  Object.keys(groupedDeck).forEach(id => {
    const entryData = groupedDeck[id];
    const card = entryData.card;
    const rarity = getNormalizedRarity(card);
    const type = getCardType(card);

    const entry = document.createElement("div");
    entry.className = "deck-entry";

    entry.innerHTML = `
      <div class="deck-entry-left">
        <div class="deck-entry-emoji">${card.emoji || "🃏"}</div>
        <div>
          <div class="deck-entry-name">${card.name} x${entryData.copies}</div>
          <div class="deck-entry-info">${rarity} • ${type}</div>
        </div>
      </div>

      <div class="deck-entry-controls">
        <button class="remove-one-btn">-</button>
        <button class="add-one-btn">+</button>
      </div>
    `;

    entry.querySelector(".remove-one-btn").addEventListener("click", () => {
      const lastIndex = entryData.indexes[entryData.indexes.length - 1];
      removeCardFromDeck(lastIndex);
    });

    entry.querySelector(".add-one-btn").addEventListener("click", () => {
      addCardToDeck(id);
    });

    deckDiv.appendChild(entry);
  });
}

// =============================
// EVENTOS DO DECK BUILDER
// =============================
if (openDeckBuilderBtn) {
  openDeckBuilderBtn.onclick = () => {
    showScreen("deck-screen");
    renderDeckBuilder();
  };
}

if (backToMenuDeckBtn) {
  backToMenuDeckBtn.onclick = () => {
    showScreen("start-screen");
  };
}

if (deckSearchInput) {
  deckSearchInput.addEventListener("input", renderDeckBuilder);
}

if (deckFilterRarity) {
  deckFilterRarity.addEventListener("change", renderDeckBuilder);
}

if (deckFilterType) {
  deckFilterType.addEventListener("change", renderDeckBuilder);
}

if (deckFilterOwned) {
  deckFilterOwned.addEventListener("change", renderDeckBuilder);
}

if (deckCardsDropZone) {
  deckCardsDropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    deckCardsDropZone.classList.add("drag-over");
  });

  deckCardsDropZone.addEventListener("dragleave", () => {
    deckCardsDropZone.classList.remove("drag-over");
  });

  deckCardsDropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    deckCardsDropZone.classList.remove("drag-over");

    const draggingCard = document.querySelector(".builder-card.dragging");
    if (!draggingCard) return;

    const cardId = draggingCard.dataset.cardId;
    if (!cardId) return;

    addCardToDeck(cardId);
  });
}

if (autoBuildBtn) {
  autoBuildBtn.onclick = () => {
    autoBuildDeckFromCollection();
    renderDeckBuilder();
    showWarning("Deck automático criado!");
  };
}

if (clearDeckBtn) {
  clearDeckBtn.onclick = () => {
    clearDeck();
    showWarning("Deck limpo!");
  };
}

if (saveDeckBtn) {
  saveDeckBtn.onclick = () => {
    const deckAtual = getCurrentDeck();

    if (deckAtual.length !== MAX_DECK_SIZE) {
      showWarning(`O deck precisa ter ${MAX_DECK_SIZE} cartas.`);
      return;
    }

    salvarDados();
    showWarning("Deck salvo!");
  };
}

// =============================
// TROCAR NOME / TROCAR DECK
// =============================
const deckSelect = document.getElementById("deck-select");
const deckNameInput = document.getElementById("deck-name-input");
const newDeckBtn = document.getElementById("new-deck-btn");
const deleteDeckBtn = document.getElementById("delete-deck-btn");

if (deckSelect) {
  deckSelect.addEventListener("change", (e) => {
    currentDeckIndex = Number(e.target.value || 0);
    salvarDados();
    renderDeckBuilder();
  });
}

if (deckNameInput) {
  deckNameInput.addEventListener("input", (e) => {
    if (!decks[currentDeckIndex]) return;
    decks[currentDeckIndex].nome = e.target.value || `Deck ${currentDeckIndex + 1}`;
    salvarDados();
    renderDeckBuilder();
  });
}

if (newDeckBtn) {
  newDeckBtn.addEventListener("click", () => {
    decks.push({
      nome: `Deck ${decks.length + 1}`,
      cartas: []
    });

    currentDeckIndex = decks.length - 1;
    salvarDados();
    renderDeckBuilder();
  });
}

if (deleteDeckBtn) {
  deleteDeckBtn.addEventListener("click", () => {
    if (decks.length <= 1) {
      showWarning("Você precisa ter pelo menos 1 deck.");
      return;
    }

    decks.splice(currentDeckIndex, 1);
    currentDeckIndex = Math.max(0, currentDeckIndex - 1);

    salvarDados();
    renderDeckBuilder();
  });
}
// =============================
// ELEMENTOS MENU / PLAYER
// =============================
const playerNicknameEl = document.getElementById("player-nickname");
const logoutBtn = document.getElementById("logout-btn");
const switchAccountBtn = document.getElementById("switch-account-btn");

const openRollBtn = document.getElementById("open-roll-btn");
const backToMenuBtn = document.getElementById("back-to-menu-btn");
const rollOnceBtn = document.getElementById("roll-once-btn");
const rollTenBtn = document.getElementById("roll-ten-btn");

const roll10Modal = document.getElementById("roll10-modal");
const closeRoll10ModalBtn = document.getElementById("close-roll10-modal");

// =============================
// FUNÇÃO PRA SABER SE A CARTA PRECISA ALVO
// =============================
function effectNeedsTarget(card) {
  if (!card || card.cardClass !== "effect") return false;

  const targetEffects = [
    "blackLuna",
    "dealDamageToEnemy",
    "buffDefense400",
    "equalizeUnitStats",
    "reapStrike"
  ];

  return (card.effects || []).some(effect => targetEffects.includes(effect.id));
}

// =============================
// FUNÇÃO PRA JOGAR CARTA DE EFEITO
// =============================

function playEffectFromHand(handIndex) {
  const card = currentMatch?.playerHand?.[handIndex] || playerHand[handIndex];
  if (!card) return;

  if (card.cardClass !== "effect") return;

  const needsTarget = effectNeedsTarget(card);

  if (!needsTarget) {
    socket.emit("play_effect_card", {
      matchId: currentMatch.id,
      handIndex,
      targetZone: null,
      targetIndex: null,
      playerId: currentPlayer.id
    });

    selectedEffectIndex = null;
    waitingEffectTarget = false;
    return;
  }

  selectedEffectIndex = handIndex;
  waitingEffectTarget = true;

  showWarning("Escolha uma unidade alvo.");
}

// =============================
// FUNÇÃO PRA CLICAR NUM ALVO DO CAMPO
// =============================
function tryUseEffectOnTarget(zone, index) {
  if (!waitingEffectTarget) return;
  if (!currentMatch?.id) return;

  socket.emit("play_effect_card", {
    matchId: currentMatch.id,
    handIndex: selectedEffectIndex,
    targetZone: zone,
    targetIndex: index,
    playerId: currentPlayer.id
  });

  selectedEffectIndex = null;
  waitingEffectTarget = false;
}


// =============================
// API HELPERS
// =============================
async function apiRequest(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json();
  return data;
}

async function getMe(token) {
  return apiRequest(`${FRONTEND_SOCKET_BASE_URL}/me`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

async function getFullCollection(token) {
  return apiRequest(`${FRONTEND_SOCKET_BASE_URL}/collection/full`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

async function rollCardFromServer(token) {
  return apiRequest(`${FRONTEND_SOCKET_BASE_URL}/roll`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

async function rollTenCardsFromServer(token) {
  return apiRequest(`${FRONTEND_SOCKET_BASE_URL}/roll/10`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

// =============================
// PLAYER UI
// =============================
function updatePlayerUI() {
  const player = JSON.parse(localStorage.getItem("player"));

  if (playerNicknameEl) {
    playerNicknameEl.textContent = player?.username || "Visitante";
  }
}

function logoutPlayer() {
  localStorage.removeItem("player");
  localStorage.removeItem("token");

  currentPlayer = null;
  colecao = {};

  window.location.href = "login.html";
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", logoutPlayer);
}

if (switchAccountBtn) {
  switchAccountBtn.addEventListener("click", logoutPlayer);
}

// =============================
// SYNC PLAYER
// =============================
let rollsDisponiveis = 0;

function updateRollUI() {
  const el = document.getElementById("rolls-left");
  if (!el) return;

  el.textContent = `Rolls restantes: ${rollsDisponiveis}`;
}

async function syncPlayerFromServer() {
  const token = localStorage.getItem("token");
  if (!token) return;

  try {
    const result = await getMe(token);

    if (result?.player) {
      currentPlayer = result.player;
      rollsDisponiveis = result.player.rolls || 0;

      localStorage.setItem("player", JSON.stringify(result.player));

      updatePlayerUI();
      updateRollUI();
    }
  } catch (error) {
    console.error("Erro ao sincronizar player:", error);
  }
}

// =============================
// CARREGAR COLEÇÃO
// =============================
async function loadCollectionFromServer() {
  const token = localStorage.getItem("token");
  if (!token) return;

  try {
    const result = await getFullCollection(token);

    if (result.error) {
      console.error("Erro ao buscar coleção:", result.error);
      return;
    }

    colecao = {};

    if (Array.isArray(result.cards)) {
      result.cards.forEach(card => {
        if (card && card.id) {
          colecao[String(card.id)] = card.quantity || 0;
        }
      });
    }

    salvarDados();
    renderCollectionPreview();
    renderDeckBuilder();
  } catch (error) {
    console.error("Erro ao carregar coleção do servidor:", error);
  }
}

async function unlockAllForTest() {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Faça login primeiro.");
    return;
  }

  try {
    const res = await fetch(`${FRONTEND_SOCKET_BASE_URL}/debug/unlock-all`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Erro ao liberar cartas.");
      return;
    }

    alert("🔥 Todas as cartas desbloqueadas!");
    await syncPlayerFromServer();
    await loadCollectionFromServer();
    renderCollectionPreview();
    renderDeckBuilder();
  } catch (error) {
    console.error("Erro:", error);
    alert("Erro ao conectar com o servidor.");
  }
}

// =============================
// ROLL
// =============================
function renderRollResult(card) {
  const box = document.getElementById("roll-result-card");
  if (!box || !card) return;

  const finalCard = {
    ...card,
    defense: card.defense ?? card.health ?? 0,
    rarity: card.rarity || card.raridade || "Básico"
  };

  box.innerHTML = `
    <div class="card big-roll-card">
      ${getCardHTML(finalCard, {
    showSummon: finalCard.cardClass !== "effect",
    showAttack: finalCard.cardClass !== "effect",
    summonCost: finalCard.cost ?? 0
  })}
    </div>
  `;
}

function getRarityClassName(rarity) {
  const value = String(rarity || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (value === "basico" || value === "basica") return "rarity-basico";
  if (value === "comum") return "rarity-comum";
  if (value === "especial") return "rarity-especial";
  if (value === "extraordinario" || value === "estraordinario") return "rarity-extraordinario";
  if (value === "elite") return "rarity-elite";

  return "rarity-basico";
}

function showRoll10Cards(cards) {
  const modal = document.getElementById("roll10-modal");
  const grid = document.getElementById("roll10-cards");

  if (!modal || !grid) return;

  grid.innerHTML = "";

  cards.forEach((card, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "roll10-pack-card";

    const rarityClass = getRarityClassName(card.rarity);

    wrapper.innerHTML = `
      <div class="roll10-pack-inner ${rarityClass}" data-revealed="false">
        <div class="roll10-pack-front">
          <div class="pack-back-symbol">✦</div>
        </div>

        <div class="roll10-pack-back">
          <div class="roll10-pack-emoji">${card.emoji || "🃏"}</div>
          <div class="roll10-pack-name">${card.name}</div>
          <div class="roll10-pack-rarity">${card.rarity}</div>
        </div>
      </div>
    `;

    const inner = wrapper.querySelector(".roll10-pack-inner");

    wrapper.addEventListener("click", () => {
      if (inner.dataset.revealed === "true") return;

      inner.dataset.revealed = "true";
      inner.classList.add("revealed");
    });

    setTimeout(() => {
      wrapper.classList.add("show");
    }, index * 90);

    grid.appendChild(wrapper);
  });

  modal.classList.remove("hidden");
}

async function rollCardOnline() {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Faça login primeiro.");
    return null;
  }

  try {
    const result = await rollCardFromServer(token);

    if (result.error) {
      alert(result.error);
      await syncPlayerFromServer();
      return null;
    }

    const card = result.card;
    if (!card) return null;

    rollsDisponiveis = result.remainingRolls ?? rollsDisponiveis;
    updateRollUI();

    await syncPlayerFromServer();
    await loadCollectionFromServer();

    return card;
  } catch (error) {
    console.error("Erro no roll online:", error);
    alert("Erro ao fazer roll.");
    return null;
  }
}

async function rollTenCardsOnline() {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Faça login primeiro.");
    return [];
  }

  try {
    const result = await rollTenCardsFromServer(token);

    if (result.error) {
      alert(result.error);
      await syncPlayerFromServer();
      return [];
    }

    rollsDisponiveis = result.remainingRolls ?? rollsDisponiveis;
    updateRollUI();

    await syncPlayerFromServer();
    await loadCollectionFromServer();

    return result.cards || [];
  } catch (error) {
    console.error("Erro no roll x10 online:", error);
    alert("Erro ao fazer 10 rolls.");
    return [];
  }
}

// =============================
// BOTÕES DA TELA ROLL
// =============================
if (openRollBtn) {
  openRollBtn.addEventListener("click", () => {
    showScreen("roll-screen");
    renderCollectionPreview();
    updateRollUI();
  });
}

if (backToMenuBtn) {
  backToMenuBtn.addEventListener("click", () => {
    showScreen("start-screen");
  });
}

if (rollOnceBtn) {
  rollOnceBtn.addEventListener("click", async () => {
    try {
      const card = await rollCardOnline();

      if (card) {
        renderRollResult(card);
        renderCollectionPreview();
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao fazer roll.");
    }
  });
}

if (rollTenBtn) {
  rollTenBtn.addEventListener("click", async () => {
    try {
      const cards = await rollTenCardsOnline();

      if (cards.length > 0) {
        showRoll10Cards(cards);
        renderCollectionPreview();
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao fazer 10 rolls.");
    }
  });
}

if (closeRoll10ModalBtn) {
  closeRoll10ModalBtn.addEventListener("click", () => {
    if (roll10Modal) {
      roll10Modal.classList.add("hidden");
    }
  });
}

if (roll10Modal) {
  roll10Modal.addEventListener("click", (e) => {
    if (e.target === roll10Modal) {
      roll10Modal.classList.add("hidden");
    }
  });
}

// =============================
// INICIALIZAÇÃO DA TELA
// =============================
window.addEventListener("load", async () => {
  updatePlayerUI();
  await syncPlayerFromServer();
  await loadCollectionFromServer();
  renderCollectionPreview();

  if (document.getElementById("deck-screen")) {
    renderDeckBuilder();
  }
});

// =============================
// PASSAR TURNO
// =============================
const endTurnBtn = document.getElementById("end-turn-btn");
const surrenderBtn = document.getElementById("surrender-btn");

function surrenderCurrentMatch() {
  if (!currentMatch?.id) {
    alert("Voce ainda nao esta em uma partida.");
    return;
  }

  if (!socket.connected || !socket.id) {
    alert("Conexao perdida com o servidor. Recarregue a pagina.");
    return;
  }

  socket.emit("surrender_match", {
    matchId: currentMatch.id,
    playerId: currentPlayer.id
  });
}

if (endTurnBtn) {
  endTurnBtn.addEventListener("click", () => {
    console.log("🔵 CLICOU EM PASSAR TURNO");
    console.log("Match atual:", currentMatch);
    console.log("Socket ID:", socket.id);
    console.log("Turno do match:", currentMatch?.turnPlayerId);

    if (!currentMatch?.id) {
      alert("❌ Você ainda não está em uma partida!");
      return;
    }

    if (!socket.connected || !socket.id) {
      alert("❌ Conexão perdida com o servidor. Recarregue a página.");
      return;
    }

    socket.emit("end_turn", {
      matchId: currentMatch.id,
      playerId: currentPlayer.id
    });

    console.log("📤 Evento end_turn enviado");
  });
}
// =============================
// CEMITÉRIO
// =============================
if (surrenderBtn) {
  surrenderBtn.addEventListener("click", surrenderCurrentMatch);
}

let graveyardPlayer = [];
let graveyardEnemy = [];
let graveHistory = [];

const graveModal = document.getElementById("graveyard-modal");
const graveCards = document.getElementById("graveyard-cards");
const graveTitle = document.getElementById("graveyard-title");

const openPlayerGrave = document.getElementById("open-player-grave");
const openEnemyGrave = document.getElementById("open-enemy-grave");
const closeGrave = document.getElementById("close-graveyard");

function updateGraveyardUI() {
  const p = document.getElementById("graveyard-player-count");
  const e = document.getElementById("graveyard-enemy-count");
  const playerGraveEl = document.getElementById("graveyard-player");
  const enemyGraveEl = document.getElementById("graveyard-enemy");

  if (p) p.textContent = graveyardPlayer.length;
  if (e) e.textContent = graveyardEnemy.length;

  if (playerGraveEl) {
    playerGraveEl.innerHTML = graveyardPlayer
      .map(c => `<div class="grave-card">${c.name}</div>`)
      .join("");
  }

  if (enemyGraveEl) {
    enemyGraveEl.innerHTML = graveyardEnemy
      .map(c => `<div class="grave-card">${c.name}</div>`)
      .join("");
  }
}

function openGraveyard(grave, title) {
  if (!graveModal || !graveCards || !graveTitle) return;

  graveModal.classList.remove("hidden");
  graveTitle.textContent = title;
  graveCards.innerHTML = "";

  if (!grave.length) {
    graveCards.innerHTML = "<p>Nenhuma carta no cemitério.</p>";
    return;
  }

  grave.forEach((card, i) => {
    const el = document.createElement("div");
    el.className = "card";

    el.innerHTML = `
      <div class="card-inner ${getRarityClass(card)}">
        <div class="card-name">${card.name}</div>
        <div class="card-emoji">${card.emoji || "🃏"}</div>
        <div class="card-stats">
          <span class="stat-badge stat-atk"><span>⚔</span><span>${card.attack ?? 0}</span></span>
          <span class="stat-badge stat-def"><span>🛡</span><span>${card.defense ?? 0}</span></span>
        </div>
        <div class="card-costs">
          <span class="cost-badge cost-summon">#${i + 1}</span>
        </div>
      </div>
    `;

    graveCards.appendChild(el);
  });
}

if (openPlayerGrave) {
  openPlayerGrave.onclick = () => openGraveyard(graveyardPlayer, "Seu Cemitério");
}

if (openEnemyGrave) {
  openEnemyGrave.onclick = () => openGraveyard(graveyardEnemy, "Cemitério do Inimigo");
}

if (closeGrave) {
  closeGrave.onclick = () => {
    if (graveModal) graveModal.classList.add("hidden");
  };
}

if (graveModal) {
  graveModal.addEventListener("click", (e) => {
    if (e.target === graveModal) {
      graveModal.classList.add("hidden");
    }
  });
}

// =============================
// ANIMAÇÃO DE MORTE
// =============================
function animateCardToGraveyard(cardElement, isPlayer) {
  if (!cardElement) return;

  const graveBtn = isPlayer
    ? document.getElementById("open-player-grave")
    : document.getElementById("open-enemy-grave");

  if (!graveBtn) return;

  const rectCard = cardElement.getBoundingClientRect();
  const rectGrave = graveBtn.getBoundingClientRect();

  const clone = cardElement.cloneNode(true);
  clone.classList.add("card-death-animation");

  clone.style.position = "fixed";
  clone.style.left = rectCard.left + "px";
  clone.style.top = rectCard.top + "px";
  clone.style.width = rectCard.width + "px";
  clone.style.height = rectCard.height + "px";
  clone.style.zIndex = "99999";
  clone.style.pointerEvents = "none";

  document.body.appendChild(clone);

  requestAnimationFrame(() => {
    clone.style.left = rectGrave.left + "px";
    clone.style.top = rectGrave.top + "px";
    clone.style.transform = "scale(0.2)";
    clone.style.opacity = "0";
  });

  setTimeout(() => {
    clone.remove();
  }, 700);
}

function animateHandCardToGraveyard(handCardElement, isPlayer = true) {
  animateCardToGraveyard(handCardElement, isPlayer);
}

// =============================
// ENVIAR PARA O CEMITÉRIO
// =============================

function sendToGraveyard(unit) {
  if (!unit || !unit.card) return;

  const deadCard = structuredClone(unit.card);
  deadCard.__lastOwner = unit.owner;

  graveHistory.unshift({
    card: deadCard,
    turn: turnNumber,
    owner: unit.owner
  });

  const isPlayerUnit =
    unit.owner === "player" ||
    unit.owner === socket.id ||
    unit.owner === currentPlayer?.id;

  if (isPlayerUnit) {
    graveyardPlayer.push(deadCard);
  } else {
    graveyardEnemy.push(deadCard);
  }

  updateGraveyardUI();
}

function cleanupDeadUnits() {
  Object.keys(board).forEach(zone => {
    const survivors = [];

    board[zone].forEach(unit => {
      if (!unit || !unit.card) return;

      if ((unit.card.defense ?? 0) <= 0) {
        sendToGraveyard(unit);
      } else {
        survivors.push(unit);
      }
    });

    board[zone] = survivors;
  });

  syncGlobals();
  renderAll();
}

// =============================
// NORMALIZAR CARTAS
// =============================
function normalizeCardStats(card) {
  if (!card) return card;

  if (card.defense == null && card.health != null) {
    card.defense = card.health;
  }

  if (card.rarity == null && card.raridade != null) {
    card.rarity = card.raridade;
  }

  return card;
}

// =============================
// PLACEHOLDERS DE EFEITOS
// =============================
const EFFECTS = window.EFFECTS || {};
const CARD_DB = window.CARD_DB || {};

function runEffects(card, trigger, ctx = {}) {
  if (!card || !card.effects) return true;

  for (const effect of card.effects) {
    if (typeof effect === "string") continue;
    if (effect.trigger !== trigger) continue;

    const fn = EFFECTS?.[effect.id];
    if (fn) {
      fn({ ...ctx, card }, effect);
    }
  }

  return true;
}

// =============================
// GLOBAIS FINAIS
// =============================
function syncGlobals() {
  window.board = board;
  window.playerHand = playerHand;
  window.enemyHand = enemyHand;
  window.playerPE = playerPE;
  window.maxPE = maxPE;
  window.playerLife = playerLife;
  window.enemyLife = enemyLife;
  window.turnNumber = turnNumber;
  window.graveyardPlayer = graveyardPlayer;
  window.graveyardEnemy = graveyardEnemy;
  window.showWarning = showWarning;
  window.cleanupDeadUnits = cleanupDeadUnits;
  window.runEffects = runEffects;
}

// =============================
// FECHAR MENU DE CARTA AO CLICAR FORA
// =============================
document.addEventListener("click", (e) => {
  const menu = document.getElementById("card-menu");
  if (!menu) return;
  if (menu.style.display !== "flex") return;

  if (!e.target.closest("#card-menu") && !e.target.closest(".card")) {
    hideCardMenu();
  }
});

// =============================
// MENSAGEM DE DEBUG INICIAL
// =============================
console.log("Script carregado até Parte 6");