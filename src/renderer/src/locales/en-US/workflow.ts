export default {
  yamlEditor: 'YAML Editor',
  deviceScreen: 'Device Screen',
  selectDevice: 'Select Device',
  run: 'Run',
  stop: 'Stop',
  running: 'Running...',
  selectDeviceFirst: 'Please select a device first',
  yamlEmpty: 'YAML content is empty',
  runFailed: 'Run failed',
  stopped: 'Stopped',
  stopFailed: 'Stop failed',
  retryConnection: 'Retry',
  connecting: 'Connecting...',
  connectionFailed: 'Connection failed',
  noDeviceConnected: 'No Device Connected',
  noDeviceDesc: 'Select a running device from the top-right corner',
  saved: 'Saved & formatted',
  inspector: {
    title: 'Element Selector',
    enable: 'Enable',
    disable: 'Close Selector',
    cancelPicking: 'Cancel',
    repick: 'Re-select',
    needDevice: 'Connect a device first',
    hoverHint: 'Hover to preview\nClick to select & generate commands',
    locked: 'Selected',
    attributes: 'Attributes',
    position: 'Position',
    state: 'State',
    clickable: 'Clickable',
    focusable: 'Focusable',
    enabled: 'Enabled',
    scrollable: 'Scrollable',
    checked: 'Checked',
    selected: 'Selected',
    copied: 'Copied',
    commands: 'Quick Commands',
    insert: 'Insert',
    copy: 'Copy'
  },
  actionModal: {
    title: 'Actions for this element',
    search: 'Search commands...',
    noResult: 'No matching commands found',
    copied: 'Copied',
    run: 'Run',
    edit: 'Edit',
    copy: 'Copy',
    keyboard: {
      navigate: 'Navigate',
      copy: 'Copy',
      edit: 'Edit',
      run: 'Run',
      search: 'Search',
      close: 'Close'
    }
  },
  editor: {
    yamlCannotSave: 'YAML has errors, cannot save',
    saveFailed: 'Save failed',
    saveSuccess: 'Saved successfully',
    yamlErrorLeaveBody:
      'Current YAML has syntax errors and cannot be saved. Discard changes and leave?',
    yamlErrorLeaveTitle: 'YAML Error',
    discardAndLeave: 'Discard & Leave',
    continueEditing: 'Continue Editing',
    unsavedBody: 'This script has unsaved changes. Save before leaving?',
    unsavedTitle: 'Unsaved Changes',
    saveAndLeave: 'Save & Leave',
    discardChanges: 'Discard Changes',
    switchedTo: 'Switched to: {name}',
    pickElementHint: 'Click an element on the device to insert',
    elementAdded: 'Added to steps',
    yamlValidationFailed: 'YAML validation failed, please fix first',
    selectDeviceAndAddSteps: 'Please select a device and add steps first'
  },
  engine: {
    offline: 'flow-engine offline, host unreachable',
    notInstalled: 'flow-engine not deployed, cannot run',
    updateAvailable: 'flow-engine is outdated, update before running',
    checking: 'Checking flow-engine…'
  },
  grid: {
    emptyTitle: 'No Scripts Yet',
    emptyDesc:
      'Create a script, define steps and parameters, then run it on multiple devices at once.',
    emptyCreate: 'Create Your First Script',
    featSteps: 'Write Steps',
    featStepsDesc: 'Pick actions from the library',
    featParams: 'Configure Params',
    featParamsDesc: 'Fine-tune each step',
    featBatch: 'Batch Run',
    featBatchDesc: 'Run on multiple devices',
    noMatchTitle: 'No results for "{keyword}"',
    noMatchDesc: 'Try a different keyword or create a new script.',
    clearSearch: 'Clear Search',
    newScript: 'New Script'
  },
  stage: {
    yamlError: '⚠ YAML Error · Cannot add steps',
    frozenMode: '🧊 Frozen · Operate device freely',
    pickMode: '🎯 Pick Mode · Click elements to add steps',
    switchToPick: 'Switch to Pick',
    switchToFreeze: 'Switch to Freeze',
    retry: 'Retry',
    connecting: 'Connecting...',
    noDevice: 'No Device Connected',
    noDeviceHint: 'Will connect automatically when creating a script'
  },
  topBar: {
    untitled: 'Untitled Script',
    running: 'Running',
    runError: 'Run Failed',
    runSuccess: '✓ Run Complete',
    pickMode: 'Pick Mode · Click elements to add steps',
    idle: 'Idle',
    backToList: 'Back to list',
    unsavedChanges: 'Unsaved changes',
    changeDevice: 'Change Device',
    syntaxGuide: 'Syntax Guide',
    cantSwitchRunning: 'Cannot switch device while running',
    cantSwitchDeploying: 'Cannot switch device while deploying',
    engineOnline: 'Online',
    engineOffline: 'Offline',
    engineNotInstalled: 'Not Installed',
    engineUpdateAvailable: 'Update Required',
    engineOnlineTitle: 'flow-engine online',
    engineOfflineTitle: 'flow-engine offline — host unreachable (check network)',
    engineNotInstalledTitle: 'flow-engine not deployed — contact admin to install',
    engineUpdateAvailableTitle:
      'flow-engine on this host is outdated. Update it before running scripts.'
  },
  actionBar: {
    stopRun: 'Stop',
    save: 'Save',
    saved: 'Saved',
    run: 'Run'
  },
  yamlErrorBar: {
    defaultTitle: 'YAML has errors — cannot switch to visual mode or run'
  },
  statusBar: {
    steps: '{count} steps',
    lines: '{count} lines',
    errors: '✗ {count} errors',
    noErrors: '✓ No errors'
  },
  switcher: {
    search: 'Search scripts',
    loading: 'Loading…',
    noMatch: 'No match found',
    empty: 'No scripts yet',
    steps: '{count} steps',
    newScript: 'New Script'
  },
  sidePanel: {
    ariaLabel: 'Edit Panel',
    visual: 'Visual',
    errors: '{count} errors',
    syntaxOk: 'Syntax OK'
  },
  stepList: {
    title: 'Step List',
    emptyHint: 'No steps yet, add one below',
    addStep: 'Add Step'
  },
  stepTree: {
    addInContainer: 'Add step',
    branchLabel: 'Branch {index}',
    insertElement: '+ Pick element to insert'
  },
  stepItem: {
    viewYaml: 'View in YAML',
    deleteStep: 'Delete this step'
  },
  engineBanner: {
    title: 'flow-engine Not Ready',
    hint: '— Scripts cannot run. Please install the engine first.',
    install: 'Install Now',
    updateTitle: 'flow-engine Update Required',
    updateHint: '— The engine on this host is outdated. Update it before running scripts.',
    update: 'Update Now'
  },
  deviceDialog: {
    createTitle: 'Create Script',
    switchTitle: 'Switch Device',
    selectDevice: 'Select Target Device',
    hostStats: '{hosts} hosts · {running} running',
    noHosts: 'No online hosts or running devices',
    selectApp: 'Select Target App',
    from: 'From',
    selectDeviceFirst: 'Please select a device on the left first',
    waitingForDevice: 'Waiting for device selection...',
    searchApp: 'Search app name or package...',
    scanFailed: 'Scan failed',
    retryScan: 'Retry Scan',
    noMatchApp: 'No matching apps found',
    noApps: 'No apps installed',
    recentApps: 'Recent Apps',
    allApps: 'All Apps ({count})',
    nameYourScript: 'Name Your Script',
    namePlaceholder: 'e.g. TikTok Auto Like Script',
    scanHint: 'Only apps with a launcher entry are scanned',
    cancel: 'Cancel',
    startCreate: 'Start Creating',
    confirmSwitch: 'Confirm Switch',
    defaultName: '{appName} Automation'
  },
  deploy: {
    title: 'Install flow-engine',
    desc: 'Deploy the automation engine to the target host and start the service',
    targetHost: 'Target Host',
    password: 'Host Password',
    passwordPlaceholder: 'Enter root password',
    checkingVersion: 'Checking engine version…',
    connecting: 'Connecting to host…',
    uploading: 'Uploading engine files…',
    installing: 'Installing and starting service…',
    verifying: 'Verifying service status…',
    failed: 'Deployment Failed',
    success: 'Deployment Successful',
    installSuccess: 'Installed Successfully',
    updateSuccess: 'Updated Successfully',
    alreadyLatest: 'Already on the latest version. Installation skipped.',
    unreachable: 'Target host is unreachable',
    updatePending: 'Detected old version {current}; updating to {bundled}',
    cancel: 'Cancel',
    start: 'Start Deploy',
    done: 'Done',
    close: 'Close',
    retry: 'Retry'
  },
  actionPicker: {
    title: 'Add Step',
    heading: 'Add Action',
    subtitle: 'Select an action to add to the script. You can configure its parameters afterwards.',
    searchPlaceholder: 'Search actions, e.g. click, input, wait...',
    noResult: 'No actions found for "{keyword}"'
  },
  card: {
    openScript: 'Open script {name}',
    delete: 'Delete',
    justNowUpdated: 'Just updated',
    minutesAgoUpdated: '{count} min ago',
    hoursAgoUpdated: '{count} hr ago',
    daysAgoUpdated: '{count} days ago',
    dateUpdated: 'Updated {month}/{day}',
    dateYearUpdated: 'Updated {year}/{month}/{day}',
    dateCreated: 'Created {month}/{day}',
    dateYearCreated: 'Created {year}/{month}/{day}',
    draft: 'Draft',
    stepUnit: 'steps'
  },
  listView: {
    deleteTitle: 'Delete Script',
    deleteConfirm: 'Are you sure you want to delete "{name}"? This cannot be undone.',
    deleteBtn: 'Delete',
    cancelBtn: 'Cancel',
    deleted: 'Deleted',
    deleteFailed: 'Delete failed',
    loadFailed: 'Load failed'
  },
  filterBar: {
    ariaLabel: 'App groups',
    all: 'All'
  },
  elementPopover: {
    copied: 'Copied',
    selectorStrategy: 'Selector Strategy',
    elementProperties: 'Element Properties',
    viewDetails: 'View details / selectors',
    backToActions: 'Back to actions',
    noAnchor: 'No text/id anchor found, only coordinates available',
    lowStability: 'Script may be unstable, try picking an element with text',
    close: 'Close',
    escClose: 'Esc to close'
  },
  yamlPreview: {
    collapse: 'Collapse YAML',
    expand: 'View YAML',
    noPreview: '# (Unable to generate preview)'
  },
  yamlEditorHover: {
    executionFailed: '**Execution Failed**'
  },
  appRow: {
    daysAgo: '{count}d ago',
    hoursAgo: '{count}h ago',
    minutesAgo: '{count}m ago',
    justNow: 'Just now'
  },
  actionPane: {
    otherActions: 'Other Actions',
    noRecommendation: 'No suitable recommendations for this element'
  },
  heroCard: {
    smartRecommend: 'Smart Pick',
    clickToApply: 'Click to apply'
  },
  candidatePicker: {
    clickableArea: 'Clickable area (no anchor)',
    noAnchor: 'No text anchor',
    label: 'Candidates',
    sortHint: 'Sorted by area · smaller (more specific) elements first'
  },
  statusChip: {
    steps: '{count} steps',
    draft: 'Draft'
  },
  stepEditor: {
    collapse: 'Collapse',
    collapseEditor: 'Collapse editor'
  },
  autoForm: {
    primaryParams: 'Primary Parameters',
    complexHint: 'Complex structure — edit in YAML editor',
    moreSettings: 'More Settings ({count})',
    common: 'Common',
    labelField: 'Label',
    labelPlaceholder: 'For your reference only, shown in run logs',
    skipOnFail: 'Skip on failure',
    skipOnFailHint: "This step failing won't stop the flow",
    chanceField: 'Run by chance',
    chanceHint: '0–1, e.g. 0.3 = 30% chance'
  },
  deviceStage: {
    connectionFailed: 'Connection failed'
  },
  actionLabel: {
    tapOn: 'Tap',
    longPressOn: 'Long Press',
    doubleTapOn: 'Double Tap',
    pressKey: 'Press Key',
    back: 'Press Back',
    hideKeyboard: 'Hide Keyboard',
    inputText: 'Input Text',
    eraseText: 'Clear Input',
    pasteText: 'Paste',
    setClipboard: 'Set Clipboard',
    copyTextFrom: 'Copy Element Text',
    inputRandomText: 'Random Letters',
    inputRandomNumber: 'Random Numbers',
    inputRandomEmail: 'Random Email',
    inputRandomPersonName: 'Random Name',
    scroll: 'Scroll Down',
    scrollUntilVisible: 'Scroll Until Visible',
    swipe: 'Swipe',
    sleep: 'Wait',
    waitForAnimationToEnd: 'Wait for Animation',
    extendedWaitUntil: 'Wait Until',
    launchApp: 'Launch App',
    stopApp: 'Stop App',
    killApp: 'Force Stop',
    clearState: 'Clear App Data',
    clearKeychain: 'Clear Keychain',
    assertVisible: 'Assert Visible',
    assertNotVisible: 'Assert Not Visible',
    assertTrue: 'Assert Expression',
    repeat: 'Repeat',
    retry: 'Retry on Failure',
    branch: 'Conditional Branch',
    runFlow: 'Run Sub-flow',
    takeScreenshot: 'Screenshot',
    setLocation: 'Mock Location',
    openLink: 'Open Link',
    setPermissions: 'Set Permissions',
    shell: 'Run Expression (short)',
    setAirplaneMode: 'Airplane Mode',
    httpRequest: 'HTTP Request',
    defineVariables: 'Define Variables',
    evalScript: 'Evaluate Expression',
    runScript: 'Run Script'
  },
  actionDesc: {
    tapOn: 'Tap a button or text element',
    longPressOn: 'Long press an element',
    doubleTapOn: 'Double tap an element',
    pressKey: 'Simulate a device key (Back / Home / Enter ...)',
    back: 'Same as pressing the device Back key',
    hideKeyboard: 'Dismiss the virtual keyboard',
    inputText: 'Type into the current input field, supports variables',
    eraseText: 'Delete characters from input field',
    pasteText: 'Paste clipboard content into current input',
    setClipboard: 'Set clipboard content, supports variables',
    copyTextFrom: 'Copy text from a specified element to clipboard',
    inputRandomText: 'Input random letters of specified length',
    inputRandomNumber: 'Input random digits of specified length',
    inputRandomEmail: 'Input a random email address',
    inputRandomPersonName: 'Input a random person name',
    scroll: 'Scroll down one screen',
    scrollUntilVisible: 'Keep scrolling until target element appears',
    swipe: 'Swipe up / down / left / right',
    sleep: 'Pause for a duration (ms)',
    waitForAnimationToEnd: 'Wait until animations stop changing',
    extendedWaitUntil: 'Wait until an element appears / disappears',
    launchApp: 'Launch the configured app with permission / data options',
    stopApp: 'Stop the app normally',
    killApp: 'Force stop the app process',
    clearState: 'Clear app data and cache (like reinstall)',
    clearKeychain: 'Clear saved accounts and passwords',
    assertVisible: 'Fail if target element is not found',
    assertNotVisible: 'Fail if target element is visible',
    assertTrue: 'JS expression must be true, else fail',
    repeat: 'Repeat a group of commands',
    retry: 'Automatically retry on failure',
    branch: 'if / else if / else branching',
    runFlow: 'Run another flow file / sub-command group',
    takeScreenshot: 'Save current screen to specified path',
    setLocation: 'Simulate GPS location',
    openLink: 'Open a web URL or app deep link',
    setPermissions: 'Grant / deny multiple permissions at once',
    shell: 'Shorthand for evalScript, run a JS expression',
    setAirplaneMode: 'Toggle airplane mode on / off',
    httpRequest: 'GET / POST, store response in variable',
    defineVariables: 'Define variables to reference in later commands',
    evalScript: 'Run a JS expression (commonly for variables)',
    runScript: 'Run multi-line JS code or external JS file'
  },
  actionCategory: {
    tap: 'Tap',
    input: 'Input',
    scroll: 'Scroll',
    wait: 'Wait',
    app: 'App Control',
    assert: 'Assert',
    flow: 'Flow',
    device: 'Device',
    http: 'Network',
    script: 'Script'
  },
  actionSummary: {
    toFill: '(to fill)',
    empty: '(empty)',
    unfilled: '(unfilled)',
    useConfigAppId: '(using config appId)',
    charCount: '{count} chars',
    digitCount: '{count} digits',
    branchCount: '{count} branches',
    retryCount: 'retry {count} times',
    varCount: '{count} variables',
    permCount: '{count} items',
    on: 'on',
    off: 'off',
    defaultVal: '(default)',
    waitVisible: 'wait visible {target}',
    waitInvisible: 'wait hidden {target}'
  },
  field: {
    text: 'Display Text',
    id: 'Widget ID',
    index: 'Match Index',
    enabled: 'Must Be Clickable',
    selected: 'Must Be Selected',
    checked: 'Must Be Checked',
    focused: 'Must Be Focused',
    width: 'Width',
    height: 'Height',
    tolerance: 'Size Tolerance',
    point: 'Point (x,y)',
    traits: 'Accessibility Traits',
    delay: 'Delay (ms)',
    repeat: 'Tap Count',
    waitToSettleTimeoutMs: 'Settle Timeout (ms)',
    retryTapIfNoChange: 'Retry If No Change',
    waitUntilVisible: 'Wait Until Visible',
    duration: 'Duration (ms)',
    timeout: 'Timeout (ms)',
    min: 'Min (ms)',
    max: 'Max (ms)',
    visible: 'Element Visible',
    notVisible: 'Element Hidden',
    direction: 'Direction',
    start: 'Start (x,y)',
    end: 'End (x,y)',
    from: 'From Element',
    appId: 'App Package',
    clearState: 'Clear Data on Launch',
    stopApp: 'Stop Running App First',
    clearKeychain: 'Clear Keychain',
    permissions: 'Permissions',
    arguments: 'Launch Arguments',
    charactersToErase: 'Characters to Erase',
    length: 'Length',
    speed: 'Speed (0-100)',
    visibilityPercentage: 'Visibility %',
    centerElement: 'Center Element',
    element: 'Target Element',
    url: 'Request URL',
    method: 'Request Method',
    headers: 'Headers',
    body: 'Request Body',
    outputVariable: 'Output Variable',
    jsonPath: 'JSON Path',
    latitude: 'Latitude',
    longitude: 'Longitude',
    link: 'Link',
    autoVerify: 'Auto Verify',
    browser: 'Force Browser',
    times: 'Times',
    while: 'While Condition',
    commands: 'Sub-commands',
    maxRetries: 'Max Retries',
    file: 'File Path',
    env: 'Variables',
    script: 'Script Content',
    true: 'Expression',
    label: 'Label',
    optional: 'Skip on Failure',
    chance: 'Run Chance (0-1)',
    when: 'Run Condition',
    $value: 'Value'
  },
  guide: {
    listView: {
      welcomeTitle: 'Welcome to Script Editor',
      welcomeDesc:
        'Manage all your automation scripts here. View script count and associated apps.',
      searchTitle: 'Search Scripts',
      searchDesc: 'Type a script or app name to quickly find what you need.',
      groupTitle: 'App Groups',
      groupDesc:
        'Filter by app on the left. Click an app to see its scripts, click "All" to reset.',
      listTitle: 'Script List',
      listDesc:
        'Your scripts are shown as cards here, grouped by app. Click a card to open the editor.',
      createTitle: 'Create Your First Script',
      createDesc:
        'Click here to start: select device → select app → name your script → enter editor.'
    },
    createDialog: {
      wizardTitle: 'Create Script Wizard',
      wizardDesc: 'Three steps: select device → select app → name script. Follow the order.',
      deviceTitle: 'Step 1: Select Device',
      deviceDesc:
        'Choose a running device from the left as your debug target. Devices are grouped by host.',
      appTitle: 'Step 2: Select App',
      appDesc:
        'After selecting a device, installed apps will be scanned automatically. Choose your target app.',
      nameTitle: 'Step 3: Name Your Script',
      nameDesc:
        'Give your script a name. The system will auto-fill "App Name + Automation" as default.',
      confirmTitle: 'Confirm Creation',
      confirmDesc: 'Once everything is set, click "Start Creating" to enter the editor.'
    },
    editView: {
      infoTitle: 'Script Info Bar',
      infoDesc:
        'Shows script name, associated app, and run status. Double-click the name to rename; use dropdown to switch scripts.',
      screenTitle: 'Device Screen',
      screenDesc:
        'Live device display. In Pick Mode, click UI elements to auto-detect and recommend actions, generating steps instantly.',
      modeTitle: 'Mode Switch',
      modeDesc:
        'Pick Mode captures elements for steps; Freeze Mode lets you operate the phone — swipe, navigate, then switch back.',
      editorTitle: 'YAML Editor',
      editorDesc:
        'The code editor on the right. Picked elements auto-insert YAML code, or you can write and edit manually.',
      saveRunTitle: 'Save & Run',
      saveRunDesc:
        'Click Save (⌘S) when done, then Run to execute on the device. You can stop anytime during execution.',
      switchTitle: 'Switch Device',
      switchDesc: 'Need to test on another device? Click here to switch target.'
    },
    elementPick: {
      panelTitle: 'Element Details Panel',
      panelDesc:
        'This panel appears after clicking a screen element, showing its type, attributes, and position.',
      recommendTitle: 'Smart Recommendations',
      recommendDesc:
        'The system auto-recommends the best action (tap, input, swipe, etc.) based on element type. Click the card to add it as a step.',
      candidateTitle: 'Candidate Elements',
      candidateDesc:
        'Multiple elements may overlap at the same position. Expand the list to switch to a more precise target.',
      detailTitle: 'View Selector Details',
      detailDesc:
        'Switch to the property view to see selector strategies (text/ID/coordinates) and detailed attributes for manual tuning.'
    },
    frozenMode: {
      enteredTitle: 'Freeze Mode Active',
      enteredDesc:
        'In Freeze Mode, you can freely operate the phone — swipe, open apps, navigate without triggering element capture.',
      operateTitle: 'Operate the Screen',
      operateDesc:
        'Now you can freely interact — swipe, tap, navigate to the page where you want to pick elements.',
      switchBackTitle: 'Switch Back to Pick Mode',
      switchBackDesc:
        'Once you reach the target page, click here to return to Pick Mode and continue adding steps.'
    },
    selectorDetail: {
      viewTitle: 'Element Details View',
      viewDesc: 'Shows all positioning strategies and property info for the current element.',
      strategyTitle: 'Selector Strategies',
      strategyDesc:
        'Lists all positioning methods (text, ID, coordinates). Higher scores are more stable; the top choice is used in generated YAML.',
      propertyTitle: 'Element Properties',
      propertyDesc:
        'Shows complete element properties (class, bounds, size, text). Click a row to copy the value.'
    }
  },
  recommendation: {
    ancestorClickable: 'nearest clickable ancestor',
    ancestorScrollable: 'nearest scrollable container',
    ancestorEditable: 'nearest editable ancestor',
    ancestorCheckable: 'nearest checkable ancestor',
    ancestorFocusable: 'nearest focusable ancestor',
    self: 'self',
    upgraded: 'Source not interactive, upgraded to {relation}, best for {action} (score {score})',
    bestMatch: 'Best match: {action} (score {score})',
    multiStep: 'Multi-step: execute {steps} in sequence',
    suitsCurrent: 'Suits this element',
    insertOneStep: 'Click to insert 1 step',
    currentElement: '{name} this element'
  },
  popover: {
    element: 'Element',
    strategyTextIndexed: 'By text + index disambiguation',
    strategyText: 'By text match',
    strategyIdIndexed: 'By id + index disambiguation',
    strategyId: 'By id match',
    strategySpatial: 'By spatial relation',
    strategyTraits: 'By accessibility traits',
    strategyPoint: 'By coordinate fallback',
    reasonUnique: 'Unique match, layout-independent',
    reasonIndexed: 'Index-disambiguated, usually stable',
    reasonMayChange: 'May be affected by UI changes',
    reasonFragile: 'Breaks on different device or resolution'
  },
  misc: {
    unnamedApp: 'Unnamed App',
    loadDeviceFailed: 'Failed to load host / device data',
    scanTimeout: 'Scan timed out, please check device network',
    guideNext: 'Next',
    guidePrev: 'Previous',
    guideDone: 'Done'
  },
  yamlSchema: {
    // ── Common fields ──
    commonWhen: '⚡ Only execute this step when the condition is met, otherwise skip',
    commonChance:
      '🎲 Execute by probability\n\nRange `0.0`–`1.0`, e.g. `0.3` = 30% chance\n\nMutually exclusive with `when` (if both present, only `when` takes effect)',
    commonLabel: 'Give this step a name for easier identification in run logs\n\n`string`',
    commonOptional:
      'If this step fails, skip it and continue the flow\n\n`boolean` default `false`',

    // ── Element selector ──
    selectorTitle: 'Element Selector',
    selectorDesc:
      'Find an element on screen (button, text, icon, etc). Match by text, ID, state, or spatial relation; all conditions must be met.',
    selectorText:
      'Find by displayed text (supports regex)\n\ne.g. `"Login"` `"^OK$"` `"Price：\\\\d+"`',
    selectorId: 'Find by widget ID (no package prefix needed)\n\ne.g. `"btn_login"`',
    selectorEnabled:
      'Only select clickable (or non-clickable) elements\n\n`true` = clickable, `false` = not clickable',
    selectorSelected:
      'Only select elements in selected state\n\n`true` = selected, `false` = not selected',
    selectorChecked:
      'Only select checked elements (checkbox / toggle)\n\n`true` = checked, `false` = unchecked',
    selectorFocused:
      'Only select the currently focused element (e.g. active text input)\n\n`true` = focused',
    selectorWidth: 'Find by width\n\nUnit: pixels (px)',
    selectorHeight: 'Find by height\n\nUnit: pixels (px)',
    selectorTolerance: 'Allowed deviation for width/height (±pixels)\n\nDefault `0` (exact match)',
    selectorIndex:
      'When multiple matches, pick which one\n\nStarts from 0: `0` first, `1` second; negative counts from end: `-1` last',
    selectorOptional: 'Skip without error if not found\n\n`boolean` default `false`',
    selectorBelow: 'Target element must be below this element',
    selectorAbove: 'Target element must be above this element',
    selectorLeftOf: 'Target element must be to the left of this element',
    selectorRightOf: 'Target element must be to the right of this element',
    selectorChildOf: 'Target element must be inside this element (nested within)',
    selectorContainsChild: 'Target element must directly contain this child element',
    selectorContainsDescendants: 'Target element must contain all listed descendant elements',
    selectorTraits:
      'Find by accessibility traits, space-separated\n\ne.g. `"clickable enabled"` = clickable and enabled',

    // ── Condition ──
    conditionTitle: 'Condition',
    conditionDesc:
      'Define a condition for `when` (execute if true), `repeat.while` (loop condition), `extendedWaitUntil` (wait condition), etc.',
    conditionVisible: 'Condition is met when this element is visible on screen',
    conditionNotVisible: 'Condition is met when this element is not visible on screen',
    conditionTrue:
      'Write a JS expression; condition is met when result is `true`\n\ne.g. `"$\\{counter < 10\\}"`',
    conditionLabel: 'Give this condition a name for easier identification in logs',

    // ── Tap series ──
    tapText: 'Find by displayed text (supports regex)',
    tapId: 'Find by widget ID (no package prefix needed)',
    tapIndex: 'When multiple matches, pick which one\n\nStarts from 0; `-1` = last',
    tapEnabled: 'Only select clickable (or non-clickable) ones',
    tapSelected: 'Only select already selected ones',
    tapChecked: 'Only select checked ones (checkbox / toggle)',
    tapFocused: 'Only select the currently focused one (e.g. active input)',
    tapWidth: 'Find by width\n\nUnit: pixels (px)',
    tapHeight: 'Find by height\n\nUnit: pixels (px)',
    tapTolerance: 'Allowed deviation for width/height (±pixels)\n\nDefault `0`',
    tapBelow: 'Target element must be below this element',
    tapAbove: 'Target element must be above this element',
    tapLeftOf: 'Target element must be to the left of this element',
    tapRightOf: 'Target element must be to the right of this element',
    tapChildOf: 'Target element must be inside this element',
    tapContainsChild: 'Target element must directly contain this child element',
    tapContainsDescendants: 'Target element must contain all listed descendant elements',
    tapTraits: 'Find by accessibility traits, space-separated\n\ne.g. `"clickable enabled"`',
    tapPoint:
      'Tap by screen coordinates\n\nAbsolute `"x,y"` e.g. `"360,800"`; percentage `"50%,80%"` resolution-independent',
    tapOptional: 'Skip without error if element not found\n\nDefault `false`',
    tapWaitUntilVisible: 'Wait for the element to appear before tapping',
    tapWaitToSettleTimeoutMs:
      'Wait for UI to stop changing after tap\n\nUnit: ms, default `1500`, max `30000` (clamped)',
    tapRetryTapIfNoChange:
      'Automatically retry tap if no UI change detected\n\nDefault `false` (no retry)',
    tapRepeat: 'Tap multiple times in a row\n\nUse with `delay`',
    tapDelay: 'Interval between consecutive taps\n\nUnit: ms, default `100`',
    tapLabel: 'Give this step a name for easier identification in logs',

    // ── appId object ──
    appIdDesc: 'App package name; omit to use the `appId` from config section',

    // ── Helper hints ──
    helperBoolTrigger: 'Just write `true` to trigger (no parameters)',
    helperStringParam: 'Pass a string parameter',
    helperAppIdHint: 'App package name (e.g. `com.example.app`)',
    helperFixedMs: 'Fixed milliseconds',
    helperRandomRange: 'Write as `[min, max]` for a random value in range (unit: ms)',

    // ── Command enum header ──
    cmdTitle: 'Script Command',
    cmdDesc:
      'Write the command name directly (no params), or command name + params (after the colon)',

    // ── Bare command enum descriptions ──
    enumLaunchApp: '🚀 Launch the configured app',
    enumStopApp: '⏹️ Stop the configured app',
    enumKillApp: '🔴 Force-kill the configured app',
    enumClearState: '🗑️ Clear app data and cache',
    enumClearKeychain: '🔑 Clear app credentials cache',
    enumScroll: '📜 Scroll down once',
    enumBack: '⬅️ Press Back button',
    enumHideKeyboard: '⌨️ Dismiss virtual keyboard',
    enumHideKeyboardAlias: '⌨️ Dismiss virtual keyboard (space-separated alias)',
    enumPasteText: '📋 Paste clipboard content',
    enumEraseText: '⌫ Delete input text (default 50 chars)',
    enumInputRandomText: '🎲 Input 8 random letters',
    enumInputRandomNumber: '🎲 Input random number',
    enumInputRandomEmail: '📧 Input random email',
    enumInputRandomPersonName: '👤 Input random person name',
    enumWaitForAnimationToEnd: '⏱️ Wait for animation to end (default `15000` ms)',

    // ── launchApp ──
    launchAppDesc: '🚀 Launch app\n\nPass package name directly, or use a config object',
    launchAppAppIdHint: 'App package name, e.g. `com.example.app`',
    launchAppClearState: 'Clear app data before launch (like a fresh install)\n\nDefault `false`',
    launchAppStopApp: 'Stop app first if already running before launch\n\nDefault `true`',
    launchAppClearKeychain: 'Clear saved credentials for the app',
    launchAppPermissions:
      'Pre-set permissions on launch: `permission: allow or deny`\n\ne.g. `camera: allow` `location: deny`',
    launchAppArguments:
      'Extra parameters passed to the app on launch (Android Intent extras)\n\nAll key-values are strings, e.g. `from: push`',

    // ── stopApp / killApp / clearState ──
    stopAppDesc: '⏹️ Stop app',
    killAppDesc: '🔴 Force-kill app',
    clearStateDesc: '🗑️ Clear app data',

    // ── Tap commands ──
    tapOnDesc: '👆 Tap element\n\nTap by text, ID, or screen coordinates',
    tapOnHint: 'Button / text content to tap (supports regex)',
    longPressOnDesc: '👆 Long press element\n\nSame usage as `tapOn`',
    longPressOnHint: 'Button / text content to long press (supports regex)',
    doubleTapOnDesc: '👆 Double tap element\n\nSame usage as `tapOn`',
    doubleTapOnHint: 'Button / text content to double tap (supports regex)',

    // ── swipe ──
    swipeDesc: '👉 Swipe screen\n\nSwipe by direction, or from start to end coordinates',
    swipeEnumUp: '⬆️ Swipe up',
    swipeEnumDown: '⬇️ Swipe down',
    swipeEnumLeft: '⬅️ Swipe left',
    swipeEnumRight: '➡️ Swipe right',
    swipeDirection: 'Swipe direction',
    swipeDuration: 'Duration of one swipe in ms, default `400`',
    swipeStart: 'Start coordinates, format `"x,y"` or percentage `"50%,80%"`',
    swipeEnd: 'End coordinates, same format as start',
    swipeFrom: "Start swiping from this element's position",
    swipeWaitToSettleTimeoutMs:
      'Wait for UI to stop changing after swipe\n\nUnit: ms, default `1500`',

    // ── scroll ──
    scrollDesc: '📜 Scroll down once',

    // ── scrollUntilVisible ──
    scrollUntilVisibleDesc: '📜 Keep scrolling until target element appears',
    scrollUntilVisibleElement: 'Target element to find (required)',
    scrollUntilVisibleDirection: 'Scroll direction\n\nDefault `DOWN`',
    scrollUntilVisibleTimeout:
      'Max scroll duration\n\nUnit: ms, default `20000`, times out on exceed',
    scrollUntilVisibleSpeed: 'Scroll speed (`0` slowest, `100` fastest)\n\nDefault `40`',
    scrollUntilVisibleVisibilityPct:
      'How much of the element must be visible to count as "found"\n\n`0`–`100`, default `100` (fully visible)',
    scrollUntilVisibleCenterElement:
      'After finding, continue scrolling to center the element on screen\n\nDefault `false`',
    scrollUntilVisibleWaitToSettle:
      'Wait for UI to stop changing after each scroll\n\nUnit: ms, default `1500`',
    scrollUntilVisibleFrom:
      'Scroll within a specific container (not full screen)\n\ne.g. `id: "list_container"`',

    // ── inputText ──
    inputTextDesc:
      '⌨️ Type text in the current input field\n\nAccepts text or number, supports variables `"$\\{USERNAME\\}"`',

    // ── eraseText ──
    eraseTextDesc: '⌫ Delete text\n\nDelete characters from the input field',
    eraseTextIntHint: 'Number of characters to delete (default `50`)',
    eraseTextPropHint: 'Number of characters to delete',

    // ── inputRandomText ──
    inputRandomTextDesc: '🎲 Input random text',
    inputRandomTextIntHint: 'Random text length (default `8`)',
    inputRandomTextPropHint: 'Text length',

    // ── inputRandomNumber ──
    inputRandomNumberDesc: '🎲 Input random number',
    inputRandomNumberIntHint: 'Number of random digits',
    inputRandomNumberPropHint: 'Number of digits',

    // ── inputRandomEmail / inputRandomPersonName ──
    inputRandomEmailDesc: '📧 Input random email address',
    inputRandomPersonNameDesc: '👤 Input random person name',

    // ── pressKey ──
    pressKeyDesc: '🔘 Press key\n\nSimulate pressing a device key, case-insensitive',
    pressKeyStringHint: [
      'Key name (case-insensitive; multi-word keys use spaces, e.g. `Volume Up`)',
      '',
      '**Common**: `Home` · `Back` · `Enter` · `Tab` · `Delete` · `Backspace` · `Space` · `Escape` · `Menu` · `Search` · `Power` · `Camera` · `Clear` · `Lock`',
      '**Volume / Page**: `Volume Up` · `Volume Down` · `Page Up` · `Page Down`',
      '**D-Pad**: `DPad Up` · `DPad Down` · `DPad Left` · `DPad Right` · `DPad Center`',
      '**Letters/Numbers**: `A`–`Z` · `0`–`9`',
      '**Symbols**: `Comma` · `Period` · `Grave` · `Minus` · `Equals` · `Semicolon` · `Apostrophe` · `Slash` · `Backslash` · `Left Bracket` · `Right Bracket` · `At` · `Plus` · `Star` · `Pound`',
      '**Numpad**: `Numpad 0`–`Numpad 9`',
      '**Other**: `Call` · `EndCall` · `Forward Delete`'
    ].join('\n'),
    pressKeyIntHint: 'You can also use Android key code numbers directly\n\n`integer`',

    // ── hideKeyboard / back ──
    hideKeyboardDesc: '⌨️ Dismiss virtual keyboard',
    backDesc: '⬅️ Press Back button',

    // ── assertions ──
    assertVisibleDesc:
      '✅ Assert element is visible\n\nWaits up to `17000` ms (17 seconds), fails on timeout',
    assertVisibleHint: 'Text expected to be visible (supports regex)',
    assertNotVisibleDesc:
      '❌ Assert element is not visible\n\nFails if visible (waits up to `7000` ms)',
    assertNotVisibleHint: 'Text that should not appear (supports regex)',
    assertTrueDesc:
      '🧪 Assert condition is true\n\nWrite a JS expression, e.g. `"$\\{counter > 0\\}"`, must evaluate to true',

    // ── sleep ──
    sleepDesc: '⏱️ Pause for a duration\n\nFixed ms, `[min, max]` random range, or object form',
    sleepFixedMs: 'Fixed wait (milliseconds)',
    sleepRandomRange: 'Write as `[min, max]` for random wait in range (unit: ms)',
    sleepDuration: 'Fixed duration (ms)',
    sleepMin: 'Minimum random wait (ms)',
    sleepMax: 'Maximum random wait (ms)',

    // ── waitForAnimationToEnd ──
    waitAnimDesc:
      '⏱️ Wait for animation to finish and UI to settle\n\nUnit: ms, default max `15000`',
    waitAnimDefault: 'Use default timeout `15000` ms',
    waitAnimCustom: 'Custom timeout (ms)',
    waitAnimTimeout: 'Timeout\n\nUnit: ms, default `15000`',

    // ── extendedWaitUntil ──
    extWaitDesc:
      '⏱️ Wait until a condition is met\n\nWait for element to appear / disappear, or until timeout',
    extWaitVisible: 'Wait until this element appears',
    extWaitNotVisible: 'Wait until this element disappears',
    extWaitTimeout: 'Max wait time\n\nUnit: ms, default `17000`, times out on exceed',

    // ── repeat ──
    repeatDesc:
      '🔄 Loop a set of commands\n\nThree stop modes (combinable): count `times` / duration `duration` / condition `while`\n\nLimit: max `1000` iterations, default max `30` minutes without `duration`',
    repeatTimes: 'Number of repetitions\n\ne.g. `3` = execute 3 times',
    repeatDuration: 'Total run time\n\nUnit: ms; also accepts `[min, max]` for random',
    repeatDurationRandom: 'Write as `[min, max]` for a random duration in range (unit: ms)',
    repeatWhile: 'Loop condition: keep running until condition becomes false',
    repeatCommands: 'Commands to execute repeatedly (required)',

    // ── retry ──
    retryDesc: '🔁 Auto-retry on failure\n\nAutomatically retry when commands fail',
    retryMaxRetries: 'Max retries after initial failure, default `1`, max `3`',
    retryCommands: 'Commands to attempt (required)',

    // ── runFlow ──
    runFlowDesc:
      '📂 Run a sub-flow\n\nSpecify a file path directly, or inline the commands in YAML',
    runFlowStringHint: 'File path to another YAML sub-flow',
    runFlowCommands: 'Sub-flow command list (mutually exclusive with `file`)',
    runFlowFile: 'Sub-flow file path (mutually exclusive with `commands`)',
    runFlowEnv:
      'Variables specific to the sub-flow (override or add to parent variables)\n\ne.g. `USER: zhangsan`',

    // ── branch ──
    branchDesc:
      '🔀 Conditional branch (if / else if / else)\n\nExecutes the first branch whose condition is met; a branch without `when` acts as fallback',
    branchWhen: 'Condition to enter this branch; omit `when` for fallback (acts as `else`)',
    branchCommands: 'Commands for this branch (required)',

    // ── defineVariables / evalScript / runScript ──
    defineVariablesDesc:
      '📝 Define variables, reference later with `$\\{varName\\}`\n\ne.g. `USERNAME: zhangsan`, then use `$\\{USERNAME\\}` in commands\n\n⚠️ All keys except `when`/`chance` are treated as variable names',
    evalScriptDesc:
      '📜 Execute a JS expression (commonly used to update variables)\n\ne.g. `"$\\{counter = counter + 1\\}"`',
    runScriptDesc:
      '📜 Run a JS script\n\nWrite code directly, use object config, or reference an external file',
    runScriptStringHint: 'Write JS code directly',
    runScriptScript: 'JS code (mutually exclusive with `file`)',
    runScriptFile: 'External JS file path (mutually exclusive with `script`)',
    runScriptEnv: 'Variables accessible during script execution',

    // ── clipboard ──
    copyTextFromDesc: '📋 Copy text from specified element to clipboard',
    copyTextFromHint: 'Target element to copy text from',
    pasteTextCmdDesc: '📋 Paste clipboard content to current input field',
    setClipboardDesc: '📋 Set clipboard content\n\nSupports `$\\{varName\\}` substitution',

    // ── device ──
    setLocationDesc: '📍 Simulate GPS location',
    setLocationLatitude: 'Latitude (north-south coordinate), range `-90.0` to `90.0`',
    setLocationLongitude: 'Longitude (east-west coordinate), range `-180.0` to `180.0`',
    openLinkDesc: '🔗 Open link\n\nWeb URL or app deep link',
    openLinkStringHint: 'Web URL or app deep link (e.g. `myapp://home`)',
    openLinkLink: 'Web URL or app deep link (e.g. `myapp://home`)',
    openLinkAutoVerify: 'Let the system auto-verify this link (Android App Links mechanism)',
    openLinkBrowser: 'Force open in browser, skip in-app navigation',
    takeScreenshotDesc: '📷 Take screenshot and save to specified path',
    setPermissionsDesc: '🔐 Batch-set app permissions',
    setPermissionsPermissions:
      'Permission: `allow` (grant) / `deny` (revoke)\n\ne.g. `camera: allow` `location: deny`',
    shellDesc: '📜 Execute JS expression (`evalScript` shorthand, not a system shell)',
    shellHint: 'JS expression, e.g. `"counter = counter + 1"`',
    setAirplaneModeDesc: '✈️ Toggle airplane mode on / off',
    setAirplaneModeBool: '`true` enables airplane mode, `false` disables',
    setAirplaneModeEnabled: 'On or off\n\nDefault `true` (on)',

    // ── httpRequest ──
    httpDesc: '🌐 Send an HTTP request\n\nStore response in a variable for later use',
    httpUrl: 'Request URL (required), supports `$\\{varName\\}` substitution',
    httpMethod: 'Request method, default `GET`',
    httpEnumGet: '📥 GET (fetch data)',
    httpEnumPost: '📤 POST (submit data)',
    httpHeaders: 'Request headers, all key-values are strings\n\ne.g. `Authorization: Bearer xxx`',
    httpBody: 'POST request body, write a JSON structure (can be nested)',
    httpOutputVariable:
      'Store the response in this variable name, reference later with `$\\{varName\\}`',
    httpJsonPath:
      'Extract a specific field from the response JSON (dot-separated)\n\ne.g. `"data.code"` extracts `code` from `data`',
    httpRetry: 'Auto-retry configuration on failure',
    httpRetryTimes: 'Max retry count, default `1` (one retry after initial failure)',
    httpRetryInterval: 'Interval between retries\n\nUnit: ms, default `3000`',

    // ── Config section ──
    configTitle: 'Script Config',
    configDesc: 'Config section: written at the top, separated from commands below by `---`',
    configAppId: '📱 App package name to automate (required), e.g. `com.example.app`',
    configName: '📛 Name of this flow (for identification)',
    configUrl: '🔗 Web URL to automate (only for web automation)',
    configTags: '🏷️ Tags for the flow, a string array (for categorization / filtering)',
    configEnv:
      '🔧 Define flow-wide variables\n\ne.g. `USERNAME: zhangsan`, reference in commands with `$\\{USERNAME\\}`',
    configOnFlowStart: '▶️ Commands to execute before the flow starts (preparation)',
    configOnFlowComplete:
      '⏏️ Commands to execute after the flow ends (runs regardless of success/failure, commonly used for cleanup)',
    configExceptionHandlers:
      '🛡️ Popup handler\n\nAutomatically dismiss unexpected popups by tapping the matching button, then continue',
    configExceptionText: 'Button text in the popup to tap (plain text)',
    configExceptionTextProp: 'Button text in the popup to tap (supports regex)',
    configExceptionId: 'Button ID in the popup to tap',
    configExceptionMaxTrigger: 'Max trigger count, prevents infinite loops from recurring popups',
    configExceptionBelow: 'Constrain button to be below a specific element (for disambiguation)',
    configProperties: '📦 Custom metadata, for notes only — does not affect flow execution',

    // ── Command list ──
    commandListTitle: 'Command List',
    commandListDesc:
      'Command section: written after `---`, prefix each command with `- ` (dash + space)'
  }
}
