import { useMatches } from "react-router-dom";
import { findRbFromMatches } from "../constants/rbCodes";

/** Current screen's RB_MASTER (from route `id`), or null. */
export function useCurrentRbCode() {
  return findRbFromMatches(useMatches());
}
