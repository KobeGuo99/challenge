(function () {
  const elements = {
    playerCards: document.getElementById("playerCards"),
    historyList: document.getElementById("historyList"),
    leaderChip: document.getElementById("leaderChip"),
    storageStatus: document.getElementById("storageStatus"),
    lastUpdated: document.getElementById("lastUpdated"),
    refreshButton: document.getElementById("refreshButton"),
    resetButton: document.getElementById("resetButton"),
    pointForm: document.getElementById("pointForm"),
    pointPlayer: document.getElementById("pointPlayer"),
    pointAction: document.getElementById("pointAction"),
    pointValue: document.getElementById("pointValue"),
    pointNote: document.getElementById("pointNote"),
    pointPreview: document.getElementById("pointPreview"),
    pointPreviewBox: document.getElementById("pointPreviewBox"),
    modalBackdrop: document.getElementById("modalBackdrop"),
    cancelResetButton: document.getElementById("cancelResetButton"),
    confirmResetButton: document.getElementById("confirmResetButton")
  };

  const storage = window.AppStorage.createClient();
  const defaultState = window.APP_DEFAULT_STATE || {};
  const refreshIntervalMs = (window.APP_CONFIG && window.APP_CONFIG.refreshIntervalMs) || 60000;

  let state = normalizeState(defaultState);
  let syncBusy = false;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeState(rawState) {
    const base = clone(defaultState);
    const legacyEvents = [];

    if (Array.isArray(rawState && rawState.history)) {
      rawState.history.forEach(function (item) {
        legacyEvents.push({
          id: item.id || `legacy-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          timestamp: item.timestamp || new Date().toISOString(),
          playerId: item.playerId || "system",
          actionId: "legacy",
          actionName: item.action || "Imported",
          points: Number(item.points) || 0,
          note: item.details || ""
        });
      });
    }

    return {
      meta: Object.assign({}, base.meta || {}, rawState && rawState.meta ? rawState.meta : {}),
      players: Array.isArray(rawState && rawState.players) ? rawState.players : clone(base.players || []),
      actions: Array.isArray(rawState && rawState.actions) ? rawState.actions : clone(base.actions || []),
      pointEvents: Array.isArray(rawState && rawState.pointEvents)
        ? rawState.pointEvents
        : legacyEvents
    };
  }

  function numberValue(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatTimestamp(timestamp) {
    if (!timestamp) {
      return "-";
    }

    return new Date(timestamp).toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  function setStatus(source, warning) {
    if (source === "remote" && !warning) {
      elements.storageStatus.textContent = "Synced with JSONBin";
      return;
    }

    if (warning) {
      elements.storageStatus.textContent = `Using local copy: ${warning}`;
      return;
    }

    elements.storageStatus.textContent = "Using local copy";
  }

  function updateMeta() {
    state.meta.revision = numberValue(state.meta.revision) + 1;
    state.meta.updatedAt = new Date().toISOString();
  }

  function getPlayerTotals() {
    return state.players.map(function (player) {
      const events = state.pointEvents.filter(function (event) {
        return event.playerId === player.id;
      });
      const totalPoints = events.reduce(function (sum, event) {
        return sum + numberValue(event.points);
      }, 0);

      return {
        player: player,
        totalPoints: totalPoints,
        eventsCount: events.length
      };
    });
  }

  function getLeaderText() {
    const totals = getPlayerTotals().sort(function (a, b) {
      return b.totalPoints - a.totalPoints;
    });

    if (!totals.length || (totals[1] && totals[0].totalPoints === totals[1].totalPoints)) {
      return "Leader: tied";
    }

    return `Leader: ${totals[0].player.name}`;
  }

  function getPlayerClass(playerId) {
    if (playerId === "rinchan") {
      return "player-rinchan";
    }

    if (playerId === "kokun") {
      return "player-kokun";
    }

    return "";
  }

  function renderPlayerOptions() {
    const currentValue = elements.pointPlayer.value;
    elements.pointPlayer.innerHTML = state.players.map(function (player) {
      return `<option value="${player.id}">${player.name}</option>`;
    }).join("");

    if (state.players.some(function (player) { return player.id === currentValue; })) {
      elements.pointPlayer.value = currentValue;
    } else if (state.players.length) {
      elements.pointPlayer.value = state.players[0].id;
    }
  }

  function renderActionOptions() {
    const currentValue = elements.pointAction.value;
    elements.pointAction.innerHTML = state.actions.map(function (action) {
      return `<option value="${action.id}">${action.name}</option>`;
    }).join("");

    if (state.actions.some(function (action) { return action.id === currentValue; })) {
      elements.pointAction.value = currentValue;
    } else if (state.actions.length) {
      elements.pointAction.value = state.actions[0].id;
    }
  }

  function renderScoreboard() {
    elements.playerCards.innerHTML = getPlayerTotals().map(function (item) {
      const playerClass = getPlayerClass(item.player.id);

      return `
        <article class="score-card ${playerClass}">
          <div class="score-header">
            <div>
              <h3>${item.player.name}</h3>
              <div class="subtle">Weekly points</div>
            </div>
            <div class="points-total">${item.totalPoints}</div>
          </div>
          <div class="stats">
            <div class="stat-row"><span>Total actions</span><strong>${item.eventsCount}</strong></div>
          </div>
        </article>
      `;
    }).join("");

    elements.leaderChip.textContent = getLeaderText();
  }

  function renderHistory() {
    const playerNames = state.players.reduce(function (map, player) {
      map[player.id] = player.name;
      return map;
    }, {});

    elements.historyList.innerHTML = state.pointEvents.length
      ? state.pointEvents.slice(0, 20).map(function (event) {
          const pointClass = event.points > 0 ? "positive" : event.points < 0 ? "negative" : "";
          const pointLabel = event.points > 0 ? `+${event.points}` : `${event.points}`;
          const playerClass = getPlayerClass(event.playerId);

          return `
            <div class="simple-item ${playerClass}">
              <strong>${playerNames[event.playerId] || event.playerId} · ${event.actionName}</strong>
              <div class="subtle">${formatTimestamp(event.timestamp)} · <span class="${pointClass}">${pointLabel} pts</span></div>
              ${event.note ? `<div class="subtle">${event.note}</div>` : ""}
            </div>
          `;
        }).join("")
      : '<div class="empty-state">No point changes yet.</div>';
  }

  function renderMeta() {
    elements.lastUpdated.textContent = formatTimestamp(state.meta.updatedAt);
  }

  function updatePreview() {
    const points = numberValue(elements.pointValue.value);
    elements.pointPreview.textContent = points > 0 ? `+${points}` : String(points);
    elements.pointPreviewBox.classList.toggle("is-negative", points < 0);
    elements.pointValue.classList.toggle("negative-input", points < 0);
  }

  function render() {
    renderPlayerOptions();
    renderActionOptions();
    renderScoreboard();
    renderHistory();
    renderMeta();
    updatePreview();
  }

  async function refreshFromStorage() {
    if (syncBusy) {
      return;
    }

    syncBusy = true;
    elements.storageStatus.textContent = "Refreshing...";

    try {
      const result = await storage.load(defaultState);
      state = normalizeState(result.state);
      setStatus(result.source, result.warning);
      render();
    } finally {
      syncBusy = false;
    }
  }

  async function saveWithLatest(mutator) {
    if (syncBusy) {
      return;
    }

    syncBusy = true;
    elements.storageStatus.textContent = "Saving...";

    try {
      const latest = await storage.load(defaultState);
      state = normalizeState(latest.state);
      mutator();
      updateMeta();
      const saved = await storage.save(state);
      state = normalizeState(saved.state);
      setStatus(saved.source, saved.warning);
      render();
    } finally {
      syncBusy = false;
    }
  }

  async function handlePointSubmit(event) {
    event.preventDefault();

    const playerId = elements.pointPlayer.value;
    const actionId = elements.pointAction.value;
    const action = state.actions.find(function (item) {
      return item.id === actionId;
    });
    const points = numberValue(elements.pointValue.value);
    const note = elements.pointNote.value.trim();

    await saveWithLatest(function () {
      state.pointEvents.unshift({
        id: `event-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        playerId: playerId,
        actionId: actionId,
        actionName: action ? action.name : actionId,
        points: points,
        note: note
      });
    });

    elements.pointValue.value = "1";
    elements.pointNote.value = "";
    updatePreview();
  }

  function openResetModal() {
    elements.modalBackdrop.classList.remove("hidden");
  }

  function closeResetModal() {
    elements.modalBackdrop.classList.add("hidden");
  }

  async function handleResetConfirm() {
    await saveWithLatest(function () {
      state.pointEvents = [];
      state.meta.lastResetAt = new Date().toISOString();
    });

    closeResetModal();
  }

  function bindEvents() {
    elements.pointForm.addEventListener("submit", handlePointSubmit);
    elements.pointValue.addEventListener("input", updatePreview);
    elements.refreshButton.addEventListener("click", refreshFromStorage);
    elements.resetButton.addEventListener("click", openResetModal);
    elements.cancelResetButton.addEventListener("click", closeResetModal);
    elements.confirmResetButton.addEventListener("click", handleResetConfirm);
    elements.modalBackdrop.addEventListener("click", function (event) {
      if (event.target === elements.modalBackdrop) {
        closeResetModal();
      }
    });
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) {
        refreshFromStorage();
      }
    });
    window.setInterval(refreshFromStorage, refreshIntervalMs);
  }

  function init() {
    render();
    bindEvents();
    refreshFromStorage();
  }

  init();
})();
