import type { WorkflowAction } from '@shared/ipc/agent.types'

type TranslateFn = (key: string, params?: Record<string, unknown>) => string

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function formatValue(value: unknown, fallback = ''): string {
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
}

function resolveTarget(selector: unknown, t: TranslateFn): string {
  if (!isRecord(selector)) {
    return t('aiWorkflow.actionDescription.unknownTarget')
  }

  const directTarget =
    selector.text ||
    selector.resource_id ||
    selector.content_desc ||
    selector.desc ||
    selector.class_name

  if (directTarget !== null && directTarget !== undefined && directTarget !== '') {
    return String(directTarget)
  }

  if (typeof selector.index === 'number') {
    return t('aiWorkflow.actionDescription.indexTarget', { index: selector.index })
  }

  return t('aiWorkflow.actionDescription.unknownTarget')
}

function resolveKeyName(keyCode: number, t: TranslateFn): string {
  const keyNameMap: Record<number, string> = {
    3: t('aiWorkflow.actionDescription.keys.home'),
    4: t('aiWorkflow.actionDescription.keys.back'),
    24: t('aiWorkflow.actionDescription.keys.volumeUp'),
    25: t('aiWorkflow.actionDescription.keys.volumeDown'),
    26: t('aiWorkflow.actionDescription.keys.power'),
    66: t('aiWorkflow.actionDescription.keys.enter')
  }
  return keyNameMap[keyCode] || t('aiWorkflow.actionDescription.keys.keyCode', { keyCode })
}

export function createActionDescriptionGetter(t: TranslateFn) {
  return (action: WorkflowAction): string => {
    const params = isRecord(action.params) ? action.params : {}

    switch (action.path) {
      case 'base/sleep':
      case 'logic/sleep':
        return t('aiWorkflow.actionDescription.waitMs', {
          duration: formatValue(params.duration, '0')
        })
      case 'permission/set':
        return t('aiWorkflow.actionDescription.grantPermission', {
          packageName: formatValue(params.package_name)
        })
      case 'activity/start_activity':
      case 'activity/start':
        return t('aiWorkflow.actionDescription.startApp', {
          packageName: formatValue(params.package_name)
        })
      case 'activity/stop':
        return t('aiWorkflow.actionDescription.stopApp', {
          packageName: formatValue(params.package_name)
        })
      case 'accessibility/node': {
        const actionType = formatValue(params.action)
        const target = resolveTarget(params.selector, t)
        const actionParams = isRecord(params.action_params) ? params.action_params : {}
        const text = formatValue(actionParams.text)

        if (actionType === 'click') {
          return t('aiWorkflow.actionDescription.clickTarget', { target })
        }
        if (actionType === 'long_click') {
          return t('aiWorkflow.actionDescription.longClickTarget', { target })
        }
        if (actionType === 'set_text' || actionType === 'input') {
          return t('aiWorkflow.actionDescription.inputToTarget', { text, target })
        }
        if (actionType === 'scroll_forward') {
          return t('aiWorkflow.actionDescription.scrollForwardTarget', { target })
        }
        if (actionType === 'scroll_backward') {
          return t('aiWorkflow.actionDescription.scrollBackwardTarget', { target })
        }
        return t('aiWorkflow.actionDescription.findNode', { target })
      }
      case 'accessibility/find_node': {
        const target =
          formatValue(params.text) ||
          formatValue(params.resource_id) ||
          t('aiWorkflow.actionDescription.unknownTarget')
        return t('aiWorkflow.actionDescription.findNode', { target })
      }
      case 'accessibility/perform_action': {
        const target =
          formatValue(params.text) ||
          formatValue(params.view_id) ||
          resolveTarget(params.selector, t)
        return t('aiWorkflow.actionDescription.performAction', { target })
      }
      case 'input/click':
        return t('aiWorkflow.actionDescription.clickCoordinate', {
          x: formatValue(params.x, '?'),
          y: formatValue(params.y, '?')
        })
      case 'input/text':
        return t('aiWorkflow.actionDescription.inputText', {
          text: formatValue(params.text)
        })
      case 'input/scroll_bezier':
        return t('aiWorkflow.actionDescription.scrollBezier', {
          startX: formatValue(params.start_x, '?'),
          startY: formatValue(params.start_y, '?'),
          endX: formatValue(params.end_x, '?'),
          endY: formatValue(params.end_y, '?')
        })
      case 'input/keyevent': {
        const keyCode = Number(params.key_code)
        const safeKeyCode = Number.isNaN(keyCode) ? -1 : keyCode
        const keyName = resolveKeyName(safeKeyCode, t)
        return t('aiWorkflow.actionDescription.keyEvent', { keyName })
      }
      case 'accessibility/dump':
        return t('aiWorkflow.actionDescription.dumpUi')
      case 'activity/top_activity':
        return t('aiWorkflow.actionDescription.topActivity')
      case 'system/toast':
        return t('aiWorkflow.actionDescription.showToast', {
          message: formatValue(params.message)
        })
      default:
        return action.path
    }
  }
}
