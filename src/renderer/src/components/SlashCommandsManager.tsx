import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Trash2,
  Edit,
  Save,
  Command,
  Globe,
  FolderOpen,
  Terminal,
  FileCode,
  Zap,
  Code,
  AlertCircle,
  Loader2,
  Search,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { api, type SlashCommand } from '@/lib/api'
import { cn } from '@/lib/utils'
import { COMMON_TOOL_MATCHERS } from '@/types/hooks'

interface SlashCommandsManagerProps {
  projectPath?: string
  className?: string
  scopeFilter?: 'project' | 'user' | 'all'
}

interface CommandForm {
  name: string
  namespace: string
  content: string
  description: string
  allowedTools: string[]
  scope: 'project' | 'user'
}

// 示例命令模板
const EXAMPLE_COMMANDS = [
  {
    name: 'review',
    description: 'Review code for best practices',
    content:
      'Review the following code for best practices, potential issues, and improvements:\n\n@$ARGUMENTS',
    allowedTools: ['Read', 'Grep', 'Edit']
  },
  {
    name: 'explain',
    description: 'Explain how something works',
    content:
      'Explain how $ARGUMENTS works in detail, including its purpose, implementation, and usage examples.',
    allowedTools: ['Read', 'Grep', 'WebSearch']
  },
  {
    name: 'fix-issue',
    description: 'Fix a specific issue',
    content: 'Fix issue #$ARGUMENTS following our coding standards and best practices.',
    allowedTools: ['Read', 'Edit', 'MultiEdit', 'Write']
  },
  {
    name: 'test',
    description: 'Write tests for code',
    content:
      'Write comprehensive tests for:\n\n@$ARGUMENTS\n\nInclude unit tests, edge cases, and integration tests where appropriate.',
    allowedTools: ['Read', 'Write', 'Edit']
  },
  {
    name: 'refactor',
    description: 'Refactor code for better maintainability',
    content:
      'Refactor the following code to improve maintainability, performance, and readability:\n\n@$ARGUMENTS\n\nMaintain all existing functionality.',
    allowedTools: ['Read', 'Edit', 'MultiEdit', 'Grep']
  },
  {
    name: 'document',
    description: 'Add documentation to code',
    content:
      'Add comprehensive documentation to:\n\n@$ARGUMENTS\n\nInclude function descriptions, parameter types, return values, and usage examples.',
    allowedTools: ['Read', 'Edit', 'Write']
  }
]

// Get icon for command based on its properties
const getCommandIcon = (command: SlashCommand) => {
  if (command.has_bash_commands) return Terminal
  if (command.has_file_references) return FileCode
  if (command.accepts_arguments) return Zap
  if (command.scope === 'project') return FolderOpen
  if (command.scope === 'user') return Globe
  return Command
}

/**
 * SlashCommandsManager component for managing custom slash commands
 * Provides a no-code interface for creating, editing, and deleting commands
 */
