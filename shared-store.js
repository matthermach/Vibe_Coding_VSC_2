(function () {
  function create({ client, validate, onStatus = () => {}, onRemote = () => {}, isBusy = () => false, pollMs = 15000, debounceMs = 500 }) {
    let status = { phase: 'loading', session: null, revision: null, hasData: false, message: '' };
    let allowed = false;
    let loaded = false;
    let pending = null;
    let inFlight = false;
    let generation = 0;
    let saveTimer;
    let pollTimer;
    let subscription;
    let disposed = false;
    const emit = (phase, message = '') => { status = { ...status, phase, message }; if (!disposed) onStatus({ ...status }); };
    const hasPending = () => pending !== null || inFlight;
    const canEdit = () => allowed && loaded && ['ready', 'empty', 'pending', 'saving'].includes(status.phase);

    async function load({ discard = false, quiet = false } = {}) {
      if (!status.session || disposed || (!discard && (hasPending() || isBusy() || ['conflict', 'error'].includes(status.phase)))) return;
      if (discard) { pending = null; clearTimeout(saveTimer); }
      const requestGeneration = generation;
      const requestRevision = status.revision;
      if (!quiet) emit('loading');
      try {
        const membership = await client.from('roadmap_members').select('user_id').eq('user_id', status.session.user.id).maybeSingle();
        if (requestGeneration !== generation || disposed) return;
        if (membership.error) throw membership.error;
        if (!membership.data) { allowed = false; loaded = false; emit('denied', 'Twoje konto nie ma dostępu do workspace.'); return; }
        allowed = true;
        const response = await client.from('roadmap_workspaces').select('data,revision').eq('id', 'main').maybeSingle();
        if (requestGeneration !== generation || disposed) return;
        if (response.error) throw response.error;
        if (!response.data) throw Error('Brak workspace w bazie. Uruchom migrację SQL.');
        const nextRevision = Number(response.data.revision);
        if (!Number.isSafeInteger(nextRevision) || nextRevision < 0) throw Error('Nieprawidłowa wersja danych w bazie.');
        if (response.data.data !== null) validate(response.data.data);
        if (hasPending() || status.revision !== requestRevision || (quiet && isBusy())) return;
        if (!loaded || status.revision !== nextRevision || discard) {
          onRemote(response.data.data === null ? null : structuredClone(response.data.data));
        }
        loaded = true;
        status = { ...status, revision: nextRevision, hasData: response.data.data !== null };
        emit(status.hasData ? 'ready' : 'empty');
      } catch (error) {
        if (requestGeneration === generation && !disposed) emit('error', error.message || 'Nie można pobrać danych z bazy.');
      }
    }

    async function flush() {
      if (inFlight || pending === null || !allowed || !loaded || disposed || ['conflict', 'denied', 'signed-out'].includes(status.phase)) return;
      clearTimeout(saveTimer);
      const payload = pending;
      pending = null;
      inFlight = true;
      const requestGeneration = generation;
      const expectedRevision = status.revision;
      emit('saving');
      try {
        const response = await client.rpc('save_roadmap_workspace', { expected_revision: expectedRevision, payload });
        if (requestGeneration !== generation || disposed) return;
        if (response.error) throw response.error;
        const nextRevision = Number(response.data);
        if (!Number.isSafeInteger(nextRevision) || nextRevision !== expectedRevision + 1) throw Error('Nieprawidłowe potwierdzenie zapisu.');
        status = { ...status, revision: nextRevision, hasData: true };
        emit(pending === null ? 'ready' : 'pending');
      } catch (error) {
        if (requestGeneration !== generation || disposed) return;
        pending ||= payload;
        if (error.code === '42501' || error.status === 401 || error.status === 403) {
          allowed = false;
          emit('denied', 'Sesja wygasła lub cofnięto dostęp. Zaloguj się ponownie.');
        } else emit(error.code === '40001' ? 'conflict' : 'error', error.message || 'Nie udało się zapisać danych.');
      } finally {
        if (requestGeneration === generation) {
          inFlight = false;
          if (pending !== null && status.phase === 'pending') void flush();
        }
      }
    }

    async function setSession(session) {
      const changed = status.session?.user.id !== session?.user.id;
      if (changed) {
        generation++;
        pending = null;
        inFlight = false;
        allowed = false;
        loaded = false;
        clearTimeout(saveTimer);
        status = { ...status, revision: null, hasData: false };
      }
      status = { ...status, session };
      if (!session) { emit('signed-out'); return; }
      if (changed || !loaded) await load();
    }

    async function start() {
      subscription = client.auth.onAuthStateChange((event, session) => {
        if (event !== 'INITIAL_SESSION') setTimeout(() => { if (!disposed) void setSession(session); }, 0);
      }).data.subscription;
      emit('loading');
      try {
        const response = await client.auth.getSession();
        if (response.error) throw response.error;
        if (!disposed) await setSession(response.data.session);
      } catch (error) { emit('error', error.message || 'Nie można odczytać sesji.'); }
      if (pollMs > 0) pollTimer = setInterval(() => { if (!document.hidden) void load({ quiet: true }); }, pollMs);
      globalThis.addEventListener('focus', refresh);
    }
    function refresh() { void load({ quiet: true }); }
    function queue(data) {
      if (!canEdit()) throw Error('Brak uprawnień lub nierozwiązany konflikt zapisu.');
      validate(data);
      pending = structuredClone(data);
      clearTimeout(saveTimer);
      emit(inFlight ? 'saving' : 'pending');
      saveTimer = setTimeout(() => void flush(), debounceMs);
    }
    async function login(email, redirectTo) {
      const response = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: false } });
      if (response.error) throw response.error;
    }
    async function logout() {
      const response = await client.auth.signOut({ scope: 'local' });
      if (response.error) throw response.error;
      await setSession(null);
    }
    async function retry() {
      if (pending !== null && allowed && loaded && status.phase === 'error') { emit('pending'); await flush(); }
      else if (!hasPending()) await load({ discard: true });
    }
    function dispose() { disposed = true; generation++; clearTimeout(saveTimer); clearInterval(pollTimer); subscription?.unsubscribe(); globalThis.removeEventListener('focus', refresh); }
    return { start, queue, flush, login, logout, retry, hasPending, canEdit, reload: () => load({ discard: true }), getStatus: () => ({ ...status }), dispose };
  }

  function validateConfig(config) {
    if (!config?.url || !config?.publishableKey) throw Error('Brak konfiguracji Supabase.');
    const url = new URL(config.url);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw Error('Podaj adres HTTPS projektu Supabase bez ścieżki.');
    const key = config.publishableKey;
    if (key.startsWith('sb_publishable_')) return;
    let role;
    try { role = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role; } catch { throw Error('Użyj publicznego klucza publishable lub anon.'); }
    if (role !== 'anon') throw Error('Klucz service_role lub sekretny nie może trafić do strony.');
  }
  globalThis.SharedWorkspace = { create, validateConfig };
})();