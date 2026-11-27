import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  Platform,
  ActivityIndicator,
  AppState,
  ScrollView,
  KeyboardAvoidingView,
  Linking,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  CalendarDays,
  ListTodo,
  SquarePen,
  UserRound,
  Plus,
  Mic,
  X,
  Bell,
  MapPin,
  Repeat2,
  FileText,
  Clock3,
  Check,
  ArrowUpRight,
  CalendarHeart,
} from "lucide-react-native";
import { Store, useStore } from "./src/state";
import { Feedback, Notice } from "./src/feedback";
import {
  Theme,
  Heading,
  Card,
  Label,
  Button,
  Field,
  Row,
  Toggle,
  Pills,
  Sheet,
  colors,
  text,
  s,
} from "./src/ui";
import {
  CalendarScreen,
  AgendaScreen,
  allowReminder,
} from "./src/screens/CalendarScreen";
import { AddScreen } from "./src/screens/AddScreen";
import {
  SettingsScreen,
  SettingPage,
  confirmAction,
} from "./src/screens/SettingsScreen";
import {
  CalendarEvent,
  newEvent,
  dateKey,
  parseLocal,
  validateEvent,
  defaultSettings,
} from "./src/domain/model";
import { describeDate } from "./src/domain/calendar";
import { parseSentence } from "./src/domain/parse";
import { recognizeAI } from "./src/services/ai";
import {
  startSpeech,
  SpeechSession,
  prepareSpeech,
} from "./src/services/speech";
import { exportText, pickDocument, readBytes } from "./src/services/files";
import { validateBackup } from "./src/services/storage";
import { DraftProvider, useDrafts } from "./src/drafts";
import { DraftNotice } from "./src/components/DraftNotice";
import { voiceChoice, VoiceChoice } from "./src/domain/voiceGesture";
type Tab = "calendar" | "agenda" | "add" | "mine";
const portrait = require("./assets/la-pluma.png");
export default function App() {
  return (
    <SafeAreaProvider>
      <Store>
        <DraftProvider>
          <CalendarApp />
        </DraftProvider>
      </Store>
    </SafeAreaProvider>
  );
}
function CalendarApp() {
  const drafts = useDrafts();
  const { data, ready, error, reload, mutate, saveEvents, notificationError } =
    useStore();
  const [tab, setTab] = useState<Tab>("calendar");
  const [settingsPage, setSettingsPage] = useState<SettingPage>("home");
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [editing, setEditing] = useState<CalendarEvent>();
  const [addKey, setAddKey] = useState(0);
  const [toast, setToast] = useState<{
    text: string;
    action?: { label: string; run: () => void };
  } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const notice: Notice = useCallback((message, action) => {
    setToast({ text: message, action });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(
      () => setToast(null),
      action ? 10000 : 6500,
    );
  }, []);
  const [quick, setQuick] = useState(false);
  const [sentence, setSentence] = useState("");
  const [quickReminder, setQuickReminder] = useState(false);
  const [quickMode, setQuickMode] = useState<"notification" | "alarm">(
    "notification",
  );
  useEffect(() => {
    prepareSpeech();
  }, []);
  const [issues, setIssues] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceStarting, setVoiceStarting] = useState(false);
  const [voiceFinalizing, setVoiceFinalizing] = useState(false);
  const [voiceDirection, setVoiceDirection] = useState<VoiceChoice>("neutral");
  const voiceDirectionRef = useRef<VoiceChoice>("neutral");
  const [voiceEditing, setVoiceEditing] = useState(false);
  const voicePreparing = useRef(false);
  const voiceOperation = useRef(0);
  const voiceRequest = useRef<AbortController | null>(null);
  const ignoreBackdropUntil = useRef(0);
  const voiceGesture = useRef(false);
  const [cancelled, setCancelled] = useState(false);
  const hold = useRef(false);
  const cancelRef = useRef(false);
  const transcript = useRef("");
  const beforeVoice = useRef({ text: "", reminder: false });
  const session = useRef<SpeechSession | null>(null);
  const sessionEnded = useRef(false);
  const submitted = useRef(false);
  const processing = useRef(false);
  const quickOperation = useRef(0);
  const quickRequest = useRef<AbortController | null>(null);
  const downY = useRef(0);
  const downX = useRef(0);
  const longPressed = useRef(false);
  const submitRef = useRef<(raw: string) => Promise<void>>(async () => {});
  const accent =
    data.settings.appearance.accent === "purple" ? "#a08acb" : "#7389d9";
  const soft =
    data.settings.appearance.accent === "purple" ? "#f1edf9" : "#edf2fc";
  const theme = {
    accent,
    soft,
    panel: `rgba(255,255,255,${data.settings.appearance.opacity / 100})`,
  };
  const openQuick = () => {
    setVoiceEditing(false);
    const saved = drafts.get<{
      text: string;
      reminder: boolean;
      mode?: "notification" | "alarm";
    }>("quick");
    setSentence(saved?.text || "");
    setIssues([]);
    setQuickReminder(saved?.reminder ?? data.settings.reminders.defaultOn);
    setQuickMode(saved?.mode || data.settings.reminders.mode || "notification");
    setQuick(true);
    setCancelled(false);
  };
  useEffect(() => {
    if (quick && !listening && !voiceStarting && !voiceFinalizing && !busy)
      drafts.set("quick", {
        text: sentence,
        reminder: quickReminder,
        mode: quickMode,
      });
  }, [
    quick,
    sentence,
    quickReminder,
    quickMode,
    listening,
    voiceStarting,
    voiceFinalizing,
    busy,
  ]);
  const submit = async (raw: string) => {
    if (processing.current) return;
    if (!raw.trim()) {
      setIssues(["还没听清，可以重新长按，或直接输入一句话。"]);
      return;
    }
    processing.current = true;
    const operation = ++quickOperation.current;
    const request = new AbortController();
    quickRequest.current = request;
    setBusy(true);
    setIssues([]);
    try {
      let found: CalendarEvent[] = [];
      const basic = parseSentence(raw);
      if (!basic.issues.length) found = [basic.event];
      else if (data.settings.ai.enabled) {
        const result = await recognizeAI(
          data.settings.ai,
          { text: raw },
          request.signal,
        );
        if (operation !== quickOperation.current) return;
        if (result.questions.length) {
          setIssues(result.questions);
          return;
        }
        found = result.events;
      } else {
        setIssues(basic.issues);
        return;
      }
      if (!found.length) {
        setIssues(["没有识别到日程，请补充具体日期与事项。"]);
        return;
      }
      const events = found.map((e) =>
        validateEvent({
          ...e,
          reminder: quickReminder,
          reminderMode: quickMode,
          minutesBefore: e.reminder
            ? e.minutesBefore
            : data.settings.reminders.minutes,
        }),
      );
      if (events.some((e) => e.reminder) && !(await allowReminder(notice)))
        events.forEach((e) => {
          e.reminder = false;
        });
      if (operation !== quickOperation.current) return;
      await saveEvents(events);
      drafts.remove("quick");
      const ids = new Set(events.map((e) => e.id));
      setQuick(false);
      setSentence("");
      setTab("agenda");
      notice(`已添加${events.length > 1 ? events.length + "项" : "到日历"}`, {
        label: "撤销",
        run: () =>
          mutate((d) => ({
            ...d,
            events: d.events.filter((e) => !ids.has(e.id)),
          }))
            .then(() => notice("已撤销这次添加"))
            .catch((e) => notice(e.message)),
      });
    } catch (e) {
      if (operation === quickOperation.current)
        setIssues([(e as Error).message]);
    } finally {
      if (operation === quickOperation.current) {
        setBusy(false);
        processing.current = false;
        quickRequest.current = null;
      }
    }
  };
  submitRef.current = submit;
  const finishTranscript = () => {
    if (submitted.current || cancelRef.current || hold.current) return;
    submitted.current = true;
    setListening(false);
    setVoiceFinalizing(false);
    if (transcript.current.trim()) {
      setSentence(transcript.current);
      if (voiceDirectionRef.current === "confirm") submitRef.current(transcript.current);
      else setVoiceEditing(true);
    }
  };
  const beginVoice = async () => {
    if (hold.current || voicePreparing.current || listening || voiceFinalizing || busy) return;
    voiceDirectionRef.current = "neutral";
    setVoiceDirection("neutral");
    setVoiceEditing(false);
    setVoiceFinalizing(false);
    const operation = ++voiceOperation.current;
    const request = new AbortController();
    voiceRequest.current = request;
    voicePreparing.current = true;
    setVoiceStarting(true);
    ignoreBackdropUntil.current = Date.now() + 600;
    const saved = drafts.get<{
      text: string;
      reminder: boolean;
      mode?: "notification" | "alarm";
    }>("quick");
    beforeVoice.current = quick
      ? { text: sentence, reminder: quickReminder }
      : {
          text: saved?.text || "",
          reminder: saved?.reminder ?? data.settings.reminders.defaultOn,
        };
    if (!quick) setQuickReminder(beforeVoice.current.reminder);
    if (!quick)
      setQuickMode(
        saved?.mode || data.settings.reminders.mode || "notification",
      );
    longPressed.current = true;
    voiceGesture.current = true;
    hold.current = true;
    cancelRef.current = false;
    submitted.current = false;
    sessionEnded.current = false;
    transcript.current = "";
    setSentence("");
    setQuick(true);
    setIssues([]);
    setCancelled(false);
    setListening(false);
    try {
      const active = await startSpeech(
        (v) => {
          if (operation !== voiceOperation.current || cancelRef.current) return;
          transcript.current = v;
          setSentence(v);
        },
        () => {
          if (operation !== voiceOperation.current) return;
          voicePreparing.current = false;
          setVoiceStarting(false);
          setVoiceFinalizing(false);
          setListening(false);
          sessionEnded.current = true;
          session.current = null;
          if (!cancelRef.current && !transcript.current.trim()) {
            cancelRef.current = true;
            setSentence(beforeVoice.current.text);
            setIssues(["没有听清内容，请重新长按说话；之前输入的内容已保留。"]);
          }
          if (!hold.current) finishTranscript();
        },
        (message) => {
          if (operation !== voiceOperation.current) return;
          cancelRef.current = true;
          voicePreparing.current = false;
          setVoiceStarting(false);
          setVoiceFinalizing(false);
          setListening(false);
          if (!transcript.current.trim()) setSentence(beforeVoice.current.text);
          setIssues([message]);
        },
        {
          signal: request.signal,
          onStart: () => {
            if (operation !== voiceOperation.current || cancelRef.current)
              return;
            voicePreparing.current = false;
            setVoiceStarting(false);
            setListening(true);
          },
        },
      );
      if (operation !== voiceOperation.current || cancelRef.current) {
        active.cancel();
        return;
      }
      if (sessionEnded.current) return;
      session.current = active;
    } catch (e) {
      if (operation !== voiceOperation.current) return;
      hold.current = false;
      cancelRef.current = true;
      voicePreparing.current = false;
      setVoiceStarting(false);
      setListening(false);
      if (!transcript.current.trim()) setSentence(beforeVoice.current.text);
      setIssues([(e as Error).message]);
    }
  };
  const moveVoice = (e: { nativeEvent: { pageX?: number; pageY?: number; changedTouches?: readonly { pageX: number; pageY: number }[] } }) => {
    if (!hold.current) return;
    const point = e.nativeEvent.changedTouches?.[0] || e.nativeEvent;
    if (point.pageX === undefined || point.pageY === undefined) return;
    const next = voiceChoice(point.pageX - downX.current, point.pageY - downY.current);
    voiceDirectionRef.current = next;
    setVoiceDirection(next);
    if (next === "cancel") cancelVoice();
  };
  const releaseVoice = () => {
    if (voiceGesture.current) {
      voiceGesture.current = false;
      ignoreBackdropUntil.current = Date.now() + 450;
    }
    if (!hold.current) return;
    hold.current = false;
    ignoreBackdropUntil.current = Date.now() + 450;
    if (cancelRef.current) {
      session.current?.cancel();
      setListening(false);
      return;
    }
    if (sessionEnded.current) finishTranscript();
    else if (session.current) {
      setListening(false);
      setVoiceFinalizing(true);
      session.current.stop();
    }
    else {
      voiceOperation.current++;
      voiceRequest.current?.abort();
      voicePreparing.current = false;
      setVoiceStarting(false);
      setListening(false);
      setSentence(beforeVoice.current.text);
      setIssues(["麦克风还在准备时已松开，请再长按一次说话。"]);
    }
  };
  const cancelVoice = () => {
    voiceOperation.current++;
    cancelRef.current = true;
    hold.current = false;
    voiceRequest.current?.abort();
    voiceRequest.current = null;
    voicePreparing.current = false;
    setVoiceStarting(false);
    setVoiceFinalizing(false);
    ignoreBackdropUntil.current = Date.now() + 450;
    session.current?.cancel();
    session.current = null;
    setListening(false);
    setCancelled(true);
    setSentence(beforeVoice.current.text);
    setQuickReminder(beforeVoice.current.reminder);
  };
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const release = () => releaseVoice();
    window.addEventListener("pointerup", release);
    window.addEventListener("mouseup", release);
    const cancel = () => {
      if (hold.current) cancelVoice();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && hold.current) cancelVoice();
    };
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("mouseup", release);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", escape);
    };
  }, []);
  useEffect(() => {
    const l = AppState.addEventListener("change", (state) => {
      if (state === "background" && hold.current && !voicePreparing.current)
        cancelVoice();
    });
    return () => {
      l.remove();
      voiceOperation.current++;
      voiceRequest.current?.abort();
      session.current?.cancel();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);
  const closeQuick = () => {
    quickOperation.current++;
    quickRequest.current?.abort();
    quickRequest.current = null;
    processing.current = false;
    setBusy(false);
    if (hold.current || listening || voicePreparing.current || session.current)
      cancelVoice();
    setQuick(false);
  };
  const widgetOpenRef = useRef<(url: string) => void>(() => {});
  widgetOpenRef.current = (url) => {
    if (!url.startsWith("quill://widget/")) return;
    const route = url.slice("quill://widget/".length).split("?")[0];
    if (route === "voice" || route === "quick") { openQuick(); }
    else if (route === "agenda") { setQuick(false); setTab("agenda"); }
    else { setQuick(false); setTab("calendar"); }
  };
  useEffect(() => {
    if (!ready || !drafts.ready) return;
    let active = true;
    Linking.getInitialURL().then(url => { if (active && url) widgetOpenRef.current(url); }).catch(() => {});
    const sub = Linking.addEventListener("url", e => widgetOpenRef.current(e.url));
    return () => { active = false; sub.remove(); };
  }, [ready, drafts.ready]);
  const navigate = (next: Tab) => {
    setTab(next);
    if (next === "mine") setSettingsPage("home");
    if (next === "add") {
      setEditing(undefined);
      setAddKey((k) => k + 1);
    }
  };
  const aiSettings = () => {
    setQuick(false);
    setTab("mine");
    setSettingsPage("ai");
  };
  if (error)
    return (
      <SafeAreaView
        style={{ flex: 1, justifyContent: "center", padding: 25, gap: 18 }}
      >
        <Heading title="需要恢复本机数据" />
        <Label>{error}</Label>
        <Button onPress={reload}>重新读取</Button>
        <Button
          secondary
          onPress={async () => {
            try {
              const f = await pickDocument();
              if (!f) return;
              const backup = validateBackup(
                JSON.parse(new TextDecoder().decode(await readBytes(f))),
              );
              await mutate(() => backup);
              reload();
            } catch (e) {
              notice((e as Error).message);
            }
          }}
        >
          选择备份恢复
        </Button>
        {toast && <Label>{toast.text}</Label>}
      </SafeAreaView>
    );
  if (!ready || !drafts.ready)
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8f9fd",
        }}
      >
        <ActivityIndicator color={accent} />
        <Label muted>正在打开你的日历…</Label>
      </View>
    );
  return (
    <Feedback.Provider value={notice}>
      <Theme.Provider value={theme}>
        <View style={styles.outer} onTouchMove={moveVoice} onPointerMove={moveVoice}>
          <KeyboardAvoidingView
            style={{ flex: 1, width: "100%", maxWidth: 480 }}
            behavior={
              Platform.OS === "ios"
                ? "padding"
                : Platform.OS === "android"
                  ? "height"
                  : undefined
            }
          >
            <SafeAreaView style={styles.app} edges={["top", "bottom"]}>
              <StatusBar style="dark" />
              {!!data.settings.appearance.background && (
                <>
                  <Image
                    source={{ uri: data.settings.appearance.background }}
                    blurRadius={data.settings.appearance.blur}
                    style={StyleSheet.absoluteFill}
                  />
                  <View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        backgroundColor: `rgba(0,0,0,${1 - data.settings.appearance.brightness / 100})`,
                      },
                    ]}
                  />
                </>
              )}
              <View style={{ flex: 1 }}>
                {tab === "calendar" ? (
                  <CalendarScreen onOpen={setSelected} onQuick={openQuick} />
                ) : tab === "agenda" ? (
                  <AgendaScreen onOpen={setSelected} />
                ) : tab === "add" ? (
                  <AddScreen
                    key={addKey}
                    initial={editing}
                    onSaved={() => {
                      setEditing(undefined);
                      setTab("calendar");
                      setAddKey((k) => k + 1);
                    }}
                    onAI={aiSettings}
                  />
                ) : (
                  <SettingsScreen
                    page={settingsPage}
                    setPage={setSettingsPage}
                  />
                )}
              </View>
              {!!notificationError && (
                <Pressable
                  onPress={() => {
                    setTab("mine");
                    setSettingsPage("reminders");
                  }}
                  style={{
                    paddingHorizontal: 18,
                    paddingVertical: 7,
                    backgroundColor: "#fff7ec",
                  }}
                >
                  <Label style={{ fontSize: 10, color: "#b09059" }}>
                    {notificationError}
                  </Label>
                </Pressable>
              )}
              <View style={[styles.nav, { backgroundColor: theme.panel }]}>
                {(
                  [
                    { key: "calendar", label: "月历", icon: CalendarDays },
                    { key: "agenda", label: "日程", icon: ListTodo },
                    { key: "quick", label: "快速添加", icon: Plus },
                    { key: "add", label: "普通添加", icon: SquarePen },
                    { key: "mine", label: "我的", icon: UserRound },
                  ] as const
                ).map((item) => (
                  <Pressable
                    key={item.key}
                    accessibilityRole="button"
                    accessibilityLabel={
                      item.key === "quick"
                        ? "快速添加，轻点输入，长按说话"
                        : item.label
                    }
                    onPressIn={(e) => {
                      if (item.key === "quick") {
                        longPressed.current = false;
                        downY.current = e.nativeEvent.pageY;
                        downX.current = e.nativeEvent.pageX;
                      }
                    }}
                    onLongPress={item.key === "quick" ? beginVoice : undefined}
                    delayLongPress={350}
                    onTouchEnd={item.key === "quick" ? releaseVoice : undefined}
                    onPointerUp={
                      item.key === "quick" ? releaseVoice : undefined
                    }
                    onPointerMove={item.key === "quick" ? moveVoice : undefined}
                    onTouchMove={item.key === "quick" ? moveVoice : undefined}
                    onPress={() =>
                      item.key === "quick"
                        ? longPressed.current
                          ? undefined
                          : openQuick()
                        : navigate(item.key)
                    }
                    style={styles.navItem}
                  >
                    {item.key === "quick" ? (
                      <View
                        style={[styles.avatarCircle, { backgroundColor: soft }]}
                      >
                        <View
                          style={{
                            width: 43,
                            height: 40,
                            overflow: "hidden",
                            borderRadius: 20,
                          }}
                        >
                          <Image source={portrait} style={styles.avatar} />
                        </View>
                        <View
                          style={[
                            styles.plusBadge,
                            { backgroundColor: accent },
                          ]}
                        >
                          <Plus size={11} color="white" strokeWidth={3} />
                        </View>
                      </View>
                    ) : (
                      <item.icon
                        size={22}
                        color={tab === item.key ? accent : "#a3abc1"}
                        strokeWidth={tab === item.key ? 1.9 : 1.6}
                      />
                    )}
                    <Text
                      style={[
                        text,
                        {
                          fontSize: 10,
                          color:
                            tab === item.key || (item.key === "quick" && quick)
                              ? accent
                              : "#a0a8bc",
                          marginTop: item.key === "quick" ? 1 : 8,
                          fontWeight: tab === item.key ? "600" : "400",
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {quick && (
                <View
                  style={[StyleSheet.absoluteFill, { bottom: 86 }]}
                  pointerEvents="box-none"
                  onTouchEnd={releaseVoice}
                  onPointerUp={releaseVoice}
                  onTouchMove={moveVoice}
                  onPointerMove={moveVoice}
                >
                  <Pressable
                    style={[
                      StyleSheet.absoluteFill,
                      { backgroundColor: "rgba(62,70,95,.17)" },
                    ]}
                    accessibilityLabel="收起快速添加"
                    onPress={() => {
                      // The original native long-press release can reach the new backdrop.
                      if (
                        !voiceGesture.current &&
                        !hold.current &&
                        !voicePreparing.current &&
                        !listening &&
                        !voiceFinalizing &&
                        !busy &&
                        Date.now() >= ignoreBackdropUntil.current
                      )
                        closeQuick();
                    }}
                  />
                  <View
                    style={[styles.quickPosition, { maxHeight: "96%" }]}
                    pointerEvents="box-none"
                  >
                    <ScrollView
                      keyboardShouldPersistTaps="handled"
                      automaticallyAdjustKeyboardInsets
                      contentContainerStyle={styles.quickSheet}
                    >
                      <View
                        style={{
                          height: 4,
                          width: 34,
                          borderRadius: 3,
                          backgroundColor: "#e6eaf3",
                          alignSelf: "center",
                          marginBottom: 8,
                        }}
                      />
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Label style={{ fontSize: 19, fontWeight: "700" }}>
                          {voiceStarting
                            ? "正在准备麦克风…"
                            : listening
                              ? "正在听…"
                              : voiceFinalizing ? "正在识别…" : "快速添加"}
                        </Label>
                        <Pressable
                          onPress={closeQuick}
                          accessibilityLabel="关闭快速添加"
                        >
                          <X size={19} color="#acb4c9" />
                        </Pressable>
                      </View>
                      <Label muted style={{ fontSize: 11 }}>
                        {voiceStarting
                          ? Platform.OS === "android"
                            ? "正在准备本机中文识别，首次加载需要几秒，准备好后再说话。"
                            : "首次使用请允许麦克风权限，准备好后再说话。"
                          : listening
                            ? voiceDirection === "confirm" ? "已选确认，松手后识别并添加" : voiceDirection === "edit" ? "已选修改，松手后编辑文字" : "按住时左滑修改 · 右滑确认 · 上滑取消"
                            : voiceFinalizing ? voiceDirection === "confirm" ? "正在完成你已确认的语音，识别后添加，可撤销。" : "正在识别，完成后直接编辑文字。"
                            : "轻点输入一句话，长按直接说话"}
                      </Label>
                      {!listening && !voiceStarting && !voiceFinalizing && <DraftNotice />}
                      {listening && (
                        <View style={styles.wave}>
                          {Array.from({ length: 23 }, (_, i) => (
                            <View
                              key={i}
                              style={{
                                width: 3,
                                height: 9 + Math.sin(i * 1.8) ** 2 * 29,
                                borderRadius: 3,
                                backgroundColor: accent,
                                opacity: 0.3 + Math.sin(i * 0.7) ** 2 * 0.5,
                              }}
                            />
                          ))}
                        </View>
                      )}
                      {(listening || voiceFinalizing) && <View style={{ backgroundColor: soft, borderRadius: 14, padding: 14, minHeight: 62 }}>
                        <Label muted style={{ fontSize: 11, marginBottom: 6 }}>识别内容</Label>
                        <Label style={{ fontSize: 16, lineHeight: 24 }}>{sentence.trim() || "正在识别，请稍候…"}</Label>
                      </View>}
                      {(listening || voiceStarting) && <View style={{ flexDirection: "row", gap: 10, paddingVertical: 18 }}>
                        <View style={{ flex: 1, backgroundColor: voiceDirection === "edit" ? soft : "#f8f9fc", borderRadius: 18, padding: 18 }}><Label style={{ textAlign: "center", color: accent, fontWeight: "700" }}>← 修改文字</Label></View>
                        <View style={{ flex: 1, backgroundColor: voiceDirection === "confirm" ? accent : soft, borderRadius: 18, padding: 18 }}><Label style={{ textAlign: "center", color: voiceDirection === "confirm" ? "white" : accent, fontWeight: "700" }}>确认添加 →</Label></View>
                      </View>}
                      {!listening && !voiceStarting && !voiceFinalizing && <Field
                        key={voiceEditing ? "voice-edit" : "quick-text"}
                        autoFocus={voiceEditing}
                        value={sentence}
                        onChangeText={setSentence}
                        editable={!listening && !voiceStarting && !voiceFinalizing && !busy}
                        multiline
                        placeholder="明天下午三点开会"
                        accessibilityLabel="一句话日程"
                      />}
                      {issues.length > 0 && (
                        <View style={{ gap: 4 }}>
                          {issues.map((issue, i) => (
                            <Label
                              key={i}
                              style={{ color: "#b48e68", fontSize: 12 }}
                            >
                              {issue}
                            </Label>
                          ))}
                          {!data.settings.ai.enabled && (
                            <Pressable onPress={aiSettings}>
                              <Label style={{ color: accent, fontSize: 11 }}>
                                也可以连接 AI 理解更复杂的表达 ›
                              </Label>
                            </Pressable>
                          )}
                        </View>
                      )}
                      <Row label="提醒" value={quickReminder ? "开启" : "关闭"}>
                        <Toggle
                          value={quickReminder}
                          onChange={async (v) => {
                            if (v && !(await allowReminder(notice))) return;
                            setQuickReminder(v);
                          }}
                        />
                      </Row>
                      {quickReminder && (
                        <Pills
                          value={quickMode}
                          onChange={setQuickMode}
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
                      {voiceFinalizing && <ActivityIndicator color={accent} />}
                      
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <Pressable
                          accessibilityLabel="按住说话"
                          accessibilityRole="button"
                          onPressIn={(e) => {
                            downY.current = e.nativeEvent.pageY;
                        downX.current = e.nativeEvent.pageX;
                          }}
                          onLongPress={beginVoice}
                          delayLongPress={150}
                          onTouchEnd={releaseVoice}
                          onPointerUp={releaseVoice}
                          onPointerMove={moveVoice}
                          onTouchMove={moveVoice}
                          style={{
                            flex: 1,
                            flexDirection: "row",
                            gap: 9,
                            height: 49,
                            borderRadius: 14,
                            backgroundColor: soft,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Mic size={21} color={accent} />
                          <Label style={{ color: accent }}>{listening || voiceStarting ? "保持按住，左右滑动选择" : "按住说话"}</Label>
                        </Pressable>
                        {!listening && !voiceStarting && !voiceFinalizing && <View style={{ flex: 1 }}>
                          <Button
                            disabled={
                              busy ||
                              listening ||
                              voiceStarting ||
                              voiceFinalizing ||
                              !sentence.trim()
                            }
                            onPress={() => submit(sentence)}
                          >
                            {busy ? "正在添加…" : "添加到日历"}
                          </Button>
                        </View>}
                      </View>
                      <Label
                        muted
                        style={{ fontSize: 10, textAlign: "center" }}
                      >
                        {cancelled
                          ? "已取消，可以重新说一句。"
                          : "按住说话时滑动选择：右滑松手添加，左滑松手修改；上滑取消。"}
                      </Label>
                    </ScrollView>
                  </View>
                </View>
              )}
              {toast && (
                <View style={styles.toast}>
                  <Check size={16} color={accent} />
                  <Label style={{ flex: 1, fontSize: 12, lineHeight: 19 }}>
                    {toast.text}
                  </Label>
                  {toast.action && (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        toast.action?.run();
                        setToast(null);
                      }}
                    >
                      <Label
                        style={{
                          color: accent,
                          fontSize: 12,
                          fontWeight: "600",
                        }}
                      >
                        {toast.action.label}
                      </Label>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => setToast(null)}
                    accessibilityLabel="关闭提示"
                  >
                    <X size={15} color="#aab1c3" />
                  </Pressable>
                </View>
              )}
              <Sheet
                visible={!!selected}
                onClose={() => setSelected(null)}
                title="日程详情"
              >
                {selected && (
                  <>
                    <Label style={{ fontSize: 23, fontWeight: "700" }}>
                      {selected.title}
                    </Label>
                    <Card>
                      <Row
                        label="日期"
                        value={describeDate(selected.start)}
                        icon={<CalendarDays size={18} color={accent} />}
                      />
                      <Row
                        label="时间"
                        value={
                          selected.allDay
                            ? "全天"
                            : selected.start.slice(11, 16) +
                              (selected.end
                                ? " — " + selected.end.slice(11, 16)
                                : "")
                        }
                        icon={<Clock3 size={18} color={accent} />}
                      />
                      {selected.lunar && (
                        <Row
                          label="农历生日"
                          value={`${selected.lunar.leap ? "闰" : ""}${selected.lunar.month}月${selected.lunar.day}日`}
                        />
                      )}
                      <Row
                        label="地点"
                        value={selected.location || "未填写"}
                        icon={<MapPin size={18} color={accent} />}
                      />
                      <Row
                        label="重复"
                        value={
                          selected.lunar
                            ? "每年农历生日"
                            : {
                                none: "不重复",
                                daily: "每天",
                                weekly: "每周",
                                yearly: "每年",
                              }[selected.repeat]
                        }
                        icon={<Repeat2 size={18} color={accent} />}
                      />
                      <Row
                        label="提醒"
                        value={
                          selected.reminder
                            ? (selected.reminderMode === "alarm"
                                ? "闹铃"
                                : "消息通知") +
                              " · 提前" +
                              selected.minutesBefore +
                              "分钟"
                            : "关闭"
                        }
                        icon={<Bell size={18} color={accent} />}
                      />
                    </Card>
                    {!!selected.notes && (
                      <Card>
                        <Label muted style={{ fontSize: 11 }}>
                          备注
                        </Label>
                        <Label>{selected.notes}</Label>
                      </Card>
                    )}
                    <Button
                      onPress={() => {
                        setEditing(selected);
                        setSelected(null);
                        setTab("add");
                        setAddKey((k) => k + 1);
                      }}
                    >
                      编辑日程
                    </Button>
                    <Button
                      secondary
                      danger
                      onPress={async () => {
                        if (
                          !(await confirmAction(
                            "删除这条日程？",
                            selected.repeat !== "none"
                              ? "这是一条重复日程，将删除整个重复系列。"
                              : "删除后将不再显示。",
                          ))
                        )
                          return;
                        try {
                          await mutate((d) => ({
                            ...d,
                            events: d.events.filter(
                              (e) => e.id !== selected.id,
                            ),
                          }));
                          setSelected(null);
                          notice("日程已删除");
                        } catch (e) {
                          notice((e as Error).message);
                        }
                      }}
                    >
                      删除日程
                    </Button>
                  </>
                )}
              </Sheet>
              <Onboarding
                visible={!data.settings.onboarded}
                onStart={async (name, ai) => {
                  try {
                    await mutate((d) => ({
                      ...d,
                      settings: {
                        ...d.settings,
                        name: name.trim(),
                        onboarded: true,
                      },
                    }));
                    if (ai) aiSettings();
                  } catch (e) {
                    notice("没有保存成功，请重试");
                  }
                }}
              />
            </SafeAreaView>
          </KeyboardAvoidingView>
        </View>
      </Theme.Provider>
    </Feedback.Provider>
  );
}
function Onboarding({
  visible,
  onStart,
}: {
  visible: boolean;
  onStart: (name: string, ai: boolean) => void;
}) {
  const [name, setName] = useState("");
  const t = useContext(Theme);
  if (!visible) return null;
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: "#f9faff",
          padding: 30,
          justifyContent: "center",
          gap: 24,
        },
      ]}
    >
      <View
        style={{
          width: 57,
          height: 57,
          borderRadius: 19,
          backgroundColor: t.soft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CalendarDays size={27} color={t.accent} />
      </View>
      <View style={{ gap: 10 }}>
        <Text
          style={[text, { fontSize: 34, fontWeight: "700", lineHeight: 47 }]}
        >
          你好，quill。
        </Text>
        <Label muted>
          留一点空白，记一点期待。{`\n`}从今天，开始记录你的每一天。
        </Label>
      </View>
      <Field
        label="怎么称呼你？（选填）"
        placeholder="表格中使用的姓名"
        value={name}
        onChangeText={setName}
      />
      <Card style={{ backgroundColor: "#f0f3fc" }}>
        <Label style={{ fontWeight: "600" }}>也可以，接上你的 AI</Label>
        <Label muted style={{ fontSize: 11 }}>
          理解更复杂的日程与补充要求，之后随时可以设置。
        </Label>
        <Pressable
          accessibilityRole="button"
          onPress={() => onStart(name, true)}
        >
          <Label style={{ color: t.accent, fontSize: 12 }}>
            连接自己的 API　↗
          </Label>
        </Pressable>
      </Card>
      <Button onPress={() => onStart(name, false)}>先使用基础日历</Button>
      <Label muted style={{ fontSize: 10, textAlign: "center" }}>
        日程保存在本机，请记得定期备份。
      </Label>
    </View>
  );
}
const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: "#eef1f8", alignItems: "center" },
  app: {
    flex: 1,
    width: "100%",
    maxWidth: 480,
    backgroundColor: "#f8f9fd",
    overflow: "hidden",
    ...Platform.select({
      web: { boxShadow: "0 0 70px rgba(74,88,132,.08)" },
      default: {},
    }),
  },
  nav: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: "#edf0f8",
    paddingHorizontal: 9,
    paddingTop: 8,
    paddingBottom: 12,
    minHeight: 83,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    minHeight: 54,
    paddingBottom: 3,
  },
  avatarCircle: {
    width: 49,
    height: 49,
    borderRadius: 25,
    marginTop: -16,
    position: "relative",
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 55,
    height: 55,
    position: "absolute",
    left: -6,
    top: 0,
    resizeMode: "contain",
  },
  plusBadge: {
    position: "absolute",
    right: -2,
    bottom: 0,
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  toast: {
    position: "absolute",
    bottom: 102,
    left: 18,
    right: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e6ebf7",
    borderRadius: 16,
    padding: 15,
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    ...Platform.select({
      web: { boxShadow: "0 8px 28px rgba(54,69,115,.1)" },
      default: { elevation: 4 },
    }),
  },
  quickPosition: { position: "absolute", bottom: 0, left: 0, right: 0 },
  quickSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 27,
    borderTopRightRadius: 27,
    padding: 22,
    gap: 13,
    borderWidth: 1,
    borderColor: "#edf0f9",
  },
  wave: {
    height: 45,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
});