export const SlashCommandsManager: React.FC<SlashCommandsManagerProps> = ({
  projectPath,
  className,
  scopeFilter = 'all'
}) => {
  const { t } = useTranslation('settings')
  const [commands, setCommands] = useState<SlashCommand[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedScope, setSelectedScope] = useState<'all' | 'project' | 'user'>(
    scopeFilter === 'all' ? 'all' : (scopeFilter as 'project' | 'user')
  )
  const [expandedCommands, setExpandedCommands] = useState<Set<string>>(new Set())

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingCommand, setEditingCommand] = useState<SlashCommand | null>(null)
  const [commandForm, setCommandForm] = useState<CommandForm>({
    name: '',
    namespace: '',
    content: '',
    description: '',
    allowedTools: [],
    scope: 'user'
  })

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [commandToDelete, setCommandToDelete] = useState<SlashCommand | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadCommands = async () => {
    try {
      setLoading(true)
      setError(null)
      const loadedCommands = await api.slashCommandsList(projectPath)
      setCommands(loadedCommands)
    } catch (err) {
      console.error('Failed to load slash commands:', err)
      setError(t('commands.errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  // Load commands on mount
  useEffect(() => {
    loadCommands()
  }, [projectPath])

  const handleCreateNew = () => {
    setEditingCommand(null)
    setCommandForm({
      name: '',
      namespace: '',
      content: '',
      description: '',
      allowedTools: [],
      scope: scopeFilter !== 'all' ? scopeFilter : projectPath ? 'project' : 'user'
    })
    setEditDialogOpen(true)
  }

  const handleEdit = (command: SlashCommand) => {
    setEditingCommand(command)
    setCommandForm({
      name: command.name,
      namespace: command.namespace || '',
      content: command.content,
      description: command.description || '',
      allowedTools: command.allowed_tools,
      scope: command.scope as 'project' | 'user'
    })
    setEditDialogOpen(true)
  }

  // Apply example command template
  const applyExample = (example: (typeof EXAMPLE_COMMANDS)[0]) => {
    setCommandForm((prev) => ({
      ...prev,
      name: example.name,
      description: example.description,
      content: example.content,
      allowedTools: example.allowedTools
    }))
  }

  // Handle example selection from dropdown
  const handleExampleSelect = (exampleName: string) => {
    const example = EXAMPLE_COMMANDS.find((cmd) => cmd.name === exampleName)
    if (example) {
      applyExample(example)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)

      await api.slashCommandSave(
        commandForm.scope,
        commandForm.name,
        commandForm.namespace || undefined,
        commandForm.content,
        commandForm.description || undefined,
        commandForm.allowedTools,
        commandForm.scope === 'project' ? projectPath : undefined
      )

      setEditDialogOpen(false)
      await loadCommands()
    } catch (err) {
      console.error('Failed to save command:', err)
      setError(err instanceof Error ? err.message : t('commands.errors.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClick = (command: SlashCommand) => {
    setCommandToDelete(command)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!commandToDelete) return

    try {
      setDeleting(true)
      setError(null)
      await api.slashCommandDelete(commandToDelete.id, projectPath)
      setDeleteDialogOpen(false)
      setCommandToDelete(null)
      await loadCommands()
    } catch (err) {
      console.error('Failed to delete command:', err)
      const errorMessage = err instanceof Error ? err.message : t('commands.errors.deleteFailed')
      setError(errorMessage)
    } finally {
      setDeleting(false)
    }
  }

  const cancelDelete = () => {
    setDeleteDialogOpen(false)
    setCommandToDelete(null)
  }

  const toggleExpanded = (commandId: string) => {
    setExpandedCommands((prev) => {
      const next = new Set(prev)
      if (next.has(commandId)) {
        next.delete(commandId)
      } else {
        next.add(commandId)
      }
      return next
    })
  }

  const handleToolToggle = (tool: string) => {
    setCommandForm((prev) => ({
      ...prev,
      allowedTools: prev.allowedTools.includes(tool)
        ? prev.allowedTools.filter((t) => t !== tool)
        : [...prev.allowedTools, tool]
    }))
  }

  // Filter commands
  const filteredCommands = commands.filter((cmd) => {
    // Hide default commands
    if (cmd.scope === 'default') {
      return false
    }

    // Apply scopeFilter if set to specific scope
    if (scopeFilter !== 'all' && cmd.scope !== scopeFilter) {
      return false
    }

    // Scope filter
    if (selectedScope !== 'all' && cmd.scope !== selectedScope) {
      return false
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        cmd.name.toLowerCase().includes(query) ||
        cmd.full_command.toLowerCase().includes(query) ||
        (cmd.description && cmd.description.toLowerCase().includes(query)) ||
        (cmd.namespace && cmd.namespace.toLowerCase().includes(query))
      )
    }

    return true
  })

  // Group commands by namespace and scope
  const groupedCommands = filteredCommands.reduce(
    (acc, cmd) => {
      const key = cmd.namespace
        ? `${cmd.namespace} (${cmd.scope})`
        : `${cmd.scope === 'project' ? t('commands.groups.project') : t('commands.groups.user')}`
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(cmd)
      return acc
    },
    {} as Record<string, SlashCommand[]>
  )

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {scopeFilter === 'project' ? t('commands.projectTitle') : t('commands.title')}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {scopeFilter === 'project'
              ? t('commands.projectDescription')
              : t('commands.description')}
          </p>
        </div>
        <Button onClick={handleCreateNew} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          {t('commands.actions.newCommand')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('commands.search.placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        {scopeFilter === 'all' && (
          <Select value={selectedScope} onValueChange={(value: any) => setSelectedScope(value)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('commands.filter.allCommands')}</SelectItem>
              <SelectItem value="project">{t('commands.filter.project')}</SelectItem>
              <SelectItem value="user">{t('commands.filter.user')}</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Commands List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredCommands.length === 0 ? (
        <Card className="p-8">
          <div className="text-center">
            <Command className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              {searchQuery
                ? t('commands.empty.noResults')
                : scopeFilter === 'project'
                  ? t('commands.empty.noProjectCommands')
                  : t('commands.empty.noCommands')}
            </p>
            {!searchQuery && (
              <Button onClick={handleCreateNew} variant="outline" size="sm" className="mt-4">
                {scopeFilter === 'project'
                  ? t('commands.empty.createFirstProject')
                  : t('commands.empty.createFirst')}
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {Object.entries(groupedCommands).map(([groupKey, groupCommands]) => (
            <Card key={groupKey} className="overflow-hidden p-0 shadow-sm gap-0 border-muted/50">
              <div className="px-4 py-3 bg-muted/50 border-b">
                <h4 className="text-sm font-medium">{groupKey}</h4>
              </div>

              <div className="divide-y">
                {groupCommands.map((command) => {
                  const Icon = getCommandIcon(command)
                  const isExpanded = expandedCommands.has(command.id)

                  return (
                    <div key={command.id}>
                      <div className="px-4 py-3">
                        <div className="flex items-start gap-4">
                          <Icon className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <code className="text-sm font-mono text-primary">
                                {command.full_command}
                              </code>
                              {command.accepts_arguments && (
                                <Badge variant="secondary" className="text-xs">
                                  {t('commands.badges.arguments')}
                                </Badge>
                              )}
                            </div>

                            {command.description && (
                              <p className="text-sm text-muted-foreground mb-2">
                                {command.description}
                              </p>
                            )}

                            <div className="flex items-center gap-4 text-xs">
                              {command.allowed_tools && command.allowed_tools.length > 0 && (
                                <span className="text-muted-foreground">
                                  {command.allowed_tools.length}{' '}
                                  {t('commands.details.tools', {
                                    count: command.allowed_tools.length
                                  })}
                                </span>
                              )}

                              {command.has_bash_commands && (
                                <Badge variant="outline" className="text-xs">
                                  {t('commands.badges.bash')}
                                </Badge>
                              )}

                              {command.has_file_references && (
                                <Badge variant="outline" className="text-xs">
                                  {t('commands.badges.files')}
                                </Badge>
                              )}

                              <button
                                onClick={() => toggleExpanded(command.id)}
                                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronDown className="h-3 w-3" />
                                    {t('commands.actions.hideContent')}
                                  </>
                                ) : (
                                  <>
                                    <ChevronRight className="h-3 w-3" />
                                    {t('commands.actions.showContent')}
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(command)}
                              className="h-8 w-8"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(command)}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-4 p-3 bg-muted/50 rounded-md">
                                <pre className="text-xs font-mono whitespace-pre-wrap">
                                  {command.content}
                                </pre>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-[1200px] max-h-[85vh] z-[9999] flex flex-col overflow-hidden sm:max-w-[90vw] lg:max-w-[85vw] xl:max-w-[80vw] 2xl:max-w-[1200px]">
          <DialogHeader>
            <DialogTitle>
              {editingCommand ? t('commands.dialog.editTitle') : t('commands.dialog.createTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex gap-6">
            {/* Left Panel - Scope, Examples, Name, Description */}
            <div className="w-1/2 space-y-4 overflow-y-auto pr-3">
              {/* Scope */}
              <div className="space-y-2">
                <Label>{t('commands.form.scope')}</Label>
                <Select
                  value={commandForm.scope}
                  onValueChange={(value: 'project' | 'user') =>
                    setCommandForm((prev) => ({ ...prev, scope: value }))
                  }
                  disabled={
                    scopeFilter !== 'all' || (!projectPath && commandForm.scope === 'project')
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(scopeFilter === 'all' || scopeFilter === 'user') && (
                      <SelectItem value="user">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          {t('commands.form.userScope')}
                        </div>
                      </SelectItem>
                    )}
                    {(scopeFilter === 'all' || scopeFilter === 'project') && (
                      <SelectItem value="project" disabled={!projectPath}>
                        <div className="flex items-center gap-2">
                          <FolderOpen className="h-4 w-4" />
                          {t('commands.form.projectScope')}
                        </div>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {commandForm.scope === 'user'
                    ? t('commands.form.userScopeDescription')
                    : t('commands.form.projectScopeDescription')}
                </p>
              </div>

              {/* Example Commands (only for new commands) */}
              {!editingCommand && (
                <div className="space-y-2">
                  <Label>{t('commands.form.examples')}</Label>
                  <Select onValueChange={handleExampleSelect}>
                    <SelectTrigger className="h-auto min-h-[44px] px-3 py-2">
                      <SelectValue placeholder={t('commands.form.examplesPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent className="z-[10000]">
                      {EXAMPLE_COMMANDS.map((example) => (
                        <SelectItem
                          key={example.name}
                          value={example.name}
                          className="cursor-pointer"
                        >
                          <div className="flex items-center gap-3 py-1 w-full">
                            <Code className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                            <div className="flex flex-col gap-1 flex-1 min-w-0">
                              <div className="font-medium text-sm">{example.name}</div>
                              <div className="text-xs text-muted-foreground line-clamp-2">
                                {example.description}
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t('commands.form.examplesDescription')}
                  </p>
                </div>
              )}

              {/* Name and Namespace */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>{t('commands.form.name')}</Label>
                  <Input
                    placeholder={t('commands.form.namePlaceholder')}
                    value={commandForm.name}
                    onChange={(e) => setCommandForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('commands.form.namespace')}</Label>
                  <Input
                    placeholder={t('commands.form.namespacePlaceholder')}
                    value={commandForm.namespace}
                    onChange={(e) =>
                      setCommandForm((prev) => ({ ...prev, namespace: e.target.value }))
                    }
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label>{t('commands.form.description')}</Label>
                <Textarea
                  placeholder={t('commands.form.descriptionPlaceholder')}
                  value={commandForm.description}
                  onChange={(e) =>
                    setCommandForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="resize-none"
                  rows={3}
                />
              </div>
            </div>

            {/* Right Panel - Content, Tools, Preview */}
            <div className="w-1/2 space-y-4 overflow-y-auto pl-3">
              {/* Content */}
              <div className="space-y-2">
                <Label>{t('commands.form.content')}</Label>
                <Textarea
                  placeholder={t('commands.form.contentPlaceholder')}
                  value={commandForm.content}
                  onChange={(e) => setCommandForm((prev) => ({ ...prev, content: e.target.value }))}
                  className="min-h-[180px] font-mono text-sm resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  {t('commands.form.contentDescription')}
                </p>
              </div>

              {/* Allowed Tools */}
              <div className="space-y-2">
                <Label>{t('commands.form.allowedTools')}</Label>
                <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto p-2 border rounded-md bg-muted/30">
                  {COMMON_TOOL_MATCHERS.map((tool) => (
                    <Button
                      key={tool}
                      variant={commandForm.allowedTools.includes(tool) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleToolToggle(tool)}
                      type="button"
                      className="text-xs h-7"
                    >
                      {tool}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('commands.form.allowedToolsDescription')}
                </p>
              </div>

              {/* Preview */}
              {commandForm.name && (
                <div className="space-y-2">
                  <Label>{t('commands.form.preview')}</Label>
                  <div className="p-3 bg-muted rounded-md">
                    <code className="text-sm">
                      /{commandForm.namespace && `${commandForm.namespace}:`}
                      {commandForm.name}
                      {commandForm.content.includes('$ARGUMENTS') &&
                        ` [${t('commands.form.arguments')}]`}
                    </code>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-4 flex-shrink-0">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t('commands.dialog.cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!commandForm.name || !commandForm.content || saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('commands.dialog.saving')}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {t('commands.dialog.save')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('commands.deleteDialog.title')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p>{t('commands.deleteDialog.confirmation')}</p>
            {commandToDelete && (
              <div className="p-3 bg-muted rounded-md">
                <code className="text-sm font-mono">{commandToDelete.full_command}</code>
                {commandToDelete.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {commandToDelete.description}
                  </p>
                )}
              </div>
            )}
            <p className="text-sm text-muted-foreground">{t('commands.deleteDialog.warning')}</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={cancelDelete} disabled={deleting}>
              {t('commands.deleteDialog.cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('commands.deleteDialog.deleting')}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('commands.deleteDialog.delete')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
