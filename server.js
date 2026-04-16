
const express = require("express");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;
const MIN_PLAYERS = 3;
const MAX_NEWS = 120;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();
const socketToRoom = new Map();
const profiles = new Map();
const voiceScopes = new Map();

const BASE_STATS = {
  economy: 55,
  security: 55,
  welfare: 55,
  trust: 55,
  ecology: 55,
  birthRate: 55
};
const STAT_KEYS = Object.keys(BASE_STATS);

const EVENTS = [
  { title: "Рост мировых цен", text: "Импорт дорожает.", effects: { economy: -5, welfare: -3 } },
  { title: "Инвестиционный форум", text: "Бизнес готов вкладываться.", effects: { economy: 4, trust: 2 } },
  { title: "Наводнение", text: "Несколько регионов пострадали.", effects: { welfare: -5, ecology: -4 } },
  { title: "Кибератака", text: "Госуслуги временно недоступны.", effects: { security: -6, trust: -3 } },
  { title: "Экспортный рекорд", text: "У страны сильный внешний спрос.", effects: { economy: 5, birthRate: 1 } },
  { title: "Утечка документов", text: "Общество ждет объяснений от власти.", effects: { trust: -6, security: -2 } }
];

const STORY = [
  "Парламент расколот: компромисс дается тяжело.",
  "Эксперты предупреждают о накопительном эффекте решений.",
  "На улицах растет давление на политиков.",
  "Внешние игроки внимательно следят за вашим курсом.",
  "Этот раунд может стать поворотным для всей страны."
];

const MISSIONS = [
  {
    text: "Снизьте Экономику + Доверие минимум на 8 за день.",
    check: (start, end) => Math.max(0, start.economy - end.economy) + Math.max(0, start.trust - end.trust) >= 8,
    success: { news: "По стране пошла волна слухов и паники.", effects: { trust: -3 }, tone: "bad" },
    fail: { news: "Правительство удержало повестку дня.", effects: { trust: 2 }, tone: "good" }
  },
  {
    text: "Снизьте Безопасность + Экологию минимум на 8 за день.",
    check: (start, end) => Math.max(0, start.security - end.security) + Math.max(0, start.ecology - end.ecology) >= 8,
    success: { news: "Системные сбои в инфраструктуре усилились.", effects: { security: -3 }, tone: "bad" },
    fail: { news: "Ведомства быстро стабилизировали ситуацию.", effects: { security: 2 }, tone: "good" }
  },
  {
    text: "Добейтесь снижения минимум 3 показателей страны к вечеру.",
    check: (start, end) => STAT_KEYS.filter((k) => end[k] < start[k]).length >= 3,
    success: { news: "Последствия спорных реформ стали заметны всем.", effects: { welfare: -2, trust: -2 }, tone: "bad" },
    fail: { news: "Кабмин сработал неожиданно слаженно.", effects: { economy: 1, trust: 1 }, tone: "good" }
  }
];

