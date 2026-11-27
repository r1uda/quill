import React, { useContext, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Search,
  Bell,
  MapPin,
  CalendarHeart,
  Clock3,
} from "lucide-react-native";
import {
  Card,
  Label,
  Heading,
  Pills,
  Empty,
  Toggle,
  Field,
  Theme,
  colors,
  text,
  s,
} from "../ui";
import { useStore } from "../state";
import { CalendarEvent, addDays, dateKey, parseLocal } from "../domain/model";
import {
  monthCells,
  onDay,
  lunarLabel,
  weekNames,
  upcoming,
  describeDate,
} from "../domain/calendar";
import { useNotice } from "../feedback";
import { requestReminders } from "../services/notifications";
import { Platform } from "react-native";
import { MonthPicker } from "../components/MonthPicker";
import {
  matchesEventQuery,
  nextOccasion,
  specialDateLabel,
} from "../domain/occasions";
export async function allowReminder(notice: ReturnType<typeof useNotice>) {
  if (Platform.OS === "web") {
    notice("已保存提醒设置；手机通知需在安装版中启用");
    return true;
  }
  try {
    if (await requestReminders()) return true;
    notice("没有获得通知权限，日程仍会显示；可在手机设置中允许通知");
    return false;
  } catch {
    notice("暂时无法开启手机通知，日程仍可正常保存");
    return false;
  }
}
export function EventCard({
  event,
  onOpen,
  date,
}: {
  event: CalendarEvent;
  onOpen: (e: CalendarEvent) => void;
  date?: Date;
}) {
  const { saveEvents } = useStore();
  const t = useContext(Theme);
  const notice = useNotice();
  const color =
    event.kind === "birthday"
      ? "#c39bc5"
      : event.kind === "anniversary"
        ? "#b69bda"
        : t.accent;
  return (
    <View
      style={[
        styles.event,
        { borderLeftColor: color, backgroundColor: t.panel },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        onPress={() => onOpen(event)}
        style={{ flexDirection: "row", flex: 1, gap: 14, alignItems: "center" }}
      >
        <View style={{ width: 43 }}>
          <Label style={{ fontSize: 13, fontWeight: "600" }}>
            {event.allDay ? "全天" : event.start.slice(11, 16)}
          </Label>
          {event.end && (
            <Label muted style={{ fontSize: 10 }}>
              {event.end.slice(11, 16)}
            </Label>
          )}
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <Label style={{ fontWeight: "600", fontSize: 15 }}>
            {event.title}
          </Label>
          {(event.location || event.kind !== "event" || date) && (
            <Label muted style={{ fontSize: 11 }}>
              {event.kind !== "event"
                ? specialDateLabel(event)
                : event.location}
              {date ? `　${dateKey(date)}` : ""}
            </Label>
          )}
        </View>
      </Pressable>
      <Toggle
        label={`${event.title}的提醒`}
        value={event.reminder}
        onChange={async (value) => {
          try {
            if (value && !(await allowReminder(notice))) return;
            await saveEvents([{ ...event, reminder: value }]);
          } catch (e) {
            notice((e as Error).message);
          }
        }}
      />
    </View>
  );
}
export function CalendarScreen({
  onOpen,
  onQuick,
}: {
  onOpen: (e: CalendarEvent) => void;
  onQuick: () => void;
}) {
  const { data } = useStore();
  const t = useContext(Theme);
  const [selected, setSelected] = useState(new Date());
  const [view, setView] = useState(new Date());
  const [monthPicker, setMonthPicker] = useState(false);
  const [mode, setMode] = useState<"month" | "week" | "day">("month");
  const cells = useMemo(
    () =>
      mode === "month"
        ? monthCells(view)
        : Array.from({ length: 7 }, (_, i) =>
            addDays(selected, i - ((selected.getDay() + 6) % 7)),
          ),
    [view, selected, mode],
  );
  const list = onDay(data.events, selected);
  const today = dateKey(new Date());
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={s.page}
    >
      <Heading
        title="quill"
        subtitle={`${data.settings.name ? data.settings.name + "，" : ""}把每一天，慢慢安排好。`}
        action={
          <View style={[styles.smallBrand, { backgroundColor: t.soft }]}>
            <CalendarDays size={20} color={t.accent} />
          </View>
        }
      />
      <View style={styles.monthTitle}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`选择年月，当前${view.getFullYear()}年${view.getMonth() + 1}月`}
          onPress={() => setMonthPicker(true)}
          style={{ paddingVertical: 8, paddingRight: 8 }}
        >
          <Text
            style={[text, { fontSize: 25, fontWeight: "700", marginTop: 5 }]}
          >
            {view.getFullYear()}
            <Text style={{ fontSize: 17, fontWeight: "400" }}> 年 </Text>
            {view.getMonth() + 1}
            <Text style={{ fontSize: 17, fontWeight: "400" }}> 月⌄</Text>
          </Text>
        </Pressable>
        <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
          <Pressable
            accessibilityLabel="上一个月"
            onPress={() => {
              const v = new Date(view.getFullYear(), view.getMonth() - 1, 1);
              setView(v);
              if (mode !== "month") setSelected(v);
            }}
          >
            <ChevronLeft size={20} color="#929ab0" />
          </Pressable>
          <Pressable
            accessibilityLabel="回到今天"
            onPress={() => {
              setSelected(new Date());
              setView(new Date());
            }}
          >
            <Label style={{ color: t.accent, fontSize: 12 }}>今天</Label>
          </Pressable>
          <Pressable
            accessibilityLabel="下一个月"
            onPress={() => {
              const v = new Date(view.getFullYear(), view.getMonth() + 1, 1);
              setView(v);
              if (mode !== "month") setSelected(v);
            }}
          >
            <ChevronRight size={20} color="#929ab0" />
          </Pressable>
        </View>
      </View>
      <Pills
        items={[
          { key: "month", label: "月历" },
          { key: "week", label: "周视图" },
          { key: "day", label: "日视图" },
        ]}
        value={mode}
        onChange={setMode}
      />
      {mode !== "day" && (
        <Card style={{ padding: 12, paddingTop: 18, gap: 4 }}>
          <View style={styles.grid}>
            {["一", "二", "三", "四", "五", "六", "日"].map((day, i) => (
              <View key={day} style={[styles.cell, { minHeight: 28 }]}>
                <Label
                  muted
                  style={{ fontSize: 11, color: i > 4 ? "#b5a6cc" : "#9aa1b6" }}
                >
                  {day}
                </Label>
              </View>
            ))}
          </View>
          <View style={styles.grid}>
            {cells.map((d) => {
              const key = dateKey(d);
              const active = dateKey(selected) === key;
              const count = onDay(data.events, d).length;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={`${key}${count ? "有" + count + "项安排" : ""}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    setSelected(d);
                    if (mode === "month")
                      setView(new Date(d.getFullYear(), d.getMonth(), 1));
                  }}
                  style={styles.cell}
                >
                  <View
                    style={[
                      styles.dayCircle,
                      active && { backgroundColor: t.accent },
                    ]}
                  >
                    <Label
                      style={{
                        fontSize: 14,
                        color: active
                          ? "white"
                          : d.getMonth() !== view.getMonth()
                            ? "#c9cdd9"
                            : key === today
                              ? t.accent
                              : colors.ink,
                        fontWeight: active || key === today ? "700" : "400",
                      }}
                    >
                      {d.getDate()}
                    </Label>
                  </View>
                  <Label
                    style={{
                      fontSize: 8,
                      lineHeight: 14,
                      color: active ? t.accent : "#b2b8c9",
                    }}
                  >
                    {lunarLabel(d).replace(/.*月/, "")}
                  </Label>
                  <View style={{ height: 5, flexDirection: "row", gap: 3 }}>
                    {count > 0 && (
                      <View
                        style={{
                          width: 3,
                          height: 3,
                          backgroundColor: t.accent,
                          borderRadius: 2,
                        }}
                      />
                    )}
                    {count > 1 && (
                      <View
                        style={{
                          width: 3,
                          height: 3,
                          backgroundColor: "#c7aad9",
                          borderRadius: 2,
                        }}
                      />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Card>
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 5,
        }}
      >
        <View>
          <Label style={{ fontSize: 17, fontWeight: "600" }}>
            {selected.getMonth() + 1}月{selected.getDate()}日{" "}
            <Label muted style={{ fontSize: 12 }}>
              周{weekNames[selected.getDay()]}
            </Label>
          </Label>
          <Label muted style={{ fontSize: 10, marginTop: 3 }}>
            农历{lunarLabel(selected)}
          </Label>
        </View>
        <Label muted style={{ fontSize: 11 }}>
          {list.length} 项安排
        </Label>
      </View>
      <View style={{ gap: 10 }}>
        {list.map((e) => (
          <EventCard key={e.id} event={e} onOpen={onOpen} date={selected} />
        ))}
        {!list.length && (
          <Card>
            <Empty icon={<CalendarDays size={29} color="#cbd3eb" />} />
            <ButtonLink onPress={onQuick} />
          </Card>
        )}
      </View>
      <Label muted style={{ fontSize: 10, textAlign: "center", marginTop: 8 }}>
        日程会一直显示，提醒可以随时开关。
      </Label>
      {monthPicker && (
        <MonthPicker
          value={view}
          onClose={() => setMonthPicker(false)}
          onSelect={(year, month) => {
            const day = Math.min(
              selected.getDate(),
              new Date(year, month + 1, 0).getDate(),
            );
            const date = new Date(year, month, day);
            setView(date);
            setSelected(date);
            setMonthPicker(false);
          }}
        />
      )}
    </ScrollView>
  );
}
function ButtonLink({ onPress }: { onPress: () => void }) {
  const t = useContext(Theme);
  return (
    <Pressable onPress={onPress} style={{ alignItems: "center", padding: 8 }}>
      <Label style={{ color: t.accent, fontSize: 12 }}>＋ 快速记一件事</Label>
    </Pressable>
  );
}
export function AgendaScreen({
  onOpen,
}: {
  onOpen: (e: CalendarEvent) => void;
}) {
  const { data } = useStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"today" | "week" | "all">("week");
  const [section, setSection] = useState<"schedule" | "occasions">("schedule");
  const catalog = section === "occasions" || !!query.trim();
  const matches = useMemo(
    () =>
      data.events
        .filter(
          (e) =>
            (section !== "occasions" || e.kind !== "event") &&
            matchesEventQuery(e, query),
        )
        .map((event) => ({
          event,
          next: event.kind !== "event" ? nextOccasion(event) : undefined,
        }))
        .sort(
          (a, b) =>
            (a.next?.getTime() ?? parseLocal(a.event.start).getTime()) -
            (b.next?.getTime() ?? parseLocal(b.event.start).getTime()),
        ),
    [data.events, query, section],
  );
  const rows = useMemo(
    () =>
      upcoming(
        data.events,
        new Date(),
        filter === "today" ? 1 : filter === "week" ? 7 : 366,
      )
        .filter((x) => matchesEventQuery(x.event, query))
        .slice(0, 300),
    [data.events, query, filter],
  );
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = dateKey(row.date);
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  return (
    <ScrollView
      contentContainerStyle={s.page}
      showsVerticalScrollIndicator={false}
    >
      <Heading title="日程" subtitle="让眼前的事情，清清楚楚。" />
      <Field
        placeholder="搜索姓名、生日、纪念日或日程"
        accessibilityLabel="搜索日程"
        value={query}
        onChangeText={setQuery}
      />
      <Pills
        value={section}
        onChange={setSection}
        items={[
          { key: "schedule", label: "日程安排" },
          { key: "occasions", label: "生日与纪念日" },
        ]}
      />
      {catalog ? (
        <>
          <Label muted style={{ fontSize: 12 }}>
            {section === "occasions"
              ? "每一份重要的日子，都在这里。"
              : "搜索全部已保存记录，不受日期范围限制。"}
          </Label>
          {matches.map(({ event, next }) => (
            <View key={event.id} style={{ gap: 4 }}>
              <EventCard event={event} onOpen={onOpen} />
              <Label muted style={{ fontSize: 12, paddingHorizontal: 14 }}>
                {event.kind !== "event"
                  ? `下次：${next ? dateKey(next) : "按规则暂无日期"}${event.birthYear ? ` · ${event.birthYear}年出生` : ""}`
                  : event.start.replace("T", " ")}
              </Label>
            </View>
          ))}
          {!matches.length && (
            <Empty
              title={query ? "没有找到相关记录" : "还没有生日与纪念日"}
              detail="可以在普通添加中记录，也可以快速输入一句话。"
            />
          )}
        </>
      ) : (
        <>
          <Pills
            value={filter}
            onChange={setFilter}
            items={[
              { key: "today", label: "今天" },
              { key: "week", label: "未来七天" },
              { key: "all", label: "未来一年" },
            ]}
          />
          {[...groups].map(([key, group]) => (
            <View key={key} style={{ gap: 10, marginTop: 8 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Label style={{ fontWeight: "600" }}>{describeDate(key)}</Label>
                <Label muted style={{ fontSize: 11 }}>
                  {group.length} 项
                </Label>
              </View>
              {group.map((x) => (
                <EventCard
                  key={x.event.id + key}
                  event={x.event}
                  onOpen={onOpen}
                  date={x.date}
                />
              ))}
            </View>
          ))}
          {!rows.length && (
            <Empty
              title={query ? "没有找到相关日程" : "这段时间还没有安排"}
              detail={query ? "试试换一个关键词。" : "先记一件想完成的小事吧。"}
            />
          )}
        </>
      )}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  smallBrand: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  monthTitle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: "14.285714%",
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCircle: {
    height: 30,
    width: 30,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  event: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ecf0f8",
    backgroundColor: "rgba(255,255,255,.94)",
    borderLeftWidth: 3,
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 13,
    gap: 4,
  },
});
