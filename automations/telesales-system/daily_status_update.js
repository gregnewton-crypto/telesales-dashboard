// ============================================
// DAILY STATUS UPDATE (v3)
// Airtable Automation Script
// Trigger: Daily at midnight (00:00 UTC)
// ============================================
// Uses FIELD IDs throughout (no emoji name references)
// ============================================
// WHAT IT DOES:
//   Part 1 - Updates every period row in the Periods table
//   Part 2 - Refreshes the single Control Panel row
// ============================================

// =====================
// FIELD ID REGISTRY
// =====================
// Periods table (tblsYGzExUrlnbEkl)
const P = {
    PERIOD:       'fld7svQp6AwitHlu5',  // Period name, e.g. "P5"
    NUMBER:       'fldaR75vvaFwnUAnq',  // Period number, e.g. 5
    YEAR:         'fldPQFr9BxaEYXiD8',  // Year, e.g. "2026"
    START_DATE:   'fld2OiC5qjnWpGbzb',  // Start date
    END_DATE:     'fldL1PM1sA46xyzse',  // End date
    TOTAL_DAYS:   'fldmUqMGUSfVRflWy',  // Total days in period
    STATUS:       'fldvfXPoCYKZfqCRq',  // Current / Complete / Upcoming
    IS_CURRENT:   'fldKiyeV8Ohqr39mt',  // "Yes" or "No"
    DAYS_ELAPSED: 'flde2n4hwNj9SymY5',  // Days elapsed
    PCT_COMPLETE: 'fldcYXYDoOmGkh2UA',  // % complete
};

// Control Panel table (tbleIjncfLJ5hjvxk)
const CP = {
    PANEL:              'fldJhR8noC0wyHWRP',  // Panel name
    CURRENT_PERIOD:     'fldUklQtdePBIoMl3',  // Current period name
    CURRENT_WEEK:       'fldcFH6uCuwxcNtli',  // ISO calendar week number
    PERIOD_WEEK:        'fld6pwFWxkINGBITz',  // Week within period (1-4)
    PERIOD_START:       'fldRRkjXZIT6FoVHk',  // Period start date
    PERIOD_END:         'fldS7pSPAUSzK3zZS',  // Period end date
    BANK_HOLIDAY_TODAY: 'fldIqQnc1fW59Y3HN',  // Checkbox: is today a bank holiday?
    DAYS_REMAINING:     'fld2cWSNJ3CK0b1ii',  // Calendar days remaining
    WORKING_DAYS_TOTAL: 'fldQkVvEFfGq23S5Y',  // Working days in full period
    WORKING_DAYS_LEFT:  'fldCCS7VeTqEDnjjc',  // Working days remaining
};

// =====================
// DATE HELPERS
// =====================
function fmt(d) {
    return d.toISOString().split('T')[0];
}

function parseDate(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
}

// ISO 8601 week number (Monday-based, Week 1 contains Jan 4)
function getISOWeek(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const jan4 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
}

// =====================
// EASTER & BANK HOLIDAYS
// =====================
function calculateEaster(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
}

function nthDayOfMonth(year, month, dayOfWeek, n) {
    const first = new Date(year, month, 1);
    let day = first.getDay();
    let offset = (dayOfWeek - day + 7) % 7;
    return new Date(year, month, 1 + offset + (n - 1) * 7);
}

function lastMondayOfMonth(year, month) {
    const last = new Date(year, month + 1, 0);
    let day = last.getDay();
    let offset = (day - 1 + 7) % 7;
    return new Date(year, month + 1, -offset);
}

function getUKBankHolidayDates(year) {
    const easter = calculateEaster(year);
    const goodFriday = new Date(easter);
    goodFriday.setDate(easter.getDate() - 2);
    const easterMonday = new Date(easter);
    easterMonday.setDate(easter.getDate() + 1);

    let newYear = new Date(year, 0, 1);
    const nyDay = newYear.getDay();
    if (nyDay === 6) newYear = new Date(year, 0, 3);
    if (nyDay === 0) newYear = new Date(year, 0, 2);

    const earlyMay = nthDayOfMonth(year, 4, 1, 1);
    const spring = lastMondayOfMonth(year, 4);
    const summer = lastMondayOfMonth(year, 7);

    let christmas = new Date(year, 11, 25);
    let boxing = new Date(year, 11, 26);
    const xmasDay = christmas.getDay();
    if (xmasDay === 6) {
        christmas = new Date(year, 11, 27);
        boxing = new Date(year, 11, 28);
    } else if (xmasDay === 0) {
        christmas = new Date(year, 11, 27);
        boxing = new Date(year, 11, 28);
    } else if (xmasDay === 5) {
        boxing = new Date(year, 11, 28);
    }

    return new Set([
        fmt(newYear), fmt(goodFriday), fmt(easterMonday),
        fmt(earlyMay), fmt(spring), fmt(summer),
        fmt(christmas), fmt(boxing)
    ]);
}

// ============================================
// MAIN LOGIC
// ============================================
const periodsTable = base.getTable('tblsYGzExUrlnbEkl');
const controlTable = base.getTable('tbleIjncfLJ5hjvxk');

const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const todayStr = fmt(today);

const ukHolidays = getUKBankHolidayDates(now.getFullYear());

console.log('Daily update running: ' + todayStr);
console.log('UK bank holidays loaded: ' + ukHolidays.size + ' dates');

