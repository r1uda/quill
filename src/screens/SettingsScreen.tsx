import React, { useContext, useEffect, useState } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Image,
  Platform,
  Linking,
  Alert,
  AppState,
} from "react-native";
import {
  UserRound,
  Settings2,
  Palette,
  Bell,
  Database,
  ChevronRight,
  ShieldCheck,
  ArrowUpRight,
  CloudOff,
  CalendarDays,
} from "lucide-react-native";
import Slider from "@react-native-community/slider";
import {
  Heading,
  Card,
  Label,
  Row,
  Field,
  Button,
  Toggle,
  Pills,
  Sheet,
  Theme,
  colors,
  s,
} from "../ui";
import { useStore } from "../state";
import { useNotice } from "../feedback";
import { defaultSettings, dateKey, Settings } from "../domain/model";
import { getApiKey, setApiKey, validateBackup } from "../services/storage";
import { endpoint, testConnection, listModels } from "../services/ai";
import {
  providers,
  providerFor,
  selectProvider,
  modelChoices,
} from "../domain/providers";
import {
  exportText,
  pickDocument,
  pickImage,
  readBytes,
} from "../services/files";
import {
  notificationStatus,
  requestReminders,
  openReminderSettings,
  testReminder,
  stopAlarm,
} from "../services/notifications";
import { allowReminder } from "./CalendarScreen";
import { pinWidget } from "../services/widgets";
import { BackgroundCropper, CropImage } from "../components/BackgroundCropper";
export type SettingPage =
  "home" | "profile" | "ai" | "appearance" | "reminders" | "data" | "widgets";
