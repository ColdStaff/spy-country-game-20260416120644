const socket = io();

const palettes = {
  skin: [
    { label: "Светлая", value: "#F4D4B5" },
    { label: "Теплая", value: "#D8B08C" },
    { label: "Смуглая", value: "#A97E5F" },
    { label: "Темная", value: "#7A573E" }
  ],
  hairStyle: [
    { label: "Короткая", value: "short" },
    { label: "Длинная", value: "long" },
    { label: "Кудрявая", value: "curly" },
    { label: "Лысый", value: "bald" }
  ],
  hairColor: [
    { label: "Черные", value: "#1E1E25" },
    { label: "Каштан", value: "#5E3A1C" },
    { label: "Русые", value: "#8B5A2B" },
    { label: "Пепельные", value: "#A58D73" },
    { label: "Бордовые", value: "#6A1E1E" }
  ],
  outfitColor: [
    { label: "Голубой", value: "#5DA9E9" },
    { label: "Мята", value: "#66C2A5" },
    { label: "Коралл", value: "#E07A5F" },
    { label: "Вино", value: "#B56576" },
    { label: "Фиолет", value: "#9D4EDD" },
    { label: "Золото", value: "#F2C14E" }
  ],
  bgColor: [
    { label: "Синяя ночь", value: "#2D4059" },
    { label: "Пыльная слива", value: "#4C3B4D" },
    { label: "Глубокая бирюза", value: "#2C666E" },
    { label: "Графит", value: "#594545" },
    { label: "Зеленый мрак", value: "#285943" },
    { label: "Неон-дым", value: "#5C3C92" }
  ]
};

const statLabels = {
  economy: "Экономика",
  security: "Безопасность",
  welfare: "Благосостояние",
  trust: "Доверие",
  ecology: "Экология",
  birthRate: "Рождаемость"
};

const state = {
  socketId: null,
  profile: null,
  room: null,
  rooms: [],
  chatScope: "public",
  messages: { public: [], spy: [] },
  micOn: false,
  localStream: null,
  voiceScope: null,
  peers: new Map(),
  toastTimer: null
};

const el = {
  connectionState: document.getElementById("connectionState"),
  screens: {
    auth: document.getElementById("screen-auth"),
    lobby: document.getElementById("screen-lobby"),
    room: document.getElementById("screen-room"),
    game: document.getElementById("screen-game")
  },
  nicknameInput: document.getElementById("nicknameInput"),
  registerBtn: document.getElementById("registerBtn"),
  avatarPreview: document.getElementById("avatarPreview"),
  skinSelect: document.getElementById("skinSelect"),
  hairStyleSelect: document.getElementById("hairStyleSelect"),
  hairColorSelect: document.getElementById("hairColorSelect"),
  outfitColorSelect: document.getElementById("outfitColorSelect"),
  bgColorSelect: document.getElementById("bgColorSelect"),
  createRoomName: document.getElementById("createRoomName"),
  createRoomPassword: document.getElementById("createRoomPassword"),
  createRoomMax: document.getElementById("createRoomMax"),
  createRoomBtn: document.getElementById("createRoomBtn"),
  joinCodeInput: document.getElementById("joinCodeInput"),
  joinPasswordInput: document.getElementById("joinPasswordInput"),
  joinByCodeBtn: document.getElementById("joinByCodeBtn"),
  roomsList: document.getElementById("roomsList"),
  roomTitle: document.getElementById("roomTitle"),
  roomCodeBadge: document.getElementById("roomCodeBadge"),
  copyRoomCodeBtn: document.getElementById("copyRoomCodeBtn"),
  roomPlayers: document.getElementById("roomPlayers"),
  hostControls: document.getElementById("hostControls"),
  hostRoomName: document.getElementById("hostRoomName"),
  hostRoomPassword: document.getElementById("hostRoomPassword"),
  hostRoomMax: document.getElementById("hostRoomMax"),
  hostRoomLock: document.getElementById("hostRoomLock"),
  saveRoomSettingsBtn: document.getElementById("saveRoomSettingsBtn"),
  startGameBtn: document.getElementById("startGameBtn"),
  leaveRoomBtn: document.getElementById("leaveRoomBtn"),
  dayBadge: document.getElementById("dayBadge"),
  phaseBadge: document.getElementById("phaseBadge"),
  roleBadge: document.getElementById("roleBadge"),
  spyObjective: document.getElementById("spyObjective"),
  spyTeam: document.getElementById("spyTeam"),
  statsGrid: document.getElementById("statsGrid"),
  newsFeed: document.getElementById("newsFeed"),
  eventCard: document.getElementById("eventCard"),
  storyCard: document.getElementById("storyCard"),
  dayResults: document.getElementById("dayResults"),
  cardsBoard: document.getElementById("cardsBoard"),
  phaseActions: document.getElementById("phaseActions"),
  playersForArrest: document.getElementById("playersForArrest"),
  chatPublicTab: document.getElementById("chatPublicTab"),
  chatSpyTab: document.getElementById("chatSpyTab"),
  micBtn: document.getElementById("micBtn"),
  voiceScopeBadge: document.getElementById("voiceScopeBadge"),
  chatMessages: document.getElementById("chatMessages"),
  chatInput: document.getElementById("chatInput"),
  sendChatBtn: document.getElementById("sendChatBtn"),
  toast: document.getElementById("toast"),
  remoteAudios: document.getElementById("remoteAudios")
};

