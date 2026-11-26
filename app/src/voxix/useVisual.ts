import { useSyncExternalStore } from "react";
import { VISUAL_PADRAO, ouvirVisual, visualAtual, type Visual } from "./personalizar";

export function useVisual(): Visual {
  return useSyncExternalStore(ouvirVisual, visualAtual, () => VISUAL_PADRAO);
}
