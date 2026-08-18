export default {
  title: '任務中心',
  stats: {
    total: '全部任務',
    running: '運行中',
    done: '已完成',
    failed: '失敗'
  },
  table: {
    name: '任務名稱',
    workflow: '工作流',
    devices: '裝置數',
    progress: '進度',
    status: '狀態',
    duration: '耗時',
    actions: '操作',
    detail: '詳情',
    cancel: '取消',
    retryFailed: '重試失敗',
    delete: '刪除'
  },
  status: {
    running: '運行中',
    done: '已完成',
    cancelled: '已取消',
    pending: '等待中',
    completed: '成功',
    failed: '失敗',
    submitFailed: '提交失敗',
    partialFailed: '部分失敗'
  },
  detail: {
    back: '返回任務中心',
    progress: '進度',
    duration: '耗時',
    cancelAll: '全部取消',
    cancelDevice: '取消此裝置',
    retryDevice: '重試此裝置',
    viewLog: '查看日誌',
    currentStep: '當前步驟',
    queuing: '排隊中...',
    screenshot: '截圖',
    failScreenshot: '失敗時截圖',
    variables: '注入變量'
  },
  batchExecute: {
    title: '執行自動化任務',
    selectWorkflow: '選擇工作流',
    configParams: '配置參數',
    confirm: '確認執行',
    searchWorkflow: '搜尋工作流...',
    steps: '{count} 步',
    variables: '{count} 個變量',
    noVariables: '無變量',
    importCsv: '匯入 CSV',
    downloadTemplate: '下載範本',
    notFilled: '未填寫',
    defaultValueHint: '未填寫參數的裝置將使用工作流預設值',
    prev: '上一步',
    next: '下一步',
    startExecute: '開始執行'
  },
  confirm: {
    cancelTask: '確定要取消這個任務嗎？',
    deleteTask: '確定要刪除這個任務嗎？刪除後不可恢復。'
  },
  time: {
    justNow: '剛剛',
    minutesAgo: '{count} 分鐘前',
    hoursAgo: '{count} 小時前',
    daysAgo: '{count} 天前'
  }
}
