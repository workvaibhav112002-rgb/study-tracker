import type React from 'react'
import { BarChart3, FolderKanban, History, Layers, NotebookPen, Target, Timer, Users } from 'lucide-react'
import type { Tab } from '../components/Navbar'

/** Tab labels and icons, in number-key order. */
export const TAB_META: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'timer', label: 'Focus', icon: Timer },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'cards', label: 'Cards', icon: Layers },
  { id: 'notes', label: 'Notes', icon: NotebookPen },
  { id: 'history', label: 'History', icon: History },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'friends', label: 'Friends', icon: Users },
  { id: 'mistakes', label: 'Mistake Lab', icon: Target },
]
