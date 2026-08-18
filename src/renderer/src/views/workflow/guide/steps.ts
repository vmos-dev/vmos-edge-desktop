import type { DriveStep } from 'driver.js'
import { t } from '@renderer/locales'

// ═══ Guide IDs ═══

export const LIST_GUIDE_ID = 'workflow-list'
export const CREATE_GUIDE_ID = 'workflow-create'
export const EDIT_GUIDE_ID = 'workflow-edit'
export const PICK_GUIDE_ID = 'workflow-pick'
export const FROZEN_GUIDE_ID = 'workflow-frozen'
export const SELECTOR_GUIDE_ID = 'workflow-selector'

// ═══ ① 列表页 ═══

export function getListViewSteps(): DriveStep[] {
  return [
    {
      element: '.topbar-lead',
      popover: {
        title: t('workflow.guide.listView.welcomeTitle'),
        description: t('workflow.guide.listView.welcomeDesc'),
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '.topbar-search',
      popover: {
        title: t('workflow.guide.listView.searchTitle'),
        description: t('workflow.guide.listView.searchDesc'),
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '.wf-sidebar',
      popover: {
        title: t('workflow.guide.listView.groupTitle'),
        description: t('workflow.guide.listView.groupDesc'),
        side: 'right',
        align: 'start'
      }
    },
    {
      element: '.wf-main-slot',
      popover: {
        title: t('workflow.guide.listView.listTitle'),
        description: t('workflow.guide.listView.listDesc'),
        side: 'left',
        align: 'start'
      }
    },
    {
      element: '.new-btn',
      popover: {
        title: t('workflow.guide.listView.createTitle'),
        description: t('workflow.guide.listView.createDesc'),
        side: 'bottom',
        align: 'end'
      }
    }
  ]
}

// ═══ ② 新建弹窗 ═══

export function getCreateDialogSteps(): DriveStep[] {
  return [
    {
      element: '.selector-container',
      popover: {
        title: t('workflow.guide.createDialog.wizardTitle'),
        description: t('workflow.guide.createDialog.wizardDesc'),
        side: 'top',
        align: 'center'
      }
    },
    {
      element: '.device-col',
      popover: {
        title: t('workflow.guide.createDialog.deviceTitle'),
        description: t('workflow.guide.createDialog.deviceDesc'),
        side: 'right',
        align: 'start'
      }
    },
    {
      element: '.app-col',
      popover: {
        title: t('workflow.guide.createDialog.appTitle'),
        description: t('workflow.guide.createDialog.appDesc'),
        side: 'left',
        align: 'start'
      }
    },
    {
      element: '.name-section',
      popover: {
        title: t('workflow.guide.createDialog.nameTitle'),
        description: t('workflow.guide.createDialog.nameDesc'),
        side: 'top',
        align: 'center'
      }
    },
    {
      element: '.footer-btns',
      popover: {
        title: t('workflow.guide.createDialog.confirmTitle'),
        description: t('workflow.guide.createDialog.confirmDesc'),
        side: 'top',
        align: 'end'
      }
    }
  ]
}

// ═══ ③ 编辑页 ═══

export function getEditViewSteps(): DriveStep[] {
  return [
    {
      element: '.top-bar',
      popover: {
        title: t('workflow.guide.editView.infoTitle'),
        description: t('workflow.guide.editView.infoDesc'),
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '.device-stage',
      popover: {
        title: t('workflow.guide.editView.screenTitle'),
        description: t('workflow.guide.editView.screenDesc'),
        side: 'right',
        align: 'center'
      }
    },
    {
      element: '.device-toolbar',
      popover: {
        title: t('workflow.guide.editView.modeTitle'),
        description: t('workflow.guide.editView.modeDesc'),
        side: 'bottom',
        align: 'center'
      }
    },
    {
      element: '.side-panel',
      popover: {
        title: t('workflow.guide.editView.editorTitle'),
        description: t('workflow.guide.editView.editorDesc'),
        side: 'left',
        align: 'center'
      }
    },
    {
      element: '.action-bar',
      popover: {
        title: t('workflow.guide.editView.saveRunTitle'),
        description: t('workflow.guide.editView.saveRunDesc'),
        side: 'top',
        align: 'center'
      }
    },
    {
      element: '.device-btn',
      popover: {
        title: t('workflow.guide.editView.switchTitle'),
        description: t('workflow.guide.editView.switchDesc'),
        side: 'bottom',
        align: 'end'
      }
    }
  ]
}

// ═══ ④ 首次元素拾取 ═══

export function getElementPickSteps(): DriveStep[] {
  return [
    {
      element: '.popover-slot',
      popover: {
        title: t('workflow.guide.elementPick.panelTitle'),
        description: t('workflow.guide.elementPick.panelDesc'),
        side: 'left',
        align: 'start'
      }
    },
    {
      element: '.hero-card',
      popover: {
        title: t('workflow.guide.elementPick.recommendTitle'),
        description: t('workflow.guide.elementPick.recommendDesc'),
        side: 'left',
        align: 'start'
      }
    },
    {
      element: '.candidate-picker',
      popover: {
        title: t('workflow.guide.elementPick.candidateTitle'),
        description: t('workflow.guide.elementPick.candidateDesc'),
        side: 'left',
        align: 'start'
      }
    },
    {
      element: '.switch-btn',
      popover: {
        title: t('workflow.guide.elementPick.detailTitle'),
        description: t('workflow.guide.elementPick.detailDesc'),
        side: 'top',
        align: 'start'
      }
    }
  ]
}

// ═══ ⑤ 冻结模式 ═══

export function getFrozenModeSteps(): DriveStep[] {
  return [
    {
      element: '.device-toolbar',
      popover: {
        title: t('workflow.guide.frozenMode.enteredTitle'),
        description: t('workflow.guide.frozenMode.enteredDesc'),
        side: 'bottom',
        align: 'center'
      }
    },
    {
      element: '.device-frame',
      popover: {
        title: t('workflow.guide.frozenMode.operateTitle'),
        description: t('workflow.guide.frozenMode.operateDesc'),
        side: 'right',
        align: 'center'
      }
    },
    {
      element: '.mode-btn',
      popover: {
        title: t('workflow.guide.frozenMode.switchBackTitle'),
        description: t('workflow.guide.frozenMode.switchBackDesc'),
        side: 'bottom',
        align: 'center'
      }
    }
  ]
}

// ═══ ⑥ 选择器详情 ═══

export function getSelectorDetailSteps(): DriveStep[] {
  return [
    {
      element: '.details-pane',
      popover: {
        title: t('workflow.guide.selectorDetail.viewTitle'),
        description: t('workflow.guide.selectorDetail.viewDesc'),
        side: 'left',
        align: 'start'
      }
    },
    {
      element: '.strategy-list',
      popover: {
        title: t('workflow.guide.selectorDetail.strategyTitle'),
        description: t('workflow.guide.selectorDetail.strategyDesc'),
        side: 'left',
        align: 'start'
      }
    },
    {
      element: '.property-list',
      popover: {
        title: t('workflow.guide.selectorDetail.propertyTitle'),
        description: t('workflow.guide.selectorDetail.propertyDesc'),
        side: 'left',
        align: 'start'
      }
    }
  ]
}
