export const DAYS = [
  { value: 1, short: 'Mon', label: 'Monday' },
  { value: 2, short: 'Tue', label: 'Tuesday' },
  { value: 3, short: 'Wed', label: 'Wednesday' },
  { value: 4, short: 'Thu', label: 'Thursday' },
  { value: 5, short: 'Fri', label: 'Friday' },
  { value: 6, short: 'Sat', label: 'Saturday' },
]

export const dayLabel = (day: number) => DAYS.find((item) => item.value === day)?.label ?? ''

export const slotKey = (day: number, periodNo: number) => `${day}:${periodNo}`