// =====================
// PART 1: PERIOD STATUS
// =====================
const periods = await periodsTable.selectRecordsAsync({
    fields: [
        P.PERIOD, P.NUMBER, P.YEAR,
        P.START_DATE, P.END_DATE,
        P.TOTAL_DAYS, P.STATUS, P.IS_CURRENT,
        P.DAYS_ELAPSED, P.PCT_COMPLETE
    ]
});

console.log('Periods loaded: ' + periods.records.length + ' records');

// Debug: show date format from first record
if (periods.records.length > 0) {
    const sample = periods.records[0];
    console.log('Date format check: "' + sample.getCellValue(P.START_DATE) + '" (getCellValue) vs "' + sample.getCellValueAsString(P.START_DATE) + '" (getCellValueAsString)');
}

let currentPeriodRecord = null;

for (const record of periods.records) {
    const startStr = record.getCellValue(P.START_DATE);
    const endStr = record.getCellValue(P.END_DATE);

    if (!startStr || !endStr) continue;

    const start = parseDate(startStr);
    const end = parseDate(endStr);
    const totalDays = record.getCellValue(P.TOTAL_DAYS) || 28;

    let newStatus, isCurrent, daysElapsed, pctComplete;

    if (today >= start && today <= end) {
        newStatus = '\u{1F7E2} Current';
        isCurrent = 'Yes';
        daysElapsed = Math.floor((today - start) / 86400000) + 1;
        pctComplete = Math.round((daysElapsed / totalDays) * 100);
        currentPeriodRecord = record;
    } else if (today > end) {
        newStatus = '⬜ Complete';
        isCurrent = 'No';
        daysElapsed = totalDays;
        pctComplete = 100;
    } else {
        newStatus = '\u{1F535} Upcoming';
        isCurrent = 'No';
        daysElapsed = 0;
        pctComplete = 0;
    }

    // Only write if something changed
    const oldStatus = record.getCellValueAsString(P.STATUS);
    const oldElapsed = record.getCellValue(P.DAYS_ELAPSED);

    if (oldStatus !== newStatus || oldElapsed !== daysElapsed) {
        await periodsTable.updateRecordAsync(record.id, {
            [P.STATUS]: newStatus,
            [P.IS_CURRENT]: isCurrent,
            [P.DAYS_ELAPSED]: daysElapsed,
            [P.PCT_COMPLETE]: pctComplete
        });
        const periodName = record.getCellValueAsString(P.PERIOD);
        const year = record.getCellValueAsString(P.YEAR);
        console.log(periodName + ' ' + year + ': ' + newStatus + ' | Day ' + daysElapsed + '/' + totalDays + ' | ' + pctComplete + '%');
    }
}

// ===========================
// PART 2: CONTROL PANEL
// ===========================
if (!currentPeriodRecord) {
    console.log('WARNING: No current period found. Control Panel not updated.');
} else {
    const cpRecords = await controlTable.selectRecordsAsync({
        fields: [CP.PANEL]
    });

    if (cpRecords.records.length === 0) {
        console.log('WARNING: Control Panel table is empty.');
    } else {
        const cpRecord = cpRecords.records[0];

        const periodName = currentPeriodRecord.getCellValueAsString(P.PERIOD);
        const startStr = currentPeriodRecord.getCellValue(P.START_DATE);
        const endStr = currentPeriodRecord.getCellValue(P.END_DATE);
        const start = parseDate(startStr);
        const end = parseDate(endStr);

        // Calendar week (ISO 8601)
        const calendarWeek = getISOWeek(today);

        // Period week (1-4)
        const daysSinceStart = Math.floor((today - start) / 86400000);
        const periodWeek = Math.min(4, Math.floor(daysSinceStart / 7) + 1);

        // Days remaining (including today)
        const daysRemaining = Math.floor((end - today) / 86400000) + 1;

        // Working days helper
        function countWorkingDays(fromDate, toDate) {
            let count = 0;
            let d = new Date(fromDate);
            while (d <= toDate) {
                const dayOfWeek = d.getDay();
                if (dayOfWeek !== 0 && dayOfWeek !== 6 && !ukHolidays.has(fmt(d))) {
                    count++;
                }
                d.setDate(d.getDate() + 1);
            }
            return count;
        }

        const workingDaysRemaining = countWorkingDays(today, end);
        const workingDaysTotal = countWorkingDays(start, end);

        // Bank holiday check
        const isBankHolidayToday = ukHolidays.has(todayStr);

        // Update Control Panel
        await controlTable.updateRecordAsync(cpRecord.id, {
            [CP.CURRENT_PERIOD]: periodName,
            [CP.CURRENT_WEEK]: calendarWeek,
            [CP.PERIOD_WEEK]: periodWeek,
            [CP.PERIOD_START]: startStr,
            [CP.PERIOD_END]: endStr,
            [CP.DAYS_REMAINING]: daysRemaining,
            [CP.WORKING_DAYS_TOTAL]: workingDaysTotal,
            [CP.WORKING_DAYS_LEFT]: workingDaysRemaining,
            [CP.BANK_HOLIDAY_TODAY]: isBankHolidayToday
        });

        console.log('Control Panel updated:');
        console.log('  Period: ' + periodName + ' | Calendar Week ' + calendarWeek + ' | Period Week ' + periodWeek);
        console.log('  ' + daysRemaining + ' days remaining (' + workingDaysRemaining + ' working)');
        console.log('  ' + workingDaysTotal + ' working days this period');
        console.log('  Bank holiday today: ' + (isBankHolidayToday ? 'YES' : 'No'));
    }
}

console.log('Daily update complete.');
