/**
 * How deeply Pebble's tools rest: 'light' on battery, 'deep' while you are away or a game runs full screen, 'off' while
 * the island is tucked away (everything stops; agents still reach Pebble, and a question brings the island back).
 */
export type RestLevel = 'awake' | 'light' | 'deep' | 'off'

export function restLevel(now: { away: boolean; game: boolean; battery: boolean; tucked?: boolean }, when: { away: boolean; games: boolean; battery: boolean }): RestLevel {
  if (now.tucked) return 'off'
  if ((now.away && when.away) || (now.game && when.games)) return 'deep'
  return now.battery && when.battery ? 'light' : 'awake'
}
