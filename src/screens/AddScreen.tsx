import React, { useContext, useEffect, useState, useRef } from "react";
import {
  View,
  Pressable,
  ScrollView,
  Platform,
  Text,
  Image,
  ActivityIndicator,
} from "react-native";
import {
  FileSpreadsheet,
  ImagePlus,
  FileImage,
  ChevronRight,
  Check,
  Plus,
  CalendarDays,
} from "lucide-react-native";
import {
  Card,
  Label,
  Field,
  Button,
  Heading,
  Pills,
  Toggle,
  Row,
  Sheet,
  CheckBox,
  Empty,
  Theme,
  colors,
  s,
} from "../ui";
import { useStore } from "../state";
import {
  CalendarEvent,
  newEvent,
  validateEvent,
  dateKey,
  parseLocal,
  pad,
  Settings,
} from "../domain/model";
import { lunarToday, monthCells } from "../domain/calendar";
import { useNotice } from "../feedback";
import { allowReminder } from "./CalendarScreen";
import {
  pickDocument,
  pickImage,
  readBytes,
  imageDataURL,
} from "../services/files";
import { useDrafts } from "../drafts";
import { DraftNotice } from "../components/DraftNotice";
import { MonthPicker } from "../components/MonthPicker";
import { normalizeOccasion } from "../domain/occasions";
import { recognizeImage } from "../services/ocr";
import { recognizeAI } from "../services/ai";
import {
  ImportTable,
  Mapping,
  readWorkbook,
  detectMapping,
  parseTable,
  parseRecognizedText,
  dedupe,
} from "../domain/imports";
export function DateField({
  value,
  onChange,
  label = "日期",
}: {
  value: string;
  onChange: (s: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(new Date());
  const [chooseMonth, setChooseMonth] = useState(false);
  const t = useContext(Theme);
  return (
    <>
      <Row
        label={label}
        value={value.replace(/-/g, " / ")}
        icon={<CalendarDays size={17} color={t.accent} />}
        onPress={() => {
          try {
            setView(parseLocal(value));
          } catch {}
          setOpen(true);
        }}
      />
      <Sheet
        title="选择日期"
        visible={open && !chooseMonth}
        onClose={() => setOpen(false)}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Pressable
            onPress={() =>
              setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))
            }
          >
            <Label>‹ 上月</Label>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="选择日期的年月"
            onPress={() => setChooseMonth(true)}
          >
            <Label style={{ fontWeight: "600" }}>
              {view.getFullYear()}年{view.getMonth() + 1}月
            </Label>
          </Pressable>
          <Pressable
            onPress={() =>
              setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))
            }
          >
            <Label>下月 ›</Label>
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {["一", "二", "三", "四", "五", "六", "日"].map((w) => (
            <View
              key={w}
              style={{ width: "14.285%", alignItems: "center", padding: 8 }}
            >
              <Label muted>{w}</Label>
            </View>
          ))}
          {monthCells(view).map((d) => (
            <Pressable
              key={dateKey(d)}
              onPress={() => {
                onChange(dateKey(d));
                setOpen(false);
              }}
              style={{
                width: "14.285%",
                paddingVertical: 10,
                alignItems: "center",
                backgroundColor: dateKey(d) === value ? t.soft : "transparent",
                borderRadius: 12,
              }}
            >
              <Label muted={d.getMonth() !== view.getMonth()}>
                {d.getDate()}
              </Label>
            </Pressable>
          ))}
        </View>
        <Field
          label="也可直接填写日期（YYYY-MM-DD）"
          value={value}
          onChangeText={onChange}
        />
        <Button
          onPress={() => {
            try {
              parseLocal(value);
              setOpen(false);
            } catch {}
          }}
        >
          确定
        </Button>
      </Sheet>
      {open && chooseMonth && (
        <MonthPicker
          value={view}
          onClose={() => setChooseMonth(false)}
          onSelect={(year, month) => {
            setView(new Date(year, month, 1));
            setChooseMonth(false);
          }}
        />
      )}
    </>
  );
}
export function EventForm({
  initial,
  onSaved,
}: {
  initial?: CalendarEvent;
  onSaved: () => void;
}) {
  const { data, saveEvents } = useStore();
  const notice = useNotice();
  const drafts = useDrafts();
  const draftKey = `manual:${initial?.id || "new"}`;
  const dirty = useRef(!!drafts.get(draftKey));
  const [event, setEvent] = useState<CalendarEvent>(
    drafts.get<CalendarEvent>(draftKey) ||
      initial || {
        ...newEvent(),
        reminder: data.settings.reminders.defaultOn,
        reminderMode: data.settings.reminders.mode || "notification",
        minutesBefore: data.settings.reminders.minutes,
      },
  );
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState(false);
  const patch = (p: Partial<CalendarEvent>) => {
    dirty.current = true;
    setEvent((e) => ({ ...e, ...p }));
  };
  useEffect(() => {
    if (dirty.current) drafts.set(draftKey, event);
  }, [event, draftKey]);
  const save = async () => {
    setSaving(true);
    try {
      const e = validateEvent(normalizeOccasion(event));
      await saveEvents([e]);
      dirty.current = false;
      drafts.remove(draftKey);
      notice(initial ? "修改已保存" : "已添加到日历");
      onSaved();
    } catch (e) {
      notice((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const referenceDate = (value: string) => {
    let lunar = { ...event.lunar!, referenceDate: value };
    let start = event.start;
    try {
      const converted = lunarToday(parseLocal(value));
      lunar = {
        ...lunar,
        month: converted.month,
        day: converted.day,
        leap: converted.leap,
      };
      start = value + "T09:00";
    } catch {}
    patch({ lunar, start });
  };
  return (
    <View style={{ gap: 17 }}>
      <Pills
        value={event.kind}
        items={[
          { key: "event", label: "日程" },
          { key: "birthday", label: "生日" },
          { key: "anniversary", label: "纪念日" },
        ]}
        onChange={(kind) =>
          patch({
            kind,
            lunar: undefined,
            repeat: kind === "event" ? "none" : "yearly",
            allDay: kind !== "event",
          })
        }
      />
      <Field
        label={event.kind === "birthday" ? "谁的生日" : "标题"}
        placeholder={
          event.kind === "birthday" ? "例如：妈妈" : "这一天，有什么安排？"
        }
        value={
          event.kind === "birthday"
            ? event.person || event.title.replace(/的生日$/, "")
            : event.title
        }
        onChangeText={(v) =>
          event.kind === "birthday"
            ? patch({ person: v, title: v ? `${v}的生日` : "" })
            : patch({ title: v })
        }
      />
      {event.kind === "birthday" && (
        <>
          <Pills
            value={event.lunar ? "lunar" : "solar"}
            items={[
              { key: "solar", label: "公历生日" },
              { key: "lunar", label: "农历生日" },
            ]}
            onChange={(v) =>
              patch({ lunar: v === "lunar" ? lunarToday() : undefined })
            }
          />
          {event.lunar && (
            <>
              <Pills
                value={
                  event.lunar.referenceDate !== undefined
                    ? "reference"
                    : "direct"
                }
                items={[
                  { key: "direct", label: "直接填农历" },
                  { key: "reference", label: "按公历日期换算" },
                ]}
                onChange={(mode) =>
                  mode === "direct"
                    ? patch({
                        lunar: { ...event.lunar!, referenceDate: undefined },
                      })
                    : referenceDate(
                        event.lunar!.referenceDate || dateKey(new Date()),
                      )
                }
              />
              <Label muted style={{ fontSize: 11 }}>
                知道农历就直接填；也可选择某次过生日当天的公历日期换算。参考年份与出生年份分开填写。
              </Label>
              {event.lunar.referenceDate !== undefined ? (
                <Card>
                  <DateField
                    label="那次过生日的公历日期"
                    value={event.lunar.referenceDate}
                    onChange={referenceDate}
                  />
                  <Row
                    label="换算的农历生日"
                    value={`${event.lunar.leap ? "闰" : ""}${event.lunar.month}月${event.lunar.day}日`}
                  />
                </Card>
              ) : (
                <>
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="农历月（1—12）"
                        keyboardType="number-pad"
                        value={String(event.lunar.month)}
                        onChangeText={(v) =>
                          patch({
                            lunar: { ...event.lunar!, month: Number(v) },
                          })
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="农历日（1—30）"
                        keyboardType="number-pad"
                        value={String(event.lunar.day)}
                        onChangeText={(v) =>
                          patch({ lunar: { ...event.lunar!, day: Number(v) } })
                        }
                      />
                    </View>
                  </View>
                  <Row label="闰月生日">
                    <Toggle
                      value={event.lunar.leap}
                      onChange={(v) =>
                        patch({ lunar: { ...event.lunar!, leap: v } })
                      }
                    />
                  </Row>
                </>
              )}
              <Row
                label="特殊日期规则"
                value="闰月、小月"
                onPress={() => setRules(true)}
              />
            </>
          )}
          <Field
            label="出生年份（选填）"
            placeholder="例如：1975，不知道也可不填"
            keyboardType="number-pad"
            value={String(event.birthYear ?? event.lunar?.birthYear ?? "")}
            onChangeText={(v) =>
              patch({
                birthYear: v ? +v : undefined,
                ...(event.lunar
                  ? { lunar: { ...event.lunar, birthYear: v ? +v : undefined } }
                  : {}),
              })
            }
          />
        </>
      )}
      {!event.lunar && (
        <Card>
          <DateField
            value={event.start.slice(0, 10)}
            onChange={(v) =>
              patch({ start: v + "T" + event.start.slice(11, 16) })
            }
            label={event.kind === "event" ? "开始日期" : "日期"}
          />
          {event.kind === "event" && (
            <>
              <Row label="全天">
                <Toggle
                  value={event.allDay}
                  onChange={(v) => patch({ allDay: v })}
                />
              </Row>
              {!event.allDay && (
                <Field
                  label="开始时间"
                  placeholder="09:00"
                  value={event.start.slice(11, 16)}
                  onChangeText={(v) =>
                    patch({ start: event.start.slice(0, 10) + "T" + v })
                  }
                />
              )}
              <Row label="设置结束时间">
                <Toggle
                  value={!!event.end}
                  onChange={(v) => patch({ end: v ? event.start : undefined })}
                />
              </Row>
              {event.end && (
                <>
                  <DateField
                    label="结束日期"
                    value={event.end.slice(0, 10)}
                    onChange={(v) =>
                      patch({
                        end: v + "T" + (event.end?.slice(11, 16) || "10:00"),
                      })
                    }
                  />
                  {!event.allDay && (
                    <Field
                      label="结束时间"
                      value={event.end.slice(11, 16)}
                      onChangeText={(v) =>
                        patch({ end: event.end!.slice(0, 10) + "T" + v })
                      }
                    />
                  )}
                </>
              )}
            </>
          )}
        </Card>
      )}
      {event.kind === "event" && (
        <Field
          label="地点（选填）"
          value={event.location}
          placeholder="在哪里？"
          onChangeText={(location) => patch({ location })}
        />
      )}
      {event.kind !== "event" ? (
        <Card>
          <Row label="重复" value={event.lunar ? "每年农历生日" : "每年"} />
        </Card>
      ) : (
        <View style={{ gap: 8 }}>
          <Label style={{ fontSize: 13, fontWeight: "600" }}>重复</Label>
          <Pills
            value={event.repeat}
            onChange={(repeat) => patch({ repeat })}
            items={[
              { key: "none", label: "不重复" },
              { key: "daily", label: "每天" },
              { key: "weekly", label: "每周" },
              { key: "yearly", label: "每年" },
            ]}
          />
        </View>
      )}
      <Card>
        <Row label="提醒" value={event.reminder ? "开启" : "关闭"}>
          <Toggle
            value={event.reminder}
            onChange={async (v) => {
              try {
                if (v && !(await allowReminder(notice))) return;
                patch({ reminder: v });
              } catch (e) {
                notice((e as Error).message);
              }
            }}
          />
        </Row>
        {event.reminder && (
          <Pills
            value={event.reminderMode || "notification"}
            onChange={(reminderMode) => patch({ reminderMode })}
            items={
              Platform.OS === "ios"
                ? [{ key: "notification", label: "消息通知" }]
                : [
                    { key: "notification", label: "消息通知" },
                    { key: "alarm", label: "闹铃" },
                  ]
            }
          />
        )}
        {event.reminder && (
          <Field
            label="提前几分钟"
            keyboardType="number-pad"
            value={String(event.minutesBefore)}
            onChangeText={(v) => patch({ minutesBefore: +v })}
          />
        )}
      </Card>
      <Field
        label="备注（选填）"
        multiline
        value={event.notes}
        placeholder="想补充的事，写在这里。"
        onChangeText={(notes) => patch({ notes })}
      />
      <Button disabled={saving} onPress={save}>
        {saving
          ? "正在保存…"
          : initial
            ? "保存修改"
            : event.kind === "birthday"
              ? "保存生日"
              : event.kind === "anniversary"
                ? "保存纪念日"
                : "保存日程"}
      </Button>
      <Sheet
        visible={rules}
        onClose={() => setRules(false)}
        title="特殊日期规则"
      >
        {event.lunar && (
          <>
            <Label>当年没有对应闰月时</Label>
            <Pills
              value={event.lunar.noLeap}
              onChange={(v) => patch({ lunar: { ...event.lunar!, noLeap: v } })}
              items={[
                { key: "regular", label: "在同名普通月记录" },
                { key: "skip", label: "当年跳过" },
              ]}
            />
            <Label>三十遇到小月时</Label>
            <Pills
              value={event.lunar.shortMonth}
              onChange={(v) =>
                patch({ lunar: { ...event.lunar!, shortMonth: v } })
              }
              items={[
                { key: "last", label: "在当月最后一天记录" },
                { key: "skip", label: "当年跳过" },
              ]}
            />
            <Button onPress={() => setRules(false)}>确定</Button>
          </>
        )}
      </Sheet>
    </View>
  );
}
type AddMode = "manual" | "image" | "excel";
interface ImportDraft {
  file: { name: string; uri: string; data?: string } | null;
  instruction: string;
  recognized: string;
  tables: ImportTable[];
  sheet: number;
  mapping: Mapping;
  onlyMine: boolean;
  items: CalendarEvent[];
  checked: string[];
  warnings: string[];
  remind: boolean;
  reminderMode?: "notification" | "alarm";
  engine: "local" | "ai";
}
const emptyMapping: Mapping = {
  header: 0,
  title: -1,
  date: -1,
  time: -1,
  name: -1,
  end: -1,
};
const restoredFile = (file: ImportDraft["file"]) =>
  file
    ? { ...file, uri: file.data?.startsWith("data:") ? file.data : file.uri }
    : null;
export function AddScreen({
  initial,
  onSaved,
  onAI,
}: {
  initial?: CalendarEvent;
  onSaved: () => void;
  onAI: () => void;
}) {
  const { data, saveEvents } = useStore();
  const notice = useNotice();
  const t = useContext(Theme);
  const drafts = useDrafts();
  const [initialMode] = useState<AddMode>(() =>
    initial ? "manual" : drafts.get<AddMode>("add-mode") || "manual",
  );
  const restored = useRef(
    drafts.get<ImportDraft>(`import:${initialMode}`),
  ).current;
  const [mode, setMode] = useState<AddMode>(initialMode);
  const [file, setFile] = useState<{
    name: string;
    uri: string;
    data?: string;
    bytes?: ArrayBuffer;
  } | null>(restoredFile(restored?.file || null));
  const [instruction, setInstruction] = useState(restored?.instruction || "");
  const [recognized, setRecognized] = useState(restored?.recognized || "");
  const [tables, setTables] = useState<ImportTable[]>(restored?.tables || []);
  const [sheet, setSheet] = useState(restored?.sheet || 0);
  const [mapping, setMapping] = useState<Mapping>(
    restored?.mapping || emptyMapping,
  );
  const [onlyMine, setOnlyMine] = useState(restored?.onlyMine || false);
  const [mapOpen, setMapOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<CalendarEvent[]>(restored?.items || []);
  const [checked, setChecked] = useState<Set<string>>(
    new Set(restored?.checked || []),
  );
  const [warnings, setWarnings] = useState<string[]>(restored?.warnings || []);
  const [remind, setRemind] = useState(restored?.remind || false);
  const [reminderMode, setReminderMode] = useState<"notification" | "alarm">(
    restored?.reminderMode || data.settings.reminders.mode || "notification",
  );
  const [engine, setEngine] = useState<"local" | "ai">(
    restored?.engine || "local",
  );
  const needsAI = !!instruction.trim() || engine === "ai";
  const noAI = needsAI && !data.settings.ai.enabled;
  const sourceRevision = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const preservePreview = useRef(true);
  useEffect(() => {
    drafts.set("add-mode", mode);
    if (
      mode !== "manual" &&
      (file || instruction || recognized || items.length)
    )
      drafts.set(`import:${mode}`, {
        file: file ? { name: file.name, uri: file.uri, data: file.data } : null,
        instruction,
        recognized,
        tables,
        sheet,
        mapping,
        onlyMine,
        items,
        checked: [...checked],
        warnings,
        remind,
        reminderMode,
        engine,
      } satisfies ImportDraft);
  }, [
    mode,
    file,
    instruction,
    recognized,
    tables,
    sheet,
    mapping,
    onlyMine,
    items,
    checked,
    warnings,
    remind,
    reminderMode,
    engine,
  ]);
  useEffect(() => {
    sourceRevision.current++;
    activeRequest.current?.abort();
    setBusy(false);
    if (preservePreview.current) {
      preservePreview.current = false;
      return;
    }
    setItems([]);
    setWarnings([]);
  }, [instruction, mapping, onlyMine, sheet, engine, file, mode]);
  useEffect(
    () => () => {
      sourceRevision.current++;
      activeRequest.current?.abort();
    },
    [],
  );
  const switchMode = (v: typeof mode) => {
    const saved = drafts.get<ImportDraft>(`import:${v}`);
    preservePreview.current = true;
    setMode(v);
    setFile(restoredFile(saved?.file || null));
    setItems(saved?.items || []);
    setChecked(new Set(saved?.checked || []));
    setWarnings(saved?.warnings || []);
    setRecognized(saved?.recognized || "");
    setTables(saved?.tables || []);
    setInstruction(saved?.instruction || "");
    setSheet(saved?.sheet || 0);
    setMapping(saved?.mapping || emptyMapping);
    setOnlyMine(saved?.onlyMine || false);
    setRemind(saved?.remind || false);
    setReminderMode(
      saved?.reminderMode || data.settings.reminders.mode || "notification",
    );
    setEngine(saved?.engine || "local");
  };
  const choose = async () => {
    if (busy) return;
    try {
      if (mode === "image") {
        const image = await pickImage();
        if (image) {
          setFile(image);
          setItems([]);
          setWarnings([]);
          setRecognized("");
        }
      } else {
        const f = await pickDocument();
        if (!f) return;
        if ((f.size || 0) > 20 * 1024 * 1024)
          throw new Error("表格请控制在20MB以内");
        const bytes = await readBytes(f);
        const parsed = readWorkbook(bytes);
        if (!parsed.length) throw new Error("没有读取到工作表");
        setFile({ name: f.name, uri: f.uri, bytes });
        setTables(parsed);
        setSheet(0);
        setMapping(detectMapping(parsed[0].rows));
        setItems([]);
        setOnlyMine(
          !!data.settings.name.trim() &&
            detectMapping(parsed[0].rows).name >= 0,
        );
      }
    } catch (e) {
      notice((e as Error).message);
    }
  };
  const recognize = async () => {
    if (!file) return;
    if (noAI) {
      notice("使用补充要求需要先配置并启用AI");
      return;
    }
    setBusy(true);
    const revision = sourceRevision.current;
    const request = new AbortController();
    activeRequest.current = request;
    setItems([]);
    setWarnings([]);
    try {
      let result: { events: CalendarEvent[]; warnings: string[] };
      if (needsAI) {
        const r = await recognizeAI(
          data.settings.ai,
          {
            text:
              mode === "excel"
                ? JSON.stringify({
                    工作表: tables[sheet].name,
                    行: tables[sheet].rows,
                  })
                : recognized,
            instruction,
            name:
              onlyMine || /我的|本人|自己/.test(instruction)
                ? data.settings.name
                : "",
            aliases: data.settings.aliases,
            image:
              mode === "image"
                ? file.data?.startsWith("data:")
                  ? file.data
                  : await imageDataURL(file.uri)
                : undefined,
          },
          request.signal,
        );
        result = { events: r.events, warnings: r.questions };
      } else if (mode === "excel")
        result = parseTable(tables[sheet], mapping, data.settings, onlyMine);
      else {
        const content = recognized || (await recognizeImage(file.uri));
        if (revision !== sourceRevision.current) return;
        setRecognized(content);
        result = parseRecognizedText(content);
      }
      if (revision !== sourceRevision.current) return;
      setWarnings(result.warnings);
      setItems(result.events);
      setChecked(new Set(result.events.map((x) => x.id)));
      if (!result.events.length && !result.warnings.length)
        notice("没有识别到日程，可在下方补充或修改识别文字");
    } catch (e) {
      if (revision === sourceRevision.current) notice((e as Error).message);
    } finally {
      if (revision === sourceRevision.current) {
        setBusy(false);
        activeRequest.current = null;
      }
    }
  };
  const importSelected = async () => {
    if (noAI) return;
    setBusy(true);
    try {
      const selected = items
        .filter((e) => checked.has(e.id))
        .map((e) =>
          validateEvent({
            ...e,
            reminder: remind,
            reminderMode,
            minutesBefore: data.settings.reminders.minutes,
          }),
        );
      if (!selected.length) throw new Error("先选择需要添加的项目");
      const unique = dedupe(selected, data.events);
      if (!unique.length) throw new Error("这些日程已经存在，没有重复添加");
      await saveEvents(unique);
      drafts.remove(`import:${mode}`);
      notice(
        `已添加${unique.length}项${unique.length < selected.length ? "，重复条目已跳过" : ""}`,
      );
      onSaved();
    } catch (e) {
      notice((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={s.page}
    >
      <Heading
        title={initial ? "编辑日程" : "普通添加"}
        subtitle="仔细写下，也可以交给图片和表格。"
      />
      <Pills
        value={mode}
        onChange={switchMode}
        items={[
          { key: "manual", label: "详细填写" },
          { key: "image", label: "图片" },
          { key: "excel", label: "Excel" },
        ]}
      />
      <DraftNotice />
      {mode === "manual" ? (
        <EventForm
          key={initial?.id || "new"}
          initial={initial}
          onSaved={onSaved}
        />
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={choose}
            disabled={busy}
          >
            <Card
              style={{
                alignItems: "center",
                padding: 25,
                borderStyle: "dashed",
                gap: 12,
              }}
            >
              {mode === "image" && file ? (
                <Image
                  source={{ uri: file.data || file.uri }}
                  style={{ width: 90, height: 70, borderRadius: 10 }}
                />
              ) : mode === "image" ? (
                <ImagePlus size={30} color={t.accent} />
              ) : (
                <FileSpreadsheet size={30} color={t.accent} />
              )}
              <Label style={{ fontWeight: "600" }}>
                {file?.name ||
                  (mode === "image"
                    ? "选择一张日程图片"
                    : "选择 Excel 或 CSV 表格")}
              </Label>
              <Label muted style={{ fontSize: 11 }}>
                {file
                  ? "轻点重新选择"
                  : mode === "image"
                    ? "通知、截图、活动安排都可以"
                    : "值班表、安排表、课表，共用这个入口"}
              </Label>
            </Card>
          </Pressable>
          <Field
            label="补充要求（选填）"
            multiline
            value={instruction}
            onChangeText={setInstruction}
            placeholder="例如：只导入我的安排，忽略已取消事项"
          />
          <Label muted style={{ fontSize: 11 }}>
            留空可用基础识别；填写补充要求需连接 AI。
          </Label>
          {noAI && (
            <Card
              style={{ backgroundColor: "#fff8ee", borderColor: "#f3e8d3" }}
            >
              <Row label="使用补充要求需要配置 AI" onPress={onAI} />
              <Pressable
                onPress={() => {
                  setInstruction("");
                  setEngine("local");
                }}
              >
                <Label style={{ color: t.accent, fontSize: 12 }}>
                  清空补充，使用基础识别
                </Label>
              </Pressable>
            </Card>
          )}
          <Pills
            value={engine}
            onChange={setEngine}
            items={[
              { key: "local", label: "本机基础识别" },
              { key: "ai", label: "使用 AI 识别" },
            ]}
          />
          {mode === "excel" && tables.length > 0 && (
            <Card>
              <Label style={{ fontWeight: "600" }}>工作表</Label>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {tables.map((table, i) => (
                  <Pressable
                    key={i}
                    onPress={() => {
                      setSheet(i);
                      setMapping(detectMapping(table.rows));
                      setOnlyMine(
                        !!data.settings.name.trim() &&
                          detectMapping(table.rows).name >= 0,
                      );
                    }}
                    style={{
                      padding: 8,
                      borderRadius: 9,
                      backgroundColor: i === sheet ? t.soft : "#f7f8fc",
                    }}
                  >
                    <Label
                      style={{
                        fontSize: 12,
                        color: i === sheet ? t.accent : colors.muted,
                      }}
                    >
                      {table.name}
                    </Label>
                  </Pressable>
                ))}
              </View>
              <Row
                label="表格列对应"
                value="查看 / 修改"
                onPress={() => setMapOpen(true)}
              />
              <Row
                label="只导入我的安排"
                value={data.settings.name || "请先填写姓名"}
              >
                <Toggle
                  label="只导入我的安排"
                  value={onlyMine}
                  onChange={setOnlyMine}
                />
              </Row>
              {onlyMine && (
                <Label muted style={{ fontSize: 11 }}>
                  按姓名“{data.settings.name}”与别名匹配，找不到时会提示。
                </Label>
              )}
            </Card>
          )}
          {mode === "image" && recognized !== "" && (
            <Field
              label="识别文字（可修改后重新识别）"
              multiline
              value={recognized}
              onChangeText={(v) => {
                setRecognized(v);
                setItems([]);
              }}
            />
          )}
          <Button disabled={!file || busy || noAI} onPress={recognize}>
            {busy
              ? "正在识别，请稍等…"
              : needsAI
                ? "按补充要求使用 AI 识别"
                : "开始基础识别"}
          </Button>
          {busy && <ActivityIndicator color={t.accent} />}
          {warnings.length > 0 && (
            <Card style={{ backgroundColor: "#fffaf0" }}>
              <Label style={{ fontWeight: "600" }}>需要你看一下</Label>
              {warnings.slice(0, 20).map((w, i) => (
                <Label key={i} style={{ fontSize: 12, color: "#a88d59" }}>
                  {w}
                </Label>
              ))}
              {warnings.length > 20 && (
                <Label muted>另有{warnings.length - 20}条提示。</Label>
              )}
            </Card>
          )}
          {items.length > 0 && (
            <>
              <Label style={{ fontWeight: "600" }}>
                识别预览 · 已选 {checked.size} 项
              </Label>
              {items.map((e, index) => (
                <Card key={e.id}>
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <CheckBox
                      checked={checked.has(e.id)}
                      onPress={() =>
                        setChecked((prev) => {
                          const next = new Set(prev);
                          next.has(e.id) ? next.delete(e.id) : next.add(e.id);
                          return next;
                        })
                      }
                    />
                    <View style={{ flex: 1, gap: 9 }}>
                      <Field
                        accessibilityLabel={`第${index + 1}项标题`}
                        value={e.title}
                        onChangeText={(title) =>
                          setItems((prev) =>
                            prev.map((x) =>
                              x.id === e.id ? { ...x, title } : x,
                            ),
                          )
                        }
                      />
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <View style={{ flex: 1.5 }}>
                          <Field
                            accessibilityLabel={`第${index + 1}项日期`}
                            value={e.start.slice(0, 10)}
                            onChangeText={(v) =>
                              setItems((p) =>
                                p.map((x) =>
                                  x.id === e.id
                                    ? {
                                        ...x,
                                        start: v + "T" + x.start.slice(11, 16),
                                      }
                                    : x,
                                ),
                              )
                            }
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Field
                            accessibilityLabel={`第${index + 1}项时间`}
                            value={e.start.slice(11, 16)}
                            onChangeText={(v) =>
                              setItems((p) =>
                                p.map((x) =>
                                  x.id === e.id
                                    ? {
                                        ...x,
                                        start: x.start.slice(0, 10) + "T" + v,
                                      }
                                    : x,
                                ),
                              )
                            }
                          />
                        </View>
                      </View>
                    </View>
                  </View>
                </Card>
              ))}
              <Card>
                <Row label="导入后开启提醒" value={remind ? "开启" : "关闭"}>
                  <Toggle
                    value={remind}
                    onChange={async (v) => {
                      try {
                        if (v && !(await allowReminder(notice))) return;
                        setRemind(v);
                      } catch (e) {
                        notice((e as Error).message);
                      }
                    }}
                  />
                </Row>
                {remind && (
                  <Pills
                    value={reminderMode}
                    onChange={setReminderMode}
                    items={
                      Platform.OS === "ios"
                        ? [{ key: "notification", label: "消息通知" }]
                        : [
                            { key: "notification", label: "消息通知" },
                            { key: "alarm", label: "闹铃" },
                          ]
                    }
                  />
                )}
              </Card>
              <Button
                disabled={busy || !checked.size || noAI}
                onPress={importSelected}
              >
                添加 {checked.size} 项到日历
              </Button>
            </>
          )}
          <Sheet
            title="表格列对应"
            visible={mapOpen}
            onClose={() => setMapOpen(false)}
          >
            <Label muted style={{ fontSize: 12 }}>
              选择每项信息来自哪一列。基础识别适用于“一行一个日期与事项”的表格。
            </Label>
            {Object.entries({
              title: "标题列",
              date: "日期列",
              time: "时间列",
              name: "姓名列",
              end: "结束时间列",
            }).map(([key, label]) => (
              <View key={key} style={{ gap: 8 }}>
                <Label>{label}</Label>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
                >
                  {[
                    -1,
                    ...(tables[sheet]?.rows[mapping.header] || []).map(
                      (_, i) => i,
                    ),
                  ].map((i) => (
                    <Pressable
                      key={i}
                      onPress={() => setMapping((p) => ({ ...p, [key]: i }))}
                      style={{
                        padding: 8,
                        borderRadius: 8,
                        backgroundColor:
                          mapping[key as keyof Mapping] === i
                            ? t.soft
                            : "#f6f7fa",
                      }}
                    >
                      <Label style={{ fontSize: 11 }}>
                        {i < 0
                          ? "不使用"
                          : `${i + 1} · ${tables[sheet]?.rows[mapping.header]?.[i] || "无标题"}`}
                      </Label>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
            <Field
              label="标题行编号（从1开始）"
              keyboardType="number-pad"
              value={String(mapping.header + 1)}
              onChangeText={(v) =>
                setMapping((p) => ({ ...p, header: Math.max(0, +v - 1) }))
              }
            />
            <Button onPress={() => setMapOpen(false)}>确定</Button>
          </Sheet>
        </>
      )}
    </ScrollView>
  );
}
