// DeepSeek: GET /user/balance with your API key (the key is added by Pebble; this script never sees it).
module.exports = pebble => {
  pebble.every('10m', async () => {
    const b = await pebble.fetchJSON('https://api.deepseek.com/user/balance', { auth: 'apiKey' })
    const info = (b.balance_infos || [])[0]
    if (!info) return
    const total = Number(info.total_balance), sign = info.currency === 'CNY' ? '¥' : '$'
    const low = total < Number(pebble.settings.lowBelow ?? 2)
    pebble.widget('balance', { kind: 'chip', text: `${sign}${total.toFixed(2)}`, tone: low ? 'warn' : 'ok' })
    pebble.widget('card', { kind: 'card', title: 'DeepSeek', icon: 'agents', text: `${sign}${total.toFixed(2)} left`, tone: low ? 'warn' : 'ok', lines: b.is_available ? [] : ['The API is not available for this key'], link: 'https://platform.deepseek.com/usage' })
    if (low && !pebble.store.get('warned')) pebble.notify({ title: 'DeepSeek balance is low', body: `${sign}${total.toFixed(2)} left.`, link: 'https://platform.deepseek.com/top_up' })
    pebble.store.set('warned', low)
  })
}
