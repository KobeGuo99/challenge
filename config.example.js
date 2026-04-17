window.APP_CONFIG = {
  storage: {
    provider: "jsonbin",
    baseUrl: "https://api.jsonbin.io/v3",
    binId: "69e15764aaba88219708efd8",
    apiKey: "$2a$10$MKoWP/7rcskV7SF/DZ1X1.tkegeV8KeMq7q.Fi11vEZkDkvnPrG.u",
    accessKey: "",
    useVersioning: false
  },
  refreshIntervalMs: 60000
};

window.APP_DEFAULT_STATE = {
  meta: {
    revision: 0,
    updatedAt: null,
    lastResetAt: null,
    weekLabel: "Current Week",
    savedWeekId: null
  },
  players: [
    {
      id: "rinchan",
      name: "Rinchan"
    },
    {
      id: "kokun",
      name: "Kokun"
    }
  ],
  actions: [
    {
      id: "workout",
      name: "Workout"
    },
    {
      id: "steps",
      name: "Steps"
    },
    {
      id: "calorie-goal",
      name: "Calorie goal"
    },
    {
      id: "bonus",
      name: "Bonus"
    },
    {
      id: "penalty",
      name: "Penalty"
    }
  ],
  pointEvents: [],
  weeklyHistory: []
};
