import * as XLSX from "xlsx";
import {
  CalendarEvent,
  newEvent,
  parseLocal,
  dateKey,
  dateTime,
  pad,
  validateEvent,
} from "./model";
import { parseSentence } from "./parse";
export interface ImportTable {
  name: string;
  rows: string[][];
}
export interface Mapping {
  header: number;
  title: number;
  date: number;
  time: number;
  name: number;
  end: number;
}
export function readWorkbook(data: ArrayBuffer): ImportTable[] {
  const book = XLSX.read(data, {
    type: "array",
    // Keep wall-clock serials; converting to JS Date can shift the time zone.
    cellDates: false,
    cellNF: true,
  });
  return book.SheetNames.map((name) => {
    const sheet = book.Sheets[name];
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false,
    }) as unknown[][];
    if (rows.length > 5001)
      throw new Error(`工作表“${name}”超过5000行，请拆分后导入`);
    return {
      name,
      rows: rows.map((row, r) =>
        row.map((value, c) => {
          const cell =
            sheet[
              XLSX.utils.encode_cell({ r: r + range.s.r, c: c + range.s.c })
            ];
          if (
            cell?.t === "n" &&
            typeof cell.v === "number" &&
            XLSX.SSF.is_date(cell.z || "")
          ) {
            const d = XLSX.SSF.parse_date_code(cell.v, {
              date1904: !!book.Workbook?.WBProps?.date1904,
            });
            if (d) {
              const clock = `${pad(d.H)}:${pad(d.M)}`;
              return /[dy]/i.test(cell.z || "")
                ? `${d.y}-${pad(d.m)}-${pad(d.d)}T${clock}`
                : clock;
            }
          }
          return String(value ?? "").trim();
        }),
      ),
    };
  });
}
export function detectMapping(rows: string[][]): Mapping {
  const scores = rows
    .slice(0, 15)
    .map(
      (row) =>
        row.filter((c) =>
          /^(日期|开始日期|开始时间|时间|事项|姓名|标题|活动|日程|课程|内容|负责人)$/.test(
            c,
          ),
        ).length,
    );
  const header = Math.max(0, scores.indexOf(Math.max(...scores)));
  const h = rows[header] || [];
  const find = (re: RegExp) => h.findIndex((c) => re.test(c));
  return {
    header,
    title: find(/标题|事项|内容|活动|任务|课程|工作/),
    date: find(/日期|开始日期|^开始$|^时间$|^开始时间$/),
    time: find(/^开始时间$|^时间$|^时刻$/),
    name: find(/姓名|人员|名字|负责人|值班人/),
    end: find(/结束时间|^结束$/),
  };
}
export function matchesName(
  cell: string,
  name: string,
  aliases: string,
): boolean {
  const targets = [name, ...aliases.split(/[、,，;；\n]/)]
    .map((s) => s.trim())
    .filter(Boolean);
  return targets.some(
    (n) =>
      cell.trim() === n ||
      cell
        .split(/[、,，;；/（）()]+/)
        .map((s) => s.trim())
        .includes(n) ||
      cell.split(/[、,，;；\s/（）()]+/).includes(n),
  );
}
function normalizeDate(s: string): string {
  const full = /^(\d{4})[年/\-.](\d{1,2})[月/\-.](\d{1,2})日?(?:\s|T|$)/.exec(
    s.trim(),
  );
  if (full) return `${full[1]}-${pad(+full[2])}-${pad(+full[3])}`;
  const trailing = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:\s|T|$)/.exec(
    s.trim(),
  );
  if (trailing) {
    if (trailing[3].length !== 4)
      throw new Error("年份请写四位，例如2026-10-29");
    const a = +trailing[1],
      b = +trailing[2];
    if (a <= 12 && b <= 12) throw new Error("月日顺序不明确，请改成YYYY-MM-DD");
    return `${trailing[3]}-${pad(a > 12 ? b : a)}-${pad(a > 12 ? a : b)}`;
  }
  const short = /^(\d{1,2})[月/\-.](\d{1,2})日?(?:\s|T|$)/.exec(s.trim());
  if (short)
    return `${new Date().getFullYear()}-${pad(+short[1])}-${pad(+short[2])}`;
  throw new Error("缺少可识别日期，请使用YYYY-MM-DD");
}
export function parseTable(
  table: ImportTable,
  mapping: Mapping,
  profile: { name: string; aliases: string },
  onlyMine: boolean,
): { events: CalendarEvent[]; warnings: string[] } {
  const events: CalendarEvent[] = [];
  const warnings: string[] = [];
  if (mapping.title < 0 || mapping.date < 0)
    return {
      events,
      warnings: ["请先指定标题列和日期列；复杂的表格也可以连接AI识别。"],
    };
  if (onlyMine && (!profile.name.trim() || mapping.name < 0))
    return {
      events,
      warnings: ["按姓名筛选需要先填写使用者姓名，并指定表格的姓名列。"],
    };
  table.rows.slice(mapping.header + 1).forEach((row, index) => {
    if (row.every((c) => !c)) return;
    if (
      onlyMine &&
      !matchesName(row[mapping.name] || "", profile.name, profile.aliases)
    )
      return;
    try {
      const date = normalizeDate(row[mapping.date] || "");
      const timeString =
        (mapping.time >= 0 ? row[mapping.time] : "") || row[mapping.date] || "";
      const clock = /(\d{1,2})[:：](\d{2})/.exec(timeString);
      const start = `${date}T${clock ? `${pad(+clock[1])}:${clock[2]}` : "09:00"}`;
      const e = {
        ...newEvent(parseLocal(start)),
        title: row[mapping.title] || "",
        start,
        allDay: !clock,
        person: mapping.name >= 0 ? row[mapping.name] : undefined,
      };
      const end =
        mapping.end >= 0
          ? /(\d{1,2})[:：](\d{2})/.exec(row[mapping.end] || "")
          : null;
      if (end) e.end = `${date}T${pad(+end[1])}:${end[2]}`;
      events.push(validateEvent(e));
    } catch (err) {
      warnings.push(
        `第${index + mapping.header + 2}行：${(err as Error).message}`,
      );
    }
  });
  if (onlyMine && !events.length && !warnings.length)
    warnings.push(
      "没有匹配到你的姓名，未导入其他人的安排。请检查姓名、别名或筛选列。",
    );
  return { events, warnings };
}
export function parseRecognizedText(text: string): {
  events: CalendarEvent[];
  warnings: string[];
} {
  const events: CalendarEvent[] = [];
  const warnings: string[] = [];
  for (const line of text
    .split(/[\n；;]/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    try {
      const { event, issues } = parseSentence(line);
      if (issues.length) warnings.push(`${line}：${issues.join("；")}`);
      else events.push(event);
    } catch (err) {
      warnings.push(`${line}：${(err as Error).message}`);
    }
  }
  return { events, warnings };
}
export function dedupe(events: CalendarEvent[], existing: CalendarEvent[]) {
  const keys = new Set(existing.map((e) => `${e.title}|${e.start}|${e.kind}`));
  return events.filter((e) => {
    const key = `${e.title}|${e.start}|${e.kind}`;
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}
