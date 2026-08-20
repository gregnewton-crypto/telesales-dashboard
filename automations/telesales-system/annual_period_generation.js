// ============================================
// ANNUAL PERIOD GENERATION (v3)
// Airtable Automation Script
// Trigger: Monthly (1st of each month)
// Action: Only runs in December, creates next year's periods
//         with bank holidays auto-calculated
// ============================================
// Uses FIELD IDs throughout (no emoji name references)
// ============================================

// =====================
// FIELD ID REGISTRY
// =====================
// Periods table (tblsYGzExUrlnbEkl)
const F = {
    PERIOD:       'fld7svQp6AwitHlu5',  // Period name, e.g. "P5"
    NUMBER:       'fldaR75vvaFwnUAnq',  // Period number
    YEAR:         'fldPQFr9BxaEYXiD8',  // Year
    START_DATE:   'fld2OiC5qjnWpGbzb',  // Start date
    END_DATE:     'fldL1PM1sA46xyzse',  // End date
    BANK_HOL_UK:  'fldR7uQeT7LQTN0gX',  // Bank Holidays UK
    BANK_HOL_IE:  'fldkzLLCO8bsWHwd3',  // Bank Holidays IE
    TOTAL_DAYS:   'fldmUqMGUSfVRflWy',  // Total days in period
    WK1_START:    'fldOOrqT2rN98DpBP',  // Week 1 start
    WK2_START:    'fldmI2PbEEtgEO2RQ',  // Week 2 start
    WK3_START:    'fldKul2ZtExcrJEZX',  // Week 3 start
    WK4_START:    'fldk4AFdhwBXoqihE',  // Week 4 start
    START_WEEK:   'fldnLKaZqNNFQJWgz',  // ISO week number (start)
    END_WEEK:     'fldY0CcJ0jdtDULl0',  // ISO week number (end)
    QUARTER:      'fldX1Z3O26E6xCiDS',  // Q1-Q4
    HALF_YEAR:    'fldrPHqSyqQa24cWQ',  // H1 or H2
    WEEK_RANGE:   'fldoJL9MEn6Ja7hUM',  // Year-Week Range
    IS_CURRENT:   'fldKiyeV8Ohqr39mt',  // "Yes" or "No"
    STATUS:       'fldvfXPoCYKZfqCRq',  // Status text
    DAYS_ELAPSED: 'flde2n4hwNj9SymY5',  // Days elapsed
    PCT_COMPLETE: 'fldcYXYDoOmGkh2UA',  // % complete
};

