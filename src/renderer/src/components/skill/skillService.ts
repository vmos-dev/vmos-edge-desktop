import type { Device } from '@shared/ipc/data.types'
import { postDeviceModuleJson, type DeviceApiTarget } from '@renderer/utils/deviceApi'
import type { SkillListItem, SkillDetail, SkillOperationResult } from './types'

type SkillTarget = Device | DeviceApiTarget | null | undefined

export class SkillService {
  static async list(target: SkillTarget): Promise<{ skills: SkillListItem[]; count: number }> {
    return postDeviceModuleJson(target, 'ai', 'skill_list')
  }

  static async get(target: SkillTarget, name: string): Promise<SkillDetail> {
    return postDeviceModuleJson(target, 'ai', 'skill_get', { name })
  }

  static async install(
    target: SkillTarget,
    name: string,
    content: string
  ): Promise<SkillOperationResult> {
    return postDeviceModuleJson(target, 'ai', 'skill_install', { name, content })
  }

  static async uninstall(target: SkillTarget, name: string): Promise<SkillOperationResult> {
    return postDeviceModuleJson(target, 'ai', 'skill_uninstall', { name })
  }
}
