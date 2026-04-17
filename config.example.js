window.APP_CONFIG = {
  storage: {
    provider: "jsonbin",
    baseUrl: "https://api.jsonbin.io/v3",
    // Safe to commit for a public, read-only deployment if your bin visibility is Public.
    binId: "69e15764aaba88219708efd8",
    apiKey: "",
    accessKey: "$2a$10$MmBsm9k40Y3XYoL9lyz6BOG45rDzoCgi2mZ.7DnF/jkjKnPG3qAju",
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