function fillSelect(select, items) {
  select.innerHTML = items.map((x) => `<option value="${x.value}">${x.label}</option>`).join("");
}

fillSelect(el.skinSelect, palettes.skin);
fillSelect(el.hairStyleSelect, palettes.hairStyle);
fillSelect(el.hairColorSelect, palettes.hairColor);
fillSelect(el.outfitColorSelect, palettes.outfitColor);
fillSelect(el.bgColorSelect, palettes.bgColor);

function avatarFromInputs() {
  return {
    skin: el.skinSelect.value,
    hairStyle: el.hairStyleSelect.value,
    hairColor: el.hairColorSelect.value,
    outfitColor: el.outfitColorSelect.value,
    bgColor: el.bgColorSelect.value
  };
}

function avatarMarkup(avatar, extraClass = "") {
  return `<div class="avatar ${extraClass}" style="--skin:${avatar.skin};--hair:${avatar.hairColor};--outfit:${avatar.outfitColor};--bgc:${avatar.bgColor}"><div class="hair ${avatar.hairStyle}"></div><div class="head"></div><div class="body"></div></div>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.remove("hidden");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => el.toast.classList.add("hidden"), 2600);
}

function setScreen(name) {
  Object.entries(el.screens).forEach(([id, node]) => {
    node.classList.toggle("visible", id === name);
  });
}

function renderAvatarPreview() {
  el.avatarPreview.innerHTML = avatarMarkup(avatarFromInputs(), "avatar-lg");
}

function nowTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function phaseLabel(phase) {
  const map = {
    day: "День: голосование",
    night: "Ночь: тайные переговоры",
    arrest: "Арест: голосование",
    ended: "Матч завершен"
  };
  return map[phase] || "Ожидание";
}

function isHost() {
  return Boolean(state.room && state.room.hostId === state.socketId);
}

function renderLobby() {
  el.roomsList.innerHTML = state.rooms.length
    ? state.rooms
        .map(
          (room) => `<div class="room-item">
            <div>
              <b>${escapeHtml(room.name)}</b>
              <div><small>${room.players}/${room.maxPlayers} игроков ${room.hasPassword ? "| пароль" : ""} ${room.inGame ? "| идет игра" : ""}</small></div>
              <div><small>Код: ${room.id}</small></div>
            </div>
            <button class="btn tiny" data-join-room="${room.id}">Войти</button>
          </div>`
        )
        .join("")
    : "<div class='room-item'><small>Пока пусто. Создай первую комнату.</small></div>";
}

function renderRoom() {
  const room = state.room;
  if (!room) return;

  el.roomTitle.textContent = room.settings.name;
  el.roomCodeBadge.textContent = `Код: ${room.id}`;

  el.roomPlayers.innerHTML = room.players
    .map(
      (p) => `<div class="player-card">
        ${avatarMarkup(p.avatar)}
        <div><b>${escapeHtml(p.nickname)}</b></div>
        <small>${p.isHost ? "Хост" : "Политик"}</small>
      </div>`
    )
    .join("");

  const host = isHost();
  el.hostControls.classList.toggle("hidden", !host);
  if (host) {
    el.hostRoomName.value = room.settings.name;
    el.hostRoomPassword.value = "";
    el.hostRoomMax.value = room.settings.maxPlayers;
    el.hostRoomLock.checked = room.settings.locked;
  }
}

function renderStats(stats) {
  el.statsGrid.innerHTML = Object.entries(stats)
    .map(([key, value]) => `<div class="stat-item"><div>${statLabels[key] || key}</div><b>${value}</b><div class="bar"><span style="width:${value}%"></span></div></div>`)
    .join("");
}

function renderGame() {
  const room = state.room;
  const game = room?.game;
  if (!room || !game) return;

  el.dayBadge.textContent = `День ${game.day}`;
  el.phaseBadge.textContent = phaseLabel(game.phase);
  const role = game.myRole === "spy" ? "Шпион" : "Политик";
  el.roleBadge.textContent = `Роль: ${role}`;

  el.spyObjective.classList.toggle("hidden", game.myRole !== "spy");
  el.spyTeam.classList.toggle("hidden", game.myRole !== "spy");
  if (game.myRole === "spy") {
    el.spyObjective.textContent = `Цель шпионов: ${game.objective || "..."}`;
    el.spyTeam.textContent = `Команда: ${game.spyTeam.map((x) => x.nickname).join(", ") || "Ты один"}`;
  }

  renderStats(game.stats);

  el.eventCard.textContent = game.event ? `Событие: ${game.event.title}. ${game.event.text}` : "";
  el.storyCard.textContent = game.story ? `Сюжет: ${game.story}` : "";

  el.newsFeed.innerHTML = (game.news || [])
    .map((n) => `<div class="news-item ${n.tone || "neutral"}"><small>День ${n.day}</small><div>${escapeHtml(n.text)}</div></div>`)
    .join("");

  el.dayResults.innerHTML = (game.results || [])
    .map((r) => `<div class="result-item"><b>${escapeHtml(r.cardTitle)}</b><div>${escapeHtml(r.winnerLabel)}</div></div>`)
    .join("");

  const canVoteCards = game.status === "running" && game.phase === "day";
  el.cardsBoard.innerHTML = game.cards
    .map((card) => {
      const myVote = game.myVotes[card.id];
      const progress = game.voteProgress?.[card.id] || 0;
      return `<div class="card-item">
        <b>${escapeHtml(card.title)}</b>
        <div><small>${escapeHtml(card.description)}</small></div>
        <div><small>Проголосовало: ${progress}/${room.players.length}</small></div>
        <div class="card-options">
          ${card.options
            .map(
              (o) => `<button class="card-option ${myVote === o.id ? "voted" : ""}" data-vote-card="${card.id}" data-vote-option="${o.id}" ${!canVoteCards ? "disabled" : ""}>
                <b>${escapeHtml(o.label)}</b>
                <div><small>${escapeHtml(o.publicText)}</small></div>
              </button>`
            )
            .join("")}
        </div>
      </div>`;
    })
    .join("");

  el.playersForArrest.innerHTML = room.players
    .map(
      (p) => `<div class="arrest-item">
        <div class="inline-row">
          ${avatarMarkup(p.avatar)}
          <div>
            <b>${escapeHtml(p.nickname)}</b>
            <div><small>${p.id === game.pendingReveal?.targetId ? "Задержан(а), ждем вердикт" : ""}</small></div>
          </div>
        </div>
        <div class="inline-row">
          <button class="btn tiny" data-arrest="${p.id}" ${game.phase !== "arrest" || game.status !== "running" ? "disabled" : ""}>Голос за арест</button>
          ${game.myArrestVote === p.id ? '<small>Ваш голос</small>' : ""}
        </div>
      </div>`
    )
    .join("") +
    `<div class="arrest-item"><button class="btn tiny" data-arrest="skip" ${game.phase !== "arrest" || game.status !== "running" ? "disabled" : ""}>Пропустить арест</button></div>`;

  el.phaseActions.innerHTML = "";
  if (isHost() && game.status === "running") {
    if (game.phase === "day") {
      el.phaseActions.innerHTML += '<button id="hostForceDay" class="btn tiny">Хост: завершить день</button>';
    }
    if (game.phase === "night") {
      el.phaseActions.innerHTML += '<button id="hostEndNight" class="btn tiny">Хост: перейти к аресту</button>';
    }
    if (game.phase === "arrest") {
      el.phaseActions.innerHTML += '<button id="hostForceArrest" class="btn tiny">Хост: завершить арест</button>';
    }
  }

  if (game.status === "ended") {
    const winnerText = game.winner === "spies" ? "Победа шпионов" : "Победа политиков";
    el.phaseActions.innerHTML += `<span class="pill">${winnerText}</span>`;
  }

  if (state.chatScope === "spy" && game.myRole !== "spy") {
    state.chatScope = "public";
  }

  el.chatSpyTab.classList.toggle("hidden", game.myRole !== "spy");
  el.chatPublicTab.classList.toggle("primary", state.chatScope === "public");
  el.chatSpyTab.classList.toggle("primary", state.chatScope === "spy");
  renderChat();
  renderVoice();
}

function renderChat() {
  const current = state.messages[state.chatScope] || [];
  el.chatMessages.innerHTML = current
    .slice(-120)
    .map((m) => `<div class="msg"><small>${nowTime(m.at)} ${escapeHtml(m.fromNickname)}:</small> ${escapeHtml(m.text)}</div>`)
    .join("");
  el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
}

function closePeers(scope = null) {
  for (const [key, value] of state.peers.entries()) {
    if (scope && value.scope !== scope) continue;
    try {
      value.pc.close();
    } catch {
      // ignore
    }
    const audio = document.getElementById(`remote-${value.scope}-${value.peerId}`);
    if (audio) audio.remove();
    state.peers.delete(key);
  }
}

function peerKey(scope, id) {
  return `${scope}::${id}`;
}

function createPeer(scope, peerId) {
  const key = peerKey(scope, peerId);
  if (state.peers.has(key)) return state.peers.get(key).pc;

  const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

  if (state.localStream) {
    state.localStream.getTracks().forEach((t) => pc.addTrack(t, state.localStream));
  }

  pc.onicecandidate = (event) => {
    if (!event.candidate) return;
    socket.emit("voice:signal", { to: peerId, scope, data: { candidate: event.candidate } });
  };

  pc.ontrack = (event) => {
    let audio = document.getElementById(`remote-${scope}-${peerId}`);
    if (!audio) {
      audio = document.createElement("audio");
      audio.id = `remote-${scope}-${peerId}`;
      audio.autoplay = true;
      el.remoteAudios.appendChild(audio);
    }
    audio.srcObject = event.streams[0];
  };

  pc.onconnectionstatechange = () => {
    if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
      const item = state.peers.get(key);
      if (item) {
        state.peers.delete(key);
        const audio = document.getElementById(`remote-${scope}-${peerId}`);
        if (audio) audio.remove();
      }
    }
  };

  state.peers.set(key, { pc, peerId, scope });
  return pc;
}

async function makeOffer(scope, peerId) {
  const pc = createPeer(scope, peerId);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("voice:signal", { to: peerId, scope, data: { description: pc.localDescription } });
}

async function handleSignal(payload) {
  const { from, scope, data } = payload;
  if (scope !== state.voiceScope) return;
  const pc = createPeer(scope, from);

  if (data.description) {
    await pc.setRemoteDescription(data.description);
    if (data.description.type === "offer") {
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("voice:signal", { to: from, scope, data: { description: pc.localDescription } });
    }
  }
  if (data.candidate) {
    try {
      await pc.addIceCandidate(data.candidate);
    } catch {
      // ignore
    }
  }
}

function desiredVoiceScope() {
  const game = state.room?.game;
  if (!state.micOn || !game || game.status !== "running") return null;
  if (game.myRole === "spy" && game.phase === "night") return "spy";
  return "public";
}

function renderVoice() {
  el.micBtn.textContent = `Микрофон: ${state.micOn ? "вкл" : "выкл"}`;
  el.voiceScopeBadge.textContent = `Голос: ${state.voiceScope || "нет"}`;
}

function syncVoice() {
  const needed = desiredVoiceScope();
  if (needed === state.voiceScope) return;

  if (state.voiceScope) {
    socket.emit("voice:leave", () => {});
    closePeers(state.voiceScope);
    state.voiceScope = null;
  }

  if (!needed) {
    renderVoice();
    return;
  }

  socket.emit("voice:join", { scope: needed }, async (res) => {
    if (!res?.ok) {
      showToast(res?.error || "Не удалось подключить голосовой канал");
      renderVoice();
      return;
    }
    state.voiceScope = res.scope;
    for (const peerId of res.members || []) {
      try {
        await makeOffer(res.scope, peerId);
      } catch {
        // ignore
      }
    }
    renderVoice();
  });
}

function clearRoomState() {
  state.room = null;
  state.messages = { public: [], spy: [] };
  if (state.voiceScope) {
    socket.emit("voice:leave", () => {});
    closePeers();
    state.voiceScope = null;
  }
}

renderAvatarPreview();
[el.skinSelect, el.hairStyleSelect, el.hairColorSelect, el.outfitColorSelect, el.bgColorSelect].forEach((s) => {
  s.addEventListener("change", renderAvatarPreview);
});

el.registerBtn.addEventListener("click", () => {
  const nickname = el.nicknameInput.value.trim();
  if (!nickname) {
    showToast("Введите никнейм");
    return;
  }
  socket.emit("player:register", { nickname, avatar: avatarFromInputs() }, (res) => {
    if (!res?.ok) return showToast(res?.error || "Ошибка регистрации");
    state.profile = res.profile;
    setScreen("lobby");
    renderLobby();
  });
});

el.createRoomBtn.addEventListener("click", () => {
  socket.emit(
    "room:create",
    {
      name: el.createRoomName.value,
      password: el.createRoomPassword.value,
      maxPlayers: Number(el.createRoomMax.value)
    },
    (res) => {
      if (!res?.ok) return showToast(res?.error || "Не удалось создать комнату");
      state.messages = { public: [], spy: [] };
      showToast(`Комната ${res.roomId} создана`);
    }
  );
});

el.joinByCodeBtn.addEventListener("click", () => {
  socket.emit(
    "room:join",
    { roomId: el.joinCodeInput.value, password: el.joinPasswordInput.value },
    (res) => {
      if (!res?.ok) return showToast(res?.error || "Не удалось войти");
      state.messages = { public: [], spy: [] };
      showToast(`Подключено к ${res.roomId}`);
    }
  );
});

el.roomsList.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-join-room]");
  if (!btn) return;
  const roomId = btn.getAttribute("data-join-room");
  const room = state.rooms.find((r) => r.id === roomId);
  const password = room?.hasPassword ? prompt("Введите пароль комнаты", "") || "" : "";
  socket.emit("room:join", { roomId, password }, (res) => {
    if (!res?.ok) return showToast(res?.error || "Не удалось войти");
    state.messages = { public: [], spy: [] };
    showToast(`Подключено к ${res.roomId}`);
  });
});

el.leaveRoomBtn.addEventListener("click", () => {
  socket.emit("room:leave", () => {
    clearRoomState();
    setScreen("lobby");
  });
});

el.copyRoomCodeBtn.addEventListener("click", async () => {
  if (!state.room) return;
  try {
    await navigator.clipboard.writeText(state.room.id);
    showToast("Код комнаты скопирован");
  } catch {
    showToast("Не удалось скопировать код");
  }
});

el.saveRoomSettingsBtn.addEventListener("click", () => {
  socket.emit(
    "room:update",
    {
      name: el.hostRoomName.value,
      password: el.hostRoomPassword.value,
      maxPlayers: Number(el.hostRoomMax.value),
      locked: el.hostRoomLock.checked
    },
    (res) => {
      if (!res?.ok) return showToast(res?.error || "Ошибка сохранения");
      showToast("Настройки комнаты обновлены");
    }
  );
});

el.startGameBtn.addEventListener("click", () => {
  socket.emit("game:start", (res) => {
    if (!res?.ok) return showToast(res?.error || "Не удалось начать матч");
    showToast("Матч начался");
  });
});

el.cardsBoard.addEventListener("click", (event) => {
  const button = event.target.closest("[data-vote-card]");
  if (!button) return;
  socket.emit(
    "game:vote-card",
    { cardId: button.getAttribute("data-vote-card"), optionId: button.getAttribute("data-vote-option") },
    (res) => {
      if (!res?.ok) showToast(res?.error || "Голос не принят");
    }
  );
});

el.playersForArrest.addEventListener("click", (event) => {
  const button = event.target.closest("[data-arrest]");
  if (!button) return;
  socket.emit("game:vote-arrest", { targetId: button.getAttribute("data-arrest") }, (res) => {
    if (!res?.ok) showToast(res?.error || "Голос не принят");
  });
});

el.phaseActions.addEventListener("click", (event) => {
  if (event.target.id === "hostForceDay") {
    socket.emit("game:force-day", (res) => {
      if (!res?.ok) showToast(res?.error || "Ошибка");
    });
  }
  if (event.target.id === "hostEndNight") {
    socket.emit("game:end-night", (res) => {
      if (!res?.ok) showToast(res?.error || "Ошибка");
    });
  }
  if (event.target.id === "hostForceArrest") {
    socket.emit("game:force-arrest", (res) => {
      if (!res?.ok) showToast(res?.error || "Ошибка");
    });
  }
});

el.chatPublicTab.addEventListener("click", () => {
  state.chatScope = "public";
  renderChat();
  renderGame();
});

el.chatSpyTab.addEventListener("click", () => {
  state.chatScope = "spy";
  renderChat();
  renderGame();
});

el.sendChatBtn.addEventListener("click", () => {
  const text = el.chatInput.value.trim();
  if (!text) return;
  socket.emit("chat:send", { scope: state.chatScope, text }, (res) => {
    if (!res?.ok) return showToast(res?.error || "Не удалось отправить сообщение");
    el.chatInput.value = "";
  });
});

el.chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") el.sendChatBtn.click();
});

el.micBtn.addEventListener("click", async () => {
  if (!state.micOn) {
    try {
      if (!state.localStream) {
        state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      state.localStream.getTracks().forEach((t) => {
        t.enabled = true;
      });
      state.micOn = true;
    } catch {
      showToast("Доступ к микрофону отклонен");
      return;
    }
  } else {
    state.micOn = false;
    if (state.localStream) {
      state.localStream.getTracks().forEach((t) => {
        t.enabled = false;
      });
    }
  }
  syncVoice();
  renderVoice();
});

socket.on("session:connected", (payload) => {
  state.socketId = payload.id;
  el.connectionState.textContent = "Онлайн";
});

socket.on("connect", () => {
  el.connectionState.textContent = "Онлайн";
});

socket.on("disconnect", () => {
  el.connectionState.textContent = "Нет соединения";
  clearRoomState();
  if (state.profile) setScreen("lobby");
});

socket.on("rooms:list", (rooms) => {
  state.rooms = rooms;
  if (!state.room) renderLobby();
});

socket.on("room:state", (room) => {
  const roomChanged = state.room?.id && state.room.id !== room.id;
  if (roomChanged) state.messages = { public: [], spy: [] };
  state.room = room;
  if (room.game) {
    setScreen("game");
    renderGame();
    syncVoice();
  } else {
    setScreen("room");
    renderRoom();
    syncVoice();
  }
});

socket.on("chat:message", (msg) => {
  if (!state.messages[msg.scope]) return;
  state.messages[msg.scope].push(msg);
  if (state.messages[msg.scope].length > 240) state.messages[msg.scope].shift();
  renderChat();
});

socket.on("voice:signal", async (payload) => {
  try {
    await handleSignal(payload);
  } catch {
    // ignore
  }
});

socket.on("voice:user-left", (payload) => {
  const key = peerKey(payload.scope, payload.id);
  const peer = state.peers.get(key);
  if (!peer) return;
  try {
    peer.pc.close();
  } catch {
    // ignore
  }
  state.peers.delete(key);
  const audio = document.getElementById(`remote-${payload.scope}-${payload.id}`);
  if (audio) audio.remove();
});

if (state.profile) setScreen("lobby");
else setScreen("auth");
