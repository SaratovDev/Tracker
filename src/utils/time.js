/** Формат «X ч Y мин» */
export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h === 0) return `${m} мин`
  return `${h} ч ${m} мин`
}

/** Формат «ММ:СС» (мин:сек); при часе и более — «Ч:ММ:СС» */
export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h === 0 ? `${mm}:${ss}` : `${h}:${mm}:${ss}`
}

export function formatDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}
