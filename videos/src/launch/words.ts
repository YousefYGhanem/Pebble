// The film's words, English and Arabic. *word* is drawn in the accent colour. Claims stay within what Pebble does
// (README, docs/store/listing.json): it follows coding agents, answers their questions, plays your music with lyrics,
// shows accessory batteries, and Pip's chat has a free AI by default.
export type Lang = 'en' | 'ar'

export const WORDS: Record<Lang, Record<string, string>> = {
  en: {
    meet: 'Meet *Pebble.*',
    agents: 'Your AI agents, at the *top of your screen.*',
    answer: 'When one needs you, *answer right there.*',
    music: 'Your music, with *live lyrics.*',
    batteries: "Your accessories' *batteries,* at a glance.",
    pip: 'Ask Pip anything. *Free AI,* built in.',
    line: 'Free · Open source · Windows 10 & 11',
    search: 'Search “Pebble Pet”',
  },
  ar: {
    meet: 'تعرّف على *Pebble.*',
    agents: 'وكلاؤك الذكيون، *في أعلى شاشتك.*',
    answer: 'حين يحتاجك أحدهم، *أجبه من مكانك.*',
    music: 'موسيقاك، *بكلمات متزامنة.*',
    batteries: 'بطاريات ملحقاتك، *في لمحة.*',
    pip: 'اسأل بيب أي شيء. *ذكاء اصطناعي مجاني* مدمج.',
    line: 'مجاني · مفتوح المصدر · Windows 10 و11',
    search: 'ابحث عن ”Pebble Pet“',
  },
}

/** The connect peek's words (the island's own: i18n i.peek.connected.headset). */
export const PEEK: Record<Lang, { title: string; sub: string }> = {
  en: { title: 'Nothing Ear (a)', sub: 'Headphones connected' },
  ar: { title: 'Nothing Ear (a)', sub: 'اتصلت السماعات' },
}
