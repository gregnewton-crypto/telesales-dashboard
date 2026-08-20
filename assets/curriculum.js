/*
 * Renders the micro-training Gantt chart, the section detail cards and the
 * lesson plan modal. No dependencies: the chart is a CSS grid and every block
 * is a real button, so keyboard and screen reader users get the same chart.
 *
 * Sections vary in length because each one runs for as many days as it has
 * slide decks, so the schedule is built by walking the sections and handing
 * out consecutive Monday-to-Thursday slots.
 */

(function () {
  'use strict';

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAYS_PER_WEEK = PROGRAMME.days.length;

  const el = {
    gantt: document.getElementById('gantt'),
    sections: document.getElementById('sections'),
    summary: document.getElementById('summary'),
    questions: document.getElementById('questions'),
    startDate: document.getElementById('startDate'),
    statusFilter: document.getElementById('statusFilter'),
    packing: document.getElementById('packing'),
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
  let packing = PROGRAMME.packing;
  let schedule = [];
  let totalSlots = 0;
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

  // Slots only exist Monday to Thursday, so every four slots skips a weekend.
  function dateForSlot(slot) {
    const week = Math.floor(slot / DAYS_PER_WEEK);
    const day = slot % DAYS_PER_WEEK;
    return addDays(startMonday, week * 7 + day);
  }

  function shortDate(date) {
    return date.getUTCDate() + ' ' + MONTHS[date.getUTCMonth()];
  }

  function longDate(date) {
    return DAY_NAMES[date.getUTCDay()] + ' ' + date.getUTCDate() + ' ' +
      MONTHS[date.getUTCMonth()] + ' ' + date.getUTCFullYear();
  }

  function holidayFor(date) {
    return BANK_HOLIDAYS[toISO(date)] || null;
  }

  function todayISO() {
    const now = new Date();
    return toISO(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
  }

  /* ---------- schedule ---------- */

  function buildSchedule() {
    schedule = [];
    let slot = 0;

    PROGRAMME.sections.forEach(function (section, sectionIndex) {
      if (packing === 'weekAligned') {
        const into = slot % DAYS_PER_WEEK;
        if (into !== 0) slot += DAYS_PER_WEEK - into;
      }
      section.modules.forEach(function (module, moduleIndex) {
        schedule.push({
          sectionIndex: sectionIndex,
          moduleIndex: moduleIndex,
          section: section,
          module: module,
          slot: slot
        });
        slot += 1;
      });
    });

    totalSlots = slot;
  }

  function weekCount() {
    return Math.ceil(totalSlots / DAYS_PER_WEEK);
  }

  function slotsFor(sectionIndex) {
    return schedule.filter(function (entry) {
      return entry.sectionIndex === sectionIndex;
    });
  }

  /* ---------- helpers ---------- */

  function moduleId(sectionIndex, moduleIndex) {
    return 's' + (sectionIndex + 1) + 'm' + (moduleIndex + 1);
  }

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function matchesFilter(module) {
    return statusFilter === 'all' || module.status === statusFilter;
  }

  function countByStatus() {
    const counts = { ready: 0, building: 0, planned: 0 };
    schedule.forEach(function (entry) {
      counts[entry.module.status] += 1;
    });
    return counts;
  }

  /* ---------- summary ---------- */

  function renderSummary() {
    const counts = countByStatus();
    // Not totalSlots: week-aligned packing leaves empty slots between sections,
    // and an empty morning is not a session.
    const lastSlot = schedule[schedule.length - 1].slot;

    const tiles = [
      {
        cls: '',
        big: schedule.length,
        label: 'Sessions of 15 minutes',
        sub: PROGRAMME.sections.length + ' sections \u00b7 one deck a morning, Mon to Thu'
      },
      {
        cls: 'blue',
        big: weekCount(),
        label: 'Weeks to run it',
        sub: shortDate(dateForSlot(0)) + ' to ' + shortDate(dateForSlot(lastSlot))
      },
      {
        cls: 'green',
        big: counts.ready + counts.building,
        label: 'Decks built or in progress',
        sub: counts.ready + ' finished, ' + counts.building + ' being written now'
      },
      {
        cls: 'purple',
        big: counts.planned,
        label: 'Decks still to build',
        sub: 'Every one has a lesson plan ready to build from'
      }
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
    const weeks = weekCount();
    const columns = weeks * DAYS_PER_WEEK;

    el.gantt.innerHTML = '';
    el.gantt.style.gridTemplateColumns =
      '176px repeat(' + columns + ', minmax(76px, 1fr))';
    el.gantt.style.gridTemplateRows =
      '34px 22px repeat(' + PROGRAMME.sections.length + ', 70px)';
    el.gantt.style.minWidth = (176 + columns * 76) + 'px';

    // Opaque spacers so the scrolling time axis passes behind the sticky
    // section column rather than showing through it.
    [1, 2].forEach(function (row) {
      const corner = make('div', 'g-corner');
      corner.style.gridRow = String(row);
      el.gantt.appendChild(corner);
    });

    for (let week = 0; week < weeks; week += 1) {
      const firstColumn = 2 + week * DAYS_PER_WEEK;

      const divider = make('div', 'g-line strong');
      divider.style.gridColumn = String(firstColumn);
      el.gantt.appendChild(divider);

      const weekHead = make('div', 'g-week');
      weekHead.style.gridColumn = firstColumn + ' / span ' + DAYS_PER_WEEK;
      weekHead.appendChild(make('span', null, 'Week ' + (week + 1)));
      weekHead.appendChild(make('small', null, 'w/c ' + shortDate(dateForSlot(week * DAYS_PER_WEEK))));
      el.gantt.appendChild(weekHead);

      for (let day = 0; day < DAYS_PER_WEEK; day += 1) {
        const slot = week * DAYS_PER_WEEK + day;
        const date = dateForSlot(slot);
        const holiday = holidayFor(date);
        const dayHead = make('div', 'g-day' + (holiday ? ' holiday' : ''));
        dayHead.style.gridColumn = String(firstColumn + day);
        dayHead.textContent = PROGRAMME.days[day] + ' ' + date.getUTCDate();
        el.gantt.appendChild(dayHead);
      }
    }

    const endLine = make('div', 'g-line strong');
    endLine.style.gridColumn = String(2 + columns);
    el.gantt.appendChild(endLine);

    PROGRAMME.sections.forEach(function (section, sectionIndex) {
      const rowLabel = make('div', 'g-label');
      rowLabel.style.gridRow = String(3 + sectionIndex);
      rowLabel.appendChild(make('span', null, section.name));
      rowLabel.appendChild(make('small', null, section.modules.length + ' decks \u00b7 ' +
        section.modules.length + ' \u00d7 15 min'));
      el.gantt.appendChild(rowLabel);
    });

    schedule.forEach(function (entry) {
      const date = dateForSlot(entry.slot);
      const holiday = holidayFor(date);
      const module = entry.module;

      const bar = make('button', 'g-bar ' + entry.section.colour + ' status-' + module.status);
      bar.type = 'button';
      bar.style.gridColumn = String(2 + entry.slot);
      bar.style.gridRow = String(3 + entry.sectionIndex);
      if (!matchesFilter(module)) bar.classList.add('dimmed');
      if (module.gap) bar.classList.add('flagged');
      if (toISO(date) === today) bar.classList.add('today');

      bar.appendChild(make('span', 'bar-title', module.label || module.title));
      const foot = make('span', 'bar-foot');
      foot.appendChild(make('span', 'bar-status', STATUS_LABELS[module.status].short));
      bar.appendChild(foot);

      bar.setAttribute(
        'aria-label',
        entry.section.name + ', deck ' + (entry.moduleIndex + 1) + ' of ' +
        entry.section.modules.length + '. ' +
        PROGRAMME.days[entry.slot % DAYS_PER_WEEK] + ' ' + shortDate(date) + '. ' +
        module.title + '. ' + STATUS_LABELS[module.status].name +
        (holiday ? '. Falls on a bank holiday' : '') +
        '. Opens the 15 minute lesson plan.'
      );

      bar.addEventListener('click', function () {
        openModule(entry.sectionIndex, entry.moduleIndex);
      });

      el.gantt.appendChild(bar);
    });

    el.gantt.setAttribute(
      'aria-label',
      PROGRAMME.sections.length + ' section training programme over ' + weekCount() +
      ' weeks. ' + schedule.length + ' sessions of 15 minutes, Monday to Thursday, ' +
      'starting week commencing ' + shortDate(startMonday) + '.'
    );
  }

  /* ---------- section detail cards ---------- */

  function renderSections() {
    el.sections.innerHTML = '';

    PROGRAMME.sections.forEach(function (section, sectionIndex) {
      const entries = slotsFor(sectionIndex);
      if (!entries.length) return;

      const firstDate = dateForSlot(entries[0].slot);
      const lastDate = dateForSlot(entries[entries.length - 1].slot);

      const block = make('section', 'week-block');

      const head = make('div', 'week-head');
      head.appendChild(make('span', 'tag', 'Section ' + (sectionIndex + 1)));
      head.appendChild(make('h3', null, section.name));
      head.appendChild(make('span', 'when',
        shortDate(firstDate) + ' \u2013 ' + shortDate(lastDate)));
      block.appendChild(head);

      const folder = make('p', 'folder-line');
      folder.appendChild(make('strong', null, 'Drive folder: '));
      if (section.driveUrl) {
        const link = make('a', null, section.folder);
        link.href = section.driveUrl;
        link.rel = 'noopener';
        folder.appendChild(link);
      } else {
        folder.appendChild(document.createTextNode(section.folder));
      }
      const ready = section.decksReady || 0;
      const building = section.decksBuilding || 0;
      folder.appendChild(document.createTextNode(
        ' \u2014 ' + ready + ' of ' + section.modules.length + ' decks built' +
        (building ? ', ' + building + ' in progress' : '') + '.'
      ));
      if (ready > 0) {
        folder.appendChild(make('em', null,
          ' Module names below are my proposal and are not yet matched to your deck titles.'));
      }
      block.appendChild(folder);

      const outcome = make('p', 'week-outcome');
      outcome.appendChild(make('strong', null, 'By the end of this section: '));
      outcome.appendChild(document.createTextNode(section.outcome));
      block.appendChild(outcome);

      const grid = make('div', 'module-grid');
      entries.forEach(function (entry) {
        const date = dateForSlot(entry.slot);
        const holiday = holidayFor(date);
        const module = entry.module;

        const card = make('button', 'module-card');
        card.type = 'button';
        card.id = moduleId(sectionIndex, entry.moduleIndex);
        card.appendChild(make('span', 'mc-day',
          'Deck ' + (entry.moduleIndex + 1) + ' \u00b7 ' +
          PROGRAMME.days[entry.slot % DAYS_PER_WEEK] + ' ' + shortDate(date) +
          (holiday ? ' \u2014 bank holiday' : '')));
        card.appendChild(make('span', 'mc-title', module.title));
        card.appendChild(make('span', 'mc-objective', module.objective));
        card.appendChild(make('span', 'status-chip ' + module.status,
          STATUS_LABELS[module.status].name));
        card.addEventListener('click', function () {
          openModule(sectionIndex, entry.moduleIndex);
        });
        grid.appendChild(card);
      });
      block.appendChild(grid);

      el.sections.appendChild(block);
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

  function openModule(sectionIndex, moduleIndex) {
    const section = PROGRAMME.sections[sectionIndex];
    const module = section.modules[moduleIndex];
    const entry = schedule.filter(function (item) {
      return item.sectionIndex === sectionIndex && item.moduleIndex === moduleIndex;
    })[0];
    if (!entry) return;

    const date = dateForSlot(entry.slot);
    const holiday = holidayFor(date);

    el.modalHead.innerHTML = '';
    el.modalBody.innerHTML = '';

    el.modalHead.appendChild(make('div', 'eyebrow',
      section.name + ' \u00b7 deck ' + (moduleIndex + 1) + ' of ' + section.modules.length));

    const heading = make('h2', null, module.title);
    heading.id = 'modalTitle';
    el.modalHead.appendChild(heading);

    const meta = make('div', 'modal-meta');
    meta.appendChild(make('span', null, longDate(date)));
    meta.appendChild(make('span', null, '15 minutes'));
    meta.appendChild(make('span', null, STATUS_LABELS[module.status].name));
    el.modalHead.appendChild(meta);

    const objective = make('p', 'objective');
    objective.appendChild(make('strong', null, 'Objective: '));
    objective.appendChild(document.createTextNode(module.objective));
    el.modalBody.appendChild(objective);

    if (module.status === 'ready') {
      const note = make('div', 'callout');
      note.appendChild(make('strong', null, 'A deck already exists for this slot'));
      note.appendChild(document.createTextNode(
        'It is in the ' + section.folder + ' folder. This lesson plan is my proposed ' +
        '15-minute shape for it, written before I could see your deck titles \u2014 so ' +
        'treat it as a suggestion to check the deck against, not a description of it.'));
      el.modalBody.appendChild(note);
    }

    if (holiday) {
      const warn = make('div', 'callout blocker');
      warn.appendChild(make('strong', null, 'This session lands on a bank holiday (' + holiday + ')'));
      warn.appendChild(document.createTextNode(
        'Either run that week Tuesday to Friday, or push everything from here on by one day.'));
      el.modalBody.appendChild(warn);
    }

    el.modalBody.appendChild(make('p', 'hook-line', module.hook));

    el.modalBody.appendChild(make('h4', null, 'The 15 minutes'));
    const beats = make('ol', 'beats');
    module.beats.forEach(function (beat) {
      const li = make('li', 'beat');
      const time = make('span', 'beat-time', beat.time + ' min');
      time.appendChild(make('small', null, beat.label));
      li.appendChild(time);
      li.appendChild(make('span', 'beat-detail', beat.detail));
      beats.appendChild(li);
    });
    el.modalBody.appendChild(beats);

    if (module.metric) {
      el.modalBody.appendChild(infoRow('Number to watch', module.metric));
    }
    if (module.coach) {
      el.modalBody.appendChild(infoRow('Coach note', module.coach));
    }
    if (module.sources && module.sources.length) {
      const list = make('ul');
      module.sources.forEach(function (source) {
        const li = make('li');
        const link = make('a', null, source.label);
        link.href = source.href;
        li.appendChild(link);
        list.appendChild(li);
      });
      el.modalBody.appendChild(infoRow('Source material', list));
    }

    if (module.gap) {
      const gap = make('div', 'callout' + (/^Blocked/.test(module.gap) ? ' blocker' : ''));
      gap.appendChild(make('strong', null,
        module.status === 'planned' ? 'Before this deck can be built' : 'Still needed'));
      gap.appendChild(document.createTextNode(module.gap));
      el.modalBody.appendChild(gap);
    }

    lastFocused = document.activeElement;
    el.overlay.classList.add('open');
    el.modal.scrollTop = 0;
    el.modalClose.focus();

    if (history.replaceState) {
      history.replaceState(null, '', '#' + moduleId(sectionIndex, moduleIndex));
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
    buildSchedule();
    renderSummary();
    renderGantt();
    renderSections();
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
    const label = statusFilter === 'all' ? 'all sessions' : STATUS_LABELS[statusFilter].name;
    announce('Chart highlighting ' + label + '.');
  });

  el.packing.value = packing;
  el.packing.addEventListener('change', function () {
    packing = el.packing.value;
    renderAll();
    announce(packing === 'weekAligned'
      ? 'Every section now starts on a Monday. Programme runs ' + weekCount() + ' weeks.'
      : 'Sections now run back to back. Programme runs ' + weekCount() + ' weeks.');
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
    const match = /^#s(\d+)m(\d+)$/.exec(location.hash);
    if (!match) return;
    const sectionIndex = Number(match[1]) - 1;
    const moduleIndex = Number(match[2]) - 1;
    const section = PROGRAMME.sections[sectionIndex];
    if (section && section.modules[moduleIndex]) {
      openModule(sectionIndex, moduleIndex);
    }
  }

  renderAll();
  renderQuestions();
  openFromHash();

  // Pasting a deep link into an already-open tab changes only the hash, which
  // does not re-run this script.
  window.addEventListener('hashchange', openFromHash);
})();
