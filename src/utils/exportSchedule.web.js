/**
 * Web Excel Generator for Master Maintenance Schedule.
 * Dynamically loads ExcelJS in the browser.
 */
import { formatDate, parseDate, addDays, getIsoWeekday, getWorkWeekNumber, daysInMonth } from './schedule';

// Cell fill color constant for day cells: ONLY light green for done tasks; all other cells have NO fill (white).
export const DONE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };     // light green

const isWeb = typeof window !== 'undefined';

// Lazy loader for ExcelJS to avoid bundling it initially
let cachedExcelJS = null;
async function getExcelJS() {
  if (cachedExcelJS) return cachedExcelJS;
  try {
    const mod = await import('exceljs');
    cachedExcelJS = mod.default || mod;
    return cachedExcelJS;
  } catch (err1) {
    try {
      // Browser fallback bundle
      // @ts-ignore
      const mod2 = await import('exceljs/dist/exceljs.min.js');
      cachedExcelJS = mod2.default || mod2;
      return cachedExcelJS;
    } catch (err2) {
      console.error('Failed to dynamically load ExcelJS:', err1, err2);
      throw new Error('Could not load Excel generator. Please refresh and try again.');
    }
  }
}

/**
 * Builds the list of 5-week sheet chunk descriptors.
 * Each week chunk has:
 *  - workWeekNo: number
 *  - mondayStr: 'YYYY-MM-DD'
 *  - sundayStr: 'YYYY-MM-DD'
 *  - days: [{ dateStr, dayNum, isoWeekday, weekdayLetter }]
 */
export function buildWorkWeeksList(fromWeek, toWeek, year) {
  // If toWeek < fromWeek (e.g. crossing year boundary or single week)
  const weeks = [];
  
  // Find Monday of given ISO week number in year
  // In ISO 8601, week 1 is the week with Jan 4th.
  for (let w = fromWeek; w <= toWeek; w++) {
    // Jan 4th of year is always in week 1
    const jan4 = new Date(year, 0, 4);
    const jan4IsoWeekday = getIsoWeekday(jan4); // 1..7
    // Monday of week 1:
    const monW1 = addDays(jan4, -(jan4IsoWeekday - 1));
    // Monday of week w:
    const monday = addDays(monW1, (w - 1) * 7);
    const sunday = addDays(monday, 6);

    const mondayStr = formatDate(monday);
    const sundayStr = formatDate(sunday);

    const weekdayLetters = ['M', 'T', 'W', 'TH', 'F', 'S', 'SN'];
    const days = [];
    for (let d = 0; d < 7; d++) {
      const cur = addDays(monday, d);
      days.push({
        dateStr: formatDate(cur),
        dayNum: cur.getDate(),
        isoWeekday: d + 1,
        weekdayLetter: weekdayLetters[d],
      });
    }

    weeks.push({
      workWeekNo: w,
      mondayStr,
      sundayStr,
      days,
    });
  }

  return weeks;
}

/**
 * Combine frequencies for an equipment row across an exported work week.
 * Order: d, w, M, Q, SA.
 */
export function combineWeekFrequencies(dueRulesInWeek) {
  if (!dueRulesInWeek || dueRulesInWeek.length === 0) return '';
  const freqs = new Set(dueRulesInWeek.map((r) => r.frequency));
  const order = ['d', 'w', 'M', 'Q', 'SA'];
  let res = '';
  for (const f of order) {
    if (freqs.has(f)) res += f;
  }
  return res;
}

/**
 * Prepares the hierarchical rows to render:
 *  - Category section row: { type: 'category', category }
 *  - Group header row (for groups with sub-items): { type: 'group', group }
 *  - Equipment row: { type: 'equipment', equipment, group, category, label, itemNoStr, isSubItem }
 */
