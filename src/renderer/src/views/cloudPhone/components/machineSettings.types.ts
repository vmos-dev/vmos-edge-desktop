import type { Adi } from '@shared/ipc/adi.types'

export type MachineMode = 'random' | 'custom'

export type AdiWithUpload = Omit<Adi, 'id'> & {
  id: string | number
  isUploaded: boolean
  model_name?: string
  path?: string
  isCustom?: boolean
}

export type BrandOption = {
  brand: string
  list: AdiWithUpload[]
}

export type MachineChangeReason = 'init' | 'mode-change' | 'brand-change' | 'custom-select' | 'reload'

export type MachineModelChangePayload = {
  mode: MachineMode
  reason: MachineChangeReason
  model: AdiWithUpload | null
}
