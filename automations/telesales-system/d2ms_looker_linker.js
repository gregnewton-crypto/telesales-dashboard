/**
 * Link Looker Records to Daily KPIs - Automation Script
 * 
 * Purpose: When a new record is created in ⚙️ D2MS Looker or ⚙️ Ireland Looker,
 *          automatically link it to the correct 📅 Daily KPIs record
 * 
 * Logic:
 *   - D2MS Looker records → link to 🐶 D2MS Daily KPIs (matched by date)
 *   - Ireland Looker records → link to ☘🐶 Int. Telesales Daily KPIs (matched by date)
 *   - NO region field needed in Looker tables - table name determines region
 * 
 * Usage: Set up as an Airtable Automation
 *        Trigger: When record is created in ⚙️ D2MS Looker / ⚙️ Ireland Looker
 *        Action: Run this script
 * 
 * Input Variables (set in automation):
 *   - recordId: The ID of the newly created Looker record
 *   - sourceTable: Either "⚙️ D2MS Looker" or "⚙️ Ireland Looker"
 */

// ============= CONFIGURATION =============
// IMPORTANT: You need ONE automation per Looker table.
// Set the correct table name below for EACH automation.

const CONFIG = {
    // ⚠️ CHANGE THIS for each automation:
    // Use '⚙️ D2MS Looker' OR '⚙️ Ireland Looker'
    sourceTable: '⚙️ D2MS Looker',  // <-- EDIT THIS PER AUTOMATION
    
    dailyKpisTable: '📅 Daily KPIs',
    
    // Map source table to region. These must match the ⚙️ Region single-select
    // choices on 📅 Daily KPIs EXACTLY (no extra emojis). Current choices are
    // "D2MS", "☘ Int. Telesales", "🇬🇧 Int. Telesales", "Model Pitch".
    tableToRegion: {
        '⚙️ D2MS Looker': 'D2MS',
        '⚙️ Ireland Looker': '☘ Int. Telesales'
    },
    
    // Field names
    dateField: 'Subscription Created Date',
    dailyKpiLinkField: '🔗 Daily KPI'
};

// Get record ID from automation trigger
const inputConfig = input.config();
const recordId = inputConfig.recordId;

async function linkLookerToDaily() {
    const sourceTable = CONFIG.sourceTable;
    
    console.log(`Processing record ${recordId} from ${sourceTable}...`);
    
    // Get the source table
    const lookerTable = base.getTable(sourceTable);
    const dailyKpisTable = base.getTable(CONFIG.dailyKpisTable);
    
    // Get the Looker record
    const lookerRecord = await lookerTable.selectRecordAsync(recordId, {
        fields: [CONFIG.dateField]
    });
    
    if (!lookerRecord) {
        console.log('Record not found');
        return;
    }
    
    // Get the date from the Looker record
    const createdDate = lookerRecord.getCellValue(CONFIG.dateField);
    
    if (!createdDate) {
        console.log('No date found on record');
        return;
    }
    
    // Format date to match Daily KPIs format (YYYY-MM-DD)
    const dateStr = typeof createdDate === 'string' 
        ? createdDate.split('T')[0]  // Handle ISO format
        : new Date(createdDate).toISOString().split('T')[0];
    
    console.log(`Looking for Daily KPI with date: ${dateStr}`);
    
    // Get the region for this source table
    const region = CONFIG.tableToRegion[sourceTable];
    
    if (!region) {
        console.log(`Unknown source table: ${sourceTable}`);
        return;
    }
    
    // Find the matching Daily KPI record
    const dailyRecords = await dailyKpisTable.selectRecordsAsync({
        fields: ['✍🏼 Date', '⚙️ Region']
    });
    
    // Find matching record by date and region
    const matchingDaily = dailyRecords.records.find(record => {
        const dailyDate = record.getCellValue('✍🏼 Date');
        const dailyRegion = record.getCellValueAsString('⚙️ Region');
        
        if (!dailyDate) return false;
        
        const dailyDateStr = typeof dailyDate === 'string'
            ? dailyDate.split('T')[0]
            : dailyDate;
        
        return dailyDateStr === dateStr && dailyRegion === region;
    });
    
    if (!matchingDaily) {
        console.log(`No matching Daily KPI found for ${dateStr} / ${region}`);
        return;
    }
    
    console.log(`Found matching Daily KPI: ${matchingDaily.id}`);
    
    // Update the Looker record to link to the Daily KPI
    await lookerTable.updateRecordAsync(recordId, {
        [CONFIG.dailyKpiLinkField]: [{ id: matchingDaily.id }]
    });
    
    console.log('✅ Linked successfully!');
}

await linkLookerToDaily();