const CARDS = [
  {
    title: "Антикризисный бюджет",
    description: "Нужно срочно выбрать приоритет расходов.",
    options: [
      { label: "Поддержать промышленность", publicText: "Ставка на заводы.", effects: { economy: 6, welfare: -5 }, delayed: [{ inDays: 1, effects: { birthRate: -2 }, news: "Социальные программы сократились.", tone: "bad" }] },
      { label: "Сделать упор на соцподдержку", publicText: "Поддержка семей сохранена.", effects: { welfare: 5, trust: 3, economy: -2 }, delayed: [] },
      { label: "Смешанный курс", publicText: "Компромиссное решение.", effects: { economy: 2, welfare: 2, trust: 1 }, delayed: [{ inDays: 2, effects: { economy: -2 }, news: "Резервов стало меньше.", tone: "neutral" }] }
    ]
  },
  {
    title: "Пограничная политика",
    description: "На границе растет напряженность.",
    options: [
      { label: "Усилить рубежи", publicText: "Силовики получают ресурсы.", effects: { security: 7, economy: -3 }, delayed: [] },
      { label: "Ставка на дипломатию", publicText: "Переход к переговорам.", effects: { security: 2, trust: 2, economy: 1 }, delayed: [{ inDays: 1, effects: { security: -2 }, news: "Переговоры затянулись.", tone: "neutral" }] },
      { label: "Сократить расходы на охрану", publicText: "Деньги идут в экономику.", effects: { economy: 4, welfare: 2, security: -6 }, delayed: [] }
    ]
  },
  {
    title: "Медиареформа",
    description: "Общество требует порядка в инфополе.",
    options: [
      { label: "Жесткий контроль", publicText: "Вводятся жесткие правила.", effects: { security: 4, trust: -5 }, delayed: [{ inDays: 2, effects: { trust: -2 }, news: "Репутационные потери усилились.", tone: "bad" }] },
      { label: "Прозрачный надзор", publicText: "Независимый совет создан.", effects: { trust: 4, security: 1 }, delayed: [] },
      { label: "Не вмешиваться", publicText: "Рынок решит сам.", effects: { trust: -1, security: -3 }, delayed: [{ inDays: 1, effects: { trust: -2 }, news: "Инфошум вырос.", tone: "bad" }] }
    ]
  },
  {
    title: "Зеленый переход",
    description: "Экология или промышленный темп?",
    options: [
      { label: "Резко закрыть старые мощности", publicText: "Экология важнее темпа.", effects: { ecology: 7, economy: -5, welfare: -2 }, delayed: [] },
      { label: "Плавная модернизация", publicText: "Переход без шока.", effects: { ecology: 3, trust: 2, economy: 1 }, delayed: [] },
      { label: "Сохранить текущий курс", publicText: "Ставка на стабильность.", effects: { economy: 3, ecology: -6, trust: -2 }, delayed: [{ inDays: 1, effects: { welfare: -2 }, news: "В регионах растут жалобы на экологию.", tone: "bad" }] }
    ]
  },
  {
    title: "Налоговая политика",
    description: "Бюджету нужен дополнительный ресурс.",
    options: [
      { label: "Повысить налоги для корпораций", publicText: "Бюджет усиливается.", effects: { welfare: 3, trust: 2, economy: -3 }, delayed: [] },
      { label: "Снизить налоги ради инвестиций", publicText: "Привлекаем капитал.", effects: { economy: 5, trust: -2 }, delayed: [] },
      { label: "Временный чрезвычайный сбор", publicText: "Мягкий компромисс.", effects: { economy: 2, security: 1, trust: -1 }, delayed: [] }
    ]
  },
  {
    title: "Программа рождаемости",
    description: "Показатели семейной демографии падают.",
    options: [
      { label: "Увеличить выплаты", publicText: "Поддержка семей усилена.", effects: { birthRate: 6, welfare: 2, economy: -2 }, delayed: [] },
      { label: "Льготная ипотека", publicText: "Ставка на жилье.", effects: { birthRate: 3, economy: 2, trust: 1 }, delayed: [{ inDays: 2, effects: { welfare: -1 }, news: "Стоимость аренды выросла.", tone: "neutral" }] },
      { label: "Ничего не менять", publicText: "Курс остается прежним.", effects: { birthRate: -3, trust: -2 }, delayed: [] }
    ]
  }
];

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}
function rnd(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[rnd(0, arr.length - 1)];
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = rnd(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function text(v, fallback = "", max = 60) {
  if (typeof v !== "string") return fallback;
  const t = v.trim().replace(/\s+/g, " ");
  return t ? t.slice(0, max) : fallback;
}
function cloneStats(stats) {
  return { ...stats };
}
function applyEffects(stats, effects) {
  for (const key of STAT_KEYS) {
    if (typeof effects[key] === "number") stats[key] = clamp(stats[key] + effects[key], 0, 100);
  }
}
function news(game, message, tone = "neutral") {
  game.news.unshift({ id: crypto.randomUUID(), day: game.day, text: message, tone, at: Date.now() });
  if (game.news.length > MAX_NEWS) game.news.length = MAX_NEWS;
}
function makeAvatar(input) {
  const a = input && typeof input === "object" ? input : {};
  const allowed = {
    skin: ["#F4D4B5", "#D8B08C", "#A97E5F", "#7A573E"],
    hairStyle: ["short", "long", "curly", "bald"],
    hairColor: ["#1E1E25", "#5E3A1C", "#8B5A2B", "#A58D73", "#6A1E1E"],
    outfitColor: ["#5DA9E9", "#66C2A5", "#E07A5F", "#B56576", "#9D4EDD", "#F2C14E"],
    bgColor: ["#2D4059", "#4C3B4D", "#2C666E", "#594545", "#285943", "#5C3C92"]
  };
  return {
    skin: allowed.skin.includes(a.skin) ? a.skin : allowed.skin[0],
    hairStyle: allowed.hairStyle.includes(a.hairStyle) ? a.hairStyle : "short",
    hairColor: allowed.hairColor.includes(a.hairColor) ? a.hairColor : allowed.hairColor[0],
    outfitColor: allowed.outfitColor.includes(a.outfitColor) ? a.outfitColor : allowed.outfitColor[0],
    bgColor: allowed.bgColor.includes(a.bgColor) ? a.bgColor : allowed.bgColor[0]
  };
}

function spyCount(n) {
  if (n <= 5) return 1;
  if (n <= 8) return 2;
  if (n <= 13) return 3;
  if (n <= 16) return 4;
  return 5;
}

function roomCode() {
  let code = "";
  do code = crypto.randomBytes(3).toString("hex").toUpperCase(); while (rooms.has(code));
  return code;
}

function getRoom(socketId) {
  const id = socketToRoom.get(socketId);
  return id ? rooms.get(id) || null : null;
}

function channel(id) {
  return `room:${id}`;
}

function aliveIds(room) {
  if (!room.game || room.game.status !== "running") return [...room.players.keys()];
  return [...room.players.keys()].filter((id) => !room.game.removed.has(id));
}

function buildCards() {
  return shuffle(CARDS).slice(0, 3).map((card) => ({
    id: crypto.randomUUID(),
    title: card.title,
    description: card.description,
    options: card.options.map((opt) => {
      const effects = {};
      for (const key of STAT_KEYS) {
        const base = opt.effects[key] || 0;
        if (!base) continue;
        effects[key] = base + rnd(-1, 1);
      }
      return { id: crypto.randomUUID(), label: opt.label, publicText: opt.publicText, effects, delayed: opt.delayed.map((d) => ({ ...d })) };
    })
  }));
}

function createGame(room) {
  const ids = [...room.players.keys()];
  const shuffledIds = shuffle(ids);
  const amount = Math.min(spyCount(ids.length), Math.max(1, ids.length - 1));
  const spies = new Set(shuffledIds.slice(0, amount));
  const roles = {};
  ids.forEach((id) => {
    roles[id] = spies.has(id) ? "spy" : "politician";
  });
  return {
    status: "running",
    day: 1,
    phase: "day",
    stats: cloneStats(BASE_STATS),
    dayStart: cloneStats(BASE_STATS),
    cards: [],
    votes: {},
    arrests: {},
    pendingReveal: null,
    pendingEffects: [],
    roles,
    spies,
    removed: new Set(),
    objective: pick(MISSIONS),
    event: null,
    story: "",
    news: [],
    results: [],
    winner: null
  };
}

function publicRooms() {
  return [...rooms.values()].map((r) => ({
    id: r.id,
    name: r.settings.name,
    players: r.players.size,
    maxPlayers: r.settings.maxPlayers,
    hasPassword: Boolean(r.settings.password),
    inGame: Boolean(r.game && r.game.status === "running"),
    locked: r.settings.locked
  }));
}

function emitRooms() {
  io.emit("rooms:list", publicRooms());
}

function finish(room, winner) {
  const game = room.game;
  if (!game || game.status !== "running") return;
  game.status = "ended";
  game.phase = "ended";
  game.winner = winner;
  news(game, winner === "spies" ? "Страна вошла в системный кризис. Шпионы победили." : "Шпионы разоблачены. Политики победили.", winner === "spies" ? "bad" : "good");
}

function citizensWin(room) {
  if (!room.game) return false;
  return [...room.game.spies].filter((id) => !room.game.removed.has(id)).length === 0;
}

function collapsed(stats) {
  const low = STAT_KEYS.filter((k) => stats[k] <= 15).length;
  return stats.economy <= 5 || stats.security <= 5 || stats.trust <= 5 || low >= 3;
}

function revealArrest(room) {
  const g = room.game;
  if (!g || !g.pendingReveal || g.pendingReveal.day !== g.day) return;
  const id = g.pendingReveal.targetId;
  const p = room.players.get(id);
  if (g.roles[id] === "spy") {
    g.removed.add(id);
    news(g, `${p ? p.nickname : "Подозреваемый"} оказался шпионом и арестован.`, "good");
  } else {
    news(g, `${p ? p.nickname : "Подозреваемый"} оказался невиновным.`, "bad");
  }
  g.pendingReveal = null;
}

function applyPending(room) {
  const g = room.game;
  if (!g) return;
  const next = [];
  for (const item of g.pendingEffects) {
    if (item.day <= g.day) {
      applyEffects(g.stats, item.effects);
      news(g, item.news, item.tone || "neutral");
    } else next.push(item);
  }
  g.pendingEffects = next;
}

function startDay(room) {
  const g = room.game;
  if (!g || g.status !== "running") return;
  revealArrest(room);
  applyPending(room);
  if (citizensWin(room)) return finish(room, "citizens");
  if (collapsed(g.stats)) return finish(room, "spies");

  const ev = pick(EVENTS);
  g.event = { title: ev.title, text: ev.text };
  g.story = pick(STORY);
  applyEffects(g.stats, ev.effects);
  news(g, `Событие дня: ${ev.title}. ${ev.text}`, "neutral");

  if (collapsed(g.stats)) return finish(room, "spies");

  g.phase = "day";
  g.cards = buildCards();
  g.votes = Object.fromEntries(g.cards.map((c) => [c.id, {}]));
  g.arrests = {};
  g.objective = pick(MISSIONS);
  g.dayStart = cloneStats(g.stats);
  g.results = [];
}

function advanceDay(room) {
  if (!room.game || room.game.status !== "running") return;
  room.game.day += 1;
  startDay(room);
}

function allCardsDone(room) {
  const g = room.game;
  if (!g || g.phase !== "day") return false;
  const voters = aliveIds(room);
  return g.cards.every((c) => voters.every((id) => Boolean(g.votes[c.id]?.[id])));
}

function resolveDay(room) {
  const g = room.game;
  if (!g || g.phase !== "day" || g.status !== "running") return;
  const voters = aliveIds(room);
  g.results = [];

  for (const card of g.cards) {
    const tally = {};
    voters.forEach((id) => {
      const vote = g.votes[card.id]?.[id];
      if (vote) tally[vote] = (tally[vote] || 0) + 1;
    });
    let max = -1;
    const top = [];
    card.options.forEach((o) => {
      const cnt = tally[o.id] || 0;
      if (cnt > max) {
        max = cnt;
        top.length = 0;
        top.push(o);
      } else if (cnt === max) top.push(o);
    });
    const winner = top[rnd(0, top.length - 1)];
    applyEffects(g.stats, winner.effects);
    news(g, `По карточке «${card.title}» выбрано: ${winner.label}. ${winner.publicText}`, "neutral");
    winner.delayed.forEach((d) => {
      g.pendingEffects.push({ day: g.day + d.inDays, effects: d.effects, news: d.news, tone: d.tone || "neutral" });
    });
    g.results.push({ cardTitle: card.title, winnerLabel: winner.label });
  }

  const ok = g.objective.check(g.dayStart, g.stats);
  const outcome = ok ? g.objective.success : g.objective.fail;
  g.pendingEffects.push({ day: g.day + 1, effects: outcome.effects, news: outcome.news, tone: outcome.tone });

  g.phase = "night";
  if (collapsed(g.stats)) return finish(room, "spies");
  if (citizensWin(room)) return finish(room, "citizens");
}

function allArrestsDone(room) {
  const g = room.game;
  if (!g || g.phase !== "arrest") return false;
  return aliveIds(room).every((id) => Object.prototype.hasOwnProperty.call(g.arrests, id));
}

function resolveArrest(room) {
  const g = room.game;
  if (!g || g.phase !== "arrest" || g.status !== "running") return;
  const voters = aliveIds(room);
  const tally = {};
  voters.forEach((id) => {
    const t = g.arrests[id];
    if (!t || t === "skip") return;
    if (!voters.includes(t)) return;
    tally[t] = (tally[t] || 0) + 1;
  });
  let target = null;
  let max = 0;
  Object.entries(tally).forEach(([id, cnt]) => {
    if (cnt > max) {
      max = cnt;
      target = id;
    }
  });
  const need = Math.floor(voters.length / 2) + 1;
  if (target && max >= need) {
    g.pendingReveal = { targetId: target, day: g.day + 1 };
    const p = room.players.get(target);
    news(g, `${p ? p.nickname : "Политик"} задержан(а). Вердикт будет завтра.`, "neutral");
  } else news(g, "Большинство за арест не набрано.", "neutral");

  advanceDay(room);
}

function snapshot(room, viewer) {
  const g = room.game;
  const payload = {
    id: room.id,
    hostId: room.hostId,
    settings: {
      name: room.settings.name,
      maxPlayers: room.settings.maxPlayers,
      hasPassword: Boolean(room.settings.password),
      locked: room.settings.locked
    },
    players: [...room.players.values()].map((p) => ({ id: p.id, nickname: p.nickname, avatar: p.avatar, isHost: p.isHost })),
    game: null
  };
  if (!g) return payload;
  payload.game = {
    status: g.status,
    day: g.day,
    phase: g.phase,
    stats: g.stats,
    myRole: g.roles[viewer] || null,
    objective: g.roles[viewer] === "spy" ? g.objective.text : null,
    spyTeam: g.roles[viewer] === "spy" ? [...g.spies].filter((id) => !g.removed.has(id)).map((id) => ({ id, nickname: room.players.get(id)?.nickname || "Шпион" })) : [],
    event: g.event,
    story: g.story,
    cards: g.cards.map((c) => ({ id: c.id, title: c.title, description: c.description, options: c.options.map((o) => ({ id: o.id, label: o.label, publicText: o.publicText })) })),
    myVotes: Object.fromEntries(Object.entries(g.votes).map(([cardId, votes]) => [cardId, votes[viewer] || null])),
    voteProgress: Object.fromEntries(g.cards.map((c) => [c.id, Object.keys(g.votes[c.id] || {}).length])),
    myArrestVote: g.arrests[viewer] || null,
    news: g.news,
    results: g.results,
    winner: g.winner,
    pendingReveal: g.pendingReveal ? { ...g.pendingReveal } : null
  };
  return payload;
}

function emitState(room) {
  room.players.forEach((player) => {
    io.to(player.id).emit("room:state", snapshot(room, player.id));
  });
  emitRooms();
}

function hostFix(room) {
  if (room.players.has(room.hostId)) return;
  const next = room.players.values().next().value;
  if (!next) return;
  room.hostId = next.id;
  room.players.forEach((p) => {
    p.isHost = p.id === room.hostId;
  });
}

function leaveRoom(room, socketId) {
  if (!room.players.has(socketId)) return;
  room.players.delete(socketId);
  socketToRoom.delete(socketId);
  dropVoice(socketId);
  if (room.game && room.game.status === "running") {
    room.game.removed.add(socketId);
    room.game.spies.delete(socketId);
    delete room.game.roles[socketId];
    Object.keys(room.game.votes).forEach((cardId) => delete room.game.votes[cardId][socketId]);
    delete room.game.arrests[socketId];
    if (citizensWin(room)) finish(room, "citizens");
    else if (collapsed(room.game.stats)) finish(room, "spies");
  }
  if (room.players.size === 0) {
    rooms.delete(room.id);
    emitRooms();
    return;
  }
  hostFix(room);
  emitState(room);
}

function dropVoice(socketId) {
  for (const [key, set] of voiceScopes.entries()) {
    if (!set.has(socketId)) continue;
    set.delete(socketId);
    const [roomId, scope] = key.split("::");
    io.to(channel(roomId)).emit("voice:user-left", { scope, id: socketId });
    if (set.size === 0) voiceScopes.delete(key);
  }
}
io.on("connection", (socket) => {
  socket.emit("session:connected", { id: socket.id });
  socket.emit("rooms:list", publicRooms());

  socket.on("player:register", (payload = {}, ack = () => {}) => {
    profiles.set(socket.id, {
      nickname: text(payload.nickname, "Игрок", 24),
      avatar: makeAvatar(payload.avatar)
    });
    ack({ ok: true, profile: profiles.get(socket.id) });
    socket.emit("rooms:list", publicRooms());
  });

  socket.on("rooms:list", (ack = () => {}) => {
    ack({ ok: true, rooms: publicRooms() });
  });

  socket.on("room:create", (payload = {}, ack = () => {}) => {
    const profile = profiles.get(socket.id);
    if (!profile) return ack({ ok: false, error: "Сначала укажите ник и внешность." });

    const current = getRoom(socket.id);
    if (current) {
      leaveRoom(current, socket.id);
      socket.leave(channel(current.id));
    }

    const id = roomCode();
    const room = {
      id,
      hostId: socket.id,
      settings: {
        name: text(payload.name, `Комната ${id}`, 42),
        password: text(payload.password, "", 30),
        maxPlayers: clamp(Number(payload.maxPlayers) || 20, 2, 20),
        locked: false
      },
      players: new Map([[socket.id, { id: socket.id, nickname: profile.nickname, avatar: profile.avatar, isHost: true }]]),
      game: null
    };

    rooms.set(id, room);
    socketToRoom.set(socket.id, id);
    socket.join(channel(id));
    ack({ ok: true, roomId: id });
    emitState(room);
  });

  socket.on("room:join", (payload = {}, ack = () => {}) => {
    const profile = profiles.get(socket.id);
    if (!profile) return ack({ ok: false, error: "Сначала укажите ник и внешность." });

    const roomId = text(payload.roomId, "", 12).toUpperCase();
    const room = rooms.get(roomId);
    if (!room) return ack({ ok: false, error: "Комната не найдена." });
    if (room.settings.locked) return ack({ ok: false, error: "Комната закрыта." });
    if (room.players.size >= room.settings.maxPlayers) return ack({ ok: false, error: "Комната заполнена." });
    if (room.settings.password && room.settings.password !== text(payload.password, "", 30)) return ack({ ok: false, error: "Неверный пароль." });
    if (room.game && room.game.status === "running") return ack({ ok: false, error: "Игра уже началась." });

    const current = getRoom(socket.id);
    if (current) {
      leaveRoom(current, socket.id);
      socket.leave(channel(current.id));
    }

    room.players.set(socket.id, { id: socket.id, nickname: profile.nickname, avatar: profile.avatar, isHost: false });
    socketToRoom.set(socket.id, room.id);
    socket.join(channel(room.id));
    ack({ ok: true, roomId: room.id });
    emitState(room);
  });

  socket.on("room:leave", (ack = () => {}) => {
    const room = getRoom(socket.id);
    if (!room) return ack({ ok: true });
    leaveRoom(room, socket.id);
    socket.leave(channel(room.id));
    ack({ ok: true });
  });

  socket.on("room:update", (payload = {}, ack = () => {}) => {
    const room = getRoom(socket.id);
    if (!room) return ack({ ok: false, error: "Комната не найдена." });
    if (room.hostId !== socket.id) return ack({ ok: false, error: "Только хост может менять настройки." });

    if (typeof payload.name === "string") room.settings.name = text(payload.name, room.settings.name, 42);
    if (typeof payload.password === "string") room.settings.password = text(payload.password, "", 30);
    if (typeof payload.maxPlayers !== "undefined") {
      room.settings.maxPlayers = clamp(Number(payload.maxPlayers) || room.settings.maxPlayers, 2, 20);
      if (room.players.size > room.settings.maxPlayers) room.settings.maxPlayers = room.players.size;
    }
    if (typeof payload.locked !== "undefined") room.settings.locked = Boolean(payload.locked);

    ack({ ok: true });
    emitState(room);
  });

  socket.on("game:start", (ack = () => {}) => {
    const room = getRoom(socket.id);
    if (!room) return ack({ ok: false, error: "Вы не в комнате." });
    if (room.hostId !== socket.id) return ack({ ok: false, error: "Только хост может стартовать." });
    if (room.players.size < MIN_PLAYERS) return ack({ ok: false, error: `Нужно минимум ${MIN_PLAYERS} игрока.` });
    if (room.game && room.game.status === "running") return ack({ ok: false, error: "Игра уже идет." });

    room.game = createGame(room);
    news(room.game, "Игра началась. Шпионы получили свои цели.", "neutral");
    startDay(room);
    ack({ ok: true });
    emitState(room);
  });

  socket.on("game:vote-card", (payload = {}, ack = () => {}) => {
    const room = getRoom(socket.id);
    const g = room?.game;
    if (!g || g.status !== "running") return ack({ ok: false, error: "Игра не запущена." });
    if (g.phase !== "day") return ack({ ok: false, error: "Сейчас не дневная фаза." });
    if (g.removed.has(socket.id)) return ack({ ok: false, error: "Вы выбыли из партии." });

    const card = g.cards.find((c) => c.id === payload.cardId);
    if (!card) return ack({ ok: false, error: "Карточка не найдена." });
    const opt = card.options.find((o) => o.id === payload.optionId);
    if (!opt) return ack({ ok: false, error: "Опция не найдена." });

    g.votes[card.id][socket.id] = opt.id;
    ack({ ok: true });

    if (allCardsDone(room)) resolveDay(room);
    emitState(room);
  });

  socket.on("game:force-day", (ack = () => {}) => {
    const room = getRoom(socket.id);
    const g = room?.game;
    if (!g || g.status !== "running") return ack({ ok: false, error: "Игра не запущена." });
    if (room.hostId !== socket.id) return ack({ ok: false, error: "Только хост." });
    if (g.phase !== "day") return ack({ ok: false, error: "Сейчас не дневная фаза." });
    resolveDay(room);
    ack({ ok: true });
    emitState(room);
  });

  socket.on("game:end-night", (ack = () => {}) => {
    const room = getRoom(socket.id);
    const g = room?.game;
    if (!g || g.status !== "running") return ack({ ok: false, error: "Игра не запущена." });
    if (room.hostId !== socket.id) return ack({ ok: false, error: "Только хост." });
    if (g.phase !== "night") return ack({ ok: false, error: "Сейчас не ночь." });
    g.phase = "arrest";
    g.arrests = {};
    ack({ ok: true });
    emitState(room);
  });

  socket.on("game:vote-arrest", (payload = {}, ack = () => {}) => {
    const room = getRoom(socket.id);
    const g = room?.game;
    if (!g || g.status !== "running") return ack({ ok: false, error: "Игра не запущена." });
    if (g.phase !== "arrest") return ack({ ok: false, error: "Сейчас не фаза ареста." });
    if (g.removed.has(socket.id)) return ack({ ok: false, error: "Вы выбыли." });

    const targetId = payload.targetId;
    const live = aliveIds(room);
    if (targetId && targetId !== "skip" && !live.includes(targetId)) return ack({ ok: false, error: "Неверная цель." });

    g.arrests[socket.id] = targetId || "skip";
    ack({ ok: true });
    if (allArrestsDone(room)) resolveArrest(room);
    emitState(room);
  });

  socket.on("game:force-arrest", (ack = () => {}) => {
    const room = getRoom(socket.id);
    const g = room?.game;
    if (!g || g.status !== "running") return ack({ ok: false, error: "Игра не запущена." });
    if (room.hostId !== socket.id) return ack({ ok: false, error: "Только хост." });
    if (g.phase !== "arrest") return ack({ ok: false, error: "Сейчас не фаза ареста." });
    resolveArrest(room);
    ack({ ok: true });
    emitState(room);
  });

  socket.on("chat:send", (payload = {}, ack = () => {}) => {
    const room = getRoom(socket.id);
    const g = room?.game;
    if (!room) return ack({ ok: false, error: "Вы не в комнате." });
    const msg = text(payload.text, "", 300);
    if (!msg) return ack({ ok: false, error: "Пустое сообщение." });

    const scope = payload.scope === "spy" ? "spy" : "public";
    if (scope === "spy") {
      const allowed = Boolean(g && g.status === "running" && g.phase === "night" && g.roles[socket.id] === "spy" && !g.removed.has(socket.id));
      if (!allowed) return ack({ ok: false, error: "Шпионский чат доступен только ночью и только шпионам." });
    }

    const payloadMessage = {
      id: crypto.randomUUID(),
      fromId: socket.id,
      fromNickname: room.players.get(socket.id)?.nickname || "Игрок",
      text: msg,
      scope,
      at: Date.now()
    };

    if (scope === "spy") {
      [...g.spies].forEach((id) => {
        if (!g.removed.has(id)) io.to(id).emit("chat:message", payloadMessage);
      });
    } else {
      io.to(channel(room.id)).emit("chat:message", payloadMessage);
    }
    ack({ ok: true });
  });

  socket.on("voice:join", (payload = {}, ack = () => {}) => {
    const room = getRoom(socket.id);
    if (!room) return ack({ ok: false, error: "Вы не в комнате." });
    const g = room.game;
    const scope = payload.scope === "spy" ? "spy" : "public";

    if (scope === "spy") {
      const allowed = Boolean(g && g.status === "running" && g.phase === "night" && g.roles[socket.id] === "spy" && !g.removed.has(socket.id));
      if (!allowed) return ack({ ok: false, error: "Приватная линия доступна только шпионам ночью." });
    }

    dropVoice(socket.id);

    const key = `${room.id}::${scope}`;
    const set = voiceScopes.get(key) || new Set();
    const members = [...set];
    set.add(socket.id);
    voiceScopes.set(key, set);
    ack({ ok: true, scope, members });
  });

  socket.on("voice:leave", (ack = () => {}) => {
    dropVoice(socket.id);
    ack({ ok: true });
  });

  socket.on("voice:signal", (payload = {}, ack = () => {}) => {
    const room = getRoom(socket.id);
    if (!room) return ack({ ok: false, error: "Вы не в комнате." });
    const scope = payload.scope === "spy" ? "spy" : "public";
    const key = `${room.id}::${scope}`;
    const set = voiceScopes.get(key);
    if (!set || !set.has(socket.id) || !set.has(payload.to)) return ack({ ok: false, error: "Канал недоступен." });

    io.to(payload.to).emit("voice:signal", { from: socket.id, scope, data: payload.data });
    ack({ ok: true });
  });

  socket.on("disconnect", () => {
    profiles.delete(socket.id);
    dropVoice(socket.id);
    const room = getRoom(socket.id);
    if (!room) return;
    socket.leave(channel(room.id));
    leaveRoom(room, socket.id);
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server started on http://localhost:${PORT}`);
});
