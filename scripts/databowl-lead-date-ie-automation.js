// @ts-nocheck
/**
 * Update lead status — automation (one record)
 *
 * PASTE INTO: automation named "Databowl lead date IE"
 * DO NOT create a new automation.
 *
 * Base:  appZoN6xBB9mDv8h4
 * Table: tbllpLbEtTkmMQOY9  (☘ Databowl Leads)
 *
 * AUTOMATION SETUP
 *   Trigger: When record created in ☘ Databowl Leads
 *   Action:  Run script
 *   Input:   recordId = {{recordId}}
 *
 * On create (no calls yet): sets Called?=No, Lead open/closed=Open, clears selects.
 * When calls are linked later: "Linking Leads Adversus & Databowl" re-syncs fields.
 *
 * v5 fixes:
 *   - Unqualified + Shared callback in status sets
 *   - Use latest lookup value (not first)
 *   - Lead open/closed follows lookup terminal statuses first
 */

const TABLE_ID = 'tbllpLbEtTkmMQOY9';

const FIELD = {
    TIMES_CALLED_ROLLUP: 'fldsKBO1ZpAImfV8C',
    TIMES_CALLED_SELECT: 'fldpGvpBn2J2DbXop',
    ADVERSUS_LOOKUP: 'fld0XrXF3YtWqWSAN',
    ADVERSUS_SELECT: 'fld9R1fOEzvXLCTzd',
    CALLED: 'fldbOzjdQ1ChPuOMg',
    LEAD_OPEN_CLOSED: 'fldBFGH4OGEBmuBID',
};

const CLOSED_STATUSES = new Set([
    'success',
    'not interested',
    'invalid',
    'unqualified',
]);
const OPEN_STATUSES = new Set([
    'automatic redial',
    'vip callback',
    'private callback',
    'shared callback',
]);
const VIP_PRIVATE_STATUSES = new Set(['vip callback', 'private callback']);

const STANDARD_CALL_LIMIT = 10;
const VIP_PRIVATE_CALL_LIMIT = 15;
const MAX_TIME_BUCKET = 20;

function selectName(cell) {
    if (cell == null) return '';
    if (typeof cell === 'object' && cell.name != null) return String(cell.name);
    return String(cell);
}

function norm(text) {
    return selectName(text).trim().toLowerCase();
}

function lookupToText(cell) {
    if (cell == null || cell === '') return '';
    if (Array.isArray(cell)) {
        if (cell.length === 0) return '';
        for (let i = cell.length - 1; i >= 0; i -= 1) {
            const text = selectName(cell[i]).trim();
            if (text) return text;
        }
        return '';
    }
    return selectName(cell).trim();
}

function getTimesCalled(record, fieldId) {
    const raw = record.getCellValue(fieldId);
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string' && raw.trim() !== '') {
        const n = Number(raw);
        if (Number.isFinite(n)) return n;
    }
    try {
        const str = record.getCellValueAsString(fieldId);
        if (str) {
            const n = Number(str);
            if (Number.isFinite(n)) return n;
        }
    } catch {
        // ignore
    }
    return 0;
}

function choiceIndex(fieldMeta) {
    const map = new Map();
    for (const c of fieldMeta?.options?.choices ?? []) {
        if (c.id && c.name != null) {
            map.set(norm(c.name), c.id);
        }
    }
    return map;
}

function resolveChoiceId(fieldMeta, valueText) {
    if (valueText == null || valueText === '') return null;
    const key = norm(valueText);
    const id = choiceIndex(fieldMeta).get(key);
    if (id) return id;

    const trimmed = String(valueText).trim();
    for (const c of fieldMeta?.options?.choices ?? []) {
        if (String(c.name ?? '').trim() === trimmed && c.id) return c.id;
    }
    return null;
}

function resolveTimesCalledChoiceId(fieldMeta, timesCalled) {
    const n = Math.floor(Number(timesCalled));
    if (!Number.isFinite(n) || n <= 0) return null;

    const capped = Math.min(n, MAX_TIME_BUCKET);
    const candidates = [String(capped), String(n)].filter(Boolean);

    for (const label of candidates) {
        const id = resolveChoiceId(fieldMeta, label);
        if (id) return id;
    }
    return null;
}

function computeOpenClosed(adversusText, timesCalled) {
    const status = norm(adversusText);

    if (CLOSED_STATUSES.has(status)) return 'closed';

    const limit = VIP_PRIVATE_STATUSES.has(status)
        ? VIP_PRIVATE_CALL_LIMIT
        : STANDARD_CALL_LIMIT;

    if (timesCalled > limit) return 'closed';
    if (!status || OPEN_STATUSES.has(status)) return 'open';

    return 'open';
}

function isNegativeCalledName(name) {
    const n = String(name ?? '').trim().toLowerCase();
    if (!n) return false;
    if (n === 'no') return true;
    if (/^not\b/.test(n)) return true;
    if (/not called/.test(n)) return true;
    if (/no call/.test(n)) return true;
    return false;
}

