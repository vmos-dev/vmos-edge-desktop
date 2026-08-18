export default {
  title: 'Task Center',
  stats: {
    total: 'All Tasks',
    running: 'Running',
    done: 'Completed',
    failed: 'Failed'
  },
  table: {
    name: 'Task Name',
    workflow: 'Workflow',
    devices: 'Devices',
    progress: 'Progress',
    status: 'Status',
    duration: 'Duration',
    actions: 'Actions',
    detail: 'Detail',
    cancel: 'Cancel',
    retryFailed: 'Retry Failed',
    delete: 'Delete'
  },
  status: {
    running: 'Running',
    done: 'Completed',
    cancelled: 'Cancelled',
    pending: 'Pending',
    completed: 'Success',
    failed: 'Failed',
    submitFailed: 'Submit Failed',
    partialFailed: 'Partial Failed'
  },
  detail: {
    back: 'Back to Task Center',
    progress: 'Progress',
    duration: 'Duration',
    cancelAll: 'Cancel All',
    cancelDevice: 'Cancel Device',
    retryDevice: 'Retry Device',
    viewLog: 'View Log',
    currentStep: 'Current Step',
    queuing: 'Queuing...',
    screenshot: 'Screenshot',
    failScreenshot: 'Failure Screenshot',
    variables: 'Injected Variables'
  },
  batchExecute: {
    title: 'Run Automation Task',
    selectWorkflow: 'Select Workflow',
    configParams: 'Configure Parameters',
    confirm: 'Confirm Execution',
    searchWorkflow: 'Search workflows...',
    steps: '{count} steps',
    variables: '{count} variables',
    noVariables: 'No variables',
    importCsv: 'Import CSV',
    downloadTemplate: 'Download Template',
    notFilled: 'Not filled',
    defaultValueHint: 'Devices without parameters will use workflow defaults',
    prev: 'Previous',
    next: 'Next',
    startExecute: 'Start Execution'
  },
  confirm: {
    cancelTask: 'Are you sure you want to cancel this task?',
    deleteTask: 'Are you sure you want to delete this task? This cannot be undone.'
  },
  time: {
    justNow: 'Just now',
    minutesAgo: '{count} min ago',
    hoursAgo: '{count} hr ago',
    daysAgo: '{count} days ago'
  }
}
