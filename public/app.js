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
    { label: "Туман", value: "#5A6878" }
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
  phaseHint: document.getElementById("phaseHint"),
  globalProblem: document.getElementById("globalProblem"),
  statsGrid: document.getElementById("statsGrid"),
  spyPanel: document.getElementById("spyPanel"),
  spyTeam: document.getElementById("spyTeam"),
  spyOrders: document.getElementById("spyOrders"),
  eventCard: document.getElementById("eventCard"),
  storyCard: document.getElementById("storyCard"),
  cardsBoard: document.getElementById("cardsBoard"),
  phaseActions: document.getElementById("phaseActions"),

  historyList: document.getElementById("historyList"),

  arrestSelect: document.getElementById("arrestSelect"),
  arrestStartBtn: document.getElementById("arrestStartBtn"),
  arrestVoteBtn: document.getElementById("arrestVoteBtn"),
  arrestSkipBtn: document.getElementById("arrestSkipBtn"),
  arrestStatus: document.getElementById("arrestStatus"),

  newsFeed: document.getElementById("newsFeed"),
  chatScopeSelect: document.getElementById("chatScopeSelect"),
  chatMessages: document.getElementById("chatMessages"),
  chatInput: document.getElementById("chatInput"),
  sendChatBtn: document.getElementById("sendChatBtn"),

  toast: document.getElementById("toast")
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

  document.body.classList.remove("screen-auth", "screen-lobby", "screen-room", "screen-game");
  document.body.classList.add(`screen-${name}`);
  document.body.classList.toggle("in-game", name === "game");
}

function renderAvatarPreview() {
  el.avatarPreview.innerHTML = avatarMarkup(avatarFromInputs(), "avatar-lg");
}

function phaseLabel(phase) {
  const map = {
    day: "День: голосование",
    night: "Ночь: обсуждение",
    arrest: "Арест",
    ended: "Матч завершен"
  };
  return map[phase] || "Ожидание";
}

