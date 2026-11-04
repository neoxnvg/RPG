// Same-origin player presence. Combat/progression remain local in this first transport.
export function createOnlineSession({onState = () => {}, onStatus = () => {}} = {}) {
  let latest = null, stream = null, timer = null, inFlight = false, stopped = false;
  let sent = '', lastSent = 0, retryAt = 0, hasStream = false, hasUpdate = false;
  // A fresh ID per page also distinguishes browser tabs copied from the same tab.
  const id = globalThis.crypto?.randomUUID?.() || `player-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
  let status;
  const setStatus = value => { if (status !== value) { status = value; onStatus(value); } };
  const supported = typeof location !== 'undefined' && /^https?:$/.test(location.protocol) && typeof EventSource !== 'undefined';
  const endpoint = path => new URL(path, new URL('.', location.href)).href;
  const postUpdate = async () => {
    if (stopped || inFlight || !latest || !supported || Date.now() < retryAt) return;
    const body = JSON.stringify({id, ...latest});
    const now = Date.now();
    if (body === sent && now - lastSent < 3000) return;
    inFlight = true;
    try {
      const response = await fetch(endpoint('api/player'), {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body,
        signal: AbortSignal.timeout(5000), credentials: 'same-origin', cache: 'no-store'
      });
      if (!response.ok) throw new Error(`Presence ${response.status}`);
      const result = await response.json();
      if (!result.ok) throw new Error('Presence unavailable');
      sent = body; lastSent = now; hasUpdate = true;
      if (hasStream) setStatus('online');
    } catch {
      hasUpdate = false; retryAt = Date.now() + 4000; setStatus('offline');
    } finally { inFlight = false; }
  };
  if (supported) {
    setStatus('connecting');
    stream = new EventSource(endpoint(`api/events?id=${encodeURIComponent(id)}`));
    stream.addEventListener('state', event => {
      try {
        const state = JSON.parse(event.data);
        if (state.selfId !== id || !Array.isArray(state.players)) return;
        hasStream = true;
        if (hasUpdate) setStatus('online');
        onState(state);
      } catch { /* Ignore malformed snapshots and let EventSource reconnect. */ }
    });
    stream.onerror = () => { hasStream = false; setStatus('offline'); onState({selfId: id, players: []}); };
    timer = setInterval(postUpdate, 200);
  } else setStatus('offline');
  return {
    id,
    update(value) {
      if (!value || stopped) return;
      const position = Array.isArray(value.position) ? value.position : value.position?.toArray?.();
      if (!position || position.length !== 3 || !position.every(Number.isFinite)) return;
      latest = {
        mapId: value.mapId, position: position.map(number => Math.round(number * 100) / 100),
        rotation: Number.isFinite(value.rotation) ? Math.round(value.rotation * 100) / 100 : 0,
        variant: value.variant || 'seraph', name: String(value.name || 'Aventureiro').slice(0, 24)
      };
    },
    close() {
      stopped = true; clearInterval(timer); stream?.close(); setStatus('offline');
      onState({selfId: id, players: []});
    }
  };
}
