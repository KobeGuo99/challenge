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

    function buildHeaders(authHeader) {
      const headers = {
        "Content-Type": "application/json"
      };

      if (authHeader && authHeader.name && authHeader.value) {
        headers[authHeader.name] = authHeader.value;
      }

      if (storageConfig.useVersioning) {
        headers["X-Bin-Versioning"] = "true";
      }

      return headers;
    }

    function getAuthHeaders() {
      const authHeaders = [];

      if (storageConfig.accessKey) {
        authHeaders.push({
          name: "X-Access-Key",
          value: storageConfig.accessKey
        });
      }

      if (storageConfig.apiKey) {
        authHeaders.push({
          name: "X-Master-Key",
          value: storageConfig.apiKey
        });

        if (!storageConfig.accessKey) {
          authHeaders.push({
            name: "X-Access-Key",
            value: storageConfig.apiKey
          });
        }
      }

      return authHeaders;
    }

    async function requestJson(url, options, authHeaders) {
      let lastResponse = null;

      if (!authHeaders.length) {
        const response = await fetch(url, Object.assign({}, options, {
          headers: buildHeaders(null)
        }));

        if (response.ok) {
          return response;
        }

        lastResponse = response;
        throw new Error(`JSONBin request failed (${lastResponse.status})`);
      }

      for (const authHeader of authHeaders) {
        const response = await fetch(url, Object.assign({}, options, {
          headers: buildHeaders(authHeader)
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
      canRead() {
        return !isPlaceholder(storageConfig.binId);
      },
      canWrite() {
        return !isPlaceholder(storageConfig.binId)
          && (!isPlaceholder(storageConfig.accessKey) || !isPlaceholder(storageConfig.apiKey));
      },
      async read() {
        const authHeaders = getAuthHeaders();
        const response = await requestJson(latestUrl, {
          method: "GET"
        }, authHeaders);
        const payload = await response.json();
        return payload.record || payload;
      },
      async write(state) {
        const authHeaders = getAuthHeaders();
        const response = await requestJson(resourceUrl, {
          method: "PUT",
          body: JSON.stringify(state)
        }, authHeaders);
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
      if (!remoteProvider.canRead()) {
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

      if (!remoteProvider.canWrite()) {
        return {
          state: snapshot,
          source: "local",
          warning: "Saved locally only. Remote write access is not configured."
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
      getCapabilities() {
        return {
          canReadRemote: remoteProvider.canRead(),
          canWriteRemote: remoteProvider.canWrite()
        };
      },
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