function phaseHint(phase) {
  if (phase === "day") return "Выберите по одной опции в каждой карточке.";
  if (phase === "night") return "Ночь: шпионы обсуждают планы. Арест запускается только если игроки сами этого хотят.";
  if (phase === "arrest") return "Открыто голосование за задержание подозреваемого.";
  return "";
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
              <div><small>${room.players}/${room.maxPlayers} игроков ${room.hasPassword ? "| пароль" : ""} ${room.inGame ? "| идет матч" : ""}</small></div>
              <div><small>Код: ${room.id}</small></div>
            </div>
            <button class="btn tiny" data-join-room="${room.id}">Войти</button>
          </div>`
        )
        .join("")
    : "<div class='room-item'><small>Открытых комнат нет.</small></div>";
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
        <b>${escapeHtml(p.nickname)}</b>
        <div class="muted">${p.isHost ? "Хост" : "Игрок"}</div>
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
    .map(
      ([key, value]) => `<div class="stat-item"><div class="stat-row"><span>${statLabels[key] || key}</span><b>${value}</b></div><div class="bar"><span style="width:${value}%"></span></div></div>`
    )
    .join("");
}

function renderGlobalProblem(problem) {
  if (!problem) {
    el.globalProblem.innerHTML = "";
    return;
  }

  const statusText = problem.resolved ? "Решена" : problem.failed ? "Провалена" : "Активна";
  const statusTone = problem.resolved ? "good" : problem.failed ? "bad" : "";

  el.globalProblem.innerHTML = `
    <div class="problem-target">
      <div class="inline-row between">
        <b>Глобальная проблема: ${escapeHtml(problem.title)}</b>
        <span class="pill ${statusTone}">${statusText}</span>
      </div>
      <div class="muted">${escapeHtml(problem.description)}</div>
      <div class="inline-row" style="margin-top:8px;">
        <span class="pill">Дедлайн: день ${problem.deadlineDay}</span>
        <span class="pill">Прогресс: ${problem.progress}%</span>
      </div>
      <div class="cards-board" style="margin-top:8px;">
        ${problem.targets
          .map(
            (t) => `<div class="problem-target"><b>${escapeHtml(t.label)}</b>: ${t.current}/${t.target} ${t.reached ? "<span class='pill good'>выполнено</span>" : ""}</div>`
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderSpyInfo(game) {
  const isSpy = game.myRole === "spy";

  el.spyPanel.classList.toggle("hidden", !isSpy);

  if (!isSpy) {
    el.spyTeam.innerHTML = "";
    el.spyOrders.innerHTML = "";
    return;
  }

  const teamNames = game.spyTeam.map((x) => escapeHtml(x.nickname)).join(", ") || "Ты один";
  el.spyTeam.innerHTML = `<div class="spy-order"><b>Команда шпионов</b><div>${teamNames}</div></div>`;

  el.spyOrders.innerHTML = `
    <div class="cards-board">
      ${(game.spyOrders || [])
        .map(
          (order) => `<div class="spy-order">
            <b>${escapeHtml(order.cardTitle)}</b>
            <div>${escapeHtml(order.agentGoal)}</div>
            <div class="muted">${escapeHtml(order.coverStory)}</div>
            <div class="muted">${escapeHtml(order.sabotagePlan)}</div>
          </div>`
        )
        .join("")}
    </div>
  `;
}

function renderHistory(game) {
  const list = game.history || [];

  if (list.length === 0) {
    el.historyList.innerHTML = "<div class='history-item'>Пока нет завершенных раундов.</div>";
    return;
  }

  el.historyList.innerHTML = list
    .map(
      (round) => `<div class="history-item">
        <b>День ${round.day}</b>
        <div class="muted">Событие: ${escapeHtml(round.eventTitle)}</div>
        <div class="muted">Успешных шпионских директив: ${round.sabotageSuccess}/3</div>
        <div class="cards-board" style="margin-top:6px;">
          ${round.cards
            .map(
              (c) => `<div class="history-item">
                <b>${escapeHtml(c.cardTitle)}</b>
                <div>Выбрано: ${escapeHtml(c.winnerLabel)}</div>
                <div class="muted">Причина: ${escapeHtml(c.reason)}</div>
                <div class="muted">Эффект: ${escapeHtml(c.effectsText || "без явного эффекта")}</div>
                <div class="muted">Голоса: ${c.votesByOption.map((v) => `${escapeHtml(v.label)} - ${v.votes}`).join(" | ")}</div>
              </div>`
            )
            .join("")}
        </div>
      </div>`
    )
    .join("");
}

function renderArrest(room, game) {
  const aliveSet = new Set(game.aliveIds || []);
  const alivePlayers = room.players.filter((p) => aliveSet.has(p.id));
  el.arrestSelect.innerHTML = alivePlayers.map((p) => `<option value="${p.id}">${escapeHtml(p.nickname)}</option>`).join("");

  const canStart = game.status === "running" && game.phase === "night";
  const votingActive = game.status === "running" && game.phase === "arrest";
  el.arrestStartBtn.classList.toggle("hidden", !canStart);
  el.arrestSelect.classList.toggle("hidden", !votingActive);
  el.arrestVoteBtn.classList.toggle("hidden", !votingActive);
  el.arrestSkipBtn.classList.toggle("hidden", !votingActive);
  el.arrestStartBtn.disabled = !canStart;
  el.arrestSelect.disabled = !votingActive;
  el.arrestVoteBtn.disabled = !votingActive;
  el.arrestSkipBtn.disabled = !votingActive;

  if (game.pendingReveal) {
    const pendingPlayer = room.players.find((p) => p.id === game.pendingReveal.targetId);
    el.arrestStatus.textContent = `${pendingPlayer ? pendingPlayer.nickname : "Игрок"} задержан(а), результат проверки будет в начале следующего дня.`;
  } else if (votingActive && game.myArrestVote) {
    if (game.myArrestVote === "skip") {
      el.arrestStatus.textContent = "Ваш голос: пропуск.";
    } else {
      const p = room.players.find((x) => x.id === game.myArrestVote);
      el.arrestStatus.textContent = `Ваш голос: ${p ? p.nickname : "выбранный игрок"}.`;
    }
  } else if (votingActive) {
    el.arrestStatus.textContent = "Выберите цель или пропустите голосование.";
  } else if (canStart) {
    el.arrestStatus.textContent = "Арест не обязателен. Запускайте голосование только при реальном подозрении.";
  } else if (game.phase === "day") {
    el.arrestStatus.textContent = "Арест можно запустить ночью после завершения дневных решений.";
  } else {
    el.arrestStatus.textContent = "Фаза ареста сейчас закрыта.";
  }
}

function renderCards(room, game) {
  const canVoteCards = game.status === "running" && game.phase === "day";
  const totalAlive = game.aliveCount || room.players.length;

  el.cardsBoard.innerHTML = game.cards
    .map((card, index) => {
      const myVote = game.myVotes[card.id];
      const progress = game.voteProgress?.[card.id] || 0;

      return `<div class="card-item">
        <div class="muted"><b>Бланк решения №${index + 1}</b></div>
        <b>${escapeHtml(card.title)}</b>
        <div class="muted card-meta">${escapeHtml(card.description)}</div>
        <div class="muted">Проголосовало: ${progress}/${totalAlive}</div>

        <details class="card-lore">
          <summary>Показать лор карточки</summary>
          <div class="lore-text">${escapeHtml(card.lore)}</div>
        </details>

        <div class="card-options">
          ${card.options
            .map(
              (o) => `<button class="card-option ${myVote === o.id ? "voted" : ""}" data-vote-card="${card.id}" data-vote-option="${o.id}" ${!canVoteCards ? "disabled" : ""}>
                <span class="option-check" aria-hidden="true"></span>
                <span class="option-text">
                  <b>${escapeHtml(o.label)}</b>
                  <span class="muted">${escapeHtml(o.publicText)}</span>
                </span>
              </button>`
            )
            .join("")}
        </div>
      </div>`;
    })
    .join("");
}

function renderNews(game) {
  el.newsFeed.innerHTML = (game.news || [])
    .map((n) => `<div class="news-item ${n.tone || "neutral"}"><small>День ${n.day}</small><div>${escapeHtml(n.text)}</div></div>`)
    .join("");
}

function renderPhaseActions(game) {
  el.phaseActions.innerHTML = "";

  if (isHost() && game.status === "running") {
    if (game.phase === "day") {
      el.phaseActions.innerHTML = '<button id="hostForceDay" class="btn tiny">Завершить день</button>';
    } else if (game.phase === "night") {
      el.phaseActions.innerHTML = '<button id="hostEndNight" class="btn tiny">К новому дню</button>';
    } else if (game.phase === "arrest") {
      el.phaseActions.innerHTML = '<button id="hostForceArrest" class="btn tiny">Закрыть голосование</button>';
    }
  }

  if (game.status === "ended") {
    const winnerText = game.winner === "spies" ? "Победа шпионов" : "Победа политиков";
    el.phaseActions.innerHTML = `<span class="pill">${winnerText}</span>`;
  }
}

function renderChat() {
  const current = state.messages[state.chatScope] || [];

  el.chatMessages.innerHTML = current.length
    ? current
        .slice(-120)
        .map(
          (m) =>
            `<div class="msg"><small>${new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ${escapeHtml(m.fromNickname)}:</small> ${escapeHtml(m.text)}</div>`
        )
        .join("")
    : "<div class='muted'>Пока нет сообщений.</div>";

  el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
  el.chatScopeSelect.value = state.chatScope;
}

function syncChatScopeControl(game) {
  const spyOption = el.chatScopeSelect.querySelector('option[value="spy"]');
  const isSpy = game.myRole === "spy";

  if (spyOption) {
    spyOption.hidden = !isSpy;
    spyOption.disabled = !isSpy;
  }

  if (!isSpy && state.chatScope === "spy") {
    state.chatScope = "public";
  }
}

function renderGame() {
  const room = state.room;
  const game = room?.game;
  if (!room || !game) return;

  el.dayBadge.textContent = `День ${game.day}`;
  el.phaseBadge.textContent = phaseLabel(game.phase);
  const roleName = game.myRole === "spy" ? "Шпион" : "Политик";
  el.roleBadge.textContent = `Роль: ${roleName}`;
  el.roleBadge.classList.remove("role-spy", "role-politician");
  el.roleBadge.classList.add(game.myRole === "spy" ? "role-spy" : "role-politician");
  el.phaseHint.textContent = phaseHint(game.phase);

  renderGlobalProblem(game.globalProblem);
  renderStats(game.stats);
  renderSpyInfo(game);

  el.eventCard.textContent = game.event ? `Событие: ${game.event.title}. ${game.event.text}` : "Событие дня пока не опубликовано.";
  el.storyCard.textContent = game.story ? `Политический фон: ${game.story}` : "Фоновая история появится после старта следующего дня.";

  renderCards(room, game);
  renderArrest(room, game);
  renderPhaseActions(game);
  renderNews(game);
  renderHistory(game);

  syncChatScopeControl(game);
  renderChat();
}

function clearRoomState() {
  state.room = null;
  state.messages = { public: [], spy: [] };
}

renderAvatarPreview();
[el.skinSelect, el.hairStyleSelect, el.hairColorSelect, el.outfitColorSelect, el.bgColorSelect].forEach((node) => {
  node.addEventListener("change", renderAvatarPreview);
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
  socket.emit("room:join", { roomId: el.joinCodeInput.value, password: el.joinPasswordInput.value }, (res) => {
    if (!res?.ok) return showToast(res?.error || "Не удалось подключиться");
    state.messages = { public: [], spy: [] };
    showToast(`Подключено к ${res.roomId}`);
  });
});

el.roomsList.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-join-room]");
  if (!btn) return;
  const roomId = btn.getAttribute("data-join-room");
  const room = state.rooms.find((r) => r.id === roomId);
  const password = room?.hasPassword ? prompt("Введите пароль комнаты", "") || "" : "";

  socket.emit("room:join", { roomId, password }, (res) => {
    if (!res?.ok) return showToast(res?.error || "Не удалось подключиться");
    state.messages = { public: [], spy: [] };
    showToast(`Подключено к ${res.roomId}`);
  });
});

