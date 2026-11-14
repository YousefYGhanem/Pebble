import type { PipMood } from '../../content/types'

/** The little Pip in the corner: the mood of the section on screen, and whether the hero's Pip is out of sight. */
export const buddy = $state({ mood: 'idle' as PipMood, show: false })