export async function confirmAction(
  title: string,
  message: string,
): Promise<boolean> {
  if (Platform.OS === "web") return window.confirm(`${title}\n${message}`);
  return new Promise((resolve) =>
    Alert.alert(
      title,
      message,
      [
        { text: "取消", style: "cancel", onPress: () => resolve(false) },
        { text: "确定", style: "destructive", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
export function SettingsScreen({
  page,
  setPage,
}: {
  page: SettingPage;
  setPage: (p: SettingPage) => void;
}) {
  const { data, mutate, notificationError } = useStore();
  const notice = useNotice();
  const t = useContext(Theme);
  const [name, setName] = useState(data.settings.name);
  const [aliases, setAliases] = useState(data.settings.aliases);
  const [config, setConfig] = useState(data.settings.ai);
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [picker, setPicker] = useState<"provider" | "model" | null>(null);
  const [filter, setFilter] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const selectedProvider =
    config.provider === "custom" ? undefined : providerFor(config);
  const customAI =
    config.provider === "custom" || (!!config.url && !selectedProvider);
  const chooseProvider = (id: string) => {
    const next = selectProvider(id, config);
    if (next.url !== config.url) setKey("");
    setConfig(next);
    setPicker(null);
    setFilter("");
    setAdvanced(id === "custom");
  };
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("正在检查…");
  const [appearance, setAppearance] = useState(data.settings.appearance);
  const [cropImage, setCropImage] = useState<CropImage | null>(null);
  useEffect(() => {
    if (page !== "reminders") return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active")
        notificationStatus()
          .then(setStatus)
          .catch(() => {});
    });
    return () => subscription.remove();
  }, [page]);
  useEffect(() => {
    if (page === "ai") {
      setConfig(data.settings.ai);
      getApiKey()
        .then(setKey)
        .catch(() => notice("未能读取密钥，请重新输入"));
    }
    if (page === "profile") {
      setName(data.settings.name);
      setAliases(data.settings.aliases);
    }
    if (page === "appearance") setAppearance(data.settings.appearance);
    if (page === "reminders")
      notificationStatus()
        .then(setStatus)
        .catch(() => setStatus("暂不可读取"));
  }, [page]);
  const save = async (partial: Partial<Settings>) => {
    try {
      await mutate((d) => ({ ...d, settings: { ...d.settings, ...partial } }));
      notice("设置已保存");
      setPage("home");
    } catch (e) {
      notice("没有保存成功：" + (e as Error).message);
    }
  };
  const exportBackup = async () => {
    try {
      await exportText(
        `quill备份-${dateKey(new Date())}.json`,
        JSON.stringify(data, null, 2),
      );
      notice("已导出备份，API密钥不包含在内");
    } catch (e) {
      notice((e as Error).message);
    }
  };
  const restore = async () => {
    try {
      const file = await pickDocument();
      if (!file) return;
      const bytes = await readBytes(file);
      if (bytes.byteLength > 20 * 1024 * 1024) throw new Error("备份文件过大");
      const restored = validateBackup(
        JSON.parse(new TextDecoder().decode(bytes)),
      );
      if (
        !(await confirmAction(
          "从备份恢复",
          `备份中有${restored.events.length}条日程，将替换当前本机数据。建议先导出当前备份。`,
        ))
      )
        return;
      await mutate(() => restored);
      notice("备份已恢复");
      setPage("home");
    } catch (e) {
      notice("恢复失败：" + (e as Error).message);
    }
  };
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={s.page}
    >
      <Heading
        title={
          {
            home: "我的",
            profile: "个人资料",
            ai: "AI 设置",
            appearance: "背景与外观",
            reminders: "提醒设置",
            data: "数据管理",
            widgets: "桌面小组件",
          }[page]
        }
        subtitle={page === "home" ? "按自己的习惯，安排每一天。" : undefined}
        back={page !== "home" ? () => setPage("home") : undefined}
      />
      {page === "home" && (
        <>
          <Card style={{ padding: 22, backgroundColor: t.soft, gap: 12 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 14 }}
            >
              <View
                style={{
                  width: 45,
                  height: 45,
                  backgroundColor: "rgba(255,255,255,.6)",
                  borderRadius: 15,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CalendarDays size={23} color={t.accent} />
              </View>
              <View>
                <Label style={{ fontWeight: "700", fontSize: 20 }}>
                  {data.settings.name || "你的 quill"}
                </Label>
                <Label muted style={{ fontSize: 11 }}>
                  本机日历 · 自在记录
                </Label>
              </View>
            </View>
            <View
              style={{ height: 1, backgroundColor: "rgba(160,170,200,.16)" }}
            />
            <Label style={{ fontSize: 12, color: t.accent }}>
              已记录 {data.events.length} 件值得记住的事
            </Label>
          </Card>
          <Card style={{ paddingVertical: 4 }}>
            {[
              {
                key: "profile",
                label: "个人资料",
                value: data.settings.name || "姓名与别名",
                icon: UserRound,
              },
              {
                key: "ai",
                label: "AI 设置",
                value: data.settings.ai.enabled ? "已启用" : "可选 · 未启用",
                icon: Settings2,
              },
              {
                key: "appearance",
                label: "背景与外观",
                value: "背景、模糊度、主题色",
                icon: Palette,
              },
              {
                key: "reminders",
                label: "提醒设置",
                value: "按需开启",
                icon: Bell,
              },
              {
                key: "data",
                label: "数据管理",
                value: "备份与恢复",
                icon: Database,
              },
              { key: "widgets", label: "桌面小组件", value: "4×4 / 4×2 / 2×2 / 1×2", icon: CalendarDays },
            ].map((row) => (
              <Row
                key={row.key}
                label={row.label}
                value={row.value}
                icon={<row.icon size={19} color="#9aa5c0" />}
                onPress={() => setPage(row.key as SettingPage)}
              />
            ))}
          </Card>
          <View style={{ alignItems: "center", marginTop: 28, gap: 6 }}>
            <CloudOff size={18} color="#b8c0d2" />
            <Label muted style={{ fontSize: 11 }}>
              日程保存在这台设备上
            </Label>
            <Label muted style={{ fontSize: 10 }}>
              quill 0.1.5 · 慢慢来，也来得及
            </Label>
          </View>
        </>
      )}
      {page === "widgets" && <>
        {Platform.OS === "android" && <Card><Label style={{ fontWeight: "700" }}>一键添加到桌面</Label>
          {(["4x4", "4x2", "2x2", "1x2"] as const).map(size => <Button key={size} secondary onPress={async () => {
            try { notice(await pinWidget(size) ? "请在系统弹窗中确认添加到桌面。" : "当前桌面不支持一键添加，请按下方步骤手动添加。"); }
            catch { notice("请按下方步骤从桌面的小组件列表添加 quill。"); }
          }}>添加 {size.replace("x", "×")} 小组件</Button>)}
        </Card>}
        <Card><Label style={{ fontSize: 16, fontWeight: "700" }}>把安排放在桌面上</Label>
          <Label>1. 更新安装后，先打开 quill 一次。</Label>
          <Label>2. 返回手机桌面，长按空白处，选择“添加小组件”或“添加工具”。</Label>
          <Label>3. 找到 quill，选择尺寸，拖到桌面空白位置。</Label>
          <Label muted>小米手机若先显示精选组件，请进入“全部小组件 / 安卓小组件”，再查找 quill。入口名称会随系统版本变化。</Label>
        </Card>
        <Card><Label style={{ fontWeight: "700" }}>四种尺寸</Label>
          <Label>4×4：月历、今日日程和生日提示。</Label>
          <Label>4×2：今天接下来的安排。</Label>
          <Label>2×2：下一件事的时间和地点。</Label>
          <Label>1×2：竖向的日期和简短安排。</Label>
        </Card>
        <Card><Label style={{ fontWeight: "700" }}>用语音快速添加</Label>
          <Label>点击小组件上的加号，打开快速添加；按住麦克风说话，保持按住时滑动选择。</Label>
          <Label>按住时右滑，松手后识别并添加；按住时左滑，松手后转为文字编辑。直接松手也只保留文字，不会自动添加。上滑取消。</Label>
          <Label muted>桌面的长按由系统用来移动小组件，因此录音长按在打开的快速添加小窗中完成。无需语音 API，录音在本机识别。</Label>
        </Card>
        <Card><Label style={{ fontWeight: "700" }}>更新与显示</Label>
          <Label muted>在 quill 中保存、修改、删除日程后，小组件会更新；跨天和系统定期刷新也会更新。若桌面暂未变化，打开 quill 一次。小组件会在桌面显示日程标题，请按自己的隐私需要放置。</Label>
          <Label muted>当前小组件提供安卓版本，iOS 桌面小组件尚未交付。</Label>
        </Card>
      </>}
      {page === "profile" && (
        <>
          <Card>
            <Field
              label="使用者姓名"
              value={name}
              onChangeText={setName}
              placeholder="表格里通常怎样写你的名字？"
            />
            <Field
              label="姓名别名（选填）"
              value={aliases}
              onChangeText={setAliases}
              placeholder="例如：林小同、Xiao Lin"
            />
            <Label muted style={{ fontSize: 11 }}>
              多个别名用逗号或顿号分隔。导入 Excel
              时，可以筛选与你姓名相符的安排。
            </Label>
          </Card>
          <Card>
            <Label style={{ fontWeight: "600" }}>找不到姓名时</Label>
            <Label muted style={{ fontSize: 12 }}>
              提示你核对姓名和表格列，不会直接导入其他人的安排。
            </Label>
          </Card>
          <Button
            onPress={() => save({ name: name.trim(), aliases: aliases.trim() })}
          >
            保存个人资料
          </Button>
        </>
      )}
      {page === "ai" && (
        <>
          <Card>
            <Row label="启用 AI">
              <Toggle
                label="启用AI"
                value={config.enabled}
                onChange={(v) => setConfig((x) => ({ ...x, enabled: v }))}
              />
            </Row>
            <Label muted style={{ fontSize: 11 }}>
              可选。基础日历、详细填写和基础识别可以直接使用。
            </Label>
          </Card>
          <Card>
            <Label style={{ fontSize: 13 }}>大模型服务</Label>
            <Button
              secondary
              disabled={busy}
              onPress={() => {
                setFilter("");
                setPicker("provider");
              }}
            >
              {selectedProvider?.label ||
                (customAI ? "其他 / 自定义服务" : "选择大模型服务")}
            </Button>
            <Label muted style={{ fontSize: 12 }}>
              选服务、选模型，地址自动配好，只需填写对应的密钥。
            </Label>
            {(selectedProvider || customAI) && (
              <>
                <Label style={{ fontSize: 13 }}>使用的模型</Label>
                <Button
                  secondary
                  disabled={busy}
                  onPress={() => {
                    setFilter("");
                    setPicker("model");
                  }}
                >
                  {config.model || "选择模型"}
                </Button>
              </>
            )}
            <Field
              label="API Key"
              value={key}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!showKey}
              placeholder="只在这里填写，不用发给我"
              onChangeText={setKey}
            />
            <Pressable onPress={() => setShowKey((v) => !v)}>
              <Label style={{ color: t.accent, fontSize: 12 }}>
                {showKey ? "隐藏密钥" : "显示密钥"}
              </Label>
            </Pressable>
            {(selectedProvider || customAI) && (
              <Button
                secondary
                disabled={busy}
                onPress={async () => {
                  const requestedURL = config.url;
                  setBusy(true);
                  try {
                    const models = await listModels(config, key);
                    setConfig((x) =>
                      x.url === requestedURL ? { ...x, models } : x,
                    );
                    notice(
                      `已获取 ${models.length} 个模型，点模型名称即可选择`,
                    );
                  } catch (e) {
                    notice((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "正在连接…" : "刷新模型列表"}
              </Button>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => setAdvanced((v) => !v)}
            >
              <Label style={{ color: t.accent, fontSize: 12 }}>
                {advanced ? "收起高级设置" : "高级设置"}
              </Label>
            </Pressable>
            {(advanced || customAI) && (
              <>
                {customAI ? (
                  <Field
                    label="API 服务地址"
                    value={config.url}
                    autoCapitalize="none"
                    placeholder="https://你的服务地址/v1"
                    onChangeText={(v) => {
                      setKey("");
                      setConfig((x) => ({ ...x, url: v, models: [] }));
                    }}
                  />
                ) : (
                  <Label muted style={{ fontSize: 12 }}>
                    服务地址（已自动配置）：{config.url || "请先选择大模型服务"}
                  </Label>
                )}
                <Field
                  label="自定义模型名称（选填）"
                  value={config.model}
                  autoCapitalize="none"
                  onChangeText={(v) => setConfig((x) => ({ ...x, model: v }))}
                />
                {customAI && (
                  <Pills
                    items={[
                      { key: "chat", label: "通用兼容接口" },
                      { key: "anthropic", label: "Claude 接口" },
                    ]}
                    value={config.protocol || "chat"}
                    onChange={(v) => setConfig((x) => ({ ...x, protocol: v }))}
                  />
                )}
              </>
            )}
            <Label muted style={{ fontSize: 11 }}>
              直接识图需所选模型支持图片。切换服务商后，填写该服务商的密钥。
              {Platform.OS === "web"
                ? "浏览器预览的密钥仅在本次页面会话中保留。"
                : "密钥存入手机安全存储，不会写进备份。"}
            </Label>
          </Card>
          <Button
            secondary
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await testConnection(config, key);
                notice("连接成功，模型可以正常回复");
              } catch (e) {
                notice((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "正在测试…" : "测试连接"}
          </Button>
          <Button
            disabled={busy}
            onPress={async () => {
              try {
                if (config.enabled) {
                  if (!config.url.trim() || !key.trim() || !config.model.trim())
                    throw new Error(
                      "启用前请选择大模型服务、模型，并填写对应的密钥",
                    );
                  endpoint(config.url);
                }
                await setApiKey(key.trim());
                await save({ ai: config });
              } catch (e) {
                notice((e as Error).message);
              }
            }}
          >
            保存 AI 设置
          </Button>
          {picker && (
            <Sheet
              visible
              title={picker === "provider" ? "选择大模型服务" : "选择模型"}
              onClose={() => setPicker(null)}
            >
              <Field
                label={
                  picker === "provider"
                    ? "搜索服务商（可选）"
                    : "搜索模型（可选）"
                }
                value={filter}
                onChangeText={setFilter}
                placeholder="可以直接从下面选择"
              />
              {picker === "provider" ? (
                <>
                  {providers
                    .filter((p) =>
                      [p.label, p.id, ...(p.aliases || [])]
                        .join(" ")
                        .toLowerCase()
                        .includes(filter.toLowerCase()),
                    )
                    .map((p) => (
                      <Button
                        key={p.id}
                        secondary
                        onPress={() => chooseProvider(p.id)}
                      >
                        {p.label}
                      </Button>
                    ))}
                  <Button secondary onPress={() => chooseProvider("custom")}>
                    其他 / 自定义服务
                  </Button>
                </>
              ) : (
                <>
                  {modelChoices(config)
                    .filter((m) =>
                      m.toLowerCase().includes(filter.toLowerCase()),
                    )
                    .map((m) => (
                      <Button
                        key={m}
                        secondary
                        onPress={() => {
                          setConfig((x) => ({ ...x, model: m }));
                          setPicker(null);
                        }}
                      >
                        {m}
                      </Button>
                    ))}
                  <Label muted style={{ fontSize: 12 }}>
                    更多模型可在填写密钥后刷新列表。模型能否使用，以服务商和账号权限为准。
                  </Label>
                </>
              )}
            </Sheet>
          )}
        </>
      )}
      {page === "appearance" && (
        <>
          <Card style={{ height: 215, overflow: "hidden", padding: 0 }}>
            {appearance.background && (
              <Image
                source={{ uri: appearance.background }}
                blurRadius={appearance.blur}
                style={{
                  position: "absolute",
                  width: "100%",
                  height: "100%",
                  opacity: 1,
                }}
              />
            )}
            <View
              style={{
                flex: 1,
                padding: 20,
                backgroundColor: appearance.background
                  ? `rgba(0,0,0,${1 - appearance.brightness / 100})`
                  : t.soft,
              }}
            >
              <View
                style={{
                  backgroundColor: `rgba(255,255,255,${appearance.opacity / 100})`,
                  padding: 18,
                  borderRadius: 17,
                  gap: 13,
                }}
              >
                <Label style={{ fontWeight: "700" }}>
                  你的日历，自己的样子
                </Label>
                <Label style={{ color: t.accent, fontSize: 12 }}>
                  10月28日　周三
                </Label>
                <Row label="15:00　项目讨论" />
                <Label muted style={{ fontSize: 10 }}>
                  背景只属于你，安排仍然清楚。
                </Label>
              </View>
            </View>
          </Card>
          <Button
            secondary
            onPress={async () => {
              try {
                const image = await pickImage(true);
                if (image)
                  setCropImage({
                    uri: image.uri,
                    width: image.width,
                    height: image.height,
                  });
              } catch (e) {
                notice((e as Error).message);
              }
            }}
          >
            选择图片 / 裁剪背景
          </Button>
          <Card>
            {(
              [
                { key: "blur", label: "模糊度", max: 40 },
                { key: "brightness", label: "背景亮度", max: 100 },
                { key: "opacity", label: "卡片不透明度", max: 100 },
              ] as const
            ).map((row) => (
              <View key={row.key} style={{ gap: 4 }}>
                <Row
                  label={row.label}
                  value={appearance[row.key] + (row.key === "blur" ? "" : "%")}
                />
                <Slider
                  accessibilityLabel={row.label}
                  minimumValue={row.key === "opacity" ? 30 : 0}
                  maximumValue={row.max}
                  step={1}
                  value={appearance[row.key]}
                  minimumTrackTintColor={t.accent}
                  maximumTrackTintColor="#e9ecf7"
                  thumbTintColor={t.accent}
                  onValueChange={(v) =>
                    setAppearance((p) => ({ ...p, [row.key]: v }))
                  }
                />
              </View>
            ))}
            <Label style={{ fontSize: 13 }}>主题色</Label>
            <Pills
              value={appearance.accent}
              onChange={(accent) => setAppearance((p) => ({ ...p, accent }))}
              items={[
                { key: "blue", label: "浅蓝" },
                { key: "purple", label: "浅紫" },
              ]}
            />
          </Card>
          <Button onPress={() => save({ appearance })}>保存外观</Button>
          <Button
            secondary
            onPress={async () => {
              const defaults = { ...defaultSettings.appearance };
              try {
                await mutate((d) => ({
                  ...d,
                  settings: { ...d.settings, appearance: defaults },
                }));
                setAppearance(defaults);
                setCropImage(null);
                notice("已恢复默认外观并保存");
              } catch (error) {
                notice("恢复失败：" + (error as Error).message);
              }
            }}
          >
            恢复默认外观
          </Button>
        </>
      )}
      {cropImage && (
        <BackgroundCropper
          image={cropImage}
          onCancel={() => setCropImage(null)}
          onConfirm={(background) => {
            setAppearance((p) => ({ ...p, background }));
            setCropImage(null);
            notice("取景已应用，保存外观后生效");
          }}
        />
      )}
      {page === "reminders" && (
        <>
          <Card>
            <Row label="新建日程默认提醒">
              <Toggle
                value={data.settings.reminders.defaultOn}
                onChange={async (v) => {
                  try {
                    if (v && !(await allowReminder(notice))) return;
                    await mutate((d) => ({
                      ...d,
                      settings: {
                        ...d.settings,
                        reminders: { ...d.settings.reminders, defaultOn: v },
                      },
                    }));
                  } catch (e) {
                    notice((e as Error).message);
                  }
                }}
              />
            </Row>
            <Field
              label="默认提前几分钟"
              keyboardType="number-pad"
              value={String(data.settings.reminders.minutes)}
              onChangeText={(v) => {
                const minutes = +v;
                if (
                  Number.isFinite(minutes) &&
                  minutes >= 0 &&
                  minutes <= 525600
                )
                  mutate((d) => ({
                    ...d,
                    settings: {
                      ...d.settings,
                      reminders: { ...d.settings.reminders, minutes },
                    },
                  })).catch(() => notice("保存失败"));
              }}
            />
            <Label>默认提醒方式</Label>
            <Pills
              value={data.settings.reminders.mode || "notification"}
              onChange={(mode) =>
                mutate((d) => ({
                  ...d,
                  settings: {
                    ...d.settings,
                    reminders: { ...d.settings.reminders, mode },
                  },
                })).catch(() => notice("保存失败"))
              }
              items={
                Platform.OS === "ios"
                  ? [{ key: "notification", label: "消息通知" }]
                  : [
                      { key: "notification", label: "消息通知" },
                      { key: "alarm", label: "闹铃" },
                    ]
              }
            />
            <Row label="通知声音" value="跟随手机系统">
              <Toggle
                value={data.settings.reminders.sound}
                onChange={(sound) =>
                  mutate((d) => ({
                    ...d,
                    settings: {
                      ...d.settings,
                      reminders: { ...d.settings.reminders, sound },
                    },
                  })).catch(() => notice("保存失败"))
                }
              />
            </Row>
          </Card>
          <Card>
            <Row
              label="申请提醒权限"
              onPress={async () => {
                try {
                  if (Platform.OS === "web") {
                    notice("浏览器预览不发送手机通知");
                    return;
                  }
                  await requestReminders();
                  setStatus(await notificationStatus());
                } catch (e) {
                  notice((e as Error).message);
                }
              }}
            />
            <Row
              label="打开手机通知设置"
              onPress={() =>
                Platform.OS === "web"
                  ? notice("请在安装版中打开手机通知设置")
                  : openReminderSettings("notification")
              }
            />
            {Platform.OS !== "ios" && (
              <Row
                label="打开闹钟和准时提醒权限"
                onPress={() =>
                  openReminderSettings("alarm").catch((e) => notice(e.message))
                }
              />
            )}
            <Label muted style={{ fontSize: 12 }}>
              {status}
            </Label>
            <Button
              secondary
              onPress={async () => {
                try {
                  setStatus(await notificationStatus());
                } catch (e) {
                  notice((e as Error).message);
                }
              }}
            >
              刷新提醒状态
            </Button>
            <Button
              onPress={async () => {
                try {
                  await testReminder("notification");
                  notice("10秒后发送测试消息，可以锁屏检查");
                  setStatus(await notificationStatus());
                } catch (e) {
                  notice((e as Error).message);
                }
              }}
            >
              测试消息通知（10秒后）
            </Button>
            {Platform.OS !== "ios" && (
              <Button
                secondary
                onPress={async () => {
                  try {
                    await testReminder("alarm");
                    notice("10秒后测试闹铃，可在通知栏停止");
                    setStatus(await notificationStatus());
                  } catch (e) {
                    notice((e as Error).message);
                  }
                }}
              >
                测试闹铃（10秒后）
              </Button>
            )}
            <Button
              secondary
              onPress={() => stopAlarm().catch((e) => notice(e.message))}
            >
              停止当前闹铃
            </Button>
          </Card>
          <Label muted style={{ fontSize: 12 }}>
            每条日程可单独开启或关闭。消息提醒使用通知声音；闹铃使用手机闹钟音量，持续响铃至停止，最长2分钟。安装版排程最近60次，打开应用时续排。小米手机可在系统设置中允许自启动，并将电池策略设为无限制，以减少后台限制。
          </Label>
          {!!notificationError && (
            <Label style={{ color: "#bb7b64" }}>{notificationError}</Label>
          )}
        </>
      )}
      {page === "data" && (
        <>
          <Card>
            <Row label="本机日历" value={`${data.events.length} 条记录`} />
            <Label muted style={{ fontSize: 11 }}>
              备份包含日程与界面设置，不包含 API 密钥。
            </Label>
          </Card>
          <Button secondary onPress={exportBackup}>
            导出备份文件
          </Button>
          <Button secondary onPress={restore}>
            从备份恢复
          </Button>
          <View style={{ height: 18 }} />
          <Button
            secondary
            danger
            onPress={async () => {
              if (
                !(await confirmAction(
                  "清空本机日程",
                  "所有日程、生日和纪念日会被删除，建议先导出备份。",
                ))
              )
                return;
              try {
                await mutate((d) => ({ ...d, events: [] }));
                notice("本机日程已清空");
              } catch (e) {
                notice((e as Error).message);
              }
            }}
          >
            清空本机日程
          </Button>
          <Label muted style={{ fontSize: 11 }}>
            清空只在确认后执行，不会删除你已导出的备份。
          </Label>
        </>
      )}
    </ScrollView>
  );
}
