/*
 * Renders the micro-training Gantt chart, the week detail cards and the lesson
 * plan modal. No dependencies: the chart is a CSS grid and every block is a
 * real button, so keyboard and screen reader users get the same chart.
 */

(function () {
  'use strict';

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAYS_PER_WEEK = PROGRAMME.days.length;

  const el = {
    gantt: document.getElementById('gantt'),
    weeks: document.getElementById('weeks'),
    summary: document.getElementById('summary'),
    questions: document.getElementById('questions'),
    startDate: document.getElementById('startDate'),
    statusFilter: document.getElementById('statusFilter'),
    readingToggle: document.getElementById('readingToggle'),
    overlay: document.getElementById('overlay'),
    modal: document.getElementById('modal'),
    modalHead: document.getElementById('modalHead'),
    modalBody: document.getElementById('modalBody'),
    modalClose: document.getElementById('modalClose'),
    liveRegion: document.getElementById('liveRegion')
  };

  let startMonday = parseISO(PROGRAMME.startMonday);
  let statusFilter = 'all';
  let lastFocused = null;

  /* ---------- dates ---------- */

  function parseISO(iso) {
    const parts = iso.split('-').map(Number);
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  }

  function toISO(date) {
    return date.toISOString().slice(0, 10);
  }

  function addDays(date, days) {
    return new Date(date.getTime() + days * 86400000);
  }

  function sessionDate(weekIndex, dayIndex) {
    return addDays(startMonday, weekIndex * 7 + dayIndex);
  }

  function shortDate(date) {
    return date.getUTCDate() + ' ' + MONTHS[date.getUTCMonth()];
  }

  function longDate(date) {
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getUTCDay()];
    return dayName + ' ' + date.getUTCDate() + ' ' + MONTHS[date.getUTCMonth()] + ' ' + date.getUTCFullYear();
  }

  function holidayFor(date) {
    return BANK_HOLIDAYS[toISO(date)] || null;
  }

  function todayISO() {
    const now = new Date();
    return toISO(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
  }

  /* ---------- helpers ---------- */

  function moduleId(weekIndex, dayIndex) {
    return 'w' + (weekIndex + 1) + 'd' + (dayIndex + 1);
  }

  function eachModule(fn) {
    PROGRAMME.weeks.forEach(function (week, weekIndex) {
      week.days.forEach(function (day, dayIndex) {
        fn(day, week, weekIndex, dayIndex);
      });
    });
  }

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function matchesFilter(day) {
    return statusFilter === 'all' || day.status === statusFilter;
  }

  /* ---------- summary ---------- */

  function renderSummary() {
    const counts = { built: 0, adapt: 0, create: 0 };
    let total = 0;
    eachModule(function (day) {
      counts[day.status] += 1;
      total += 1;
    });

    const tiles = [
      { cls: '', big: total, label: 'Modules of 15 minutes', sub: PROGRAMME.weeks.length + ' weeks, Monday to Thursday' },
      { cls: 'green', big: counts.built, label: 'Built \u2014 run as is', sub: 'Material already exists in this repository' },
      { cls: 'blue', big: counts.adapt, label: 'Adapt \u2014 condense', sub: 'Exists but written for a longer session' },
      { cls: 'purple', big: counts.create, label: 'New \u2014 write first', sub: 'Nothing covers this today' }
    ];

    el.summary.innerHTML = '';
    tiles.forEach(function (tile) {
      const box = make('div', 'summary-box ' + tile.cls);
      box.appendChild(make('span', 'big', String(tile.big)));
      box.appendChild(make('span', 'label', tile.label));
      box.appendChild(make('span', null, tile.sub));
      el.summary.appendChild(box);
    });
  }

  /* ---------- gantt ---------- */

  function renderGantt() {
    const today = todayISO();
    el.gantt.innerHTML = '';
    el.gantt.style.gridTemplateRows =
      '34px 22px repeat(' + PROGRAMME.weeks.length + ', 70px)';

    // Opaque spacers so the scrolling time axis passes behind the sticky
    // topic column rather than showing through it.
    [1, 2].forEach(function (row) {
      const corner = make('div', 'g-corner');
      corner.style.gridRow = String(row);
      el.gantt.appendChild(corner);
    });

    PROGRAMME.weeks.forEach(function (week, weekIndex) {
      const firstColumn = 2 + weekIndex * DAYS_PER_WEEK;

      const divider = make('div', weekIndex === 0 ? 'g-line strong' : 'g-line strong');
      divider.style.gridColumn = String(firstColumn);
      el.gantt.appendChild(divider);

      const weekHead = make('div', 'g-week');
      weekHead.style.gridColumn = firstColumn + ' / span ' + DAYS_PER_WEEK;
      weekHead.appendChild(make('span', null, 'Week ' + (weekIndex + 1)));
      weekHead.appendChild(make('small', null, 'w/c ' + shortDate(sessionDate(weekIndex, 0))));
      el.gantt.appendChild(weekHead);

      const rowLabel = make('div', 'g-label');
      rowLabel.style.gridRow = String(3 + weekIndex);
      rowLabel.appendChild(make('span', null, week.topic));
      rowLabel.appendChild(make('small', null, week.days.length + ' \u00d7 15 min'));
      el.gantt.appendChild(rowLabel);

      week.days.forEach(function (day, dayIndex) {
        const column = firstColumn + dayIndex;
        const date = sessionDate(weekIndex, dayIndex);
        const holiday = holidayFor(date);

        const dayHead = make('div', 'g-day' + (holiday ? ' holiday' : ''));
        dayHead.style.gridColumn = String(column);
        dayHead.textContent = PROGRAMME.days[dayIndex];
        el.gantt.appendChild(dayHead);

        const bar = make('button', 'g-bar ' + week.colour + ' status-' + day.status);
        bar.type = 'button';
        bar.style.gridColumn = String(column);
        bar.style.gridRow = String(3 + weekIndex);
        bar.dataset.week = String(weekIndex);
        bar.dataset.day = String(dayIndex);
        if (!matchesFilter(day)) bar.classList.add('dimmed');
        if (day.gap) bar.classList.add('flagged');
        if (toISO(date) === today) bar.classList.add('today');

        bar.appendChild(make('span', 'bar-title', CHART_LABELS[moduleId(weekIndex, dayIndex)] || day.title));
        const foot = make('span', 'bar-foot');
        foot.appendChild(make('span', 'bar-status', STATUS_LABELS[day.status].short));
        foot.appendChild(make('span', 'bar-day', shortDate(date)));
        bar.appendChild(foot);

        bar.setAttribute(
          'aria-label',
          'Week ' + (weekIndex + 1) + ', ' + PROGRAMME.days[dayIndex] + ' ' + shortDate(date) +
          '. ' + week.topic + ': ' + day.title +
          '. ' + STATUS_LABELS[day.status].name +
          (holiday ? '. Falls on a bank holiday' : '') +
          '. Opens the 15 minute lesson plan.'
        );

        bar.addEventListener('click', function () {
          openModule(weekIndex, dayIndex);
        });

        el.gantt.appendChild(bar);
      });
    });

    const endLine = make('div', 'g-line strong');
    endLine.style.gridColumn = String(2 + PROGRAMME.weeks.length * DAYS_PER_WEEK);
    el.gantt.appendChild(endLine);

    el.gantt.setAttribute(
      'aria-label',
      PROGRAMME.weeks.length + ' week training programme. One topic per week, four 15 minute modules ' +
      'from Monday to Thursday. Starting week commencing ' + shortDate(startMonday) + '.'
    );
  }

  /* ---------- week detail cards ---------- */

  function renderWeeks() {
    el.weeks.innerHTML = '';

    PROGRAMME.weeks.forEach(function (week, weekIndex) {
      const block = make('section', 'week-block');

      const head = make('div', 'week-head');
      head.appendChild(make('span', 'tag', 'Week ' + (weekIndex + 1)));
      head.appendChild(make('h3', null, week.topic));
      head.appendChild(make('span', 'when',
        shortDate(sessionDate(weekIndex, 0)) + ' \u2013 ' + shortDate(sessionDate(weekIndex, DAYS_PER_WEEK - 1))));
      block.appendChild(head);

      const outcome = make('p', 'week-outcome');
      outcome.appendChild(make('strong', null, 'By Thursday: '));
      outcome.appendChild(document.createTextNode(week.outcome));
      block.appendChild(outcome);

      const grid = make('div', 'module-grid');
      week.days.forEach(function (day, dayIndex) {
        const date = sessionDate(weekIndex, dayIndex);
        const holiday = holidayFor(date);

        const card = make('button', 'module-card');
        card.type = 'button';
        card.id = moduleId(weekIndex, dayIndex);
        card.appendChild(make('span', 'mc-day',
          PROGRAMME.days[dayIndex] + ' ' + shortDate(date) + (holiday ? ' \u2014 bank holiday' : '')));
        card.appendChild(make('span', 'mc-title', day.title));
        card.appendChild(make('span', 'mc-objective', day.objective));
        card.appendChild(make('span', 'status-chip ' + day.status, STATUS_LABELS[day.status].name));
        card.addEventListener('click', function () {
          openModule(weekIndex, dayIndex);
        });
        grid.appendChild(card);
      });
      block.appendChild(grid);

      el.weeks.appendChild(block);
    });
  }

  /* ---------- questions ---------- */

  function renderQuestions() {
    el.questions.innerHTML = '';
    OPEN_QUESTIONS.forEach(function (item) {
      const li = make('li', 'q-item' + (item.blocker ? ' blocker' : ''));

      const weekLine = make('span', 'q-week', item.week);
      if (item.blocker) {
        weekLine.appendChild(make('span', 'blocker-flag', 'Blocker'));
      }
      li.appendChild(weekLine);

      li.appendChild(make('p', 'q-text', item.question));
      li.appendChild(make('p', 'q-why', item.why));
      el.questions.appendChild(li);
    });
  }

  /* ---------- modal ---------- */

  function openModule(weekIndex, dayIndex) {
    const week = PROGRAMME.weeks[weekIndex];
    const day = week.days[dayIndex];
    const date = sessionDate(weekIndex, dayIndex);
    const holiday = holidayFor(date);

    el.modalHead.innerHTML = '';
    el.modalBody.innerHTML = '';

    el.modalHead.appendChild(make('div', 'eyebrow',
      'Week ' + (weekIndex + 1) + ' \u00b7 ' + week.topic + ' \u00b7 ' + PROGRAMME.days[dayIndex]));

    const heading = make('h2', null, day.title);
    heading.id = 'modalTitle';
    el.modalHead.appendChild(heading);

    const meta = make('div', 'modal-meta');
    meta.appendChild(make('span', null, longDate(date)));
    meta.appendChild(make('span', null, '15 minutes'));
    meta.appendChild(make('span', null, STATUS_LABELS[day.status].name));
    el.modalHead.appendChild(meta);

    const objective = make('p', 'objective');
    objective.appendChild(make('strong', null, 'Objective: '));
    objective.appendChild(document.createTextNode(day.objective));
    el.modalBody.appendChild(objective);

    if (holiday) {
      const warn = make('div', 'callout blocker');
      warn.appendChild(make('strong', null, 'This session lands on a bank holiday (' + holiday + ')'));
      warn.appendChild(document.createTextNode(
        'Either run the week Tuesday to Friday, or push the whole topic on by a week. Do not drop the module \u2014 each week is four modules by design.'));
      el.modalBody.appendChild(warn);
    }

    el.modalBody.appendChild(make('p', 'hook-line', day.hook));

    el.modalBody.appendChild(make('h4', null, 'The 15 minutes'));
    const beats = make('ol', 'beats');
    day.beats.forEach(function (beat) {
      const li = make('li', 'beat');
      const time = make('span', 'beat-time', beat.time + ' min');
      time.appendChild(make('small', null, beat.label));
      li.appendChild(time);
      li.appendChild(make('span', 'beat-detail', beat.detail));
      beats.appendChild(li);
    });
    el.modalBody.appendChild(beats);

    if (day.metric) {
      el.modalBody.appendChild(infoRow('Number to watch', day.metric));
    }
    if (day.coach) {
      el.modalBody.appendChild(infoRow('Coach note', day.coach));
    }
    if (day.sources && day.sources.length) {
      const list = make('ul');
      day.sources.forEach(function (source) {
        const li = make('li');
        const link = make('a', null, source.label);
        link.href = source.href;
        li.appendChild(link);
        list.appendChild(li);
      });
      el.modalBody.appendChild(infoRow('Source material', list));
    }

    if (day.gap) {
      const gap = make('div', 'callout' + (/^Blocked/.test(day.gap) ? ' blocker' : ''));
      gap.appendChild(make('strong', null, 'Before this can run'));
      gap.appendChild(document.createTextNode(day.gap));
      el.modalBody.appendChild(gap);
    }

    lastFocused = document.activeElement;
    el.overlay.classList.add('open');
    el.modal.scrollTop = 0;
    el.modalClose.focus();

    if (history.replaceState) {
      history.replaceState(null, '', '#' + moduleId(weekIndex, dayIndex));
    }
  }

  function infoRow(key, value) {
    const row = make('div', 'info-row');
    row.appendChild(make('span', 'k', key));
    const v = make('span', 'v');
    if (typeof value === 'string') {
      v.textContent = value;
    } else {
      v.appendChild(value);
    }
    row.appendChild(v);
    return row;
  }

  function closeModal() {
    if (!el.overlay.classList.contains('open')) return;
    el.overlay.classList.remove('open');
    if (history.replaceState) {
      history.replaceState(null, '', location.pathname + location.search);
    }
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  /* ---------- controls ---------- */

  function announce(message) {
    el.liveRegion.textContent = message;
  }

  function renderAll() {
    renderSummary();
    renderGantt();
    renderWeeks();
  }

  el.startDate.value = PROGRAMME.startMonday;
  el.startDate.addEventListener('change', function () {
    if (!el.startDate.value) return;
    const picked = parseISO(el.startDate.value);
    // Date inputs report half-typed values, so a year of 19 or 1906 arrives here
    // as a real date. Ignore anything outside a plausible range.
    const year = picked.getUTCFullYear();
    if (isNaN(year) || year < 2020 || year > 2100) {
      el.startDate.value = toISO(startMonday);
      announce('That start date was not recognised. Left unchanged.');
      return;
    }
    // The programme is a Monday-to-Thursday routine, so snap back to Monday.
    const offset = (picked.getUTCDay() + 6) % 7;
    startMonday = addDays(picked, -offset);
    el.startDate.value = toISO(startMonday);
    renderAll();
    announce('Programme now starts week commencing ' + shortDate(startMonday) + '.');
  });

  el.statusFilter.addEventListener('change', function () {
    statusFilter = el.statusFilter.value;
    renderGantt();
    const label = statusFilter === 'all' ? 'all modules' : STATUS_LABELS[statusFilter].name;
    announce('Chart highlighting ' + label + '.');
  });

  el.readingToggle.addEventListener('click', function () {
    const on = document.body.classList.toggle('reading');
    el.readingToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    try {
      localStorage.setItem('reading-mode', on ? '1' : '0');
    } catch (err) {
      /* storage blocked, the toggle still works for this visit */
    }
    announce(on ? 'Reading mode on.' : 'Reading mode off.');
  });

  try {
    if (localStorage.getItem('reading-mode') === '1') {
      document.body.classList.add('reading');
      el.readingToggle.setAttribute('aria-pressed', 'true');
    }
  } catch (err) {
    /* storage blocked */
  }

  el.modalClose.addEventListener('click', closeModal);
  el.overlay.addEventListener('mousedown', function (event) {
    if (event.target === el.overlay) closeModal();
  });

  document.addEventListener('keydown', function (event) {
    if (!el.overlay.classList.contains('open')) return;

    if (event.key === 'Escape') {
      closeModal();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = el.modal.querySelectorAll('a[href], button');
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  /* ---------- boot ---------- */

  function openFromHash() {
    const match = /^#w(\d+)d(\d+)$/.exec(location.hash);
    if (!match) return;
    const weekIndex = Number(match[1]) - 1;
    const dayIndex = Number(match[2]) - 1;
    if (PROGRAMME.weeks[weekIndex] && PROGRAMME.weeks[weekIndex].days[dayIndex]) {
      openModule(weekIndex, dayIndex);
    }
  }

  renderAll();
  renderQuestions();
  openFromHash();

  // Pasting a deep link into an already-open tab changes only the hash, which
  // does not re-run this script.
  window.addEventListener('hashchange', openFromHash);
})();