function isPositiveCalledName(name) {
    const n = String(name ?? '').trim().toLowerCase();
    if (!n || isNegativeCalledName(n)) return false;
    if (n === 'yes') return true;
    if (n === 'called') return true;
    if (/\bcalled\b/.test(n)) return true;
    return false;
}

function resolveCalledChoices(fieldMeta, fieldId) {
    const choices = fieldMeta?.options?.choices ?? [];
    let yes = choices.find((c) => /^yes$/i.test(String(c.name ?? '').trim()));
    let no = choices.find((c) => /^no$/i.test(String(c.name ?? '').trim()));
    if (!yes) yes = choices.find((c) => isPositiveCalledName(c.name) && c.id);
    if (!no) no = choices.find((c) => isNegativeCalledName(c.name) && c.id);

    if (!yes?.id || !no?.id || yes.id === no.id) {
        throw new Error(`Could not resolve Called? choice ids on ${fieldId}.`);
    }

    return { yesChoiceId: yes.id, noChoiceId: no.id };
}

function resolveOpenClosedChoices(fieldMeta, fieldId) {
    const choices = fieldMeta?.options?.choices ?? [];
    const open = choices.find((c) => /\bopen\b/i.test(String(c.name ?? '')));
    const closed = choices.find((c) => /\bclosed\b/i.test(String(c.name ?? '')));

    if (!open?.id || !closed?.id) {
        throw new Error(`Could not resolve Open/Closed choice ids on ${fieldId}.`);
    }

    return { openChoiceId: open.id, closedChoiceId: closed.id };
}

function buildStatusUpdate(record, meta) {
    const timesCalled = getTimesCalled(record, FIELD.TIMES_CALLED_ROLLUP);
    const adversusText = lookupToText(record.getCellValue(FIELD.ADVERSUS_LOOKUP));

    const timesSelectId = resolveTimesCalledChoiceId(meta.timesSelectMeta, timesCalled);
    const adversusSelectId = adversusText
        ? resolveChoiceId(meta.adversusSelectMeta, adversusText)
        : null;

    const targetCalledId = timesCalled > 0
        ? meta.yesChoiceId
        : meta.noChoiceId;
    const targetOpenClosed = computeOpenClosed(adversusText, timesCalled);
    const targetOpenClosedId = targetOpenClosed === 'open'
        ? meta.openChoiceId
        : meta.closedChoiceId;

    const fields = {};

    if (timesSelectId) {
        fields[FIELD.TIMES_CALLED_SELECT] = { id: timesSelectId };
    } else if (timesCalled <= 0) {
        fields[FIELD.TIMES_CALLED_SELECT] = null;
    }

    if (adversusText && adversusSelectId) {
        fields[FIELD.ADVERSUS_SELECT] = { id: adversusSelectId };
    } else if (!adversusText) {
        fields[FIELD.ADVERSUS_SELECT] = null;
    }

    fields[FIELD.CALLED] = { id: targetCalledId };
    fields[FIELD.LEAD_OPEN_CLOSED] = { id: targetOpenClosedId };

    return {
        fields,
        timesCalled,
        adversusText: adversusText || '(blank)',
        timesSelectId,
        adversusSelectId,
        targetCalledId,
        targetOpenClosedId,
        warnings: [
            !timesSelectId && timesCalled > 0
                ? `No single-select option for times called=${timesCalled} on ${FIELD.TIMES_CALLED_SELECT}`
                : null,
            adversusText && !adversusSelectId
                ? `No single-select option for adversus="${adversusText}" on ${FIELD.ADVERSUS_SELECT}`
                : null,
        ].filter(Boolean),
    };
}

const { recordId } = input.config();
if (!recordId) {
    throw new Error('recordId is required (map {{recordId}} from the automation trigger).');
}

const table = base.getTable(TABLE_ID);

const meta = {
    timesSelectMeta: table.getField(FIELD.TIMES_CALLED_SELECT),
    adversusSelectMeta: table.getField(FIELD.ADVERSUS_SELECT),
    ...resolveCalledChoices(table.getField(FIELD.CALLED), FIELD.CALLED),
    ...resolveOpenClosedChoices(table.getField(FIELD.LEAD_OPEN_CLOSED), FIELD.LEAD_OPEN_CLOSED),
};

const loadFields = [
    table.getField(FIELD.TIMES_CALLED_ROLLUP),
    table.getField(FIELD.TIMES_CALLED_SELECT),
    table.getField(FIELD.ADVERSUS_LOOKUP),
    table.getField(FIELD.ADVERSUS_SELECT),
    table.getField(FIELD.CALLED),
    table.getField(FIELD.LEAD_OPEN_CLOSED),
];

const record = await table.selectRecordAsync(recordId, { fields: loadFields });
if (!record) {
    throw new Error(`Record ${recordId} not found in ${TABLE_ID}.`);
}

const result = buildStatusUpdate(record, meta);

await table.updateRecordAsync(recordId, result.fields);

output.set('result', {
    recordId,
    changed: true,
    fieldsUpdated: Object.keys(result.fields),
    timesCalled: result.timesCalled,
    adversusText: result.adversusText,
    openClosed: result.targetOpenClosedId === meta.closedChoiceId ? 'Closed' : 'Open',
    warnings: result.warnings,
});
