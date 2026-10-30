/**
 * EXACTSPARE MODULE 16 — ANALYTICS & REPORTING UTILITIES
 * Date parsing, range validation, and secure CSV generation with formula injection prevention.
 */

/**
 * Parses and validates date ranges for analytics and reporting queries.
 * Supports presets ('today', '7days', '30days', '90days') and custom 'from' / 'to' dates.
 *
 * @param {Object} query - Express request query { from, to, preset }
 * @param {string} [dateField='createdAt'] - Field to filter on
 * @returns {{ startDate: Date|null, endDate: Date|null, dateFilter: Object, presetName: string }}
 */
export const parseDateRange = (query = {}, dateField = 'createdAt') => {
  const { from, to, preset } = query;
  const now = new Date();
  let startDate = null;
  let endDate = null;
  let presetName = preset || (from || to ? 'custom' : 'all');

  if (preset === 'today') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (preset === '7days') {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    endDate = now;
  } else if (preset === '30days') {
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    endDate = now;
  } else if (preset === '90days') {
    startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    endDate = now;
  } else {
    if (from) {
      const parsedFrom = new Date(from);
      if (isNaN(parsedFrom.getTime())) {
        const err = new Error('Invalid "from" date parameter. Expected format: YYYY-MM-DD or ISO 8601 string.');
        err.statusCode = 400;
        throw err;
      }
      startDate = parsedFrom;
    }

    if (to) {
      const parsedTo = new Date(to);
      if (isNaN(parsedTo.getTime())) {
        const err = new Error('Invalid "to" date parameter. Expected format: YYYY-MM-DD or ISO 8601 string.');
        err.statusCode = 400;
        throw err;
      }
      // If time was not specified (length <= 10 e.g. YYYY-MM-DD), set to end of that day
      if (typeof to === 'string' && to.length <= 10) {
        parsedTo.setHours(23, 59, 59, 999);
      }
      endDate = parsedTo;
    }
  }

  if (startDate && endDate && startDate > endDate) {
    const err = new Error('"from" date cannot be after "to" date.');
    err.statusCode = 400;
    throw err;
  }

  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter[dateField] = {};
    if (startDate) dateFilter[dateField].$gte = startDate;
    if (endDate) dateFilter[dateField].$lte = endDate;
  }

  return { startDate, endDate, dateFilter, presetName };
};

/**
 * Sanitizes a cell value for CSV output to completely prevent CSV Formula Injection
 * (CWE-1236) and safely format special characters.
 *
 * @param {*} val
 * @returns {string}
 */
export const sanitizeCsvCell = (val) => {
  if (val === null || val === undefined) return '';

  let str;
  if (val instanceof Date) {
    str = val.toISOString();
  } else if (typeof val === 'object') {
    str = JSON.stringify(val);
  } else {
    str = String(val);
  }

  // Formula Injection Defense: If cell begins with =, +, -, @, Tab (0x09), or Carriage Return (0x0D),
  // prepend a single quote so spreadsheet software interprets it as literal text.
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Standard CSV Escaping: If the cell contains quotes, commas, or newlines, wrap in quotes and escape internal quotes
  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
};

/**
 * Converts an array of objects into a secure CSV string.
 *
 * @param {Array<Object>} rows
 * @param {Array<{ key: string, label: string, format?: (val: any, row: any) => any }>} columns
 * @returns {string}
 */
export const convertToCsv = (rows, columns) => {
  // UTF-8 Byte Order Mark for proper Excel UTF-8 recognition
  const BOM = '\uFEFF';
  const headerLine = columns.map((col) => sanitizeCsvCell(col.label)).join(',');

  const dataLines = rows.map((row) => {
    return columns
      .map((col) => {
        let cellVal = row[col.key];
        if (typeof col.format === 'function') {
          cellVal = col.format(cellVal, row);
        }
        return sanitizeCsvCell(cellVal);
      })
      .join(',');
  });

  return `${BOM}${headerLine}\r\n${dataLines.join('\r\n')}\r\n`;
};
