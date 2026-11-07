/** How deeply Pebble's tools rest: 'light' on battery, 'deep' while you are away or a game runs full screen. */
export type RestLevel = 'awake' | 'light' | 'deep'

export function restLevel(now: { away: boolean; game: boolean; battery: boolean }, when: { away: boolean; games: boolean; battery: boolean }): RestLevel {
  if ((now.away && when.away) || (now.game && when.games)) return 'deep'
  return now.battery && when.battery ? 'light' : 'awake'
}
