import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from 'adhan'

// Prayer times, worked out on this PC (adhan, MIT): no network once your city is known. The five prayers of a day
// (sunrise is not one of them), and which comes next.

export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const
export type Prayer = (typeof PRAYERS)[number]
export const METHODS = ['MuslimWorldLeague', 'Egyptian', 'Karachi', 'UmmAlQura', 'Dubai', 'MoonsightingCommittee', 'NorthAmerica', 'Kuwait', 'Qatar', 'Singapore', 'Tehran', 'Turkey'] as const
export type Method = (typeof METHODS)[number]

/** A day's five prayers, in order, as times (ms). */
export function prayerDay(lat: number, lng: number, method: Method, madhab: 'shafi' | 'hanafi', day: Date): { name: Prayer; at: number }[] {
  const params = CalculationMethod[method]()
  params.madhab = madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi
  const p = new PrayerTimes(new Coordinates(lat, lng), day, params)
  return PRAYERS.map(name => ({ name, at: p[name].getTime() }))
}

/** The next prayer from now (tomorrow's Fajr after Isha). */
export function nextPrayer(lat: number, lng: number, method: Method, madhab: 'shafi' | 'hanafi', now: number): { name: Prayer; at: number } {
  const today = prayerDay(lat, lng, method, madhab, new Date(now))
  return today.find(p => p.at > now) ?? prayerDay(lat, lng, method, madhab, new Date(now + 86_400_000))[0]!
}

/** Your city's coordinates (Open-Meteo's free geocoding: only the name you typed is sent). */
export async function findCity(name: string, language = 'en'): Promise<{ city: string; lat: number; lng: number } | null> {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name, count: '1', language })}`, { signal: AbortSignal.timeout(10_000) })
  if (!r.ok) return null
  const j = await r.json() as { results?: { name: string; country?: string; latitude: number; longitude: number }[] }
  const x = j.results?.[0]
  return x ? { city: x.country ? `${x.name}, ${x.country}` : x.name, lat: x.latitude, lng: x.longitude } : null
}