export function buildHierarchicalRows(categories, groups, equipmentList, selectedSystemCode = 'ALL') {
  const filteredCats = categories.filter((c) => {
    if (selectedSystemCode === 'ALL') return true;
    return c.code === selectedSystemCode;
  });

  const rows = [];

  filteredCats.forEach((cat) => {
    rows.push({
      type: 'category',
      category: cat,
      titleA: `${cat.code}. `,
      titleC: `${cat.name.toUpperCase()}:`,
    });

    const catGroups = groups
      .filter((g) => g.category_id === cat.id)
      .sort((a, b) => Number(a.item_no) - Number(b.item_no));

    catGroups.forEach((grp) => {
      const grpEquipment = equipmentList
        .filter((e) => e.group_id === grp.id && e.is_active !== false)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      if (grpEquipment.length === 0) return;

      // Classify group pattern
      // Case A: Numbered units whose names already start with group name (e.g. "Transformer 1", "Inverter 7")
      // Check if all equipment names start with group name or similar base
      const grpBaseLower = grp.name.toLowerCase().trim();
      const allStartWithGrp = grpEquipment.length > 1 && grpEquipment.every((e) => {
        const eqLower = e.name.toLowerCase().trim();
        return eqLower.startsWith(grpBaseLower) || (grpBaseLower.includes('switchgear') && eqLower.includes('switchgear'));
      });

      // Case B: Single-equipment groups
      const isSingleEquipment = grpEquipment.length === 1 && !grpEquipment[0].area && !grpEquipment[0].name.startsWith('DCB-');

      // Case C: Groups with sub-items (areas, distribution boards, combiner boxes)
      const isSubItemGroup = !allStartWithGrp && !isSingleEquipment;

      if (isSubItemGroup) {
        // Group header row first
        rows.push({
          type: 'group',
          group: grp,
          itemNoStr: grp.item_no,
          groupName: grp.name,
        });

        // Sub-items
        grpEquipment.forEach((eq) => {
          let label = eq.name;
          if (eq.area) {
            label = `     ${eq.area} `;
          } else if (eq.name.startsWith('DCB-') && eq.unit_count) {
            label = `${eq.name}`;
          } else if (eq.name.startsWith('Grass Cutting - ')) {
            label = eq.name.replace('Grass Cutting - ', '');
          }

          rows.push({
            type: 'equipment',
            equipment: eq,
            group: grp,
            category: cat,
            itemNoStr: '',
            label: label,
            isSubItem: true,
          });
        });
      } else {
        // Numbered units or single equipment
        grpEquipment.forEach((eq, idx) => {
          rows.push({
            type: 'equipment',
            equipment: eq,
            group: grp,
            category: cat,
            itemNoStr: idx === 0 ? grp.item_no : '',
            label: eq.name,
            isSubItem: false,
          });
        });
      }
    });
  });

  return rows;
}

/**
 * Main export function called from UI.
 */
