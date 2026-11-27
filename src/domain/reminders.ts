import { CalendarEvent, parseLocal, dateTime } from "./model";
import { upcoming } from "./calendar";
export interface PlannedReminder {
  id: string;
  title: string;
  body: string;
  local?: string;
  when: number;
  mode: "notification" | "alarm";
  sound: boolean;
}
export function reminderPlan(
  events: CalendarEvent[],
  sound: boolean,
  now = new Date(),
): PlannedReminder[] {
  return upcoming(
    events.filter((e) => e.reminder),
    now,
    400,
  )
    .map((x) => {
      const when = parseLocal(x.at).getTime() - x.event.minutesBefore * 60000;
      return {
        id: `qingri:${x.event.id}:${x.at}`,
        title: x.event.title,
        body: `${x.at.replace("T", " ")}${x.event.allDay ? " · 全天" : ""}${x.event.location ? " · " + x.event.location : ""}`,
        when,
        local: dateTime(new Date(when)),
        mode: x.event.reminderMode || "notification",
        sound,
      };
    })
    .filter((x) => x.when > now.getTime())
    .sort((a, b) => a.when - b.when)
    .slice(0, 60);
}
