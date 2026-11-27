import { createContext, useContext } from "react";
export type Notice = (
  text: string,
  action?: { label: string; run: () => void },
) => void;
export const Feedback = createContext<Notice>(() => {});
export const useNotice = () => useContext(Feedback);
