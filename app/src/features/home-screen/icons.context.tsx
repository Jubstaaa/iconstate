import { createContext, useContext } from 'react'

import type { IconManifest } from '../../lib/core.types'

const IconsContext = createContext<IconManifest>({})

export const IconsProvider = IconsContext.Provider

export const useIcon = (key: string): string | undefined => useContext(IconsContext)[key]