el.leaveRoomBtn.addEventListener("click", () => {
  socket.emit("room:leave", () => {
    clearRoomState();
    setScreen("lobby");
    renderLobby();
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
      showToast("Настройки обновлены");
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
    {
      cardId: button.getAttribute("data-vote-card"),
      optionId: button.getAttribute("data-vote-option")
    },
    (res) => {
      if (!res?.ok) showToast(res?.error || "Голос не принят");
    }
  );
});

el.arrestVoteBtn.addEventListener("click", () => {
  const targetId = el.arrestSelect.value;
  if (!targetId) return;

  socket.emit("game:vote-arrest", { targetId }, (res) => {
    if (!res?.ok) showToast(res?.error || "Голос не принят");
  });
});

el.arrestSkipBtn.addEventListener("click", () => {
  socket.emit("game:vote-arrest", { targetId: "skip" }, (res) => {
    if (!res?.ok) showToast(res?.error || "Голос не принят");
  });
});

el.arrestStartBtn.addEventListener("click", () => {
  socket.emit("game:start-arrest", (res) => {
    if (!res?.ok) showToast(res?.error || "Не удалось открыть арест");
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

el.chatScopeSelect.addEventListener("change", () => {
  const scope = el.chatScopeSelect.value;
  if (scope === "spy" && state.room?.game?.myRole !== "spy") {
    state.chatScope = "public";
  } else {
    state.chatScope = scope;
  }
  renderChat();
});

el.sendChatBtn.addEventListener("click", () => {
  const message = el.chatInput.value.trim();
  if (!message) return;

  socket.emit("chat:send", { scope: state.chatScope, text: message }, (res) => {
    if (!res?.ok) return showToast(res?.error || "Не удалось отправить сообщение");
    el.chatInput.value = "";
  });
});

el.chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") el.sendChatBtn.click();
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
  if (state.profile) {
    setScreen("lobby");
    renderLobby();
  }
});

socket.on("rooms:list", (rooms) => {
  state.rooms = rooms;
  if (!state.room) renderLobby();
});

socket.on("room:state", (room) => {
  const changedRoom = state.room?.id && state.room.id !== room.id;
  if (changedRoom) {
    state.messages = { public: [], spy: [] };
    state.chatScope = "public";
  }

  state.room = room;
  if (room.game) {
    setScreen("game");
    renderGame();
  } else {
    setScreen("room");
    renderRoom();
  }
});

socket.on("chat:message", (msg) => {
  if (!state.messages[msg.scope]) return;
  state.messages[msg.scope].push(msg);
  if (state.messages[msg.scope].length > 240) state.messages[msg.scope].shift();
  renderChat();
});

if (state.profile) setScreen("lobby");
else setScreen("auth");