export async function generateMasterScheduleWorkbook({
  categories,
  groups,
  equipmentList,
  scheduleRules,
  taskLogs,
  profileMap, // Map<uuid, string (fullName)>
  fromWeek,
  toWeek,
  year,
  monthLabel,
  siteName = '',
  revisionLabel = 'REV A',
  selectedSystemCode = 'ALL',
  addNotes = true,
}) {
  const ExcelJS = await getExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Solar PM Hub';
  wb.lastModifiedBy = 'Solar PM Hub';
  wb.created = new Date();
  wb.modified = new Date();

  const allWeeks = buildWorkWeeksList(fromWeek, toWeek, year);
  const rows = buildHierarchicalRows(categories, groups, equipmentList, selectedSystemCode);

  // Group weeks into chunks of up to 5 weeks per sheet
  const weekChunks = [];
  for (let i = 0; i < allWeeks.length; i += 5) {
    weekChunks.push(allWeeks.slice(i, i + 5));
  }

  // Pre-index task_logs by `${rule_id}_${due_date}`
  const logMap = new Map();
  if (Array.isArray(taskLogs)) {
    taskLogs.forEach((l) => {
      logMap.set(`${l.rule_id}_${l.due_date}`, l);
    });
  }

  // Pre-index schedule rules by equipment_id
  const rulesByEquipment = new Map();
  (scheduleRules || []).forEach((r) => {
    const eqId = r.equipment_id;
    if (!rulesByEquipment.has(eqId)) rulesByEquipment.set(eqId, []);
    rulesByEquipment.get(eqId).push(r);
  });

  const fontName = 'Aptos Narrow';
  const todayStr = formatDate(new Date());

  // Styling helper constants
  const fillGreyBF = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBFBFBF' } };
  const fillGreen84 = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF84E291' } };
  const fillLightGreenC2 = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC2F1C8' } };
  const fillIssueOrange = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
  const fillSkippedGrey = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } };
  const fillPerfGrey = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };

  const borderThin = { style: 'thin', color: { argb: 'FFBFBFBF' } };
  const borderMedium = { style: 'medium', color: { argb: 'FF000000' } };

  // Generate each 5-week chunk as a sheet
  weekChunks.forEach((chunk) => {
    const sheetName = chunk.length === 1
      ? `WW${chunk[0].workWeekNo}`
      : `WW${chunk[0].workWeekNo}-${chunk[chunk.length - 1].workWeekNo}`;

    const numWeeks = chunk.length;
    // Total table columns:
    // A (1), B (2), C (3)
    // Code cols: 4 to (3 + numWeeks)
    // Spacer col: (4 + numWeeks)
    // Day cols: 7 cols per week, starting at (5 + numWeeks)
    const codeStartCol = 4;
    const codeEndCol = 3 + numWeeks;
    const spacerCol = 4 + numWeeks;
    const dayStartCol = 5 + numWeeks;
    const totalCols = dayStartCol + (numWeeks * 7) - 1;

    const ws = wb.addWorksheet(sheetName, {
      pageSetup: {
        paperSize: 8, // A3
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
        printTitlesRow: '5:8',
      },
      views: [{ state: 'frozen', xSplit: 3, ySplit: 8, zoomScale: 85, showGridLines: false }],
    });

    ws.headerFooter.oddFooter = `Generated by Solar PM Hub on ${todayStr} - Page &P of &N`;

    // Set Column Widths
    ws.getColumn(1).width = 8.2;
    ws.getColumn(2).width = 17.3;
    ws.getColumn(3).width = 48.7;
    for (let c = codeStartCol; c <= codeEndCol; c++) {
      ws.getColumn(c).width = 4.7;
    }
    ws.getColumn(spacerCol).width = 2.2;
    for (let c = dayStartCol; c <= totalCols; c++) {
      ws.getColumn(c).width = 6.7;
    }

    // Row 2: MASTER MAINTENANCE SCHEDULE
    const r2 = ws.getRow(2);
    r2.height = 31;
    const c2 = ws.getCell('A2');
    c2.value = 'MASTER MAINTENANCE SCHEDULE';
    c2.font = { name: fontName, size: 24, bold: true, color: { argb: 'FF000000' } };
    c2.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.mergeCells(2, 1, 2, totalCols);

    // Row 3: Work Type:  Scheduled Service
    const r3 = ws.getRow(3);
    r3.height = 28.5;
    const c3 = ws.getCell('A3');
    c3.value = 'Work Type:  Scheduled Service';
    c3.font = { name: fontName, size: 16, bold: false, color: { argb: 'FF000000' } };
    c3.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.mergeCells(3, 1, 3, totalCols);

    // Row 4: SITE, Month, REV
    const r4 = ws.getRow(4);
    r4.height = 20;

    const cSite = ws.getCell('A4');
    cSite.value = siteName ? `SITE: ${siteName}` : 'SITE:';
    cSite.font = { name: fontName, size: 11, bold: true };
    cSite.alignment = { vertical: 'middle' };

    const cMonth = ws.getCell(4, codeStartCol);
    cMonth.value = (monthLabel || 'MONTH').toUpperCase();
    cMonth.font = { name: fontName, size: 11, bold: true };
    cMonth.alignment = { horizontal: 'center', vertical: 'middle' };
    if (codeEndCol > codeStartCol) {
      ws.mergeCells(4, codeStartCol, 4, codeEndCol);
    }

    const cRev = ws.getCell(4, totalCols - 1);
    cRev.value = revisionLabel || 'REV A';
    cRev.font = { name: fontName, size: 10, bold: true };
    cRev.alignment = { horizontal: 'right', vertical: 'middle' };

    // Row 5-8: Header Block
    // A5:A7 "Item No", B5:B7 "MWO No", C5:C7 "Equipment"
    ws.mergeCells('A5:A7');
    const cA5 = ws.getCell('A5');
    cA5.value = 'Item No';
    cA5.font = { name: fontName, size: 14, bold: true };
    cA5.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cA5.fill = fillGreyBF;

    ws.mergeCells('B5:B7');
    const cB5 = ws.getCell('B5');
    cB5.value = 'MWO No';
    cB5.font = { name: fontName, size: 14, bold: true };
    cB5.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    ws.mergeCells('C5:C7');
    const cC5 = ws.getCell('C5');
    cC5.value = 'Equipment';
    cC5.font = { name: fontName, size: 14, bold: true };
    cC5.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cC5.fill = fillGreyBF;

    // Code columns: D5:G6 merged "Work Week" (fill #84E291)
    ws.mergeCells(5, codeStartCol, 6, codeEndCol);
    const cWW = ws.getCell(5, codeStartCol);
    cWW.value = 'Work Week';
    cWW.font = { name: fontName, size: 12, bold: true };
    cWW.alignment = { horizontal: 'center', vertical: 'middle' };
    cWW.fill = fillGreen84;

    // Row 7 code columns: work-week numbers (grey #BFBFBF)
    chunk.forEach((w, wIdx) => {
      const cell = ws.getCell(7, codeStartCol + wIdx);
      cell.value = w.workWeekNo;
      cell.font = { name: fontName, size: 11, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = fillGreyBF;
    });

    // Row 8 column C: Title taken from first included category
    const cC8 = ws.getCell('C8');
    const firstCat = rows.find((r) => r.type === 'category')?.category;
    let titleSys = 'INVERTER STATION';
    if (firstCat?.code === 'B') titleSys = 'PV FIELD';
    else if (firstCat?.code === 'C') titleSys = 'MV & LV';
    else if (firstCat?.code === 'D') titleSys = 'OTHER SYSTEM';
    cC8.value = titleSys;
    cC8.font = { name: fontName, size: 12, bold: true };
    cC8.alignment = { horizontal: 'center', vertical: 'middle' };
    cC8.fill = fillGreyBF;

    // Week blocks: 7 columns each
    chunk.forEach((w, wIdx) => {
      const wStartCol = dayStartCol + (wIdx * 7);
      const isAltWeek = wIdx % 2 === 0; // 0, 2, 4 (1st, 3rd, 5th) have green fill #C2F1C8
      const headerWeekFill = isAltWeek ? fillLightGreenC2 : undefined;

      // Row 5: "Work Week No." then week number in RED
      ws.mergeCells(5, wStartCol, 5, wStartCol + 2);
      const cLabel = ws.getCell(5, wStartCol);
      cLabel.value = 'Work Week No.';
      cLabel.font = { name: fontName, size: 14, bold: false };
      cLabel.alignment = { horizontal: 'center', vertical: 'middle' };
      if (headerWeekFill) cLabel.fill = headerWeekFill;

      ws.mergeCells(5, wStartCol + 3, 5, wStartCol + 6);
      const cNum = ws.getCell(5, wStartCol + 3);
      cNum.value = w.workWeekNo;
      cNum.font = { name: fontName, size: 16, bold: true, color: { argb: 'FFFF0000' } };
      cNum.alignment = { horizontal: 'center', vertical: 'middle' };
      if (headerWeekFill) cNum.fill = headerWeekFill;

      // Row 6: Empty band merged across the 7 columns
      ws.mergeCells(6, wStartCol, 6, wStartCol + 6);
      const cR6 = ws.getCell(6, wStartCol);
      if (headerWeekFill) cR6.fill = headerWeekFill;

      // Row 7: Day of month (1-31)
      // Row 8: Weekday letters M, T, W, TH, F, S, SN
      w.days.forEach((day, dIdx) => {
        const col = wStartCol + dIdx;

        const cellDay = ws.getCell(7, col);
        cellDay.value = day.dayNum;
        cellDay.font = { name: fontName, size: 9 };
        cellDay.alignment = { horizontal: 'center', vertical: 'middle' };
        if (headerWeekFill) cellDay.fill = headerWeekFill;

        const cellWd = ws.getCell(8, col);
        cellWd.value = day.weekdayLetter;
        cellWd.font = { name: fontName, size: 14, bold: true };
        cellWd.alignment = { horizontal: 'center', vertical: 'middle' };
        if (headerWeekFill) cellWd.fill = headerWeekFill;
      });
    });

    // Apply borders to header rows (5 to 8)
    for (let r = 5; r <= 8; r++) {
      for (let c = 1; c <= totalCols; c++) {
        const cell = ws.getCell(r, c);
        const isWeekStart = (c >= dayStartCol && (c - dayStartCol) % 7 === 0);
        cell.border = {
          top: r === 5 ? borderMedium : borderThin,
          bottom: r === 8 ? borderMedium : borderThin,
          left: isWeekStart ? borderMedium : borderThin,
          right: c === totalCols ? borderMedium : borderThin,
        };
      }
    }

    // Set header heights
    ws.getRow(5).height = 20;
    ws.getRow(6).height = 14;
    ws.getRow(7).height = 18;
    ws.getRow(8).height = 20;

    // Body rows
    let curRowIdx = 9;
    const equipmentRowIndices = []; // track equipment rows for performance calc

    rows.forEach((rowMeta) => {
      const row = ws.getRow(curRowIdx);
      row.height = 19.9;

      if (rowMeta.type === 'category') {
        const cA = ws.getCell(curRowIdx, 1);
        cA.value = rowMeta.titleA;
        cA.font = { name: fontName, size: 11, bold: true };

        const cC = ws.getCell(curRowIdx, 3);
        cC.value = rowMeta.titleC;
        cC.font = { name: fontName, size: 14, bold: true };

        // Category border
        for (let c = 1; c <= totalCols; c++) {
          const isWeekStart = (c >= dayStartCol && (c - dayStartCol) % 7 === 0);
          ws.getCell(curRowIdx, c).border = {
            top: borderThin,
            bottom: borderThin,
            left: isWeekStart ? borderMedium : borderThin,
            right: c === totalCols ? borderMedium : borderThin,
          };
        }
      } else if (rowMeta.type === 'group') {
        // Group header row for sub-items
        const cA = ws.getCell(curRowIdx, 1);
        cA.value = rowMeta.itemNoStr;
        cA.font = { name: fontName, size: 11, bold: true };
        cA.alignment = { horizontal: 'center', vertical: 'middle' };

        const cC = ws.getCell(curRowIdx, 3);
        cC.value = rowMeta.groupName;
        cC.font = { name: fontName, size: 13, bold: true };

        for (let c = 1; c <= totalCols; c++) {
          const isWeekStart = (c >= dayStartCol && (c - dayStartCol) % 7 === 0);
          ws.getCell(curRowIdx, c).border = {
            top: borderThin,
            bottom: borderThin,
            left: isWeekStart ? borderMedium : borderThin,
            right: c === totalCols ? borderMedium : borderThin,
          };
        }
      } else if (rowMeta.type === 'equipment') {
        const eq = rowMeta.equipment;
        equipmentRowIndices.push({ rowIdx: curRowIdx, eq });

        // Item No in column A
        if (rowMeta.itemNoStr) {
          const cA = ws.getCell(curRowIdx, 1);
          cA.value = rowMeta.itemNoStr;
          cA.font = { name: fontName, size: 11 };
          cA.alignment = { horizontal: 'center', vertical: 'middle' };
        }

        // Equipment Name / Label in column C
        const cC = ws.getCell(curRowIdx, 3);
        cC.value = rowMeta.label;
        cC.font = { name: fontName, size: 13 };
        cC.alignment = { vertical: 'middle' };

        const eqRules = rulesByEquipment.get(eq.id) || [];

        // Fill per-week code columns (D..)
        chunk.forEach((w, wIdx) => {
          const codeCol = codeStartCol + wIdx;
          const dueRulesInWeek = [];

          // Find rules that are due in week w
          eqRules.forEach((rule) => {
            // Check if rule generates any date in [w.mondayStr, w.sundayStr]
            w.days.forEach((day) => {
              // Simple check against frequency
              const freq = rule.frequency;
              let isDue = false;
              if (day.dateStr >= rule.start_date && (!rule.end_date || day.dateStr <= rule.end_date)) {
                if (freq === 'd') {
                  isDue = true;
                } else if (freq === 'w') {
                  const targetWd = rule.weekday ? Number(rule.weekday) : getIsoWeekday(parseDate(rule.start_date));
                  if (day.isoWeekday === targetWd) isDue = true;
                } else if (freq === 'M') {
                  const sDay = parseDate(rule.start_date).getDate();
                  const curD = parseDate(day.dateStr);
                  const lastD = daysInMonth(curD.getFullYear(), curD.getMonth() + 1);
                  if (curD.getDate() === Math.min(sDay, lastD)) isDue = true;
                } else if (freq === 'Q' || freq === 'SA') {
                  const step = freq === 'Q' ? 3 : 6;
                  const sDate = parseDate(rule.start_date);
                  const curD = parseDate(day.dateStr);
                  const mDiff = (curD.getFullYear() - sDate.getFullYear()) * 12 + (curD.getMonth() - sDate.getMonth());
                  if (mDiff >= 0 && mDiff % step === 0) {
                    const lastD = daysInMonth(curD.getFullYear(), curD.getMonth() + 1);
                    if (curD.getDate() === Math.min(sDate.getDate(), lastD)) isDue = true;
                  }
                }
              }
              if (isDue && !dueRulesInWeek.includes(rule)) {
                dueRulesInWeek.push(rule);
              }
            });
          });

          const codeStr = combineWeekFrequencies(dueRulesInWeek);
          if (codeStr) {
            const cellCode = ws.getCell(curRowIdx, codeCol);
            cellCode.value = codeStr;
            const hasLongFreq = codeStr.includes('M') || codeStr.includes('Q') || codeStr.includes('SA');
            cellCode.font = { name: fontName, size: 11, bold: hasLongFreq };
            cellCode.alignment = { horizontal: 'center', vertical: 'middle' };
          }
        });

        // Fill Day Cells across the weeks
        chunk.forEach((w, wIdx) => {
          const wStartCol = dayStartCol + (wIdx * 7);

          w.days.forEach((day, dIdx) => {
            const dayCol = wStartCol + dIdx;
            const cell = ws.getCell(curRowIdx, dayCol);

            // Find matching due task for this equipment on this day
            let activeRule = null;
            for (const r of eqRules) {
              const freq = r.frequency;
              let isDue = false;
              if (day.dateStr >= r.start_date && (!r.end_date || day.dateStr <= r.end_date)) {
                if (freq === 'd') {
                  isDue = true;
                } else if (freq === 'w') {
                  const targetWd = r.weekday ? Number(r.weekday) : getIsoWeekday(parseDate(r.start_date));
                  if (day.isoWeekday === targetWd) isDue = true;
                } else if (freq === 'M') {
                  const sDay = parseDate(r.start_date).getDate();
                  const curD = parseDate(day.dateStr);
                  const lastD = daysInMonth(curD.getFullYear(), curD.getMonth() + 1);
                  if (curD.getDate() === Math.min(sDay, lastD)) isDue = true;
                } else if (freq === 'Q' || freq === 'SA') {
                  const step = freq === 'Q' ? 3 : 6;
                  const sDate = parseDate(r.start_date);
                  const curD = parseDate(day.dateStr);
                  const mDiff = (curD.getFullYear() - sDate.getFullYear()) * 12 + (curD.getMonth() - sDate.getMonth());
                  if (mDiff >= 0 && mDiff % step === 0) {
                    const lastD = daysInMonth(curD.getFullYear(), curD.getMonth() + 1);
                    if (curD.getDate() === Math.min(sDate.getDate(), lastD)) isDue = true;
                  }
                }
              }
              if (isDue) {
                activeRule = r;
                break;
              }
            }

            if (activeRule) {
              const key = `${activeRule.id}_${day.dateStr}`;
              const log = logMap.get(key);
              const status = log ? log.status : 'pending';
              const result = log ? log.result : null;

              // Day cells have NO text at all (no letters, no symbols); meaning is indicated by fill color only
              cell.value = '';

              if (status === 'done') {
                cell.fill = DONE_FILL;
                if (addNotes) {
                  const workerName = (log.done_by && profileMap?.get(log.done_by)) || 'Technician';
                  const workerGroup = (log.worker_group_name || activeRule.worker_group?.name || activeRule.worker_group_name || 'Worker group');
                  const doneAt = log.done_at ? log.done_at.replace('T', ' ').substring(0, 16) : day.dateStr;
                  const approverName = (log.approved_by && profileMap?.get(log.approved_by)) || (log.reviewed_by && profileMap?.get(log.reviewed_by)) || 'Admin';
                  const approvedAt = (log.approved_at || log.reviewed_at) ? (log.approved_at || log.reviewed_at).replace('T', ' ').substring(0, 16) : doneAt;

                  let noteText = `Done by ${workerName} (${workerGroup}) on ${doneAt} - approved by ${approverName} on ${approvedAt}`;
                  if (result === 'issue' || log.notes) {
                    noteText += `\nIssue: ${log.notes || 'Issue reported'}`;
                  }
                  if (log.photo_paths && log.photo_paths.length > 0) {
                    noteText += `\nPhotos: ${log.photo_paths.length}`;
                  }
                  cell.note = noteText;
                }
              } else if (result === 'issue') {
                // Not done, but result is issue -> no fill; note with "(waiting approval)" if not done
                if (addNotes) {
                  const workerName = (log.done_by && profileMap?.get(log.done_by)) || 'Technician';
                  let noteText = `Issue: ${log.notes || 'Issue reported'} (waiting approval)`;
                  if (workerName) noteText += ` (${workerName})`;
                  if (log.photo_paths && log.photo_paths.length > 0) {
                    noteText += `\nPhotos: ${log.photo_paths.length}`;
                  }
                  cell.note = noteText;
                }
              }
              // draft / submitted / rejected / scheduled / overdue have NO fill (white)
            }
          });
        });

        // Set borders on all cells of this row
        for (let c = 1; c <= totalCols; c++) {
          const isWeekStart = (c >= dayStartCol && (c - dayStartCol) % 7 === 0);
          ws.getCell(curRowIdx, c).border = {
            top: borderThin,
            bottom: borderThin,
            left: isWeekStart ? borderMedium : borderThin,
            right: c === totalCols ? borderMedium : borderThin,
          };
        }
      }

      curRowIdx++;
    });

    // Blank row before performance summary
    curRowIdx++;

    // %Performance to Schedule Row
    const perfRowIdx = curRowIdx;
    const rPerf = ws.getRow(perfRowIdx);
    rPerf.height = 22;

    chunk.forEach((w, wIdx) => {
      const wStartCol = dayStartCol + (wIdx * 7);

      // Count due and done tasks for this week among included equipment
      let totalDue = 0;
      let totalDone = 0;

      equipmentRowIndices.forEach(({ eq }) => {
        const eqRules = rulesByEquipment.get(eq.id) || [];
        w.days.forEach((day) => {
          for (const r of eqRules) {
            const freq = r.frequency;
            let isDue = false;
            if (day.dateStr >= r.start_date && (!r.end_date || day.dateStr <= r.end_date)) {
              if (freq === 'd') isDue = true;
              else if (freq === 'w') {
                const targetWd = r.weekday ? Number(r.weekday) : getIsoWeekday(parseDate(r.start_date));
                if (day.isoWeekday === targetWd) isDue = true;
              } else if (freq === 'M') {
                const sDay = parseDate(r.start_date).getDate();
                const curD = parseDate(day.dateStr);
                const lastD = daysInMonth(curD.getFullYear(), curD.getMonth() + 1);
                if (curD.getDate() === Math.min(sDay, lastD)) isDue = true;
              } else if (freq === 'Q' || freq === 'SA') {
                const step = freq === 'Q' ? 3 : 6;
                const sDate = parseDate(r.start_date);
                const curD = parseDate(day.dateStr);
                const mDiff = (curD.getFullYear() - sDate.getFullYear()) * 12 + (curD.getMonth() - sDate.getMonth());
                if (mDiff >= 0 && mDiff % step === 0) {
                  const lastD = daysInMonth(curD.getFullYear(), curD.getMonth() + 1);
                  if (curD.getDate() === Math.min(sDate.getDate(), lastD)) isDue = true;
                }
              }
            }

            if (isDue) {
              totalDue++;
              const key = `${r.id}_${day.dateStr}`;
              const log = logMap.get(key);
              if (log?.status === 'done') totalDone++;
              break;
            }
          }
        });
      });

      const pct = totalDue > 0 ? totalDone / totalDue : 0;

      // Label in first 4 cells (merged)
      ws.mergeCells(perfRowIdx, wStartCol, perfRowIdx, wStartCol + 3);
      const cLabel = ws.getCell(perfRowIdx, wStartCol);
      cLabel.value = '%Performance to Schedule';
      cLabel.font = { name: fontName, size: 10, bold: true };
      cLabel.alignment = { horizontal: 'center', vertical: 'middle' };
      cLabel.fill = fillPerfGrey;

      // Percentage in last 3 cells (merged)
      ws.mergeCells(perfRowIdx, wStartCol + 4, perfRowIdx, wStartCol + 6);
      const cPct = ws.getCell(perfRowIdx, wStartCol + 4);
      cPct.value = pct;
      cPct.numFmt = '0%';
      cPct.font = { name: fontName, size: 11, bold: true, color: { argb: 'FF0EA5E9' } };
      cPct.alignment = { horizontal: 'center', vertical: 'middle' };
      cPct.fill = fillPerfGrey;

      // Borders
      for (let c = wStartCol; c < wStartCol + 7; c++) {
        ws.getCell(perfRowIdx, c).border = {
          top: borderMedium,
          bottom: borderMedium,
          left: c === wStartCol ? borderMedium : borderThin,
          right: c === wStartCol + 6 ? borderMedium : borderThin,
        };
      }
    });

    curRowIdx += 2; // skip one row for Legend

    // Legend Block
    const legRow1 = ws.getRow(curRowIdx);
    legRow1.height = 18;
    const cLeg1 = ws.getCell(curRowIdx, 4);
    cLeg1.value = 'd = Daily   w = Weekly   dw = Daily and Weekly   M = Monthly   Q = Quarterly   SA = Semi annual activity';
    cLeg1.font = { name: fontName, size: 10, bold: true, color: { argb: 'FF52525B' } };

    curRowIdx++;
    const legRow2 = ws.getRow(curRowIdx);
    legRow2.height = 18;

    // Legend has ONE colored square (light green) with label "Approved (done)"
    const cDone = ws.getCell(curRowIdx, 4);
    cDone.value = '';
    cDone.fill = DONE_FILL;
    cDone.border = { top: borderThin, bottom: borderThin, left: borderThin, right: borderThin };

    const cDoneLbl = ws.getCell(curRowIdx, 5);
    cDoneLbl.value = 'Approved (done)';
    cDoneLbl.font = { name: fontName, size: 10, bold: true };
  });

  return wb;
}

/**
 * Triggers web browser download of workbook buffer.
 */
export async function downloadWorkbook(workbook, filename) {
  if (typeof window === 'undefined') {
    throw new Error('Export is only supported in web browsers.');
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}
