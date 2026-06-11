// ==========================================================
//  Dev-only live reload client.
//  Connects to /__livereload (SSE). When the server restarts
//  (nodemon picks up a file change), this connection drops; on
//  reconnect the boot id changes and we reload the page.
//  No-ops in production (endpoint returns 404 -> we stop trying).
// ==========================================================
(function () {
  let bootId = null;
  let retries = 0;

  function connect() {
    let es;
    try {
      es = new EventSource("/__livereload");
    } catch {
      return; // EventSource unsupported
    }

    es.onmessage = (e) => {
      retries = 0;
      if (bootId === null) {
        bootId = e.data; // first id after (re)connect
      } else if (e.data !== bootId) {
        // server restarted with a new id -> reload
        window.location.reload();
      }
    };

    es.onerror = () => {
      es.close();
      retries += 1;
      // If it keeps failing immediately (e.g. production: endpoint 404),
      // back off and eventually stop trying.
      if (retries > 30) return;
      // While reconnecting after a restart, mark that we should reload
      // once the server is back.
      const wasConnected = bootId !== null;
      setTimeout(() => {
        if (wasConnected) {
          // try a quick health check; when server is back, reload
          fetch("/api/health", { cache: "no-store" })
            .then((r) => { if (r.ok) window.location.reload(); else connect(); })
            .catch(() => connect());
        } else {
          connect();
        }
      }, 800);
    };
  }

  // Only run on localhost / dev hosts
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(location.hostname)) {
    connect();
  }
})();
