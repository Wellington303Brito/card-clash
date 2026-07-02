// Removendo a checagem temporariamente para testar direto no Netlify
const FRONTEND_API_BASE_URL = "https://card-clash-backend.onrender.com";

async function apiRequest(endpoint, method = "GET", body = null, token = null) {
  // ✨ CORREÇÃO: Criando o objeto headers antes de usá-lo!
  const headers = {
    "Content-Type": "application/json"
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  console.log("CHAMANDO:", `${FRONTEND_API_BASE_URL}${endpoint}`, options);

  const response = await fetch(`${FRONTEND_API_BASE_URL}${endpoint}`, options);

  let data;
  try {
    data = await response.json();
  } catch {
    data = { error: "Resposta inválida do servidor." };
  }

  console.log("STATUS:", response.status);
  console.log("RESPOSTA:", data);

  if (!response.ok) {
    throw new Error(
      data.details || data.error || data.message || "Erro na requisição"
    );
  }

  return data;
}



// =============================
// AUTH
// =============================
async function registerPlayer(username, email, password) {
  return await apiRequest("/register", "POST", {
    username,
    email,
    password
  });
}

async function loginPlayer(email, password) {
  return await apiRequest("/login", "POST", {
    email,
    password
  });
}

async function getMe(token) {
  return await apiRequest("/me", "GET", null, token);
}

// =============================
// COLLECTION
// =============================
async function getCollection(token) {
  return await apiRequest("/collection", "GET", null, token);
}

async function getFullCollection(token) {
  return await apiRequest("/collection/full", "GET", null, token);
}

async function addCardToCollection(token, card_id, quantity = 1) {
  return await apiRequest(
    "/collection/add",
    "POST",
    { card_id, quantity },
    token
  );
}

// =============================
// ROLL
// =============================
async function rollCardFromServer(token) {
  return await apiRequest("/roll", "POST", {}, token);
}

async function rollTenCardsFromServer(token) {
  return await apiRequest("/roll/10", "POST", {}, token);
}

// =============================
// CARDS
// =============================
async function getAllCards() {
  return await apiRequest("/cards", "GET");
}

// =============================
// DECKS
// =============================
async function saveDeckToServer(token, name, cards) {
  return await apiRequest(
    "/decks",
    "POST",
    { name, cards },
    token
  );
}

async function deleteDeckFromServer(token, deckId) {
  return await apiRequest(
    `/decks/${deckId}`,
    "DELETE",
    null,
    token
  );
}

async function updateDeckOnServer(token, deckId, name, cards) {
  return await apiRequest(
    `/decks/${deckId}`,
    "PUT",
    { name, cards },
    token
  );
}