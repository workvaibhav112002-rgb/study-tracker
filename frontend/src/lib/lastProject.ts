/**
 * Remembers the project picked on the timer, per user and per device, so a
 * reload or a new visit picks up where you left off instead of falling back
 * to the first project you ever made.
 */
const PREFIX = 'study_tracker_last_project_v1:'

export function loadLastProject(userId: number): number | null {
  try {
    const n = Number(localStorage.getItem(PREFIX + userId))
    return Number.isInteger(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

export function saveLastProject(userId: number, projectId: number | null): void {
  try {
    if (projectId === null) localStorage.removeItem(PREFIX + userId)
    else localStorage.setItem(PREFIX + userId, String(projectId))
  } catch {
    /* storage blocked: the choice just isn't remembered */
  }
}

/**
 * Which project to select after loading. In order: the one already selected,
 * the one remembered on this device, the project of the latest session (a new
 * device or the app), then the first project. Only ids that still exist count.
 */
export function pickProject(
  projects: { id: number }[],
  current: number | null,
  remembered: number | null,
  latestSessionProject: number | null,
): number | null {
  const exists = (id: number | null): id is number => id !== null && projects.some((p) => p.id === id)
  if (exists(current)) return current
  if (exists(remembered)) return remembered
  if (exists(latestSessionProject)) return latestSessionProject
  return projects[0]?.id ?? null
}
