const TZ = 'America/Costa_Rica'

// Returns { dateTodaySemVer, dateToday } using Costa Rica local time.
// Version format: YYYY.M.DHHMM (e.g. 2026.3.150540 for March 15 at 05:40)
// dateToday format: YYYY-MM-DD HH:MM UTC-6
function getVersionInfo() {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now)

  const get = (type) => parts.find(p => p.type === type).value

  const year = get('year')
  const month = parseInt(get('month'), 10)
  const day = get('day').padStart(2, '0')
  const hour = get('hour').padStart(2, '0')
  const minute = get('minute').padStart(2, '0')

  const dateTodaySemVer = `${year}.${month}.${day}${hour}${minute}`
  const dateToday = `${year}-${get('month').padStart(2, '0')}-${day} ${hour}:${minute} UTC-6`

  return { dateTodaySemVer, dateToday }
}

// When run directly, print both values as KEY=VALUE lines for shell consumption
if (require.main === module) {
  const { dateTodaySemVer, dateToday } = getVersionInfo()
  console.log(`date_today=${dateToday}`)
  console.log(`date_today_semver=${dateTodaySemVer}`)
}

module.exports = { getVersionInfo }
