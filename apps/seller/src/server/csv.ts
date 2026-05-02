/**
 * Minimal RFC 4180 CSV parser. Handles quoted fields, embedded commas,
 * embedded newlines (inside quotes), and escaped double-quotes (`""`).
 * No streaming — input is bounded by the upload cap so loading the whole
 * string is fine.
 *
 * Returns rows as string arrays. Caller maps to a header schema.
 */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < input.length) {
    const ch = input[i]!;

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\r') {
      // Swallow — \r\n becomes \n on the next iteration.
      i += 1;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  // Flush trailing field/row (file may not end with newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop completely-blank trailing rows (single empty field).
  while (rows.length > 0 && rows[rows.length - 1]!.every((f) => f === '')) {
    rows.pop();
  }

  return rows;
}