// --- MONTH CHECK ---
// This runs monthly but only acts in December
const now = new Date();
if (now.getMonth() !== 11) { // 11 = December
    console.log('Current month: ' + now.toLocaleString('en-GB', {month: 'long'}) + '. Skipping - only runs in December.');
} else {

const table = base.getTable('tblsYGzExUrlnbEkl');
const nextYear = now.getFullYear() + 1;

// Check if records already exist for next year
const existing = await table.selectRecordsAsync({ fields: [F.YEAR] });
const alreadyExists = existing.records.some(r => r.getCellValue(F.YEAR) === String(nextYear));

if (alreadyExists) {
    console.log('Records for ' + nextYear + ' already exist. Skipping.');
} else {

    // --- EASTER CALCULATION (Anonymous Gregorian algorithm) ---
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

    // --- BANK HOLIDAY HELPERS ---
    function nthDayOfMonth(year, month, dayOfWeek, n) {
        const first = new Date(year, month, 1);
        let day = first.getDay();
        let offset = (dayOfWeek - day + 7) % 7;
        return new Date(year, month, 1 + offset + (n - 1) * 7);
    }

    function lastDayOfMonth(year, month, dayOfWeek) {
        const last = new Date(year, month + 1, 0);
        let day = last.getDay();
        let offset = (day - dayOfWeek + 7) % 7;
        return new Date(year, month + 1, -offset);
    }

    function substituteIfWeekend(d) {
        const day = d.getDay();
        if (day === 6) return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 2);
        if (day === 0) return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
        return d;
    }

    function fmt(d) { return d.toISOString().split('T')[0]; }
    function fmtLabel(d, name) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return dd + '/' + mm + ' - ' + name;
    }

    // --- CALCULATE UK BANK HOLIDAYS ---
    function getUKBankHolidays(year) {
        const easter = calculateEaster(year);
        const goodFriday = new Date(easter); goodFriday.setDate(easter.getDate() - 2);
        const easterMonday = new Date(easter); easterMonday.setDate(easter.getDate() + 1);

        let newYear = new Date(year, 0, 1);
        newYear = substituteIfWeekend(newYear);

        const earlyMay = nthDayOfMonth(year, 4, 1, 1);
        const spring = lastDayOfMonth(year, 4, 1);
        const summer = lastDayOfMonth(year, 7, 1);

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

        return [
            { date: newYear, name: newYear.getDate() === 1 ? "New Year's Day" : "New Year's Day (substitute)" },
            { date: goodFriday, name: "Good Friday" },
            { date: easterMonday, name: "Easter Monday" },
            { date: earlyMay, name: "Early May Bank Holiday" },
            { date: spring, name: "Spring Bank Holiday" },
            { date: summer, name: "Summer Bank Holiday" },
            { date: christmas, name: christmas.getDate() === 25 ? "Christmas Day" : "Christmas Day (substitute)" },
            { date: boxing, name: boxing.getDate() === 26 ? "Boxing Day" : "Boxing Day (substitute)" }
        ];
    }

    // --- CALCULATE IRELAND BANK HOLIDAYS ---
    function getIEBankHolidays(year) {
        const easter = calculateEaster(year);
        const easterMonday = new Date(easter); easterMonday.setDate(easter.getDate() + 1);

        const newYear = new Date(year, 0, 1);

        const feb1 = new Date(year, 1, 1);
        const feb1Day = feb1.getDay();
        const brigidOffset = (1 - feb1Day + 7) % 7;
        const brigid = new Date(year, 1, 1 + brigidOffset);

        const stPatrick = new Date(year, 2, 17);
        const mayDay = nthDayOfMonth(year, 4, 1, 1);
        const june = nthDayOfMonth(year, 5, 1, 1);
        const august = nthDayOfMonth(year, 7, 1, 1);
        const october = lastDayOfMonth(year, 9, 1);
        const christmas = new Date(year, 11, 25);
        const stStephens = new Date(year, 11, 26);

        return [
            { date: newYear, name: "New Year's Day" },
            { date: brigid, name: "St Brigid's Day" },
            { date: stPatrick, name: "St Patrick's Day" },
            { date: easterMonday, name: "Easter Monday" },
            { date: mayDay, name: "May Day" },
            { date: june, name: "June Bank Holiday" },
            { date: august, name: "August Bank Holiday" },
            { date: october, name: "October Bank Holiday" },
            { date: christmas, name: "Christmas Day" },
            { date: stStephens, name: "St Stephen's Day" }
        ];
    }

    // --- GET HOLIDAYS FOR A PERIOD ---
    function holidaysInPeriod(holidays, pStart, pEnd) {
        const matches = [];
        for (const h of holidays) {
            if (h.date >= pStart && h.date <= pEnd) {
                matches.push(fmtLabel(h.date, h.name));
            }
        }
        return matches.join('\n');
    }

    // --- ISO WEEK NUMBER ---
    function getISOWeek(d) {
        const date = new Date(d.getTime());
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
        const week1 = new Date(date.getFullYear(), 0, 4);
        return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000
            - 3 + (week1.getDay() + 6) % 7) / 7);
    }

    // --- GENERATE PERIODS ---
    const yearStart = new Date(nextYear, 0, 1);
    const ukHolidays = getUKBankHolidays(nextYear);
    const ieHolidays = getIEBankHolidays(nextYear);

    console.log('Generating 13 periods for ' + nextYear + '...');

    for (let p = 1; p <= 13; p++) {
        const startOffset = (p - 1) * 28;
        const pStart = new Date(yearStart);
        pStart.setDate(pStart.getDate() + startOffset);

        let pEnd;
        if (p < 13) {
            pEnd = new Date(pStart);
            pEnd.setDate(pEnd.getDate() + 27);
        } else {
            pEnd = new Date(nextYear, 11, 31);
        }

        const totalDays = Math.floor((pEnd - pStart) / 86400000) + 1;

        const wk1 = new Date(pStart);
        const wk2 = new Date(pStart); wk2.setDate(wk2.getDate() + 7);
        const wk3 = new Date(pStart); wk3.setDate(wk3.getDate() + 14);
        const wk4 = new Date(pStart); wk4.setDate(wk4.getDate() + 21);

        const startWeek = getISOWeek(pStart);
        const endWeek = getISOWeek(pEnd);
        const weekRange = 'W' + startWeek + '-W' + endWeek;

        const month = pStart.getMonth() + 1;
        let quarter, half;
        if (month <= 3) { quarter = 'Q1'; half = 'H1'; }
        else if (month <= 6) { quarter = 'Q2'; half = 'H1'; }
        else if (month <= 9) { quarter = 'Q3'; half = 'H2'; }
        else { quarter = 'Q4'; half = 'H2'; }

        const ukBH = holidaysInPeriod(ukHolidays, pStart, pEnd);
        const ieBH = holidaysInPeriod(ieHolidays, pStart, pEnd);

        await table.createRecordAsync({
            [F.PERIOD]: 'P' + p,
            [F.NUMBER]: p,
            [F.YEAR]: String(nextYear),
            [F.START_DATE]: fmt(pStart),
            [F.END_DATE]: fmt(pEnd),
            [F.TOTAL_DAYS]: totalDays,
            [F.WK1_START]: fmt(wk1),
            [F.WK2_START]: fmt(wk2),
            [F.WK3_START]: fmt(wk3),
            [F.WK4_START]: fmt(wk4),
            [F.START_WEEK]: startWeek,
            [F.END_WEEK]: endWeek,
            [F.WEEK_RANGE]: weekRange,
            [F.QUARTER]: quarter,
            [F.HALF_YEAR]: half,
            [F.IS_CURRENT]: 'No',
            [F.STATUS]: '\u{1F535} Upcoming',
            [F.DAYS_ELAPSED]: 0,
            [F.PCT_COMPLETE]: 0,
            [F.BANK_HOL_UK]: ukBH,
            [F.BANK_HOL_IE]: ieBH
        });

        console.log('P' + p + ': ' + fmt(pStart) + ' to ' + fmt(pEnd) + ' | ' + totalDays + 'd | UK: ' + (ukBH || 'None') + ' | IE: ' + (ieBH || 'None'));
    }

    console.log('All 13 periods for ' + nextYear + ' created with bank holidays.');
}
} // end December check
