// The sound level (~30 a second while music plays), for every wave on screen. The island subscribes once to main.
const listeners = new Set<(p: number) => void>()
export const onPeak = (fn: (p: number) => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export const emitPeak = (p: number) => { for (const fn of listeners) fn(p) }
