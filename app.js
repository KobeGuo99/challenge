(function () {
  const elements = {
    playerCards: document.getElementById("playerCards"),
    historyList: document.getElementById("historyList"),
    weeklyHistoryPreview: document.getElementById("weeklyHistoryPreview"),
    weeklyHistoryModalList: document.getElementById("weeklyHistoryModalList"),
    weekSaveStatus: document.getElementById("weekSaveStatus"),
    modeDescription: document.getElementById("modeDescription"),
    modePill: document.getElementById("modePill"),
    leaderChip: document.getElementById("leaderChip"),
    storageStatus: document.getElementById("storageStatus"),
    lastUpdated: document.getElementById("lastUpdated"),
    refreshButton: document.getElementById("refreshButton"),
    modeToggleButton: document.getElementById("modeToggleButton"),
    resetButton: document.getElementById("resetButton"),
    saveWeekButton: document.getElementById("saveWeekButton"),
    exportBackupButton: document.getElementById("exportBackupButton"),
    importBackupButton: document.getElementById("importBackupButton"),
    importBackupInput: document.getElementById("importBackupInput"),
    viewHistoryButton: document.getElementById("viewHistoryButton"),
    closeHistoryButton: document.getElementById("closeHistoryButton"),
    pointForm: document.getElementById("pointForm"),
    pointPlayer: document.getElementById("pointPlayer"),
    pointAction: document.getElementById("pointAction"),
    pointValue: document.getElementById("pointValue"),
    pointNote: document.getElementById("pointNote"),
    pointPreview: document.getElementById("pointPreview"),
    pointPreviewBox: document.getElementById("pointPreviewBox"),
    modalBackdrop: document.getElementById("modalBackdrop"),
    historyModalBackdrop: document.getElementById("historyModalBackdrop"),
    pinModalBackdrop: document.getElementById("pinModalBackdrop"),
    pinForm: document.getElementById("pinForm"),
    pinInput: document.getElementById("pinInput"),
    pinError: document.getElementById("pinError"),
    cancelPinButton: document.getElementById("cancelPinButton"),
    cancelResetButton: document.getElementById("cancelResetButton"),
    confirmResetButton: document.getElementById("confirmResetButton"),
    editOnlySections: document.querySelectorAll(".edit-only")
  };

  const storage = window.AppStorage.createClient();
  const storageCapabilities = storage.getCapabilities();
  const defaultState = window.APP_DEFAULT_STATE || {};
  const refreshIntervalMs = (window.APP_CONFIG && window.APP_CONFIG.refreshIntervalMs) || 60000;
  const editPin = "1825";

  let state = normalizeState(defaultState);
  let refreshBusy = false;
  let pendingSyncCount = 0;
  let syncQueue = Promise.resolve();
  let isEditMode = false;
  const canUseEditMode = storageCapabilities.canWriteRemote;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function formatDateOnly(timestamp) {
    if (!timestamp) {
      return "-";
    }

    return new Date(timestamp).toLocaleDateString([], {
      dateStyle: "medium"
    });
  }

  function createWeekLabel(timestamp) {
    return `Week of ${formatDateOnly(timestamp)}`;
  }

  function normalizeState(rawState) {
    const base = clone(defaultState);
    const legacyEvents = [];
    const fallbackWeekLabel = (base.meta && base.meta.weekLabel) || createWeekLabel(new Date().toISOString());

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
      meta: Object.assign(
        {
          revision: 0,
          updatedAt: null,
          lastResetAt: null,
          weekLabel: fallbackWeekLabel,
          savedWeekId: null
        },
        base.meta || {},
        rawState && rawState.meta ? rawState.meta : {}
      ),
      players: Array.isArray(rawState && rawState.players) ? rawState.players : clone(base.players || []),
      actions: Array.isArray(rawState && rawState.actions) ? rawState.actions : clone(base.actions || []),
      pointEvents: Array.isArray(rawState && rawState.pointEvents)
        ? rawState.pointEvents
        : legacyEvents,
      weeklyHistory: Array.isArray(rawState && rawState.weeklyHistory)
        ? rawState.weeklyHistory
        : clone(base.weeklyHistory || [])
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

  function setTemporaryStatus(message) {
    elements.storageStatus.textContent = message;
  }

  function requireEditMode() {
    if (!canUseEditMode) {
      setTemporaryStatus("This deployment is view-only. Edit mode requires a private local config.");
      return false;
    }

    if (isEditMode) {
      return true;
    }

    setTemporaryStatus("Enter the PIN to use edit mode.");
    return false;
  }

  function syncStatusLabel() {
    if (pendingSyncCount > 0) {
      return pendingSyncCount > 1 ? "Saving changes..." : "Saving change...";
    }

    return "";
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

  function getSortedPlayerTotals() {
    return getPlayerTotals().slice().sort(function (a, b) {
      return b.totalPoints - a.totalPoints;
    });
  }

  function getLeaderText() {
    const totals = getSortedPlayerTotals();

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

  function getWeekTimeRange(events) {
    if (!events.length) {
      return {
        startAt: null,
        endAt: null
      };
    }

    return events.reduce(function (range, event) {
      const timestamp = event.timestamp || new Date().toISOString();

      if (!range.startAt || new Date(timestamp) < new Date(range.startAt)) {
        range.startAt = timestamp;
      }

      if (!range.endAt || new Date(timestamp) > new Date(range.endAt)) {
        range.endAt = timestamp;
      }

      return range;
    }, {
      startAt: null,
      endAt: null
    });
  }

  function getWeekWinner(totals) {
    if (!totals.length) {
      return {
        winnerIds: [],
        winnerLabel: "No winner",
        isTie: false
      };
    }

    const highestScore = totals[0].totalPoints;
    const winners = totals.filter(function (item) {
      return item.totalPoints === highestScore;
    });

    if (winners.length > 1) {
      return {
        winnerIds: winners.map(function (item) { return item.player.id; }),
        winnerLabel: "Tie",
        isTie: true
      };
    }

    return {
      winnerIds: [winners[0].player.id],
      winnerLabel: winners[0].player.name,
      isTie: false
    };
  }

  function buildWeekSummary() {
    const totals = getSortedPlayerTotals();
    const range = getWeekTimeRange(state.pointEvents);
    const winner = getWeekWinner(totals);
    const savedAt = new Date().toISOString();

    return {
      id: `week-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      weekLabel: state.meta.weekLabel || createWeekLabel(savedAt),
      savedAt: savedAt,
      startAt: range.startAt,
      endAt: range.endAt,
      totalEvents: state.pointEvents.length,
      winnerIds: winner.winnerIds,
      winnerLabel: winner.winnerLabel,
      isTie: winner.isTie,
      totals: totals.map(function (item) {
        return {
          playerId: item.player.id,
          playerName: item.player.name,
          totalPoints: item.totalPoints,
          eventsCount: item.eventsCount
        };
      })
    };
  }

  function getSavedWeekEntry() {
    if (!state.meta.savedWeekId) {
      return null;
    }

    return state.weeklyHistory.find(function (week) {
      return week.id === state.meta.savedWeekId;
    }) || null;
  }

  function hasWeekChangedSinceSave(savedWeek) {
    if (!savedWeek) {
      return false;
    }

    return savedWeek.totalEvents !== state.pointEvents.length;
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

  function renderWeekSaveStatus() {
    const savedWeek = getSavedWeekEntry();

    elements.saveWeekButton.disabled = !isEditMode || !state.pointEvents.length;

    if (!state.pointEvents.length) {
      elements.weekSaveStatus.textContent = isEditMode
        ? "No current-week points yet. Save becomes available after you add points."
        : "View mode is active. Weekly history is shown below.";
      return;
    }

    if (!isEditMode) {
      elements.weekSaveStatus.textContent = "View mode is active. Enter the PIN to save or clear a week.";
      return;
    }

    if (savedWeek && hasWeekChangedSinceSave(savedWeek)) {
      elements.weekSaveStatus.textContent = "This week changed after the last save. Save again to add a new archived copy before clearing.";
      return;
    }

    if (savedWeek) {
      elements.weekSaveStatus.textContent = `Last saved to weekly history on ${formatTimestamp(savedWeek.savedAt)}. Saving again will add another archived copy.`;
      return;
    }

    elements.weekSaveStatus.textContent = "This week has not been saved to history yet.";
  }

  function renderWeekSummaryCard(week) {
    const winnerClass = week.winnerIds.length === 1 ? getPlayerClass(week.winnerIds[0]) : "";
    const totalsHtml = week.totals.map(function (total) {
      const pointLabel = total.totalPoints > 0 ? `+${total.totalPoints}` : `${total.totalPoints}`;
      return `
        <div class="stat-row">
          <span>${total.playerName}</span>
          <strong>${pointLabel} pts</strong>
        </div>
      `;
    }).join("");

    return `
      <div class="simple-item ${winnerClass}">
        <div class="history-title-row">
          <strong>${week.weekLabel}</strong>
          <div class="history-card-actions">
            <span class="subtle">${formatDateOnly(week.savedAt)}</span>
            ${isEditMode ? `<button class="danger-button delete-week-button" type="button" data-week-id="${week.id}">Delete</button>` : ""}
          </div>
        </div>
        <div class="subtle">Winner: ${week.winnerLabel} · ${week.totalEvents} entries</div>
        ${week.startAt && week.endAt ? `<div class="subtle">${formatDateOnly(week.startAt)} to ${formatDateOnly(week.endAt)}</div>` : ""}
        <div class="summary-stack">${totalsHtml}</div>
      </div>
    `;
  }

  function renderWeeklyHistory() {
    const latestWeek = state.weeklyHistory[0];

    elements.viewHistoryButton.disabled = !state.weeklyHistory.length;

    elements.weeklyHistoryPreview.innerHTML = latestWeek
      ? renderWeekSummaryCard(latestWeek)
      : '<div class="empty-state">No saved weeks yet.</div>';

    elements.weeklyHistoryModalList.innerHTML = state.weeklyHistory.length
      ? state.weeklyHistory.map(renderWeekSummaryCard).join("")
      : '<div class="empty-state">No weekly history yet. Save a week first.</div>';
  }

  function renderMode() {
    elements.modePill.textContent = isEditMode ? "Edit mode" : "View mode";
    elements.modeToggleButton.textContent = isEditMode ? "Lock" : "Edit";
    elements.modeToggleButton.className = isEditMode ? "secondary-button" : "primary-button";
    elements.modeToggleButton.disabled = !canUseEditMode;
    elements.modeDescription.textContent = isEditMode
      ? "Edit mode is unlocked. You can add points, save weeks, and clear the current week."
      : canUseEditMode
        ? "View mode shows points and history. Enter the PIN to switch to edit mode."
        : "This deployment is view-only. To enable editing, add a private local config with write access.";

    elements.editOnlySections.forEach(function (section) {
      section.classList.toggle("hidden-mode", !isEditMode);
    });
  }

  function setConfigurationGuidance() {
    if (storageCapabilities.canReadRemote) {
      return;
    }

    elements.modeDescription.textContent = "JSONBin is not configured here yet. For local editing, create config.local.js from config.local.example.js.";
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

  function sanitizeImportState(rawState) {
    const importedState = normalizeState(rawState);

    importedState.meta = Object.assign({}, importedState.meta || {}, {
      revision: numberValue(importedState.meta && importedState.meta.revision),
      updatedAt: importedState.meta && importedState.meta.updatedAt ? importedState.meta.updatedAt : null,
      lastResetAt: importedState.meta && importedState.meta.lastResetAt ? importedState.meta.lastResetAt : null,
      weekLabel: importedState.meta && importedState.meta.weekLabel
        ? importedState.meta.weekLabel
        : createWeekLabel(new Date().toISOString()),
      savedWeekId: importedState.meta && importedState.meta.savedWeekId
        ? importedState.meta.savedWeekId
        : null
    });

    return importedState;
  }

  function buildBackupFilename() {
    const dateStamp = new Date().toISOString().slice(0, 10);
    return `rinchan-kokun-backup-${dateStamp}.json`;
  }

  function render() {
    renderMode();
    setConfigurationGuidance();
    renderPlayerOptions();
    renderActionOptions();
    renderScoreboard();
    renderHistory();
    renderWeeklyHistory();
    renderWeekSaveStatus();
    renderMeta();
    updatePreview();
  }

  function queuePersist(snapshot, successMessage) {
    const snapshotRevision = numberValue(snapshot && snapshot.meta ? snapshot.meta.revision : 0);

    pendingSyncCount += 1;
    setTemporaryStatus(syncStatusLabel());

    syncQueue = syncQueue.catch(function () {
      return null;
    }).then(async function () {
      const saved = await storage.save(snapshot);

      if (numberValue(state.meta && state.meta.revision) === snapshotRevision) {
        state = normalizeState(saved.state);
        render();
      }

      if (successMessage && pendingSyncCount === 1) {
        setTemporaryStatus(successMessage);
      } else {
        setStatus(saved.source, saved.warning);
      }

      return saved;
    }).catch(function (error) {
      setTemporaryStatus(`Save failed: ${error.message}`);
      return null;
    }).finally(function () {
      pendingSyncCount = Math.max(0, pendingSyncCount - 1);

      if (pendingSyncCount > 0) {
        setTemporaryStatus(syncStatusLabel());
      }
    });

    return syncQueue;
  }

  async function refreshFromStorage() {
    if (refreshBusy || pendingSyncCount > 0) {
      return;
    }

    refreshBusy = true;
    elements.storageStatus.textContent = "Refreshing...";

    try {
      const result = await storage.load(defaultState);
      const loadedState = normalizeState(result.state);

      if (numberValue(loadedState.meta && loadedState.meta.revision) >= numberValue(state.meta && state.meta.revision)) {
        state = loadedState;
        render();
      }

      setStatus(result.source, result.warning);
    } finally {
      refreshBusy = false;
    }
  }

  function saveWithLatest(mutator, successMessage) {
    if (refreshBusy) {
      setTemporaryStatus("Please wait for refresh to finish.");
      return false;
    }

    const nextState = normalizeState(clone(state));
    const previousState = state;

    state = nextState;
    const shouldSave = mutator();

    if (shouldSave === false) {
      state = previousState;
      render();
      return false;
    }

    updateMeta();
    render();
    queuePersist(clone(state), successMessage);
    return true;
  }

  function handleExportBackup() {
    if (!requireEditMode()) {
      return;
    }

    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = buildBackupFilename();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setTemporaryStatus("Backup exported.");
  }

  function handleImportBackupClick() {
    if (!requireEditMode()) {
      return;
    }

    elements.importBackupInput.value = "";
    elements.importBackupInput.click();
  }

  async function handleImportBackupChange(event) {
    if (!requireEditMode()) {
      event.target.value = "";
      return;
    }

    const file = event.target.files && event.target.files[0];

    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const importedState = sanitizeImportState(parsed);
      const confirmed = window.confirm("Importing a backup will replace the current app data. Continue?");

      if (!confirmed) {
        event.target.value = "";
        return;
      }

      saveWithLatest(function () {
        state = importedState;
      }, "Backup imported.");
    } catch (error) {
      setTemporaryStatus(`Import failed: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  }

  async function handlePointSubmit(event) {
    event.preventDefault();

    if (!requireEditMode()) {
      return;
    }

    const playerId = elements.pointPlayer.value;
    const actionId = elements.pointAction.value;
    const action = state.actions.find(function (item) {
      return item.id === actionId;
    });
    const points = numberValue(elements.pointValue.value);
    const note = elements.pointNote.value.trim();

    const saved = saveWithLatest(function () {
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

    if (saved) {
      elements.pointValue.value = "1";
      elements.pointNote.value = "";
      updatePreview();
    }
  }

  async function handleSaveWeek() {
    if (!requireEditMode()) {
      return;
    }

    if (!state.pointEvents.length) {
      setTemporaryStatus("Nothing to save for this week yet.");
      return;
    }

    const saved = saveWithLatest(function () {
      const summary = buildWeekSummary();
      state.weeklyHistory.unshift(summary);
      state.meta.savedWeekId = summary.id;
    }, "Week saved to history.");
  }

  async function handleDeleteSavedWeek(weekId) {
    if (!requireEditMode()) {
      return;
    }

    const deleted = saveWithLatest(function () {
      const beforeCount = state.weeklyHistory.length;
      state.weeklyHistory = state.weeklyHistory.filter(function (week) {
        return week.id !== weekId;
      });

      if (beforeCount === state.weeklyHistory.length) {
        return false;
      }

      if (state.meta.savedWeekId === weekId) {
        state.meta.savedWeekId = null;
      }
    }, "Saved week deleted from history.");
  }

  function openResetModal() {
    if (!requireEditMode()) {
      return;
    }

    elements.modalBackdrop.classList.remove("hidden");
  }

  function closeResetModal() {
    elements.modalBackdrop.classList.add("hidden");
  }

  function openHistoryModal() {
    elements.historyModalBackdrop.classList.remove("hidden");
  }

  function closeHistoryModal() {
    elements.historyModalBackdrop.classList.add("hidden");
  }

  function openPinModal() {
    elements.pinInput.value = "";
    elements.pinError.classList.add("hidden");
    elements.pinModalBackdrop.classList.remove("hidden");
    window.setTimeout(function () {
      elements.pinInput.focus();
    }, 0);
  }

  function closePinModal() {
    elements.pinModalBackdrop.classList.add("hidden");
  }

  function lockEditMode() {
    isEditMode = false;
    closePinModal();
    render();
    setTemporaryStatus("View mode locked.");
  }

  function handleModeToggle() {
    if (isEditMode) {
      lockEditMode();
      return;
    }

    openPinModal();
  }

  function handlePinSubmit(event) {
    event.preventDefault();

    if (elements.pinInput.value === editPin) {
      isEditMode = true;
      closePinModal();
      render();
      setTemporaryStatus("Edit mode unlocked.");
      return;
    }

    elements.pinError.classList.remove("hidden");
    elements.pinInput.select();
  }

  async function handleResetConfirm() {
    saveWithLatest(function () {
      state.pointEvents = [];
      state.meta.lastResetAt = new Date().toISOString();
      state.meta.weekLabel = createWeekLabel(state.meta.lastResetAt);
      state.meta.savedWeekId = null;
    }, "Current week cleared.");

    closeResetModal();
  }

  function bindEvents() {
    elements.pointForm.addEventListener("submit", handlePointSubmit);
    elements.pointValue.addEventListener("input", updatePreview);
    elements.refreshButton.addEventListener("click", refreshFromStorage);
    elements.modeToggleButton.addEventListener("click", handleModeToggle);
    elements.saveWeekButton.addEventListener("click", handleSaveWeek);
    elements.exportBackupButton.addEventListener("click", handleExportBackup);
    elements.importBackupButton.addEventListener("click", handleImportBackupClick);
    elements.importBackupInput.addEventListener("change", handleImportBackupChange);
    elements.viewHistoryButton.addEventListener("click", openHistoryModal);
    elements.closeHistoryButton.addEventListener("click", closeHistoryModal);
    elements.pinForm.addEventListener("submit", handlePinSubmit);
    elements.cancelPinButton.addEventListener("click", closePinModal);
    elements.resetButton.addEventListener("click", openResetModal);
    elements.cancelResetButton.addEventListener("click", closeResetModal);
    elements.confirmResetButton.addEventListener("click", handleResetConfirm);
    elements.modalBackdrop.addEventListener("click", function (event) {
      if (event.target === elements.modalBackdrop) {
        closeResetModal();
      }
    });
    elements.historyModalBackdrop.addEventListener("click", function (event) {
      if (event.target === elements.historyModalBackdrop) {
        closeHistoryModal();
      }
    });
    elements.pinModalBackdrop.addEventListener("click", function (event) {
      if (event.target === elements.pinModalBackdrop) {
        closePinModal();
      }
    });
    [elements.weeklyHistoryPreview, elements.weeklyHistoryModalList].forEach(function (container) {
      container.addEventListener("click", function (event) {
        const button = event.target.closest("[data-week-id]");

        if (!button) {
          return;
        }

        handleDeleteSavedWeek(button.getAttribute("data-week-id"));
      });
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeResetModal();
        closeHistoryModal();
        closePinModal();
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
    if (!state.meta.weekLabel) {
      state.meta.weekLabel = createWeekLabel(new Date().toISOString());
    }

    render();
    bindEvents();
    refreshFromStorage();
  }

  init();
})();
