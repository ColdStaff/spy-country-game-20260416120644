
const express = require("express");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;
const MIN_PLAYERS = 3;
const MAX_HISTORY = 20;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();
const socketToRoom = new Map();
const profiles = new Map();

const BASE_STATS = {
  economy: 55,
  security: 55,
  welfare: 55,
  trust: 55,
  ecology: 55,
  birthRate: 55
};
const STAT_KEYS = Object.keys(BASE_STATS);
const STAT_LABELS = {
  economy: "Экономика",
  security: "Безопасность",
  welfare: "Благосостояние",
  trust: "Доверие",
  ecology: "Экология",
  birthRate: "Рождаемость"
};

const EVENTS = [
  {
    title: "Срыв поставок топлива",
    text: "Три региона остались без плановых поставок, рынок нервно реагирует.",
    effects: { economy: -5, welfare: -3, trust: -1 }
  },
  {
    title: "Визит иностранных инвесторов",
    text: "Капитал готов зайти в страну, но только при прозрачных правилах.",
    effects: { economy: 4, trust: 2 }
  },
  {
    title: "Шторм в прибрежных районах",
    text: "Стихийное бедствие разрушило часть инфраструктуры и логистики.",
    effects: { welfare: -4, ecology: -4, economy: -2 }
  },
  {
    title: "Крупная кибератака",
    text: "Удар пришелся по госслужбам и платежным системам.",
    effects: { security: -6, trust: -3 }
  },
  {
    title: "Прорыв в агросекторе",
    text: "Новый урожай снижает инфляцию на базовые продукты.",
    effects: { economy: 3, welfare: 3, birthRate: 1 }
  },
  {
    title: "Утечка служебной переписки",
    text: "Оппозиция требует отчет о спорных решениях кабинета.",
    effects: { trust: -5, security: -1 }
  }
];

const STORY_BEATS = [
  "Во фракциях растет недоверие: слишком многие замечают несогласованность решений.",
  "На рынках обсуждают, выдержит ли страна еще один политический просчет.",
  "В международной прессе появляется версия о внешнем влиянии на внутреннюю политику.",
  "Региональные элиты требуют быстрых и понятных действий, иначе обещают блокировать реформы.",
  "Общество расколото: часть граждан ждет жесткого курса, часть требует мягкой стабилизации."
];

const GLOBAL_PROBLEMS = [
  {
    title: "Энергетический дефицит",
    description:
      "Страна входит в холодный сезон с дефицитом энергии. Если к дедлайну не поднять экономику, безопасность и доверие, начнется масштабный управленческий кризис.",
    deadlineDay: 6,
    targets: { economy: 64, security: 62, trust: 60 },
    rewardEffects: { trust: 4, welfare: 3 },
    failEffects: { economy: -8, trust: -8, welfare: -6 },
    successText: "Кризис энергосистемы локализован: удалось удержать регионы от отключений.",
    failText: "Энергетический кризис сорвал работу регионов и ударил по стабильности."
  },
  {
    title: "Кризис доверия институтам",
    description:
      "После серии скандалов граждане перестают верить управленцам. Нужно восстановить доверие, благосостояние и безопасность до критического срока.",
    deadlineDay: 5,
    targets: { trust: 65, welfare: 61, security: 60 },
    rewardEffects: { trust: 5, economy: 2 },
    failEffects: { trust: -10, economy: -5, security: -4 },
    successText: "Антикризисный пакет вернул легитимность институтам и снизил протестный фон.",
    failText: "Недоверие к институтам перешло в системный общественный конфликт."
  },
  {
    title: "Демографический спад",
    description:
      "Падение рождаемости и доходов семей угрожает долгосрочной устойчивости. Политикам нужно улучшить ключевые показатели до дедлайна.",
    deadlineDay: 7,
    targets: { birthRate: 63, welfare: 62, economy: 60 },
    rewardEffects: { birthRate: 4, trust: 2 },
    failEffects: { birthRate: -8, welfare: -6, trust: -4 },
    successText: "Демографическая программа сработала: регионы фиксируют рост семейной активности.",
    failText: "Демографический спад усилился и ударил по социальной устойчивости страны."
  }
];

