import { atom } from "jotai"

/**
 * Set once the app is about to reload because it deletes its databases, the
 * last account removed from the device (access/0014): the shell then renders
 * nothing that reads them, since their clients are disposed with them.
 */
export const appClosingAtom = atom(false)
