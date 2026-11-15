const ExcelJS = require('exceljs');
const { generateMasterScheduleWorkbook, DONE_FILL } = require('./exportTestBundle');

async function testExport() {
  const categories = [{ id: 'cat1', code: 'A', name: 'System A' }];
  const groups = [{ id: 'grp1', category_id: 'cat1', item_no: 1, name: 'Inverters' }];
  const equipmentList = [{ id: 'eq1', group_id: 'grp1', name: 'Inverter Unit 1', is_active: true, unit_count: 1 }];
  
  const scheduleRules = [
    { id: 'r1', equipment_id: 'eq1', frequency: 'd', start_date: '2026-11-10' }
  ];

  // 1 done task, 1 issue task, remaining are scheduled/overdue
  const taskLogs = [
    { rule_id: 'r1', due_date: '2026-11-15', status: 'done', done_by: 'u1', done_at: '2026-11-15 10:30', notes: 'Checked all connections' },
    { rule_id: 'r1', due_date: '2026-11-13', status: 'issue', done_by: 'u1', notes: 'Loose wire found' }
  ];

  const profileMap = new Map([['u1', 'Juan dela Cruz']]);

  const wb = await generateMasterScheduleWorkbook({
    categories,
    groups,
    equipmentList,
    scheduleRules,
    taskLogs,
    profileMap,
    fromWeek: 46, // 2026 week 46 has Nov 15
    toWeek: 46,
    year: 2026,
    monthLabel: 'NOVEMBER',
    siteName: 'Solar Plant Alpha',
    revisionLabel: 'REV 1',
    selectedSystemCode: 'ALL',
    addNotes: true,
  });

  const ws = wb.worksheets[0];
  console.log('Worksheet created:', ws.name);

  let foundEqRow = -1;
  ws.eachRow((row, rowNumber) => {
    const val = row.getCell(3).value;
    if (val === 'Inverter Unit 1') {
      foundEqRow = rowNumber;
    }
  });

  console.log('Equipment row:', foundEqRow);
  const row = ws.getRow(foundEqRow);
  
  // Day columns for WW46: Col 6 to 12 (Nov 9 to Nov 15)
  for (let c = 6; c <= 12; c++) {
    const cell = row.getCell(c);
    const dayHeader = ws.getRow(8).getCell(c).value;
    console.log(`Col ${c} (day ${dayHeader}): val='${cell.value}' fill=${cell.fill?.fgColor?.argb} note='${cell.note || ''}'`);
    
    // Rule: Day cells contain NO text, letters or symbols
    if (cell.value !== '' && cell.value !== null && cell.value !== undefined) {
      throw new Error(`Day cell at col ${c} has text '${cell.value}', expected NO text!`);
    }

    // Rule: The ONLY fill color used in day cells is LIGHT GREEN for DONE tasks (FFC6EFCE). Everything else has NO fill.
    if (c === 12) { // Nov 15 is DONE
      if (cell.fill?.fgColor?.argb !== 'FFC6EFCE') {
        throw new Error(`Done cell fill expected FFC6EFCE, got ${cell.fill?.fgColor?.argb}`);
      }
      if (!cell.note || !cell.note.includes('Done by Juan dela Cruz')) {
        throw new Error(`Done cell expected note with worker name, got '${cell.note}'`);
      }
    } else {
      // Must have NO fill
      if (cell.fill?.fgColor?.argb) {
        throw new Error(`Col ${c} should have NO fill, but got ${cell.fill.fgColor.argb}`);
      }
      if (c === 10) { // Nov 13 is ISSUE -> note exists, no fill
        if (!cell.note || !cell.note.includes('Loose wire found')) {
          throw new Error(`Issue cell expected note, got '${cell.note}'`);
        }
      }
    }
  }

  // Check legend: should only have Done
  console.log('Checking legend block...');
  let foundDoneLegend = false;
  let hasOtherColorLegends = false;
  ws.eachRow((r, rNum) => {
    for (let c = 1; c <= 20; c++) {
      const cell = r.getCell(c);
      if (cell.value === 'Done') {
        foundDoneLegend = true;
        const square = r.getCell(c - 1);
        if (square.fill?.fgColor?.argb !== 'FFC6EFCE') {
          throw new Error(`Legend Done square expected FFC6EFCE, got ${square.fill?.fgColor?.argb}`);
        }
      }
      if (cell.value === 'Overdue' || cell.value === 'Scheduled' || cell.value === 'Issue reported' || cell.value === 'Skipped') {
        hasOtherColorLegends = true;
      }
    }
  });

  if (!foundDoneLegend) throw new Error('Legend "Done" not found');
  if (hasOtherColorLegends) throw new Error('Found removed status labels in legend');

  await wb.xlsx.writeFile('test_schedule.xlsx');
  console.log('✅ Export verification passed! Only light green FFC6EFCE used for done cells, all others no fill, no text in day cells.');
}

testExport().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
