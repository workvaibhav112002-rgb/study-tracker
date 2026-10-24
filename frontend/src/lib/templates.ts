import type { Settings } from '../types'

export interface SessionTemplate {
  id: string
  name: string
  hint: string
  values: Pick<Settings, 'work_duration' | 'short_break_duration' | 'long_break_duration' | 'long_break_interval'>
}

export const TEMPLATES: SessionTemplate[] = [
  { id: 'classic', name: 'Classic', hint: '25 / 5 / 15, long break every 4', values: { work_duration: 25, short_break_duration: 5, long_break_duration: 15, long_break_interval: 4 } },
  { id: 'deep', name: 'Deep work', hint: '50 / 10 / 30, long break every 3', values: { work_duration: 50, short_break_duration: 10, long_break_duration: 30, long_break_interval: 3 } },
  { id: 'sprint', name: 'Sprint', hint: '15 / 3 / 10, long break every 4', values: { work_duration: 15, short_break_duration: 3, long_break_duration: 10, long_break_interval: 4 } },
  { id: 'exam', name: 'Exam prep', hint: '45 / 10 / 20, long break every 2', values: { work_duration: 45, short_break_duration: 10, long_break_duration: 20, long_break_interval: 2 } },
]

export function matchingTemplate(s: Settings): string | null {
  const t = TEMPLATES.find((t) => Object.entries(t.values).every(([k, v]) => s[k as keyof typeof t.values] === v))
  return t?.id ?? null
}
