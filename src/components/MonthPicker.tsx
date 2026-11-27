import React, { useContext, useState } from "react";
import { Pressable, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Sheet, Label, Theme } from "../ui";

export function MonthPicker({ value, onSelect, onClose }: {
  value: Date;
  onSelect: (year: number, month: number) => void;
  onClose: () => void;
}) {
  const t = useContext(Theme);
  const [year, setYear] = useState(value.getFullYear());
  const [yearsVisible, setYearsVisible] = useState(false);
  const [yearPage, setYearPage] = useState(Math.floor(value.getFullYear() / 12) * 12);
  const limit = (n: number) => Math.max(1900, Math.min(2199, n));
  return <Sheet visible title="选择年月" onClose={onClose}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Pressable accessibilityRole="button" accessibilityLabel={yearsVisible ? "上一组年份" : "上一年"} onPress={() => yearsVisible ? setYearPage((v) => Math.max(1900, v - 12)) : setYear((v) => limit(v - 1))} style={{ padding: 12 }}>
        <ChevronLeft size={20} color={t.accent} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="选择年份" onPress={() => { setYearPage(Math.floor(year / 12) * 12); setYearsVisible((v) => !v); }} style={{ padding: 12 }}>
        <Label style={{ fontWeight: "600", fontSize: 18, color: t.accent }}>{yearsVisible ? `${yearPage} — ${Math.min(2199, yearPage + 11)}` : `${year} 年`}</Label>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={yearsVisible ? "下一组年份" : "下一年"} onPress={() => yearsVisible ? setYearPage((v) => Math.min(2196, v + 12)) : setYear((v) => limit(v + 1))} style={{ padding: 12 }}>
        <ChevronRight size={20} color={t.accent} />
      </Pressable>
    </View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {Array.from({ length: 12 }, (_, i) => yearsVisible ? yearPage + i : i).filter((n) => !yearsVisible || n >= 1900 && n <= 2199).map((n) => {
        const active = yearsVisible ? n === year : year === value.getFullYear() && n === value.getMonth();
        return <Pressable key={n} accessibilityRole="button" accessibilityLabel={yearsVisible ? `选择${n}年` : `选择${n + 1}月`} accessibilityState={{ selected: active }} onPress={() => {
          if (yearsVisible) { setYear(n); setYearsVisible(false); }
          else onSelect(year, n);
        }} style={{ width: "30%", flexGrow: 1, paddingVertical: 17, alignItems: "center", borderRadius: 14, backgroundColor: active ? t.accent : t.soft }}>
          <Label style={{ color: active ? "white" : t.accent, fontWeight: active ? "700" : "400" }}>{yearsVisible ? `${n}年` : `${n + 1}月`}</Label>
        </Pressable>;
      })}
    </View>
    <Label muted style={{ fontSize: 12, textAlign: "center" }}>点击上方年份可快速换年，选择月份后直接跳转。</Label>
  </Sheet>;
}
