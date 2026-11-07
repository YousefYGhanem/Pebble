import type { Spawner } from './host'
import type { FromMain, ToMain } from './runner'

/** What sharedSpawner needs of a process (Electron's UtilityProcess in the app; a fake in tests). */
export interface Child {
  postMessage(m: unknown): void
  on(e: 'message', f: (m: ToMain & { plugin: string }) => void): void
  on(e: 'exit', f: (code: number) => void): void
  off(e: 'message' | 'exit', f: (...a: never[]) => void): void
  kill(): boolean | void
}

/**
 * Built-in connectors share one process (each process costs ~70 MB on its own); a plugin you added gets its own,
 * so its crash or hang stays its own. Messages carry the plugin id both ways (runner.ts).
 * The shared process ends when its last connector stops; a crash ends every connector in it (each restarts).
 */
export function sharedSpawner(fork: () => Child): Spawner {
  let shared: Child | undefined, users = 0
  return (id, builtIn = false) => {
    const own = !builtIn
    const child = own ? fork() : (shared ??= fork())
    if (!own) users++
    const listeners = { message: [] as ((m: ToMain) => void)[], exit: [] as ((code: number) => void)[] }
    let gone = false
    const onMessage = (m: ToMain & { plugin: string }) => {
      if (m.plugin !== id) return
      if (m.type === 'exit') end(m.code)
      else listeners.message.forEach(f => f(m))
    }
    const onExit = (code: number) => end(code)
    child.on('message', onMessage)
    child.on('exit', onExit)
    function release() {
      if (gone) return false
      gone = true
      child.off('message', onMessage)
      child.off('exit', onExit)
      if (own) child.kill()
      else if (--users === 0) { if (shared === child) shared = undefined; child.kill() }
      return true
    }
    function end(code: number) { if (release()) listeners.exit.forEach(f => f(code)) }
    return {
      post: (m: FromMain) => { if (!gone) child.postMessage({ ...m, plugin: id }) },
      on: ((e: 'message' | 'exit', f: (x: never) => void) => { listeners[e].push(f as never) }) as ReturnType<Spawner>['on'],
      kill: () => {
        if (!gone && !own) child.postMessage({ type: 'stop', plugin: id })
        release()
      }
    }
  }
}
