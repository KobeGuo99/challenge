(function () {
  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isPlaceholder(value) {
    return !value || String(value).includes("REPLACE_WITH");
  }

  function createLocalFallbackProvider() {
    const key = "rinchan-kokun-challenge-state";

    return {
      name: "Local fallback",
      async read() {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      },
      async write(state) {
        localStorage.setItem(key, JSON.stringify(state));
        return deepClone(state);
      }
    };
  }

  function createJsonBinProvider(storageConfig) {
    const baseUrl = (storageConfig.baseUrl || "https://api.jsonbin.io/v3").replace(/\/$/, "");
    const resourceUrl = `${baseUrl}/b/${storageConfig.binId}`;
    const latestUrl = `${resourceUrl}/latest`;

    function buildHeaders(authMode) {
      const headers = {
        "Content-Type": "application/json"
      };

      if (authMode === "master" && storageConfig.apiKey) {
        headers["X-Master-Key"] = storageConfig.apiKey;
      }

      if (authMode === "access" && storageConfig.apiKey) {
        headers["X-Access-Key"] = storageConfig.apiKey;
      }

      if (storageConfig.accessKey) {
        headers["X-Access-Key"] = storageConfig.accessKey;
      }

      if (storageConfig.useVersioning) {
        headers["X-Bin-Versioning"] = "true";
      }

      return headers;
    }

    async function requestJson(url, options) {
      const authModes = storageConfig.accessKey ? ["master"] : ["master", "access"];
      let lastResponse = null;

      for (const authMode of authModes) {
        const response = await fetch(url, Object.assign({}, options, {
          headers: buildHeaders(authMode)
        }));

        if (response.ok) {
          return response;
        }

        lastResponse = response;

        if (response.status !== 401 && response.status !== 403) {
          break;
        }
      }

      throw new Error(`JSONBin request failed (${lastResponse ? lastResponse.status : "unknown"})`);
    }

    return {
      name: "JSONBin",
      isConfigured() {
        return !isPlaceholder(storageConfig.binId) && !isPlaceholder(storageConfig.apiKey);
      },
      async read() {
        const response = await requestJson(latestUrl, {
          method: "GET"
        });
        const payload = await response.json();
        return payload.record || payload;
      },
      async write(state) {
        const response = await requestJson(resourceUrl, {
          method: "PUT",
          body: JSON.stringify(state)
        });
        const payload = await response.json();
        return payload.record || state;
      }
    };
  }

  function createStorageClient() {
    const storageConfig = (window.APP_CONFIG && window.APP_CONFIG.storage) || {};
    const localProvider = createLocalFallbackProvider();
    const remoteProvider = createJsonBinProvider(storageConfig);

    async function load(defaultState) {
      if (!remoteProvider.isConfigured()) {
        const localState = await localProvider.read();
        return {
          state: localState ? deepClone(localState) : deepClone(defaultState),
          source: "local",
          warning: "JSONBin is not configured."
        };
      }

      try {
        const remoteState = await remoteProvider.read();
        localProvider.write(remoteState);
        return {
          state: deepClone(remoteState),
          source: "remote",
          warning: ""
        };
      } catch (error) {
        const localState = await localProvider.read();
        return {
          state: localState ? deepClone(localState) : deepClone(defaultState),
          source: "local",
          warning: error.message
        };
      }
    }

    async function save(state) {
      const snapshot = deepClone(state);
      await localProvider.write(snapshot);

      if (!remoteProvider.isConfigured()) {
        return {
          state: snapshot,
          source: "local",
          warning: "Saved locally only. JSONBin is not configured."
        };
      }

      try {
        const remoteState = await remoteProvider.write(snapshot);
        await localProvider.write(remoteState);
        return {
          state: deepClone(remoteState),
          source: "remote",
          warning: ""
        };
      } catch (error) {
        return {
          state: snapshot,
          source: "local",
          warning: error.message
        };
      }
    }

    return {
      async load(defaultState) {
        return load(defaultState);
      },
      async save(state) {
        return save(state);
      }
    };
  }

  window.AppStorage = {
    createClient: createStorageClient
  };
})();
