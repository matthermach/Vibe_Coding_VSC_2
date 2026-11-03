(function () {
  const dayMs = 86400000;
  const parseDate = value => new Date(value + 'T00:00:00Z');
  const dateKey = date => date.toISOString().slice(0, 10);
  const isWorkday = date => date.getUTCDay() !== 0 && date.getUTCDay() !== 6;

  function calendar(start) {
    const first = parseDate(start);
    const end = new Date(first);
    end.setUTCMonth(end.getUTCMonth() + 12, 1);
    const days = [];
    const workdays = {};
    for (let date = new Date(first); date < end; date = new Date(+date + dayMs)) {
      const month = dateKey(date).slice(0, 7);
      const workday = isWorkday(date);
      days.push({ date: dateKey(date), month, workday });
      if (workday) workdays[month] = (workdays[month] || 0) + 1;
    }
    return { days, workdays };
  }

  function simulate(state, iterations = 1500, random = Math.random) {
    const { days, workdays } = calendar(state.horizon);
    const items = state.initiatives.flatMap(initiative => initiative.items.map(item => ({ ...item, initiativeId: initiative.id, initiativeStart: initiative.start })));
    const samples = Object.fromEntries(items.map(item => [item.id, { starts: [], finishes: [], onTime: 0 }]));
    const initiativeSamples = Object.fromEntries(state.initiatives.map(initiative => [initiative.id, { starts: [], finishes: [], onTime: 0 }]));
    const portfolioSample = { starts: [], finishes: [], onTime: 0 };
    for (let trial = 0; trial < iterations; trial++) {
      const resources = Object.create(null);
      for (const team of state.teams) {
        for (const skill of team.skills) {
          resources[team.id + ':' + skill] = days.map(day => day.workday ? (Number(team.capacity[day.month]?.[skill]) || 0) / workdays[day.month] : 0);
        }
      }
      const completed = Object.create(null);
      for (const item of items) {
        const pool = resources[item.teamId + ':' + item.skillId];
        const predecessor = item.predecessor ? completed[item.predecessor] : -1;
        const earliest = [state.horizon, item.initiativeStart, item.start].filter(Boolean).sort().at(-1);
        let remaining = jStat.uniform.inv(random(), Number(item.min), Number(item.max));
        let first = Infinity;
        let finish = Infinity;
        if (pool && predecessor !== undefined && predecessor !== Infinity) {
          for (let index = Math.max(0, predecessor + 1); index < days.length; index++) {
            if (days[index].date < earliest || pool[index] <= 0) continue;
            if (first === Infinity) first = index;
            const used = Math.min(pool[index], remaining);
            remaining -= used;
            pool[index] -= used;
            if (remaining <= 1e-8) { finish = index; break; }
          }
        }
        completed[item.id] = finish;
        samples[item.id].starts.push(first);
        samples[item.id].finishes.push(finish);
        if (finish !== Infinity && item.fixed && days[finish].date <= item.deadline) samples[item.id].onTime++;
      }
      for (const initiative of state.initiatives) {
        const sample = initiativeSamples[initiative.id];
        sample.starts.push(initiative.items.length ? Math.min(...initiative.items.map(item => samples[item.id].starts[trial])) : Infinity);
        sample.finishes.push(initiative.items.length ? Math.max(...initiative.items.map(item => completed[item.id])) : Infinity);
        if (initiative.items.filter(item => item.fixed).every(item => completed[item.id] !== Infinity && days[completed[item.id]].date <= item.deadline)) sample.onTime++;
      }
      portfolioSample.starts.push(items.length ? Math.min(...items.map(item => samples[item.id].starts[trial])) : Infinity);
      portfolioSample.finishes.push(items.length ? Math.max(...items.map(item => completed[item.id])) : Infinity);
      if (items.filter(item => item.fixed).every(item => completed[item.id] !== Infinity && days[completed[item.id]].date <= item.deadline)) portfolioSample.onTime++;
    }
    const percentile = (values, probability) => values.sort((first, second) => first - second)[Math.ceil(values.length * probability) - 1];
    const summarize = (sample, hasFixed) => {
      const start = percentile(sample.starts, .5);
      const p50 = percentile(sample.finishes, .5);
      const p85 = percentile(sample.finishes, .85);
      return { start: days[start]?.date || null, p50: days[p50]?.date || null, p85: days[p85]?.date || null, probability: hasFixed ? sample.onTime / iterations : null, completion: sample.finishes.filter(Number.isFinite).length / iterations };
    };
    const results = Object.fromEntries(items.map(item => [item.id, summarize(samples[item.id], item.fixed)]));
    const initiatives = Object.fromEntries(state.initiatives.map(initiative => [initiative.id, summarize(initiativeSamples[initiative.id], initiative.items.some(item => item.fixed))]));
    return { results, initiatives, portfolio: summarize(portfolioSample, items.some(item => item.fixed)), iterations, days: days.length };
  }
  globalThis.Forecast = { simulate, calendar, parseDate, dateKey, dayMs };
})();