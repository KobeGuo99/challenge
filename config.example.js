window.APP_CONFIG = {
  storage: {
    provider: "jsonbin",
    baseUrl: "https://api.jsonbin.io/v3",
    // Safe to commit for a public, read-only deployment if your bin visibility is Public.
    binId: "REPLACE_WITH_PUBLIC_READONLY_BIN_ID",
    apiKey: "",
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
