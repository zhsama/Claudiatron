import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Network,
  Globe,
  Terminal,
  Trash2,
  Play,
  CheckCircle,
  Loader2,
  RefreshCw,
  FolderOpen,
  User,
  FileText,
  ChevronDown,
  ChevronUp,
  Copy
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api, type MCPServer } from '@/lib/api'

interface MCPServerListProps {
  /**
   * List of MCP servers to display
   */
  servers: MCPServer[]
  /**
   * Whether the list is loading
   */
  loading: boolean
  /**
   * Callback when a server is removed
   */
  onServerRemoved: (name: string) => void
  /**
   * Callback to refresh the server list
   */
  onRefresh: () => void
}

/**
 * Component for displaying a list of MCP servers
 * Shows servers grouped by scope with status indicators
 */
export const MCPServerList: React.FC<MCPServerListProps> = ({
  servers,
  loading,
  onServerRemoved,
  onRefresh
}) => {
  const { t } = useTranslation('mcp')
  const [removingServer, setRemovingServer] = useState<string | null>(null)
  const [testingServer, setTestingServer] = useState<string | null>(null)
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set())
  const [copiedServer, setCopiedServer] = useState<string | null>(null)

  // Group servers by scope
  const serversByScope = (servers || []).reduce(
    (acc, server) => {
      const scope = server.scope || 'local'
      if (!acc[scope]) acc[scope] = []
      acc[scope].push(server)
      return acc
    },
    {} as Record<string, MCPServer[]>
  )

  /**
   * Toggles expanded state for a server
   */
  const toggleExpanded = (serverName: string) => {
    setExpandedServers((prev) => {
      const next = new Set(prev)
      if (next.has(serverName)) {
        next.delete(serverName)
      } else {
        next.add(serverName)
      }
      return next
    })
  }

  /**
   * Copies command to clipboard
   */
  const copyCommand = async (command: string, serverName: string) => {
    try {
      await navigator.clipboard.writeText(command)
      setCopiedServer(serverName)
      setTimeout(() => setCopiedServer(null), 2000)
    } catch (error) {
      console.error('Failed to copy command:', error)
    }
  }

  /**
   * Removes a server
   */
  const handleRemoveServer = async (name: string) => {
    try {
      setRemovingServer(name)
      console.log('Removing server with name:', name, 'type:', typeof name)
      await api.mcpRemove(name)
      onServerRemoved(name)
    } catch (error) {
      console.error('Failed to remove server:', error)
    } finally {
      setRemovingServer(null)
    }
  }

  /**
   * Tests connection to a server
   */
  const handleTestConnection = async (name: string) => {
    try {
      setTestingServer(name)
      const result = await api.mcpTestConnection(name)
      // TODO: Show result in a toast or modal
      console.log('Test result:', result)
    } catch (error) {
      console.error('Failed to test connection:', error)
    } finally {
      setTestingServer(null)
    }
  }

  /**
   * Gets icon for transport type
   */
  const getTransportIcon = (transport: string) => {
    switch (transport) {
      case 'stdio':
        return <Terminal className="h-4 w-4 text-amber-500" />
      case 'sse':
        return <Globe className="h-4 w-4 text-emerald-500" />
      default:
        return <Network className="h-4 w-4 text-blue-500" />
    }
  }

  /**
   * Gets icon for scope
   */
  const getScopeIcon = (scope: string) => {
    switch (scope) {
      case 'local':
        return <User className="h-3 w-3 text-slate-500" />
      case 'project':
        return <FolderOpen className="h-3 w-3 text-orange-500" />
      case 'user':
        return <FileText className="h-3 w-3 text-purple-500" />
      default:
        return null
    }
  }

  /**
   * Gets scope display name
   */
  const getScopeDisplayName = (scope: string) => {
    switch (scope) {
      case 'local':
        return t('serverList.scope.local')
      case 'project':
        return t('serverList.scope.project')
      case 'user':
        return t('serverList.scope.user')
      default:
        return scope
    }
  }

  /**
   * Renders a single server item
   */
  const renderServerItem = (server: MCPServer) => {
    const isExpanded = expandedServers.has(server.name)
    const isCopied = copiedServer === server.name

    return (
      <motion.div
        key={server.name}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="group p-4 rounded-lg border border-border bg-card hover:bg-accent/5 hover:border-primary/20 transition-all overflow-hidden"
      >
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-primary/10 rounded">
                  {getTransportIcon(server.transport)}
                </div>
                <h4 className="font-medium truncate">{server.name}</h4>
                {server.status?.running && (
                  <Badge
                    variant="outline"
                    className="gap-1 flex-shrink-0 border-green-500/50 text-green-600 bg-green-500/10"
                  >
                    <CheckCircle className="h-3 w-3" />
                    {t('serverList.status.running')}
                  </Badge>
                )}
              </div>

              {server.command && !isExpanded && (
                <div className="flex items-center gap-2">
                  <p
                    className="text-xs text-muted-foreground font-mono truncate pl-9 flex-1"
                    title={server.command}
                  >
                    {server.command}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpanded(server.name)}
                    className="h-6 px-2 text-xs hover:bg-primary/10"
                  >
                    <ChevronDown className="h-3 w-3 mr-1" />
                    {t('serverList.actions.showFull')}
                  </Button>
                </div>
              )}

              {(server.transport === 'sse' || server.transport === 'http') &&
                server.url &&
                !isExpanded && (
                  <div className="overflow-hidden">
                    <p
                      className="text-xs text-muted-foreground font-mono truncate pl-9"
                      title={server.url}
                    >
                      {server.url}
                    </p>
                  </div>
                )}

              {Object.keys(server.env).length > 0 && !isExpanded && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground pl-9">
                  <span>
                    {t('serverList.details.environmentVariables')}: {Object.keys(server.env).length}
                  </span>
                </div>
              )}

              {(server.transport === 'sse' || server.transport === 'http') &&
                server.headers &&
                Object.keys(server.headers).length > 0 &&
                !isExpanded && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground pl-9">
                    <span>
                      {t('serverList.details.headers')}: {Object.keys(server.headers).length}
                    </span>
                  </div>
                )}
            </div>

            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleTestConnection(server.name)}
                disabled={testingServer === server.name}
                className="hover:bg-green-500/10 hover:text-green-600"
              >
                {testingServer === server.name ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveServer(server.name)}
                disabled={removingServer === server.name}
                className="hover:bg-destructive/10 hover:text-destructive"
              >
                {removingServer === server.name ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Expanded Details */}
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="pl-9 space-y-3 pt-2 border-t border-border/50"
            >
              {server.command && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t('serverList.details.command')}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyCommand(server.command!, server.name)}
                        className="h-6 px-2 text-xs hover:bg-primary/10"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        {isCopied ? t('serverList.actions.copied') : t('serverList.actions.copy')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(server.name)}
                        className="h-6 px-2 text-xs hover:bg-primary/10"
                      >
                        <ChevronUp className="h-3 w-3 mr-1" />
                        {t('serverList.actions.hide')}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs font-mono bg-muted/50 p-2 rounded break-all">
                    {server.command}
                  </p>
                </div>
              )}

              {server.args && server.args.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t('serverList.details.arguments')}
                  </p>
                  <div className="text-xs font-mono bg-muted/50 p-2 rounded space-y-1">
                    {server.args.map((arg, idx) => (
                      <div key={idx} className="break-all">
                        <span className="text-muted-foreground mr-2">[{idx}]</span>
                        {arg}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(server.transport === 'sse' || server.transport === 'http') && server.url && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t('serverList.details.url')}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyCommand(server.url!, server.name)}
                      className="h-6 px-2 text-xs hover:bg-primary/10"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      {isCopied ? t('serverList.actions.copied') : t('serverList.actions.copy')}
                    </Button>
                  </div>
                  <p className="text-xs font-mono bg-muted/50 p-2 rounded break-all">
                    {server.url}
                  </p>
                </div>
              )}

              {(server.transport === 'sse' || server.transport === 'http') &&
                server.headers &&
                Object.keys(server.headers).length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t('serverList.details.headers')}
                    </p>
                    <div className="text-xs font-mono bg-muted/50 p-2 rounded space-y-1">
                      {Object.entries(server.headers).map(([key, value]) => (
                        <div key={key} className="break-all">
                          <span className="text-blue-600">{key}</span>
                          <span className="text-muted-foreground mx-1">:</span>
                          <span>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {Object.keys(server.env).length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t('serverList.details.environmentVariables')}
                  </p>
                  <div className="text-xs font-mono bg-muted/50 p-2 rounded space-y-1">
                    {Object.entries(server.env).map(([key, value]) => (
                      <div key={key} className="break-all">
                        <span className="text-primary">{key}</span>
                        <span className="text-muted-foreground mx-1">=</span>
                        <span>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold">{t('serverList.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('serverList.serverCount', { count: servers.length })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          className="gap-2 hover:bg-primary/10 hover:text-primary hover:border-primary/50"
        >
          <RefreshCw className="h-4 w-4" />
          {t('serverList.refresh')}
        </Button>
      </div>

      {/* Server List */}
      {servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 bg-primary/10 rounded-full mb-4">
            <Network className="h-12 w-12 text-primary" />
          </div>
          <p className="text-muted-foreground mb-2 font-medium">{t('serverList.empty.title')}</p>
          <p className="text-sm text-muted-foreground">{t('serverList.empty.description')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(serversByScope).map(([scope, scopeServers]) => (
            <div key={scope} className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {getScopeIcon(scope)}
                <span className="font-medium">{getScopeDisplayName(scope)}</span>
                <span className="text-muted-foreground/60">({scopeServers.length})</span>
              </div>
              <AnimatePresence>
                <div className="space-y-2">{scopeServers.map(renderServerItem)}</div>
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
