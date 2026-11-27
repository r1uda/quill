import React, { createContext, useContext } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  Switch,
  StyleSheet,
  ViewStyle,
  TextInputProps,
  Modal,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { ChevronLeft, ChevronRight, Check, X } from "lucide-react-native";
export const Theme = createContext({
  accent: "#7388df",
  soft: "#edf1ff",
  panel: "rgba(255,255,255,0.96)",
});
export const colors = {
  ink: "#30374d",
  muted: "#969db2",
  line: "#edf0f7",
  bg: "#f7f8fc",
};
export const text = {
  fontFamily:
    Platform.OS === "web"
      ? '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif'
      : undefined,
  color: colors.ink,
};
export function Label({
  children,
  muted = false,
  style,
}: {
  children: React.ReactNode;
  muted?: boolean;
  style?: any;
}) {
  return (
    <Text
      style={[
        text,
        {
          fontSize: 14,
          lineHeight: 23,
          color: muted ? colors.muted : colors.ink,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const t = useContext(Theme);
  return (
    <View style={[s.card, { backgroundColor: t.panel }, style]}>
      {children}
    </View>
  );
}
export function Button({
  children,
  onPress,
  secondary = false,
  disabled = false,
  danger = false,
  icon,
}: {
  children: React.ReactNode;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  danger?: boolean;
  icon?: React.ReactNode;
}) {
  const t = useContext(Theme);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor: secondary ? t.soft : danger ? "#ce747e" : t.accent,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {icon}
      <Text
        style={[
          text,
          {
            fontSize: 15,
            fontWeight: "600",
            color: secondary ? t.accent : "#fff",
          },
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  ...props
}: TextInputProps & { label?: string }) {
  const t = useContext(Theme);
  return (
    <View style={{ gap: 8 }}>
      {label && (
        <Label style={{ fontSize: 13, fontWeight: "600" }}>{label}</Label>
      )}
      <TextInput
        accessibilityLabel={props.accessibilityLabel || label}
        placeholderTextColor="#b4bacb"
        {...props}
        style={[
          s.input,
          text,
          props.multiline && { minHeight: 90, textAlignVertical: "top" },
          props.style,
          { backgroundColor: t.panel },
        ]}
      />
    </View>
  );
}
export function Row({
  label,
  value,
  onPress,
  children,
  icon,
  danger = false,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  danger?: boolean;
}) {
  const content = (
    <>
      {icon}
      <Label style={{ flex: 1, color: danger ? "#c9707a" : colors.ink }}>
        {label}
      </Label>
      {value && (
        <Label muted style={{ fontSize: 12, maxWidth: "62%" }}>
          {value}
        </Label>
      )}
      {children}
      {onPress && <ChevronRight size={16} color="#aeb5c8" />}
    </>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={s.row}>
      {content}
    </Pressable>
  ) : (
    <View style={s.row}>{content}</View>
  );
}
export function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  const t = useContext(Theme);
  return (
    <Switch
      accessibilityLabel={label || "提醒开关"}
      value={value}
      onValueChange={onChange}
      trackColor={{ false: "#e4e7ef", true: t.accent }}
      thumbColor="#fff"
      style={
        Platform.OS === "web" ? { transform: [{ scale: 0.84 }] } : undefined
      }
    />
  );
}
export function Pills<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useContext(Theme);
  return (
    <View style={s.pills}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          accessibilityRole="button"
          accessibilityState={{ selected: value === item.key }}
          onPress={() => onChange(item.key)}
          style={[s.pill, value === item.key && { backgroundColor: t.soft }]}
        >
          <Text
            style={[
              text,
              {
                fontSize: 13,
                color: value === item.key ? t.accent : "#989fb2",
                fontWeight: value === item.key ? "600" : "400",
              },
            ]}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function Heading({
  title,
  subtitle,
  back,
  action,
}: {
  title: string;
  subtitle?: string;
  back?: () => void;
  action?: React.ReactNode;
}) {
  return (
    <View style={s.heading}>
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}
      >
        {back && (
          <Pressable
            accessibilityLabel="返回"
            accessibilityRole="button"
            onPress={back}
            style={{ padding: 3 }}
          >
            <ChevronLeft size={22} color={colors.ink} />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <Text
            style={[
              text,
              { fontSize: 23, fontWeight: "700", letterSpacing: 0.5 },
            ]}
          >
            {title}
          </Text>
          {subtitle && (
            <Label muted style={{ fontSize: 12, marginTop: 5 }}>
              {subtitle}
            </Label>
          )}
        </View>
      </View>
      {action}
    </View>
  );
}
export function Empty({
  title = "今天留一点空白",
  detail = "点下方快速添加，记下下一件小事。",
  icon,
}: {
  title?: string;
  detail?: string;
  icon?: React.ReactNode;
}) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 44, gap: 10 }}>
      {icon}
      <Label style={{ fontSize: 15, color: "#8e98b5" }}>{title}</Label>
      <Label muted style={{ fontSize: 12, textAlign: "center" }}>
        {detail}
      </Label>
    </View>
  );
}
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={s.modal}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : Platform.OS === "android"
              ? "height"
              : undefined
        }
      >
        <Pressable
          accessibilityLabel="关闭弹窗"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View style={s.sheet}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: 18,
            }}
          >
            <Label style={{ fontSize: 19, fontWeight: "700" }}>{title}</Label>
            <Pressable onPress={onClose} accessibilityLabel="关闭">
              <X size={21} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            contentContainerStyle={{ gap: 16, paddingBottom: 12 }}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
export function CheckBox({
  checked,
  onPress,
}: {
  checked: boolean;
  onPress: () => void;
}) {
  const t = useContext(Theme);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={{
        width: 22,
        height: 22,
        borderRadius: 7,
        borderWidth: 1,
        borderColor: checked ? t.accent : "#dce1ee",
        backgroundColor: checked ? t.accent : "#fff",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {checked && <Check size={16} color="#fff" />}
    </Pressable>
  );
}
export const s = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#eceff7",
    padding: 17,
    gap: 10,
  },
  button: {
    borderRadius: 14,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e9f4",
    borderRadius: 12,
    minHeight: 46,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 14,
  },
  row: {
    minHeight: 53,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#f2f4f9",
  },
  pills: {
    flexDirection: "row",
    backgroundColor: "#f3f5fa",
    borderRadius: 13,
    padding: 4,
    gap: 4,
  },
  pill: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center" },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 18,
    paddingBottom: 25,
    gap: 12,
  },
  modal: {
    flex: 1,
    backgroundColor: "rgba(42,48,70,.25)",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
  },
  sheet: {
    width: "100%",
    maxWidth: 470,
    maxHeight: "90%",
    borderRadius: 25,
    padding: 22,
    backgroundColor: "#fff",
  },
  page: { paddingHorizontal: 22, paddingBottom: 30, gap: 18 },
});
