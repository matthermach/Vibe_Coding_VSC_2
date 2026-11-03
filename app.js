(function () {
  const storageKey = 'forma-roadmap-v1';
  const colors = ['#4d9680', '#6387c5', '#c98c70', '#9b88b6', '#ab985a', '#598f9c'];
  const icons = ['rocket', 'blocks', 'sparkles', 'flag', 'globe', 'box'];
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const icon = name => `<i data-lucide="${name}"></i>`;
  const today = new Date();
  const horizon = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const shiftDate = (date, months, days = 0) => { const result = Forecast.parseDate(date); result.setUTCMonth(result.getUTCMonth() + months); result.setUTCDate(result.getUTCDate() + days); return Forecast.dateKey(result); };
  const monthsFor = start => Array.from({ length: 12 }, (_, index) => shiftDate(start, index).slice(0, 7));
  const monthName = key => Forecast.parseDate(key + '-01').toLocaleDateString('pl-PL', { month: 'short', timeZone: 'UTC' }).replace('.', '');
  const prettyDate = date => date ? Forecast.parseDate(date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : 'Poza horyzontem';
  const fullDate = date => date ? Forecast.parseDate(date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : 'Poza horyzontem';
  const percent = value => Math.round(value * 100) + '%';
  const initials = name => name.split(/\s+/).map(word => word[0]).join('').slice(0, 2).toUpperCase();
  const skillName = id => state.skills.find(skill => skill.id === id)?.name || 'Brak kompetencji';
  const teamName = id => state.teams.find(team => team.id === id)?.name || 'Brak zespołu';
  const button = (action, label, symbol, primary = false, extra = '') => `<button class="button ${primary ? 'primary' : ''}" data-action="${action}" ${extra}>${icon(symbol)}${label}</button>`;
  function demo() {
    const skills = [{ id: 'product', name: 'Product & Design' }, { id: 'frontend', name: 'Frontend' }, { id: 'backend', name: 'Backend' }, { id: 'qa', name: 'QA & Testing' }];
    const teams = [{ id: 'atlas', name: 'Atlas', skills: ['frontend', 'backend', 'qa'], color: colors[0] }, { id: 'orbit', name: 'Orbit', skills: ['product', 'frontend', 'qa'], color: colors[1] }, { id: 'nova', name: 'Nova', skills: ['backend', 'qa'], color: colors[2] }];
    teams.forEach((team, index) => { team.capacity = Object.fromEntries(monthsFor(horizon).map((month, number) => [month, Object.fromEntries(team.skills.map(skill => [skill, Math.round((skill === 'qa' ? 10 : 20 + index * 4) * (number === 1 ? .65 : 1))]))])); });
    const item = (id, name, teamId, skillId, min, max, predecessor = '', fixed = false, deadline = '') => ({ id, name, teamId, skillId, min, max, start: '', predecessor, fixed, deadline });
    return { version: 1, horizon, skills, teams, initiatives: [
      { id: 'platform', name: 'Platforma nowej generacji', color: colors[0], start: shiftDate(horizon, 0, 7), teamIds: ['atlas', 'orbit', 'nova'], items: [item('discovery', 'Discovery & UX', 'orbit', 'product', 15, 25), item('api', 'Architektura i API', 'nova', 'backend', 35, 55, 'discovery'), item('platform-ui', 'Nowy interfejs', 'atlas', 'frontend', 30, 48, 'discovery'), item('platform-test', 'Integracja i testy', 'atlas', 'qa', 12, 20, 'api', true, shiftDate(horizon, 5, 20))] },
      { id: 'selfservice', name: 'Portal self-service', color: colors[1], start: shiftDate(horizon, 1), teamIds: ['orbit', 'atlas'], items: [item('portal-design', 'Projekt doświadczenia', 'orbit', 'product', 12, 20), item('portal-build', 'Panel klienta', 'orbit', 'frontend', 28, 45, 'portal-design'), item('portal-test', 'Testy akceptacyjne', 'atlas', 'qa', 8, 14, 'portal-build', true, shiftDate(horizon, 3, 14))] },
      { id: 'automation', name: 'Automatyzacja operacji', color: colors[2], start: shiftDate(horizon, 2), teamIds: ['nova', 'atlas'], items: [item('automate-api', 'Integracje procesów', 'nova', 'backend', 24, 38), item('automate-ui', 'Centrum operacyjne', 'atlas', 'frontend', 18, 30, 'automate-api'), item('automate-test', 'Walidacja procesów', 'nova', 'qa', 10, 16, 'automate-ui')] }
    ] };
  }
  function validate(data) {
    const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Forecast.parseDate(value)) && Forecast.dateKey(Forecast.parseDate(value)) === value;
    const nonempty = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 160;
    const list = value => Array.isArray(value) && value.length <= 200;
    const fail = message => { throw Error(message); };
    if (!data || data.version !== 1 || !date(data.horizon) || !data.horizon.endsWith('-01') || !list(data.skills) || !list(data.teams) || !list(data.initiatives)) fail('Nieprawidłowy format workspace.');
    const ids = new Set();
    const entity = entry => { if (!entry || !nonempty(entry.id) || !/^[\w-]+$/.test(entry.id) || ids.has(entry.id) || !nonempty(entry.name)) fail('Nieprawidłowa nazwa lub identyfikator.'); ids.add(entry.id); };
    data.skills.forEach(entity);
    const skillIds = data.skills.map(skill => skill.id);
    data.teams.forEach(team => {
      entity(team);
      if (!list(team.skills) || new Set(team.skills).size !== team.skills.length || team.skills.some(skill => !skillIds.includes(skill)) || !team.capacity || typeof team.capacity !== 'object') fail('Nieprawidłowe kompetencje zespołu.');
      for (const [month, values] of Object.entries(team.capacity)) {
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !values || typeof values !== 'object') fail('Nieprawidłowy kalendarz capacity.');
        for (const [skill, amount] of Object.entries(values)) if (!team.skills.includes(skill) || typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || amount > 10000) fail('Capacity musi być liczbą od 0 do 10 000.');
      }
    });
    let itemCount = 0;
    data.initiatives.forEach(initiative => {
      entity(initiative);
      if (!date(initiative.start) || !list(initiative.teamIds) || new Set(initiative.teamIds).size !== initiative.teamIds.length || initiative.teamIds.some(id => !data.teams.some(team => team.id === id)) || !list(initiative.items)) fail('Sprawdź datę startu i zespoły inicjatywy.');
      const predecessors = [];
      initiative.items.forEach(item => {
        entity(item); itemCount++;
        const team = data.teams.find(team => team.id === item.teamId);
        if (!team || !initiative.teamIds.includes(team.id) || !team.skills.includes(item.skillId)) fail('Każdy element wymaga zaangażowanego zespołu z odpowiednią kompetencją.');
        if (typeof item.min !== 'number' || typeof item.max !== 'number' || !Number.isFinite(item.min) || !Number.isFinite(item.max) || item.min <= 0 || item.max < item.min || item.max > 10000) fail('Estymaty: 0 < min ≤ max ≤ 10 000 osobodni.');
        if (item.start && !date(item.start)) fail('Nieprawidłowa data startu elementu.');
        if (item.predecessor && !predecessors.includes(item.predecessor)) fail('Zależność może wskazywać tylko wcześniejszy element tej inicjatywy.');
        const earliestStart = [initiative.start, item.start].filter(Boolean).sort().at(-1);
        if (typeof item.fixed !== 'boolean' || (item.fixed && (!date(item.deadline) || item.deadline < earliestStart))) fail('Fixed date wymaga terminu nie wcześniejszego niż start.');
        predecessors.push(item.id);
      });
    });
    if (itemCount > 200 || data.teams.length > 30 || data.skills.length > 30 || data.initiatives.length > 30) fail('Limit workspace: 30 zespołów, 30 kompetencji, 30 inicjatyw i 200 elementów.');
    return data;
  }
  let state;
  let storageAvailable = true;
  try { const stored = localStorage.getItem(storageKey); state = stored ? validate(JSON.parse(stored)) : demo(); } catch { state = demo(); }
  const cloudMode = Boolean(globalThis.FORMA_CLOUD?.url || globalThis.FORMA_CLOUD?.publishableKey || location.protocol !== 'file:');
  let shared = null;
  let cloudStatus = { phase: cloudMode ? 'loading' : 'local', session: null, hasData: false, message: '' };
  const emptyWorkspace = () => ({ version: 1, horizon, skills: [], teams: [], initiatives: [] });
  const cloudBlocked = () => cloudMode && !['ready', 'pending', 'saving'].includes(cloudStatus.phase);
  let currentView = 'roadmap';
  let forecast = null;
  let stale = true;
  let computing = false;
  let revision = 0;
  let chartMode = 'teams';
  let chartFilter = '';
  const collapsed = new Set();
  let draft = null;
  let editingId = null;
  let toastTimer;
  const app = document.querySelector('#app');
  const dialog = document.querySelector('#editor');
  function notify(message) { const toast = document.querySelector('#toast'); toast.textContent = message; toast.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('visible'), 4000); }
  function save() {
    revision++; stale = true;
    if (cloudMode) { shared.queue(state); return; }
    try { localStorage.setItem(storageKey, JSON.stringify(state)); storageAvailable = true; } catch { storageAvailable = false; notify('Brak dostępu do zapisu lokalnego. Wyeksportuj dane przed zamknięciem.'); }
    document.querySelector('#save-status').innerHTML = `<span class="local-indicator"></span>${storageAvailable ? 'Zapisano lokalnie' : 'Brak zapisu lokalnego'}`;
  }
  function runSimulation() {
    if (cloudBlocked()) return;
    if (computing) return;
    try { validate(state); } catch (error) { notify(error.message); return; }
    computing = true;
    render();
    const startedRevision = revision;
    const snapshot = structuredClone(state);
    setTimeout(() => {
      try { forecast = Forecast.simulate(snapshot, 1500); stale = revision !== startedRevision; }
      catch (error) { notify('Nie udało się przeliczyć prognozy: ' + error.message); }
      finally { computing = false; render(); }
    }, 40);
  }
  const allItems = () => state.initiatives.flatMap(initiative => initiative.items);
  const result = id => stale ? null : forecast?.results[id];
  function initiativeResult(initiative) {
    if (!initiative.items.length || stale || !forecast) return { p85: null, p50: null, probability: null, start: initiative.start };
    return forecast.initiatives[initiative.id] || { p85: null, p50: null, probability: null, start: initiative.start };
  }
  function statusBadge(initiative) {
    if (stale) return '<span class="badge">Do przeliczenia</span>';
    const forecastResult = initiativeResult(initiative);
    if (!initiative.items.length) return '<span class="badge">Brak elementów</span>';
    if (!forecastResult.p85) return `<span class="badge orange">${icon('alert-triangle')}Poza horyzontem</span>`;
    if (forecastResult.probability !== null && forecastResult.probability < .85) return `<span class="badge orange">${icon('alert-triangle')}Ryzyko terminu</span>`;
    return `<span class="badge green">${icon('check')}Plan wykonalny</span>`;
  }
  function metric(label, symbol, value, badge, note) { return `<div class="metric"><div class="metric-label">${icon(symbol)}${label}</div><div class="metric-value">${value}${badge || ''}</div><div class="metric-note">${note}</div></div>`; }
  function metrics() {
    const items = allItems();
    const risky = items.filter(item => item.fixed && result(item.id)?.probability < .85).length;
    const last = stale ? null : forecast?.portfolio.p85;
    const capacity = state.teams.reduce((total, team) => total + monthsFor(state.horizon).reduce((sum, month) => sum + Object.values(team.capacity[month] || {}).reduce((acc, value) => acc + value, 0), 0), 0);
    return `<section class="metrics" aria-label="Podsumowanie portfolio">${metric('Aktywne inicjatywy', 'layers', state.initiatives.length, '<span class="badge green">PORTFOLIO</span>', `${items.length} elementów w planie`)}${metric('Zaangażowane zespoły', 'users', new Set(state.initiatives.flatMap(initiative => initiative.teamIds)).size, '', `${state.skills.length} kompetencje · ${Math.round(capacity).toLocaleString('pl-PL')} os.dni / rok`)}${metric('Ukończenie portfolio · P85', 'calendar-check-2', `<span style="font-size:21px">${stale ? '—' : last ? prettyDate(last) : 'Poza rokiem'}</span>`, '', stale ? 'Prognoza wymaga przeliczenia' : last ? `<span class="green-text">${last.slice(0, 4)} · wszystkie elementy portfolio</span>` : 'Nie wszystkie elementy mieszczą się w roku')}${metric('Terminy zagrożone', 'flag', stale ? '—' : risky, !stale && risky ? '<span class="badge orange">FIXED DATE</span>' : '', stale ? 'Prognoza wymaga przeliczenia' : `<span class="${risky ? 'orange-text' : 'green-text'}">${items.filter(item => item.fixed).length} wymagane terminy · próg 85%</span>`)}</section>`;
  }
  function heading(title, subtitle, actions = '') { return `<section class="page-heading"><div><div class="eyebrow">PLANOWANIE PORTFOLIO</div><h1>${title}</h1><p class="page-subtitle">${subtitle}</p></div><div class="heading-actions">${actions}</div></section>`; }
  const simulationButton = () => `<button class="button ${computing ? 'loading' : ''}" data-action="simulate" ${computing ? 'disabled' : ''}>${icon(computing ? 'loader-circle' : 'refresh-cw')}${computing ? 'Przeliczanie…' : 'Przelicz prognozę'}</button>`;
  function cards() {
    return `<section class="section-heading"><h2>Inicjatywy <span class="badge">${state.initiatives.length}</span></h2><span class="secondary">Priorytet według kolejności w planie</span></section><div class="initiative-list">${state.initiatives.map((initiative, index) => {
      const value = initiativeResult(initiative);
      const fixed = initiative.items.filter(item => item.fixed).length;
      const capacityCompletion = stale || !initiative.items.length ? 0 : initiative.items.filter(item => result(item.id)?.p85).length / initiative.items.length * 100;
      return `<article class="initiative-card" style="--bar-color:${colors[index % colors.length]}"><div class="card-top"><div class="project-symbol">${icon(icons[index % icons.length])}</div>${statusBadge(initiative)}<button class="icon-button" data-action="edit-initiative" data-id="${initiative.id}" aria-label="Edytuj ${escape(initiative.name)}" title="Edytuj inicjatywę">${icon('ellipsis')}</button></div><h3>${escape(initiative.name)}</h3><div class="card-meta">${icon('list-checks')}${initiative.items.length} elementów<span>·</span>${fixed} fixed date</div><div class="card-progress" title="Elementy z prognozą P85 w rocznym horyzoncie: ${Math.round(capacityCompletion)}%"><span style="width:${capacityCompletion}%"></span></div><div class="card-bottom"><div class="team-avatars">${initiative.teamIds.map(id => { const team = state.teams.find(entry => entry.id === id); const color = colors[state.teams.indexOf(team) % colors.length]; return `<span class="team-avatar" style="--bar-color:${color}" title="${escape(team.name)}">${escape(initials(team.name))}</span>`; }).join('')}</div><span>P85 <span class="forecast-date">${stale ? '—' : prettyDate(value.p85)}</span></span></div></article>`;
    }).join('') || `<div class="empty">${icon('layers')}<p>Brak inicjatyw</p>${button('add-initiative', 'Dodaj inicjatywę', 'plus', true)}</div>`}</div>`;
  }
  function chartBar(value, color, text, item) {
    const count = Forecast.calendar(state.horizon).days.length;
    const position = date => Math.max(0, Math.min(100, (+Forecast.parseDate(date) - +Forecast.parseDate(state.horizon)) / Forecast.dayMs / count * 100));
    const start = value?.start;
    const end = value?.p85;
    let html = '';
    if (start && end) {
      const left = position(start);
      const width = Math.max(.3, position(Forecast.dateKey(new Date(+Forecast.parseDate(end) + Forecast.dayMs))) - left);
      const solid = value.p50 ? Math.min(100, Math.max(0, (position(Forecast.dateKey(new Date(+Forecast.parseDate(value.p50) + Forecast.dayMs))) - left) / width * 100)) : 0;
      const tooltip = `${text}. Start P50: ${fullDate(start)}. Koniec P50: ${fullDate(value.p50)}. Koniec P85: ${fullDate(end)}${item?.fixed ? `. Szansa dotrzymania fixed date: ${percent(value.probability || 0)}` : ''}`;
      html = `<div class="bar" style="left:${left}%;width:${width}%;--bar-color:${color}" title="${escape(tooltip)}" aria-label="${escape(tooltip)}"><div class="bar-solid" style="width:${solid}%"></div><span class="bar-label">${escape(text)}</span></div>`;
    } else if (item) html = `<span class="no-forecast">${stale ? 'Oczekuje na przeliczenie' : 'Brak ukończenia P85 w horyzoncie'}</span>`;
    if (item?.fixed && item.deadline >= state.horizon && item.deadline < shiftDate(state.horizon, 12)) html += `<span class="fixed-marker" style="left:${position(item.deadline)}%" title="Fixed date: ${fullDate(item.deadline)}${value?.probability !== null && value?.probability !== undefined ? ' · szansa ' + percent(value.probability) : ''}"></span>`;
    const now = Forecast.dateKey(new Date());
    if (now >= state.horizon && now < shiftDate(state.horizon, 12)) html += `<span class="today-line" style="left:${position(now)}%"></span>`;
    return html;
  }
  function chart() {
    const months = monthsFor(state.horizon);
    const calendarDays = Forecast.calendar(state.horizon).days;
    const lengths = months.map(month => calendarDays.filter(day => day.month === month).length);
    let elapsed = 0;
    const gridStops = lengths.slice(0, -1).flatMap(length => { elapsed += length; const position = elapsed / calendarDays.length * 100; return [`transparent ${position - .1}%`, `#edf0f3 ${position - .1}%`, `#edf0f3 ${position}%`, `transparent ${position}%`]; }).join(',');
    const initiatives = state.initiatives.filter(initiative => !chartFilter || initiative.teamIds.includes(chartFilter));
    let rows = '';
    for (const initiative of initiatives) {
      const index = state.initiatives.indexOf(initiative);
      const color = colors[index % colors.length];
      rows += `<div class="gantt-row group"><div class="gantt-label"><button class="icon-button" data-action="collapse" data-id="${initiative.id}" aria-label="${collapsed.has(initiative.id) ? 'Rozwiń' : 'Zwiń'} ${escape(initiative.name)}" aria-expanded="${!collapsed.has(initiative.id)}">${icon(collapsed.has(initiative.id) ? 'chevron-right' : 'chevron-down')}</button><span class="color-dot" style="background:${color}"></span><span class="row-name" title="${escape(initiative.name)}">${escape(initiative.name)}</span><span class="count">${String(initiative.items.length).padStart(2, '0')}</span></div><div class="timeline">${chartBar(initiativeResult(initiative), color, '', null)}</div></div>`;
      if (!collapsed.has(initiative.id)) {
        for (const item of initiative.items.filter(item => !chartFilter || item.teamId === chartFilter)) {
          const teamIndex = state.teams.findIndex(team => team.id === item.teamId);
          const barColor = chartMode === 'teams' ? colors[teamIndex % colors.length] : color;
          rows += `<div class="gantt-row item"><div class="gantt-label">${icon('corner-down-right')}<span class="row-name" title="${escape(item.name)} · ${escape(teamName(item.teamId))} · ${escape(skillName(item.skillId))}">${escape(item.name)}</span>${item.fixed ? icon('flag') : ''}</div><div class="timeline">${chartBar(result(item.id), barColor, teamName(item.teamId), item)}</div></div>`;
        }
      }
    }
    return `<section class="tool" aria-label="Wykres Gantta"><div class="tool-heading"><div><h2>${icon('chart-no-axes-gantt')}Harmonogram inicjatyw <span class="badge green">P85</span></h2><small>${state.initiatives.length} inicjatywy · ${allItems().length} elementów · horyzont 12 miesięcy</small></div><div class="controls"><select class="toolbar-filter" id="chart-filter" aria-label="Filtr zespołu"><option value="">Wszystkie zespoły</option>${state.teams.map(team => `<option value="${team.id}" ${chartFilter === team.id ? 'selected' : ''}>${escape(team.name)}</option>`).join('')}</select><div class="segmented" aria-label="Kolorowanie Gantta"><button data-action="color-teams" class="${chartMode === 'teams' ? 'active' : ''}" aria-pressed="${chartMode === 'teams'}">Zespoły</button><button data-action="color-initiatives" class="${chartMode === 'initiatives' ? 'active' : ''}" aria-pressed="${chartMode === 'initiatives'}">Inicjatywy</button></div></div></div><div class="chart-toolbar"><div class="legend"><span class="legend-item"><span class="swatch"></span>Do P50</span><span class="legend-item"><span class="swatch fade"></span>Bufor do P85</span><span class="legend-item"><span class="swatch deadline"></span>Fixed date</span></div><div class="chart-range">${icon('calendar-days')}${fullDate(state.horizon)} — ${fullDate(Forecast.dateKey(new Date(+Forecast.parseDate(shiftDate(state.horizon, 12)) - Forecast.dayMs)))}</div></div><div class="gantt-scroll"><div class="gantt" style="--grid-lines:linear-gradient(to right,transparent 0,${gridStops},transparent 100%)"><div class="gantt-header"><div class="gantt-label">INICJATYWA / ELEMENT</div><div class="months" style="grid-template-columns:${lengths.map(length => length + 'fr').join(' ')}">${months.map((month, index) => `<div class="month ${index === 0 ? 'current' : ''}">${monthName(month)}<small>${month.slice(0, 4)}</small></div>`).join('')}</div></div>${rows || '<div class="empty">Brak elementów dla wybranego filtra</div>'}</div></div><div class="chart-footer"><span class="${stale ? 'sim-stale' : ''}">${icon(stale ? 'circle-alert' : 'circle-check')}${stale ? 'Dane zmienione · przelicz prognozę' : '1 500 symulacji · rozkład jednostajny · dni robocze'}</span><span>Capacity współdzielone między inicjatywami</span></div></section>`;
  }
  function roadmap() { return heading('Roadmapa i prognozy', 'Wspólny plan. Wiele zespołów. Jeden horyzont.', simulationButton() + button('add-initiative', 'Dodaj inicjatywę', 'plus', true)) + metrics() + chart() + cards(); }
  function capacityView() {
    const months = monthsFor(state.horizon);
    const total = state.teams.reduce((sum, team) => sum + months.reduce((acc, month) => acc + Object.values(team.capacity[month] || {}).reduce((num, value) => num + value, 0), 0), 0);
    return heading('Kalendarz capacity', 'Dostępność zespołów według kompetencji · osobodni / miesiąc', simulationButton() + button('add-team', 'Dodaj zespół', 'plus', true)) + `<section class="tool"><div class="tool-heading"><div><h2>${icon('calendar-days')}Dostępność na 12 miesięcy</h2><small>${state.teams.length} zespoły · ${state.skills.length} kompetencje</small></div><span class="badge">OSOBODNI / MIESIĄC</span></div><div class="capacity-toolbar"><label>Horyzont od <input type="month" id="horizon" value="${state.horizon.slice(0, 7)}" required></label><span>0 = brak dostępności · poniedziałek–piątek</span><button class="button" data-action="copy-capacity">${icon('copy')}Powiel pierwszy miesiąc na cały rok</button></div><div class="table-scroll"><table class="capacity-table"><thead><tr><th>Zespół / kompetencja</th>${months.map(month => `<th>${monthName(month)}<small>${month.slice(0, 4)}</small></th>`).join('')}</tr></thead><tbody>${state.teams.map((team, index) => `<tr class="capacity-team"><td colspan="13"><span><span class="color-dot" style="background:${colors[index % colors.length]}"></span>${escape(team.name)}</span></td></tr>${team.skills.map(skill => `<tr><td>${escape(skillName(skill))}</td>${months.map(month => `<td><input type="number" data-capacity data-team="${team.id}" data-skill="${skill}" data-month="${month}" min="0" max="10000" step="0.5" value="${team.capacity[month]?.[skill] || 0}" aria-label="${escape(team.name)} / ${escape(skillName(skill))} / ${month}"></td>`).join('')}</tr>`).join('')}`).join('') || '<tr><td colspan="13" class="empty">Dodaj zespół i przypisz kompetencje.</td></tr>'}</tbody></table></div><div class="capacity-summary"><span id="capacity-total">Łącznie: ${total.toLocaleString('pl-PL')} osobodni / rok</span><span>Estymata 10 os.dni przy capacity 20 os.dni/mies. zajmie ok. pół miesiąca.</span></div></section>`;
  }
  function teamsView() {
    return heading('Zespoły i kompetencje', 'Zasoby portfolio i obszary odpowiedzialności', button('add-team', 'Dodaj zespół', 'plus', true)) + `<div class="teams-layout"><section class="teams-list">${state.teams.map((team, index) => `<article class="team-card"><div class="team-card-top"><div class="project-symbol" style="--bar-color:${colors[index % colors.length]}">${icon('users')}</div><h3>${escape(team.name)}<small>${state.initiatives.filter(initiative => initiative.teamIds.includes(team.id)).length} inicjatywy · ${team.skills.length} kompetencje</small></h3><button class="icon-button" data-action="edit-team" data-id="${team.id}" title="Edytuj zespół" aria-label="Edytuj ${escape(team.name)}">${icon('pencil')}</button></div><div class="skill-tags">${team.skills.map(skill => `<span class="skill-tag">${escape(skillName(skill))}</span>`).join('') || '<small>Brak przypisanych kompetencji</small>'}</div></article>`).join('') || '<div class="empty">Brak zespołów</div>'}</section><section class="skills-panel"><div class="section-heading"><h2>Kompetencje</h2><span class="badge">${state.skills.length}</span></div>${state.skills.map(skill => `<div class="skill-row"><span>${escape(skill.name)}</span><button class="icon-button" data-action="delete-skill" data-id="${skill.id}" title="Usuń kompetencję" aria-label="Usuń ${escape(skill.name)}">${icon('x')}</button></div>`).join('')}<form id="skill-form" class="add-skill"><input name="skill" placeholder="Nowa kompetencja" aria-label="Nazwa nowej kompetencji" required maxlength="160"><button class="icon-button" title="Dodaj kompetencję" aria-label="Dodaj kompetencję">${icon('plus')}</button></form></section></div>`;
  }
  function overview() {
    return heading('Przegląd portfolio', 'Inicjatywy, zasoby i ryzyko terminów', simulationButton() + button('add-initiative', 'Dodaj inicjatywę', 'plus', true)) + metrics() + `<section class="tool"><div class="tool-heading"><h2>${icon('list-checks')}Prognozy elementów</h2><span class="badge green">P85</span></div><div class="table-scroll"><table class="overview-table"><thead><tr><th>Inicjatywa / element</th><th>Zespół</th><th>Min–max os.dni</th><th>Koniec P50</th><th>Koniec P85</th><th>Fixed date</th><th>Szansa terminu</th></tr></thead><tbody>${state.initiatives.flatMap(initiative => initiative.items.map(item => { const value = result(item.id); return `<tr><td>${escape(item.name)}<small>${escape(initiative.name)}</small></td><td>${escape(teamName(item.teamId))}<small>${escape(skillName(item.skillId))}</small></td><td class="mono">${item.min}–${item.max}</td><td>${stale ? '—' : prettyDate(value?.p50)}</td><td>${stale ? '—' : prettyDate(value?.p85)}</td><td>${item.fixed ? fullDate(item.deadline) : '—'}</td><td>${item.fixed && value ? `<span class="badge ${value.probability >= .85 ? 'green' : 'orange'}">${percent(value.probability)}</span>` : '—'}</td></tr>`; })).join('') || '<tr><td colspan="7" class="empty">Brak elementów w planie</td></tr>'}</tbody></table></div></section>` + cards();
  }
  function refreshIcons(root) { if (globalThis.lucide) lucide.createIcons({ root: root || document }); }
  function cloudChrome() {
    if (!cloudMode) return;
    const labels = { loading: 'Łączenie z bazą…', 'signed-out': 'Wymagane logowanie', denied: 'Brak dostępu', ready: 'Zapisano w bazie', empty: 'Pusty workspace', pending: 'Oczekuje na zapis…', saving: 'Zapisywanie…', conflict: 'Konflikt wersji', error: 'Błąd połączenia', setup: 'Brak konfiguracji bazy' };
    document.querySelector('#save-status').innerHTML = `<span class="local-indicator"></span>${labels[cloudStatus.phase] || 'Supabase'}`;
    document.querySelector('#workspace-mode').textContent = 'Wspólny workspace';
    document.querySelector('#storage-mode').textContent = 'Wspólna baza · Supabase';
    document.querySelector('#account-action').hidden = !cloudStatus.session;
    document.querySelector('#account-action').title = cloudStatus.session ? `Wyloguj ${cloudStatus.session.user.email || ''}` : 'Wyloguj';
    document.querySelector('.profile small').textContent = cloudStatus.session?.user.email || 'Dostęp po zalogowaniu';
    document.querySelector('.top-avatar').textContent = cloudStatus.session?.user.email ? initials(cloudStatus.session.user.email) : 'TY';
    document.querySelectorAll('.topbar [data-action="import"],.topbar [data-action="export"],.sidebar-bottom [data-action="export"]').forEach(control => { control.disabled = cloudBlocked(); });
  }
  function cloudGate() {
    const phase = cloudStatus.phase;
    let title = 'Łączenie z workspace';
    let content = '<p class="cloud-note">Trwa sprawdzanie sesji i dostępu do bazy.</p>';
    if (phase === 'signed-out') {
      title = 'Zaloguj się do workspace';
      content = `<form id="cloud-login" class="cloud-login"><label class="form-field">Adres e-mail<input name="email" type="email" autocomplete="email" placeholder="ty@firma.pl" required maxlength="254"></label><button class="button primary">${icon('mail')}Wyślij link do logowania</button><p class="cloud-note" id="login-result" role="status">Dostęp wyłącznie dla zatwierdzonych kont.</p></form>`;
    }
    if (phase === 'setup') { title = 'Brak konfiguracji bazy'; content = '<p class="cloud-note">Połączenie z Supabase nie zostało skonfigurowane.</p>'; }
    if (phase === 'denied') { title = 'Brak dostępu do workspace'; content = `<p class="cloud-note">${escape(cloudStatus.message)}</p><div class="cloud-actions">${button('cloud-refresh', 'Sprawdź dostęp ponownie', 'refresh-cw')}${button('cloud-logout', 'Wyloguj', 'log-out')}</div>`; }
    if (phase === 'empty') {
      title = 'Nowy wspólny workspace';
      let localData = false;
      try { localData = Boolean(localStorage.getItem(storageKey)); } catch {}
      content = `<p class="cloud-note">W bazie nie ma jeszcze planu.</p><div class="cloud-actions">${button('cloud-init-empty', 'Utwórz pusty plan', 'plus', true)}${localData ? button('cloud-init-local', 'Przenieś dane z tego urządzenia', 'upload') : ''}</div>`;
    }
    if (phase === 'conflict' || phase === 'error') {
      title = phase === 'conflict' ? 'Ktoś zmienił wspólny plan' : 'Nie udało się połączyć z bazą';
      content = `<p class="cloud-note">${phase === 'conflict' ? 'Twoje zmiany nie nadpisały nowszej wersji. Wyeksportuj je przed pobraniem aktualnego planu.' : 'Zmiany oczekujące na zapis nie zostały potwierdzone przez bazę.'}</p><div class="cloud-actions">${phase === 'error' ? button('cloud-retry', 'Ponów połączenie', 'refresh-cw', true) : ''}${cloudStatus.session ? button('cloud-refresh', 'Pobierz aktualny plan', 'cloud-download', phase === 'conflict') : button('cloud-logout', 'Wróć do logowania', 'log-in')}${cloudStatus.session && shared?.hasPending() ? button('export', 'Eksportuj swoje zmiany', 'download') : ''}</div>`;
    }
    return `<section class="cloud-gate"><div class="cloud-symbol">${icon(phase === 'loading' ? 'loader-circle' : phase === 'conflict' ? 'git-compare-arrows' : 'lock-keyhole')}</div><div class="eyebrow">FORMA / WSPÓLNY WORKSPACE</div><h1>${title}</h1>${content}</section>`;
  }
  function render() {
    cloudChrome();
    if (cloudBlocked()) { app.innerHTML = cloudGate(); refreshIcons(); return; }
    const views = { roadmap, overview, capacity: capacityView, teams: teamsView };
    app.innerHTML = views[currentView]();
    document.querySelector('#breadcrumb').textContent = { roadmap: 'Roadmapa i prognozy', overview: 'Przegląd portfolio', capacity: 'Kalendarz capacity', teams: 'Zespoły i kompetencje' }[currentView];
    document.querySelectorAll('[data-view]').forEach(element => { element.classList.toggle('active', element.dataset.view === currentView); if (element.getAttribute('role') === 'tab') element.setAttribute('aria-selected', String(element.dataset.view === currentView)); });
    refreshIcons();
  }
  function teamOptions(selected) { return draft.teamIds.map(id => `<option value="${id}" ${id === selected ? 'selected' : ''}>${escape(teamName(id))}</option>`).join(''); }
  function skillOptions(teamId, selected) { return (state.teams.find(team => team.id === teamId)?.skills || []).map(id => `<option value="${id}" ${id === selected ? 'selected' : ''}>${escape(skillName(id))}</option>`).join(''); }
  function itemEditor(item, index) {
    return `<div class="item-editor" data-item="${item.id}"><div class="item-top"><span>${String(index + 1).padStart(2, '0')}</span><input data-field="name" value="${escape(item.name)}" aria-label="Nazwa elementu ${index + 1}" placeholder="Nazwa elementu" required maxlength="160"><button type="button" class="icon-button" data-action="remove-item" data-id="${item.id}" title="Usuń element" aria-label="Usuń element ${index + 1}">${icon('trash-2')}</button></div><div class="item-fields"><label>Zespół<select data-field="teamId" required>${teamOptions(item.teamId)}</select></label><label>Kompetencja<select data-field="skillId" required>${skillOptions(item.teamId, item.skillId)}</select></label><label>Min (os.dni)<input data-field="min" type="number" min="0.5" max="10000" step="0.5" value="${item.min}" required></label><label>Max (os.dni)<input data-field="max" type="number" min="0.5" max="10000" step="0.5" value="${item.max}" required></label><label>Start elementu<input data-field="start" type="date" value="${item.start || ''}" aria-label="Start elementu ${index + 1}"></label></div><div class="item-extra"><label>Po elemencie <select data-field="predecessor"><option value="">Bez zależności</option>${draft.items.slice(0, index).map(previous => `<option value="${previous.id}" ${item.predecessor === previous.id ? 'selected' : ''}>${escape(previous.name || 'Element ' + (draft.items.indexOf(previous) + 1))}</option>`).join('')}</select></label><label><input type="checkbox" data-field="fixed" ${item.fixed ? 'checked' : ''}>Fixed date</label>${item.fixed ? `<label>Termin <input data-field="deadline" type="date" value="${item.deadline || ''}" required aria-label="Wymagany termin elementu ${index + 1}"></label>` : ''}</div></div>`;
  }
  function initiativeEditor() {
    dialog.innerHTML = `<form id="initiative-form"><div class="dialog-header"><div><h2 id="dialog-title">${editingId ? 'Edytuj inicjatywę' : 'Nowa inicjatywa'}</h2><small>Estymaty w osobodniach · min i max dla zespołu oraz kompetencji</small></div><button type="button" class="icon-button" data-action="close-dialog" title="Zamknij" aria-label="Zamknij">${icon('x')}</button></div><div class="dialog-content"><div class="form-error" id="form-error" role="alert"></div><div class="form-grid"><label class="form-field">Nazwa inicjatywy<input name="name" value="${escape(draft.name)}" placeholder="np. Platforma klienta" maxlength="160" required></label><label class="form-field">Data startu<input name="start" type="date" value="${draft.start}" required></label></div><div class="form-section-title">Zaangażowane zespoły</div><div class="check-options">${state.teams.map(team => `<label class="check-option"><input type="checkbox" name="team" value="${team.id}" ${draft.teamIds.includes(team.id) ? 'checked' : ''}>${escape(team.name)}</label>`).join('') || 'Najpierw dodaj zespół i jego kompetencje.'}</div><div class="section-heading"><h2>Elementy inicjatywy <span class="badge">${draft.items.length}</span></h2><button type="button" class="button" data-action="add-item">${icon('plus')}Dodaj element</button></div><div id="item-editors">${draft.items.map(itemEditor).join('')}</div></div><div class="dialog-footer"><div>${editingId ? `<button type="button" class="button danger" data-action="delete-initiative" data-id="${editingId}">${icon('trash-2')}Usuń inicjatywę</button><button type="button" class="icon-button" data-action="priority-up" title="Przesuń inicjatywę wyżej w priorytecie" aria-label="Podnieś priorytet inicjatywy">${icon('arrow-up')}</button>` : ''}</div><div><button type="button" class="button" data-action="close-dialog">Anuluj</button><button class="button primary">${icon('check')}Zapisz inicjatywę</button></div></div></form>`;
    refreshIcons(dialog);
  }
  function captureDraft() {
    if (!draft || !document.querySelector('#initiative-form')) return;
    const form = document.querySelector('#initiative-form');
    draft.name = form.elements.name.value.trim();
    draft.start = form.elements.start.value;
    draft.teamIds = [...form.querySelectorAll('[name=team]:checked')].map(input => input.value);
    form.querySelectorAll('[data-item]').forEach(row => {
      const item = draft.items.find(entry => entry.id === row.dataset.item);
      row.querySelectorAll('[data-field]').forEach(input => { item[input.dataset.field] = input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : input.value; });
    });
  }
  function openInitiative(id) {
    editingId = id || null;
    draft = id ? structuredClone(state.initiatives.find(entry => entry.id === id)) : { id: uid(), name: '', start: state.horizon > Forecast.dateKey(new Date()) ? state.horizon : Forecast.dateKey(new Date()), teamIds: [], items: [] };
    initiativeEditor(); dialog.showModal();
  }
  function openTeam(id) {
    editingId = id || null; draft = null;
    const team = state.teams.find(entry => entry.id === id);
    dialog.innerHTML = `<form id="team-form"><div class="dialog-header"><h2 id="dialog-title">${id ? 'Edytuj zespół' : 'Nowy zespół'}</h2><button type="button" class="icon-button" data-action="close-dialog" aria-label="Zamknij" title="Zamknij">${icon('x')}</button></div><div class="dialog-content"><div class="form-error" id="form-error" role="alert"></div><label class="form-field">Nazwa zespołu<input name="name" value="${escape(team?.name || '')}" placeholder="np. Atlas" maxlength="160" required></label><div class="form-section-title">Kompetencje zespołu</div><div class="check-options">${state.skills.map(skill => `<label class="check-option"><input type="checkbox" name="skill" value="${skill.id}" ${team?.skills.includes(skill.id) ? 'checked' : ''}>${escape(skill.name)}</label>`).join('') || 'Najpierw dodaj kompetencje.'}</div></div><div class="dialog-footer"><div>${id ? `<button type="button" class="button danger" data-action="delete-team" data-id="${id}">${icon('trash-2')}Usuń zespół</button>` : ''}</div><div><button type="button" class="button" data-action="close-dialog">Anuluj</button><button class="button primary">${icon('check')}Zapisz zespół</button></div></div></form>`;
    refreshIcons(dialog); dialog.showModal();
  }
  function closeDialog() { dialog.close(); draft = null; editingId = null; }
  function exportWorkspace() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'forma-workspace-' + Forecast.dateKey(new Date()) + '.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Workspace wyeksportowany.');
  }
  document.addEventListener('click', event => {
    const target = event.target.closest('[data-action],[data-view]');
    if (!target) return;
    const action = target.dataset.action;
    const id = target.dataset.id;
    if (action?.startsWith('cloud-')) {
      if (!shared) { notify('Najpierw skonfiguruj bazę Supabase.'); return; }
      if (action === 'cloud-logout') {
        if (shared.hasPending() && !confirm('Wylogowanie odrzuci zmiany niepotwierdzone przez bazę. Kontynuować?')) return;
        void shared.logout().catch(error => notify(error.message));
      }
      if (action === 'cloud-refresh') {
        if (shared.hasPending() && !confirm('Odrzucić swoje niepotwierdzone zmiany i pobrać plan z bazy?')) return;
        void shared.reload();
      }
      if (action === 'cloud-retry') void shared.retry();
      if (action === 'cloud-init-empty' || action === 'cloud-init-local') {
        if (cloudStatus.phase !== 'empty' || !shared.canEdit()) return;
        try {
          const next = action === 'cloud-init-empty' ? emptyWorkspace() : validate(JSON.parse(localStorage.getItem(storageKey)));
          if (action === 'cloud-init-local' && !confirm('Przenieść lokalny plan do wspólnej bazy dla wszystkich zatwierdzonych użytkowników?')) return;
          state = structuredClone(next); save(); render(); runSimulation();
        } catch (error) { notify(error.message); }
      }
      return;
    }
    if (action === 'close-dialog') { closeDialog(); return; }
    if (cloudBlocked()) {
      if (action === 'export' && cloudStatus.session && ['conflict', 'error'].includes(cloudStatus.phase) && shared?.hasPending()) exportWorkspace();
      return;
    }
    if (target.dataset.view) { currentView = target.dataset.view; render(); return; }
    if (action === 'simulate') runSimulation();
    if (action === 'export') exportWorkspace();
    if (action === 'import') document.querySelector('#import-file').click();
    if (action === 'add-initiative') openInitiative();
    if (action === 'edit-initiative') openInitiative(id);
    if (action === 'add-team') openTeam();
    if (action === 'edit-team') openTeam(id);
    if (action === 'collapse') { collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id); render(); }
    if (action === 'color-teams' || action === 'color-initiatives') { chartMode = action === 'color-teams' ? 'teams' : 'initiatives'; render(); }
    if (action === 'add-item') {
      captureDraft();
      const team = state.teams.find(entry => draft.teamIds.includes(entry.id) && entry.skills.length);
      if (!team) { document.querySelector('#form-error').textContent = 'Zaznacz zespół z przynajmniej jedną kompetencją.'; return; }
      draft.items.push({ id: uid(), name: '', teamId: team.id, skillId: team.skills[0], min: 5, max: 10, start: '', predecessor: '', fixed: false, deadline: '' }); initiativeEditor();
      dialog.querySelector('.dialog-content').scrollTop = dialog.querySelector('.dialog-content').scrollHeight;
    }
    if (action === 'remove-item') { captureDraft(); draft.items = draft.items.filter(item => item.id !== id); draft.items.forEach(item => { if (item.predecessor === id) item.predecessor = ''; }); initiativeEditor(); }
    if (action === 'delete-initiative') {
      if (!confirm('Usunąć inicjatywę wraz ze wszystkimi elementami?')) return;
      state.initiatives = state.initiatives.filter(entry => entry.id !== id); save(); closeDialog(); runSimulation(); notify('Inicjatywa usunięta.');
    }
    if (action === 'priority-up') {
      captureDraft(); const index = state.initiatives.findIndex(entry => entry.id === editingId);
      if (index === 0) { notify('Inicjatywa ma już najwyższy priorytet.'); return; }
      try { validate({ ...state, initiatives: state.initiatives.map(entry => entry.id === editingId ? draft : entry) }); } catch (error) { document.querySelector('#form-error').textContent = error.message; return; }
      state.initiatives[index] = structuredClone(draft); [state.initiatives[index - 1], state.initiatives[index]] = [state.initiatives[index], state.initiatives[index - 1]]; save(); closeDialog(); runSimulation(); notify('Priorytet inicjatywy podniesiony.');
    }
    if (action === 'delete-team') {
      if (state.initiatives.some(initiative => initiative.teamIds.includes(id))) { document.querySelector('#form-error').textContent = 'Zespół jest używany. Najpierw usuń jego elementy i odznacz go w inicjatywach.'; return; }
      if (!confirm('Usunąć zespół i jego capacity?')) return;
      state.teams = state.teams.filter(team => team.id !== id); save(); closeDialog(); render(); notify('Zespół usunięty.');
    }
    if (action === 'delete-skill') {
      if (allItems().some(item => item.skillId === id)) { notify('Kompetencja jest używana w elementach. Najpierw zmień ich kompetencję.'); return; }
      if (!confirm('Usunąć kompetencję i powiązane capacity?')) return;
      state.skills = state.skills.filter(skill => skill.id !== id);
      state.teams.forEach(team => { team.skills = team.skills.filter(skill => skill !== id); Object.values(team.capacity).forEach(month => delete month[id]); }); save(); render(); notify('Kompetencja usunięta.');
    }
    if (action === 'copy-capacity') {
      if (!confirm('Zastąpić capacity wszystkich 12 miesięcy wartościami z pierwszego miesiąca?')) return;
      state.teams.forEach(team => monthsFor(state.horizon).forEach(month => { team.capacity[month] = Object.fromEntries(team.skills.map(skill => [skill, team.capacity[state.horizon.slice(0, 7)]?.[skill] || 0])); })); save(); render(); notify('Capacity powielone na 12 miesięcy.');
    }
  });
  document.addEventListener('change', event => {
    const input = event.target;
    if (cloudBlocked()) return;
    if (input.matches('[data-capacity]')) {
      if (!input.checkValidity() || !input.value) { input.reportValidity(); input.value = state.teams.find(team => team.id === input.dataset.team).capacity[input.dataset.month]?.[input.dataset.skill] || 0; return; }
      const team = state.teams.find(entry => entry.id === input.dataset.team); team.capacity[input.dataset.month] ||= {}; team.capacity[input.dataset.month][input.dataset.skill] = Number(input.value); save();
      const total = state.teams.reduce((sum, entry) => sum + monthsFor(state.horizon).reduce((acc, month) => acc + Object.values(entry.capacity[month] || {}).reduce((num, value) => num + value, 0), 0), 0);
      document.querySelector('#capacity-total').textContent = `Łącznie: ${total.toLocaleString('pl-PL')} osobodni / rok`;
    }
    if (input.id === 'horizon') { if (!input.value || !input.checkValidity()) return; state.horizon = input.value + '-01'; save(); render(); notify('Nowe miesiące bez danych mają capacity 0.'); }
    if (input.id === 'chart-filter') { chartFilter = input.value; render(); }
    if (input.closest('#initiative-form') && (input.name === 'team' || input.dataset.field === 'teamId' || input.dataset.field === 'fixed')) {
      const changedItemId = input.closest('[data-item]')?.dataset.item;
      captureDraft();
      if (input.name === 'team') {
        const removedItems = draft.items.filter(item => !draft.teamIds.includes(item.teamId));
        if (removedItems.length) {
          document.querySelector('#form-error').textContent = 'Ten zespół ma przypisane elementy. Zmień ich zespół lub usuń je przed odznaczeniem.';
          input.checked = true; captureDraft(); return;
        }
      }
      if (input.dataset.field === 'teamId') { const item = draft.items.find(entry => entry.id === changedItemId); item.skillId = state.teams.find(team => team.id === item.teamId)?.skills[0] || ''; }
      initiativeEditor();
    }
    if (input.id === 'import-file' && input.files[0]) {
      const file = input.files[0];
      const importRevision = revision;
      if (file.size > 2000000) { notify('Plik jest zbyt duży (maks. 2 MB).'); input.value = ''; return; }
      file.text().then(text => {
        if (cloudMode && (cloudBlocked() || revision !== importRevision)) throw Error('Plan lub sesja zmieniły się podczas odczytu pliku. Ponów import.');
        const next = validate(JSON.parse(text));
        if (!confirm('Zastąpić obecny workspace danymi z pliku?')) return;
        state = next; chartFilter = ''; collapsed.clear(); save(); runSimulation(); notify('Workspace zaimportowany.');
      }).catch(error => notify('Import odrzucony: ' + error.message)).finally(() => { input.value = ''; });
    }
  });
  document.addEventListener('submit', event => {
    event.preventDefault();
    if (event.target.id === 'cloud-login') {
      if (!shared || cloudStatus.phase !== 'signed-out') return;
      const form = event.target;
      const submit = form.querySelector('button');
      submit.disabled = true;
      void shared.login(form.elements.email.value.trim(), location.origin + location.pathname).then(() => {
        form.querySelector('#login-result').textContent = 'Jeśli konto ma dostęp, otrzymasz e-mail z linkiem do logowania.';
      }).catch(() => { form.querySelector('#login-result').textContent = 'Nie udało się wysłać linku. Sprawdź adres lub spróbuj ponownie później.'; }).finally(() => { submit.disabled = false; });
      return;
    }
    if (cloudBlocked()) return;
    if (event.target.id === 'skill-form') {
      const name = event.target.elements.skill.value.trim();
      if (!name) return;
      if (state.skills.length >= 30) { notify('Maksymalnie 30 kompetencji.'); return; }
      if (state.skills.some(skill => skill.name.toLowerCase() === name.toLowerCase())) { notify('Taka kompetencja już istnieje.'); return; }
      state.skills.push({ id: uid(), name }); save(); render(); notify('Kompetencja dodana.');
    }
    if (event.target.id === 'initiative-form') {
      captureDraft();
      const initiatives = editingId ? state.initiatives.map(entry => entry.id === editingId ? draft : entry) : [...state.initiatives, draft];
      try { validate({ ...state, initiatives }); if (!draft.teamIds.length) throw Error('Zaznacz przynajmniej jeden zaangażowany zespół.'); if (!draft.items.length) throw Error('Dodaj przynajmniej jeden element inicjatywy.'); }
      catch (error) { document.querySelector('#form-error').textContent = error.message; dialog.querySelector('.dialog-content').scrollTop = 0; return; }
      state.initiatives = structuredClone(initiatives); save(); closeDialog(); runSimulation(); notify('Inicjatywa zapisana.');
    }
    if (event.target.id === 'team-form') {
      const form = event.target;
      const skills = [...form.querySelectorAll('[name=skill]:checked')].map(input => input.value);
      const previous = state.teams.find(team => team.id === editingId);
      if (previous && allItems().some(item => item.teamId === previous.id && !skills.includes(item.skillId))) { document.querySelector('#form-error').textContent = 'Nie można usunąć kompetencji używanej przez element zespołu.'; return; }
      const team = { id: editingId || uid(), name: form.elements.name.value.trim(), skills, capacity: previous ? structuredClone(previous.capacity) : {} };
      Object.values(team.capacity).forEach(month => Object.keys(month).forEach(skill => { if (!skills.includes(skill)) delete month[skill]; }));
      const teams = editingId ? state.teams.map(entry => entry.id === editingId ? team : entry) : [...state.teams, team];
      try { validate({ ...state, teams }); if (!skills.length) throw Error('Zaznacz przynajmniej jedną kompetencję.'); }
      catch (error) { document.querySelector('#form-error').textContent = error.message; return; }
      state.teams = teams; save(); closeDialog(); render(); notify('Zespół zapisany. Uzupełnij jego capacity w kalendarzu.');
    }
  });
  dialog.addEventListener('cancel', () => { draft = null; editingId = null; });
  const tabs = [...document.querySelectorAll('.app-tabs [role=tab]')];
  document.querySelector('.app-tabs').addEventListener('keydown', event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const index = tabs.indexOf(document.activeElement); const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; tabs[next].focus(); tabs[next].click(); });
  globalThis.Forma = { getState: () => structuredClone(state), validate };
  if (cloudMode) {
    try {
      SharedWorkspace.validateConfig(globalThis.FORMA_CLOUD);
      const client = supabase.createClient(FORMA_CLOUD.url, FORMA_CLOUD.publishableKey);
      shared = SharedWorkspace.create({
        client, validate,
        isBusy: () => dialog.open || Boolean(document.activeElement?.closest('[data-capacity]')),
        onRemote: data => {
          state = data || emptyWorkspace(); revision++; stale = true; forecast = null; chartFilter = ''; collapsed.clear();
          if (data && !cloudBlocked()) { render(); runSimulation(); }
        },
        onStatus: next => {
          const wasBlocked = cloudBlocked();
          cloudStatus = next;
          if (['signed-out', 'denied'].includes(next.phase)) { state = emptyWorkspace(); forecast = null; stale = true; revision++; if (dialog.open) closeDialog(); }
          if (wasBlocked || cloudBlocked()) render(); else cloudChrome();
          if (next.phase === 'ready' && !forecast && !computing) runSimulation();
        }
      });
      render(); void shared.start();
      globalThis.addEventListener('beforeunload', event => { if (shared.hasPending()) { event.preventDefault(); event.returnValue = ''; } });
    } catch (error) { cloudStatus = { ...cloudStatus, phase: 'setup', message: error.message }; render(); }
  } else { render(); runSimulation(); }
})();