const CARDS = [
  {
    title: "Антикризисный бюджет",
    description: "Правительство делит резервы между промышленностью, армией и соцподдержкой.",
    lore:
      "Казна истощена, а регионы требуют денег уже сейчас. Любое решение создаст новую группу недовольных: либо бизнес, либо семьи, либо силовой блок.",
    options: [
      {
        label: "Резко поддержать промышленность",
        publicText: "Промышленный рост позволит закрыть бюджетные дыры.",
        effects: { economy: 6, welfare: -5, trust: -2 },
        delayed: [{ inDays: 1, effects: { birthRate: -2 }, news: "После секвестра регионы сократили семейные программы.", tone: "bad" }]
      },
      {
        label: "Дать приоритет социальной поддержке",
        publicText: "Стабильность домохозяйств снижает риск масштабных протестов.",
        effects: { welfare: 5, trust: 3, economy: -2 },
        delayed: [{ inDays: 2, effects: { economy: -2 }, news: "Индустриальные проекты замедлились из-за нехватки финансирования.", tone: "neutral" }]
      },
      {
        label: "Компромиссный пакет",
        publicText: "Сдержанный баланс без резких перекосов.",
        effects: { economy: 2, welfare: 2, trust: 1 },
        delayed: []
      }
    ]
  },
  {
    title: "Пограничная политика",
    description: "На границе фиксируют действия неизвестных групп и каналов контрабанды.",
    lore:
      "Силовики просят экстренный бюджет, МИД настаивает на переговорах, а бизнес опасается обвала логистики. Любой выбор меняет расклад влияния внутри кабинета.",
    options: [
      {
        label: "Немедленно усилить рубежи",
        publicText: "Жесткий контроль снизит риск диверсий в коротком горизонте.",
        effects: { security: 7, economy: -3, welfare: -1 },
        delayed: []
      },
      {
        label: "Ставка на дипломатический трек",
        publicText: "Переговоры дешевле, чем затяжная силовая эскалация.",
        effects: { security: 2, trust: 2, economy: 1 },
        delayed: [{ inDays: 1, effects: { security: -2 }, news: "Переговоры затянулись, часть рисков вернулась.", tone: "neutral" }]
      },
      {
        label: "Сократить оборонный бюджет",
        publicText: "Высвобожденные средства поддержат внутренний рынок.",
        effects: { economy: 4, welfare: 2, security: -6 },
        delayed: []
      }
    ]
  },
  {
    title: "Медиареформа",
    description: "Информационный хаос усиливает панику и политическое давление.",
    lore:
      "В стране спорят, что важнее: жестко подавить дезинформацию или сохранить открытое поле. Ошибка в балансе может подорвать легитимность власти.",
    options: [
      {
        label: "Ввести жесткие ограничения",
        publicText: "Без контроля инфополя государство теряет управляемость.",
        effects: { security: 4, trust: -5 },
        delayed: [{ inDays: 2, effects: { trust: -2 }, news: "Репутационные потери от жесткой реформы продолжают расти.", tone: "bad" }]
      },
      {
        label: "Создать независимый совет",
        publicText: "Прозрачный надзор повышает легитимность решений.",
        effects: { trust: 4, security: 1, economy: 1 },
        delayed: []
      },
      {
        label: "Не вмешиваться",
        publicText: "Рынок сам выровняет информационный шум.",
        effects: { trust: -1, security: -3 },
        delayed: [{ inDays: 1, effects: { trust: -2 }, news: "Инфополе осталось хаотичным, число фейков выросло.", tone: "bad" }]
      }
    ]
  },
  {
    title: "Зеленый переход",
    description: "Экологический долг страны достиг критической отметки.",
    lore:
      "Международные партнеры угрожают санкциями за загрязнение, но закрытие старых производств может обрушить занятость в промышленных районах.",
    options: [
      {
        label: "Закрыть старые мощности сейчас",
        publicText: "Экологию нужно спасать немедленно, даже ценой шока.",
        effects: { ecology: 7, economy: -5, welfare: -2 },
        delayed: [{ inDays: 2, effects: { trust: -2 }, news: "Закрытие заводов вызвало волну недовольства в промышленных городах.", tone: "neutral" }]
      },
      {
        label: "Переходить поэтапно",
        publicText: "Модернизация без резкого обвала рабочих мест.",
        effects: { ecology: 3, trust: 2, economy: 1 },
        delayed: []
      },
      {
        label: "Оставить текущий курс",
        publicText: "Экономика пока важнее долгого экологического эффекта.",
        effects: { economy: 3, ecology: -6, trust: -2 },
        delayed: [{ inDays: 1, effects: { welfare: -2 }, news: "Экологические жалобы населения усилились.", tone: "bad" }]
      }
    ]
  },
  {
    title: "Налоговая политика",
    description: "Дефицит бюджета требует быстрых фискальных решений.",
    lore:
      "Крупный бизнес давит на кабинет, профсоюзы угрожают массовыми выступлениями, а Минфин предупреждает о риске кассового разрыва.",
    options: [
      {
        label: "Повысить налоги для корпораций",
        publicText: "Сильные платят больше, бюджет стабилизируется.",
        effects: { welfare: 3, trust: 2, economy: -3 },
        delayed: [{ inDays: 1, effects: { economy: -1 }, news: "Инвесторы временно сократили новые проекты.", tone: "neutral" }]
      },
      {
        label: "Снизить налоги ради инвестиций",
        publicText: "Низкие ставки ускорят экономику и занятость.",
        effects: { economy: 5, trust: -2, welfare: -1 },
        delayed: []
      },
      {
        label: "Ввести временный чрезвычайный сбор",
        publicText: "Мягкий компромисс до выхода из кризиса.",
        effects: { economy: 2, security: 1, trust: -1 },
        delayed: []
      }
    ]
  },
  {
    title: "Программа рождаемости",
    description: "Снижение рождаемости превращается в стратегическую угрозу.",
    lore:
      "Молодые семьи откладывают детей из-за цен и неуверенности в будущем. Кабинет спорит: делать ли прямые выплаты или стимулировать жилье и занятость.",
    options: [
      {
        label: "Увеличить прямые выплаты",
        publicText: "Семьям нужен быстрый финансовый сигнал от государства.",
        effects: { birthRate: 6, welfare: 2, economy: -2 },
        delayed: []
      },
      {
        label: "Субсидировать ипотеку для молодых",
        publicText: "Доступное жилье даст долгосрочный эффект для рождаемости.",
        effects: { birthRate: 3, economy: 2, trust: 1 },
        delayed: [{ inDays: 2, effects: { welfare: -1 }, news: "Рост спроса на жилье ускорил инфляцию аренды.", tone: "neutral" }]
      },
      {
        label: "Оставить текущие меры",
        publicText: "Бюджет не выдержит новой волны обязательств.",
        effects: { birthRate: -3, trust: -2 },
        delayed: []
      }
    ]
  },
  {
    title: "Реформа образования",
    description: "Падает качество подготовки кадров, бизнес и регионы требуют обновления системы.",
    lore:
      "Учителя ждут реального повышения оплаты, регионы просят инфраструктуру, а экономический блок считает каждый рубль. Ошибка сегодня проявится через несколько дней.",
    options: [
      {
        label: "Срочно поднять зарплаты учителям",
        publicText: "Мотивация преподавателей важнее всего в коротком горизонте.",
        effects: { trust: 3, welfare: 2, economy: -3 },
        delayed: [{ inDays: 2, effects: { birthRate: 1 }, news: "Рост стабильности в школах улучшил демографические ожидания семей.", tone: "good" }]
      },
      {
        label: "Вложиться в цифровую инфраструктуру",
        publicText: "Технологии дадут системе гибкость и охват отдаленных регионов.",
        effects: { economy: 2, trust: 1, welfare: -1 },
        delayed: [{ inDays: 1, effects: { trust: 1 }, news: "Первые регионы отчитались о запуске новых образовательных платформ.", tone: "good" }]
      },
      {
        label: "Оставить текущее финансирование",
        publicText: "Бюджет не потянет масштабную реформу прямо сейчас.",
        effects: { economy: 1, trust: -3, welfare: -2 },
        delayed: []
      }
    ]
  },
  {
    title: "Водный кризис регионов",
    description: "Несколько областей фиксируют нехватку воды и перебои в снабжении.",
    lore:
      "Промышленные лобби не хотят ограничений, экологи требуют экстренных мер, население ждет быстрых решений. Половинчатый вариант может ударить сразу по нескольким показателям.",
    options: [
      {
        label: "Ограничить промышленные квоты",
        publicText: "Сначала вода для населения, затем производство.",
        effects: { ecology: 6, welfare: 2, economy: -4 },
        delayed: []
      },
      {
        label: "Запустить дорогие опреснительные проекты",
        publicText: "Инфраструктура даст устойчивый эффект на годы вперед.",
        effects: { ecology: 3, economy: -2, trust: 2 },
        delayed: [{ inDays: 2, effects: { welfare: 2 }, news: "Новые мощности по воде частично сняли напряжение в городах.", tone: "good" }]
      },
      {
        label: "Временный подвоз без реформ",
        publicText: "Локально закрыть дефицит и не ломать отрасли.",
        effects: { welfare: 1, economy: 1, ecology: -3 },
        delayed: [{ inDays: 1, effects: { trust: -2 }, news: "Временные меры не решили проблему воды, регионы вновь требуют план.", tone: "bad" }]
      }
    ]
  },
  {
    title: "Транспортный коридор",
    description: "Стране предлагают крупный транзитный контракт с внешними партнерами.",
    lore:
      "Сделка обещает доходы и рабочие места, но требует уступок по контролю инфраструктуры. Внутри кабинета спорят о рисках зависимости.",
    options: [
      {
        label: "Подписать соглашение в полном объеме",
        publicText: "Быстрый приток инвестиций ускорит экономику.",
        effects: { economy: 6, security: -3, trust: -1 },
        delayed: [{ inDays: 2, effects: { welfare: 2 }, news: "Транзит дал дополнительные доходы для региональных бюджетов.", tone: "good" }]
      },
      {
        label: "Подписать с жесткими условиями суверенного контроля",
        publicText: "Рост торговли без потери стратегической самостоятельности.",
        effects: { economy: 3, security: 2, trust: 1 },
        delayed: []
      },
      {
        label: "Отложить сделку на год",
        publicText: "Сначала внутренний аудит и подготовка собственных мощностей.",
        effects: { security: 2, trust: -1, economy: -2 },
        delayed: []
      }
    ]
  },
  {
    title: "Судебная перезагрузка",
    description: "Общество требует очистки судебной системы после ряда скандалов.",
    lore:
      "Радикальные шаги могут обрушить управляемость на местах, но медленные реформы воспринимаются как имитация. Нужно выбрать темп и глубину изменений.",
    options: [
      {
        label: "Массовая переаттестация судей",
        publicText: "Жесткая проверка вернет доверие к институтам.",
        effects: { trust: 5, security: -2, welfare: -1 },
        delayed: [{ inDays: 1, effects: { security: -1 }, news: "Перегрузка судебной системы вызвала задержки по ключевым делам.", tone: "neutral" }]
      },
      {
        label: "Пошаговая реформа с общественным контролем",
        publicText: "Стабильный переход без управленческого шока.",
        effects: { trust: 3, security: 1, economy: 1 },
        delayed: []
      },
      {
        label: "Сохранить текущую модель",
        publicText: "Сейчас стране нужен порядок, а не системный эксперимент.",
        effects: { security: 2, trust: -4 },
        delayed: []
      }
    ]
  },
  {
    title: "Курс национальной валюты",
    description: "Резкие колебания курса бьют по ценам и импортным поставкам.",
    lore:
      "Центробанк и кабинет не сходятся в приоритетах: стабилизировать рынок любой ценой или поддержать экспорт и бюджетные доходы.",
    options: [
      {
        label: "Жесткая валютная интервенция",
        publicText: "Стабильный курс снизит инфляционные ожидания граждан.",
        effects: { trust: 3, welfare: 2, economy: -3 },
        delayed: []
      },
      {
        label: "Умеренный плавающий курс",
        publicText: "Баланс между стабильностью и конкурентоспособностью экспорта.",
        effects: { economy: 2, trust: 1, welfare: 1 },
        delayed: []
      },
      {
        label: "Ослабить валюту ради экспорта",
        publicText: "Экспортерам нужен стимул для роста выручки.",
        effects: { economy: 4, welfare: -3, trust: -2 },
        delayed: [{ inDays: 1, effects: { birthRate: -1 }, news: "Рост цен на импорт усилил потребительскую тревожность.", tone: "bad" }]
      }
    ]
  },
  {
    title: "Резерв медицины",
    description: "Система здравоохранения просит дополнительные резервы на случай вспышек заболеваний.",
    lore:
      "Минфин настаивает на экономии, медики говорят о риске коллапса в регионах. Политическое решение скажется и на доверии, и на бюджете.",
    options: [
      {
        label: "Создать крупный медрезерв сейчас",
        publicText: "Профилактика дешевле системного кризиса здравоохранения.",
        effects: { welfare: 5, trust: 3, economy: -4 },
        delayed: []
      },
      {
        label: "Точечный резерв для групп риска",
        publicText: "Адресная модель удержит баланс расходов и эффекта.",
        effects: { welfare: 2, trust: 2, economy: -1 },
        delayed: []
      },
      {
        label: "Перенести программу на следующий квартал",
        publicText: "Сначала закрыть текущие бюджетные дыры.",
        effects: { economy: 2, welfare: -3, trust: -2 },
        delayed: [{ inDays: 2, effects: { security: -2 }, news: "Локальные вспышки болезней перегрузили региональные больницы.", tone: "bad" }]
      }
    ]
  },
  {
    title: "Рынок аренды жилья",
    description: "Арендные ставки выросли до уровня, который ударил по молодым семьям.",
    lore:
      "Собственники требуют защиты доходов, арендаторы выходят на протесты, регионы боятся оттока специалистов. Нужен политический компромисс.",
    options: [
      {
        label: "Ввести потолок роста арендных ставок",
        publicText: "Социальная стабилизация важнее рыночной сверхприбыли.",
        effects: { welfare: 4, trust: 3, economy: -2 },
        delayed: [{ inDays: 1, effects: { economy: -1 }, news: "Часть инвесторов отложила запуск новых жилых проектов.", tone: "neutral" }]
      },
      {
        label: "Субсидировать аренду для молодых семей",
        publicText: "Точечная помощь без прямого давления на рынок.",
        effects: { welfare: 3, birthRate: 2, economy: -2 },
        delayed: []
      },
      {
        label: "Не вмешиваться в цены",
        publicText: "Рынок должен сам найти равновесие без ручного управления.",
        effects: { economy: 2, welfare: -4, trust: -3 },
        delayed: []
      }
    ]
  },
  {
    title: "Муниципальная автономия",
    description: "Регионы требуют больше полномочий и собственных бюджетных инструментов.",
    lore:
      "Центр опасается распада управляемости, но давление на местах растет. Решение повлияет на безопасность, доверие и скорость локальных реформ.",
    options: [
      {
        label: "Передать регионам расширенные полномочия",
        publicText: "Местные власти быстрее решают реальные проблемы территорий.",
        effects: { trust: 4, welfare: 2, security: -3 },
        delayed: [{ inDays: 2, effects: { economy: 1 }, news: "Ряд регионов ускорил запуск локальных проектов развития.", tone: "good" }]
      },
      {
        label: "Пилот в нескольких областях",
        publicText: "Ограниченный эксперимент без потери федерального контроля.",
        effects: { trust: 2, security: 1, economy: 1 },
        delayed: []
      },
      {
        label: "Сохранить жесткую централизацию",
        publicText: "Единое управление снижает риск политического распада.",
        effects: { security: 3, trust: -3, welfare: -1 },
        delayed: []
      }
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
function statLabel(key) {
  return STAT_LABELS[key] || key;
}
function effectsSummary(effects) {
  return STAT_KEYS
    .filter((k) => typeof effects[k] === "number" && effects[k] !== 0)
    .map((k) => `${statLabel(k)} ${effects[k] > 0 ? "+" : ""}${effects[k]}`)
    .join(", ");
}
function news(game, message, tone = "neutral") {
  game.news.unshift({ id: crypto.randomUUID(), day: game.day, text: message, tone, at: Date.now() });
}

function statsRanking(stats, order = "desc") {
  const factor = order === "asc" ? 1 : -1;
  return STAT_KEYS.map((key) => ({ key, value: stats[key], label: statLabel(key) })).sort((a, b) => factor * (a.value - b.value));
}

function endingDecisionLines(history) {
  const rounds = [...history].slice(0, 4).reverse();
  const lines = [];
  for (const round of rounds) {
    const card = round.cards?.[0];
    if (!card) continue;
    lines.push(`День ${round.day}: по вопросу «${card.cardTitle}» кабинет утвердил «${card.winnerLabel}».`);
  }
  return lines;
}

function buildEndingLore(game, winner) {
  const highs = statsRanking(game.stats, "desc").slice(0, 2);
  const lows = statsRanking(game.stats, "asc").slice(0, 2);
  const totalRounds = game.history.length;
  const sabotageTotal = game.history.reduce((sum, round) => sum + (round.sabotageSuccess || 0), 0);
  const sabotageRatio = totalRounds ? sabotageTotal / (totalRounds * 3) : 0;
  const decisionLines = endingDecisionLines(game.history);
  const global = game.globalProblem;

  const bestStats = highs.map((s) => `${s.label} ${s.value}`).join(", ");
  const weakStats = lows.map((s) => `${s.label} ${s.value}`).join(", ");
  const sabotageText =
    sabotageRatio >= 0.66
      ? "Шпионская сеть почти каждый цикл проводила нужные ей решения, и внутренние механизмы страны системно рассыпались."
      : sabotageRatio >= 0.4
        ? "Шпионы регулярно вмешивались в курс реформ, создавая цепочку управленческих перекосов и взаимных блокировок."
        : "Большинство диверсий было вовремя сорвано, и кабинет удержал управление даже в фазах высокого давления.";

  const globalText = global
    ? global.failed
      ? `Глобальная проблема «${global.title}» была провалена, что стало точкой невозврата для системы.`
      : global.resolved
        ? `Глобальная проблема «${global.title}» была закрыта политиками до критического срока.`
        : `Глобальная проблема «${global.title}» осталась частично нерешенной и продолжила давить на систему.`
    : "";

  const decisionsText = decisionLines.length ? `Ключевые развилки партии: ${decisionLines.join(" ")}` : "";

  if (winner === "spies") {
    return {
      headline: "Победа шпионов",
      conclusion: "Иностранные агенты добились стратегического развала институтов.",
      lore: [
        "К финалу партии государство не выдержало накопленного давления: локальные просчеты сложились в единый кризис управления.",
        sabotageText,
        `Слабые контуры к концу матча: ${weakStats}.`,
        globalText,
        decisionsText
      ]
        .filter(Boolean)
        .join("\n\n")
    };
  }

  return {
    headline: "Победа политиков",
    conclusion: "Шпионская сеть раскрыта, курс страны удержан.",
    lore: [
      "Политики сохранили управляемость и не дали внешнему сценарию довести страну до обрушения.",
      sabotageText,
      `Сильные контуры к концу матча: ${bestStats}.`,
      globalText,
      decisionsText
    ]
      .filter(Boolean)
      .join("\n\n")
  };
}

function makeAvatar(input) {
  const a = input && typeof input === "object" ? input : {};
  const allowed = {
    skin: ["#F4D4B5", "#D8B08C", "#A97E5F", "#7A573E"],
    hairStyle: ["short", "long", "curly", "bald"],
    hairColor: ["#1E1E25", "#5E3A1C", "#8B5A2B", "#A58D73", "#6A1E1E"],
    outfitColor: ["#5DA9E9", "#66C2A5", "#E07A5F", "#B56576", "#9D4EDD", "#F2C14E"],
    bgColor: ["#2D4059", "#4C3B4D", "#2C666E", "#594545", "#285943", "#5A6878"]
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
function buildCards(game) {
  const recent = new Set((game && game.recentCardTitles) || []);
  let pool = CARDS.filter((card) => !recent.has(card.title));
  if (pool.length < 3) pool = CARDS;

  const picked = shuffle(pool).slice(0, 3);
  if (game) {
    const titles = picked.map((c) => c.title);
    game.recentCardTitles = [...(game.recentCardTitles || []), ...titles].slice(-6);
  }

  return picked.map((card) => ({
    id: crypto.randomUUID(),
    title: card.title,
    description: card.description,
    lore: card.lore,
    options: card.options.map((opt) => {
      const effects = {};
      for (const key of STAT_KEYS) {
        const base = opt.effects[key] || 0;
        if (!base) continue;
        effects[key] = base + rnd(-1, 1);
      }
      return {
        id: crypto.randomUUID(),
        label: opt.label,
        publicText: opt.publicText,
        effects,
        delayed: opt.delayed.map((d) => ({ ...d }))
      };
    })
  }));
}

function sabotageScore(option) {
  let score = 0;
  for (const key of STAT_KEYS) {
    const value = option.effects[key] || 0;
    if (value < 0) score += Math.abs(value) * 1.6;
    else if (value > 0) score -= value * 0.45;
  }
  for (const delayed of option.delayed || []) {
    for (const key of STAT_KEYS) {
      const value = delayed.effects?.[key] || 0;
      if (value < 0) score += Math.abs(value) * 1.15;
      else if (value > 0) score -= value * 0.35;
    }
  }
  return score;
}

function positiveSpin(option) {
  const positives = STAT_KEYS
    .filter((k) => (option.effects[k] || 0) > 0)
    .map((k) => ({ key: k, value: option.effects[k] }))
    .sort((a, b) => b.value - a.value);

  if (positives.length === 0) {
    return "Говорите о стабильности и отказе от резких рисков.";
  }

  const best = positives[0];
  return `Подчеркивайте плюс по показателю «${statLabel(best.key)}» и обещайте быструю выгоду.`;
}

function buildSpyOrders(cards) {
  return cards.map((card) => {
    const ranked = [...card.options].sort((a, b) => sabotageScore(b) - sabotageScore(a));
    const target = ranked[0];
    return {
      cardId: card.id,
      cardTitle: card.title,
      targetOptionId: target.id,
      targetOptionLabel: target.label,
      agentGoal: `Продвигайте вариант: «${target.label}».`,
      coverStory: `Как убеждать политиков: ${target.publicText} ${positiveSpin(target)}`,
      sabotagePlan: `Скрытый расчёт: ${effectsSummary(target.effects) || "влияние проявится позже"}.`
    };
  });
}

function createGlobalProblem() {
  const template = pick(GLOBAL_PROBLEMS);
  return {
    title: template.title,
    description: template.description,
    deadlineDay: template.deadlineDay,
    targets: { ...template.targets },
    rewardEffects: { ...template.rewardEffects },
    failEffects: { ...template.failEffects },
    successText: template.successText,
    failText: template.failText,
    resolved: false,
    failed: false
  };
}

function globalProblemState(problem, stats) {
  const targets = Object.entries(problem.targets).map(([key, target]) => ({
    key,
    label: statLabel(key),
    target,
    current: stats[key],
    reached: stats[key] >= target
  }));
  const reachedCount = targets.filter((t) => t.reached).length;
  return {
    title: problem.title,
    description: problem.description,
    deadlineDay: problem.deadlineDay,
    resolved: problem.resolved,
    failed: problem.failed,
    progress: Math.floor((reachedCount / Math.max(1, targets.length)) * 100),
    targets
  };
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
    cards: [],
    votes: {},
    arrests: {},
    pendingReveal: null,
    pendingEffects: [],
    roles,
    spies,
    removed: new Set(),
    event: null,
    story: "",
    news: [],
    results: [],
    history: [],
    spyOrders: [],
    recentCardTitles: [],
    globalProblem: createGlobalProblem(),
    ending: null,
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

function collapsed(stats) {
  const low = STAT_KEYS.filter((k) => stats[k] <= 15).length;
  return stats.economy <= 5 || stats.security <= 5 || stats.trust <= 5 || low >= 3;
}

function citizensWin(room) {
  if (!room.game) return false;
  return [...room.game.spies].filter((id) => !room.game.removed.has(id)).length === 0;
}

function finish(room, winner) {
  const game = room.game;
  if (!game || game.status !== "running") return;
  game.status = "ended";
  game.phase = "ended";
  game.winner = winner;
  game.ending = buildEndingLore(game, winner);
  news(game, winner === "spies" ? "Страна вошла в системный кризис. Шпионы победили." : "Шпионская сеть раскрыта. Политики удержали страну.", winner === "spies" ? "bad" : "good");
}

function revealArrest(room) {
  const g = room.game;
  if (!g || !g.pendingReveal || g.pendingReveal.day !== g.day) return;
  const id = g.pendingReveal.targetId;
  const p = room.players.get(id);
  if (g.roles[id] === "spy") {
    g.removed.add(id);
    news(g, `${p ? p.nickname : "Подозреваемый"} оказался шпионом и арестован(а).`, "good");
  } else {
    news(g, `${p ? p.nickname : "Подозреваемый"} оказался невиновным. Парламент теряет время.`, "bad");
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

function refreshGlobalProblem(room) {
  const g = room.game;
  if (!g || !g.globalProblem || g.globalProblem.resolved || g.globalProblem.failed) return;

  const targets = Object.entries(g.globalProblem.targets);
  const allReached = targets.every(([key, target]) => g.stats[key] >= target);

  if (allReached) {
    g.globalProblem.resolved = true;
    applyEffects(g.stats, g.globalProblem.rewardEffects);
    news(g, g.globalProblem.successText, "good");
    return;
  }

  if (g.day > g.globalProblem.deadlineDay) {
    g.globalProblem.failed = true;
    applyEffects(g.stats, g.globalProblem.failEffects);
    news(g, g.globalProblem.failText, "bad");
  }
}

function startDay(room) {
  const g = room.game;
  if (!g || g.status !== "running") return;

  revealArrest(room);
  applyPending(room);
  refreshGlobalProblem(room);

  if (citizensWin(room)) return finish(room, "citizens");
  if (collapsed(g.stats)) return finish(room, "spies");

  const ev = pick(EVENTS);
  g.event = { title: ev.title, text: ev.text };
  g.story = pick(STORY_BEATS);
  applyEffects(g.stats, ev.effects);
  news(g, `Событие дня: ${ev.title}. ${ev.text}`, "neutral");

  refreshGlobalProblem(room);
  if (collapsed(g.stats)) return finish(room, "spies");

  g.phase = "day";
  g.cards = buildCards(g);
  g.votes = Object.fromEntries(g.cards.map((c) => [c.id, {}]));
  g.arrests = {};
  g.results = [];
  g.spyOrders = buildSpyOrders(g.cards);
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
      } else if (cnt === max) {
        top.push(o);
      }
    });

    const winner = top[rnd(0, top.length - 1)];
    applyEffects(g.stats, winner.effects);
    news(g, `По карточке «${card.title}» выбрано: ${winner.label}. ${winner.publicText}`, "neutral");

    winner.delayed.forEach((d) => {
      g.pendingEffects.push({ day: g.day + d.inDays, effects: d.effects, news: d.news, tone: d.tone || "neutral" });
    });

    const votesByOption = card.options.map((o) => ({
      label: o.label,
      votes: tally[o.id] || 0
    }));

    g.results.push({
      cardId: card.id,
      cardTitle: card.title,
      winnerOptionId: winner.id,
      winnerLabel: winner.label,
      winnerReason: winner.publicText,
      effectsText: effectsSummary(winner.effects),
      votesByOption
    });
  }

  let successCount = 0;
  g.spyOrders.forEach((order) => {
    const result = g.results.find((r) => r.cardId === order.cardId);
    if (result && result.winnerOptionId === order.targetOptionId) successCount += 1;
  });

  if (successCount >= 3) {
    g.pendingEffects.push({
      day: g.day + 1,
      effects: { economy: -4, trust: -4, security: -2 },
      news: "Иностранные агенты выполнили план на максимум: саботаж дал эффект.",
      tone: "bad"
    });
  } else if (successCount === 2) {
    g.pendingEffects.push({
      day: g.day + 1,
      effects: { economy: -2, trust: -3 },
      news: "Часть шпионских директив выполнена: в системе растут перекосы.",
      tone: "bad"
    });
  } else if (successCount === 1) {
    g.pendingEffects.push({
      day: g.day + 1,
      effects: { trust: -1 },
      news: "Шпионы смогли провести только один вредный сценарий.",
      tone: "neutral"
    });
  } else {
    g.pendingEffects.push({
      day: g.day + 1,
      effects: { trust: 2, welfare: 1 },
      news: "Диверсия сорвана: кабинет удержал курс и стабилизировал ситуацию.",
      tone: "good"
    });
  }

  g.history.unshift({
    day: g.day,
    eventTitle: g.event?.title || "Без события",
    sabotageSuccess: successCount,
    cards: g.results.map((r) => ({
      cardTitle: r.cardTitle,
      winnerLabel: r.winnerLabel,
      reason: r.winnerReason,
      effectsText: r.effectsText,
      votesByOption: r.votesByOption
    }))
  });
  if (g.history.length > MAX_HISTORY) g.history.length = MAX_HISTORY;

  g.phase = "night";
  refreshGlobalProblem(room);

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
    const target = g.arrests[id];
    if (!target || target === "skip") return;
    if (!voters.includes(target)) return;
    tally[target] = (tally[target] || 0) + 1;
  });

  let target = null;
  let maxVotes = 0;
  Object.entries(tally).forEach(([id, cnt]) => {
    if (cnt > maxVotes) {
      maxVotes = cnt;
      target = id;
    }
  });

  const need = Math.floor(voters.length / 2) + 1;
  if (target && maxVotes >= need) {
    g.pendingReveal = { targetId: target, day: g.day + 1 };
    const p = room.players.get(target);
    news(g, `${p ? p.nickname : "Политик"} задержан(а). Проверка личности будет завтра.`, "neutral");
  } else {
    news(g, "Большинство за арест не набрано.", "neutral");
  }

  advanceDay(room);
}

function snapshot(room, viewer) {
  const g = room.game;
  const liveIds = g ? aliveIds(room) : [];
  const payload = {
    id: room.id,
    hostId: room.hostId,
    settings: {
      name: room.settings.name,
      maxPlayers: room.settings.maxPlayers,
      hasPassword: Boolean(room.settings.password),
      locked: room.settings.locked
    },
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      nickname: p.nickname,
      avatar: p.avatar,
      isHost: p.isHost,
      removed: g ? g.removed.has(p.id) : false
    })),
    game: null
  };

  if (!g) return payload;

  payload.game = {
    status: g.status,
    day: g.day,
    phase: g.phase,
    stats: g.stats,
    aliveIds: liveIds,
    aliveCount: liveIds.length,
    myRole: g.roles[viewer] || null,
    spyTeam:
      g.roles[viewer] === "spy"
        ? [...g.spies].filter((id) => !g.removed.has(id)).map((id) => ({ id, nickname: room.players.get(id)?.nickname || "Шпион" }))
        : [],
    spyOrders: g.roles[viewer] === "spy" ? g.spyOrders : [],
    globalProblem: globalProblemState(g.globalProblem, g.stats),
    event: g.event,
    story: g.story,
    cards: g.cards.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      lore: c.lore,
      options: c.options.map((o) => ({ id: o.id, label: o.label, publicText: o.publicText }))
    })),
    myVotes: Object.fromEntries(Object.entries(g.votes).map(([cardId, votes]) => [cardId, votes[viewer] || null])),
    voteProgress: Object.fromEntries(g.cards.map((c) => [c.id, Object.keys(g.votes[c.id] || {}).length])),
    myArrestVote: g.arrests[viewer] || null,
    news: g.news,
    results: g.results,
    history: g.history,
    ending: g.ending ? { ...g.ending } : null,
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
    advanceDay(room);
    ack({ ok: true });
    emitState(room);
  });

  socket.on("game:start-arrest", (ack = () => {}) => {
    const room = getRoom(socket.id);
    const g = room?.game;
    if (!g || g.status !== "running") return ack({ ok: false, error: "Игра не запущена." });
    if (g.phase !== "night") return ack({ ok: false, error: "Арест можно запустить только ночью." });
    if (g.removed.has(socket.id)) return ack({ ok: false, error: "Вы выбыли." });

    g.phase = "arrest";
    g.arrests = {};
    news(g, "Игроки открыли голосование за задержание подозреваемого.", "neutral");
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

  socket.on("disconnect", () => {
    profiles.delete(socket.id);
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
