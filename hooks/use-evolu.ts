import { useAtomValue } from "jotai";
import { evoluAtom } from "@/atoms/evolu";

export const useEvolu = () => useAtomValue(evoluAtom);
