import 'react-i18next'

// Define the structure of each namespace
export interface CommonTranslations {
  appName: string
  loading: string
  error: string
  success: string
  cancel: string
  confirm: string
  save: string
  delete: string
  edit: string
  close: string
  back: string
  next: string
  previous: string
  continue: string
  retry: string
  refresh: string
  search: string
  filter: string
  sort: string
  clear: string
  reset: string
  apply: string
  ok: string
  yes: string
  no: string
}

export interface UITranslations {
  button: {
    newClaudeSession: string
    backToHome: string
    save: string
    cancel: string
    delete: string
    edit: string
    close: string
    refresh: string
    settings: string
    about: string
    help: string
    fileABug: string
  }
  navigation: {
    ccAgents: {
      title: string
      description: string
    }
    ccProjects: {
      title: string
      description: string
    }
    usageDashboard: {
      title: string
      description: string
    }
    claudeMd: {
      title: string
      description: string
    }
    mcp: {
      title: string
      description: string
    }
    settings: {
      title: string
      description: string
    }
  }
  welcome: {
    title: {
      welcome: string
      tron: string
    }
    subtitle: string
  }
  projects: {
    title: {
      main: string
    }
    description: {
      browse: string
    }
    message: {
      noProjectsFound: string
      loading: string
    }
  }
  titleBar: {
    appName: string
    minimize: string
    maximize: string
    close: string
  }
  toast: {
    success: {
      claudeBinaryPathSaved: string
    }
  }
}

export interface SettingsTranslations {
  title: string
  description: string
  actions: {
    save: string
    saving: string
  }
  tabs: {
    general: string
    permissions: string
    environment: string
    advanced: string
    hooks: string
    commands: string
    storage: string
  }
  general: {
    title: string
    language: {
      label: string
      description: string
    }
    coAuthoredBy: {
      label: string
      description: string
    }
    verboseOutput: {
      label: string
      description: string
    }
    chatTranscriptRetention: {
      label: string
      description: string
    }
    claudeInstallation: {
      title: string
      description: string
      availableInstallations: string
      selectedInstallation: string
      path: string
      actualLocation: string
      source: string
      version: string
      nodeVersion: string
    }
  }
  permissions: {
    title: string
    description: string
  }
  environment: {
    title: string
    description: string
  }
  advanced: {
    title: string
    description: string
  }
  hooks: {
    title: string
    description: string
  }
  commands: {
    title: string
    description: string
  }
  storage: {
    title: string
    description: string
  }
}

export interface ErrorTranslations {
  projects: {
    loadFailed: string
    notFound: string
    accessDenied: string
  }
  sessions: {
    loadFailed: string
    createFailed: string
    deleteFailed: string
  }
  claude: {
    binaryNotFound: string
    invalidPath: string
    executionFailed: string
    stillResponding: string
  }
  network: {
    connectionFailed: string
    timeout: string
    serverError: string
  }
  general: {
    unexpected: string
    fileNotFound: string
    permissionDenied: string
  }
}

export interface NFOTranslations {
  windowTitle: string
  header: string
  subheader: string
  asteriskTagline: string
  sections: {
    credits: string
    dependencies: string
    specialThanks: string
  }
  credits: {
    poweredBy: string
    claudeCode: string
    claudeCodeDesc: string
    mcpProtocol: string
    mcpProtocolDesc: string
  }
  dependencies: {
    runtime: string
    uiFramework: string
    styling: string
    animations: string
    buildTool: string
    packageManager: string
  }
  thanks: {
    openSource: string
    betaTesters: string
    believers: string
  }
  ascii: {
    welcome: string
  }
  footer: {
    sharing: string
    support: string
  }
}

export interface SuccessTranslations {
  claude: {
    binaryPathSaved: string
  }
  projects: {
    created: string
    updated: string
    deleted: string
  }
  sessions: {
    created: string
    updated: string
    deleted: string
  }
  settings: {
    saved: string
    exported: string
    imported: string
  }
}

export interface DialogTranslations {
  confirm: {
    leaveActiveSession: string
    deleteProject: string
    deleteSession: string
    resetSettings: string
  }
  title: {
    confirm: string
    warning: string
    error: string
    info: string
  }
}

export interface HooksTranslations {
  title: string
  description: string
  scope: {
    project: string
    local: string
    user: string
  }
  buttons: {
    templates: string
    addHook: string
    addCommand: string
    addMatcher: string
    addAnother: string
    save: string
    saving: string
  }
  events: {
    PreToolUse: {
      label: string
      description: string
    }
    PostToolUse: {
      label: string
      description: string
    }
    Notification: {
      label: string
      description: string
    }
    Stop: {
      label: string
      description: string
    }
    SubagentStop: {
      label: string
      description: string
    }
  }
  messages: {
    noHooksConfigured: string
    noCommandsAdded: string
    hasUnsavedChanges: string
    loadingConfiguration: string
    validationErrors: string
    securityWarnings: string
    localScopeNotCommitted: string
  }
  fields: {
    pattern: string
    patternTooltip: string
    patternPlaceholder: string
    commands: string
    commandPlaceholder: string
    timeout: string
    timeoutUnit: string
    commonPatterns: string
    custom: string
  }
  templates: {
    title: string
    description: string
    chooseTemplate: string
    matcher: string
  }
}

export interface SlashCommandsTranslations {
  title: {
    main: string
    project: string
  }
  description: {
    main: string
    project: string
  }
  buttons: {
    newCommand: string
    save: string
    saving: string
    cancel: string
    delete: string
    deleting: string
    edit: string
    createFirst: string
    createFirstProject: string
  }
  search: {
    placeholder: string
    noResults: string
  }
  scope: {
    all: string
    project: string
    user: string
    projectCommands: string
    userCommands: string
  }
  form: {
    title: {
      create: string
      edit: string
    }
    labels: {
      scope: string
      name: string
      namespace: string
      description: string
      content: string
      allowedTools: string
      examples: string
      preview: string
    }
    placeholders: {
      name: string
      namespace: string
      description: string
      content: string
      examples: string
    }
    help: {
      scope: {
        user: string
        project: string
      }
      content: string
      examples: string
      allowedTools: string
    }
  }
  examples: {
    review: {
      name: string
      description: string
    }
    explain: {
      name: string
      description: string
    }
    fixIssue: {
      name: string
      description: string
    }
    test: {
      name: string
      description: string
    }
    refactor: {
      name: string
      description: string
    }
    document: {
      name: string
      description: string
    }
  }
  emptyState: {
    title: {
      main: string
      project: string
      noResults: string
    }
  }
  commands: {
    details: {
      showContent: string
      hideContent: string
      arguments: string
      tools: string
      toolsCount: string
      bash: string
      files: string
    }
  }
  delete: {
    title: string
    message: string
    warning: string
  }
  errors: {
    loadFailed: string
    saveFailed: string
    deleteFailed: string
  }
}

// Define the complete translation structure
export interface TranslationResources {
  common: CommonTranslations
  ui: UITranslations
  settings: SettingsTranslations
  errors: ErrorTranslations
  nfo: NFOTranslations
  success: SuccessTranslations
  dialog: DialogTranslations
  hooks: HooksTranslations
  slashCommands: SlashCommandsTranslations
}

// Extend react-i18next module to include our types
declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: TranslationResources
  }
}

// Language codes
export type LanguageCode = 'en' | 'zh'

// Language options for UI
export interface LanguageOption {
  code: LanguageCode
  name: string
  nativeName: string
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' }
]
