import React, { useState } from 'react'
import { Download, Upload, FileText, Loader2, Info, Network, Settings2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { api } from '@/lib/api'

interface MCPImportExportProps {
  /**
   * Callback when import is completed
   */
  onImportCompleted: (imported: number, failed: number) => void
  /**
   * Callback for error messages
   */
  onError: (message: string) => void
}

/**
 * Component for importing and exporting MCP server configurations
 */
export const MCPImportExport: React.FC<MCPImportExportProps> = ({ onImportCompleted, onError }) => {
  const { t } = useTranslation('mcp')
  const [importingDesktop, setImportingDesktop] = useState(false)
  const [importingJson, setImportingJson] = useState(false)
  const [importScope, setImportScope] = useState('local')

  /**
   * Imports servers from Claude Desktop
   */
  const handleImportFromDesktop = async () => {
    try {
      setImportingDesktop(true)
      // Always use "user" scope for Claude Desktop imports (was previously "global")
      const result = await api.mcpImportFromClaudeDesktop('user')

      // Show detailed results if available
      if (result.servers && result.servers.length > 0) {
        const successfulServers = result.servers.filter((s) => s.success)
        const failedServers = result.servers.filter((s) => !s.success)

        if (successfulServers.length > 0) {
          const successMessage = t('importExport.messages.importSuccess', {
            servers: successfulServers.map((s) => s.name).join(', ')
          })
          onImportCompleted(result.imported_count, result.failed_count)
          // Show success details
          if (failedServers.length === 0) {
            onError(successMessage)
          }
        }

        if (failedServers.length > 0) {
          const failureDetails = failedServers
            .map((s) => `${s.name}: ${s.error || 'Unknown error'}`)
            .join('\n')
          onError(t('importExport.messages.importFailures', { failures: failureDetails }))
        }
      } else {
        onImportCompleted(result.imported_count, result.failed_count)
      }
    } catch (error: any) {
      console.error('Failed to import from Claude Desktop:', error)
      onError(error.toString() || t('importExport.messages.importDesktopFailed'))
    } finally {
      setImportingDesktop(false)
    }
  }

  /**
   * Handles JSON file import
   */
  const handleJsonFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setImportingJson(true)
      const content = await file.text()

      // Parse the JSON to validate it
      let jsonData
      try {
        jsonData = JSON.parse(content)
      } catch (e) {
        onError(t('importExport.messages.invalidJson'))
        return
      }

      // Check if it's a single server or multiple servers
      if (jsonData.mcpServers) {
        // Multiple servers format
        let imported = 0
        let failed = 0

        for (const [name, config] of Object.entries(jsonData.mcpServers)) {
          try {
            const serverConfig = {
              type: 'stdio',
              command: (config as any).command,
              args: (config as any).args || [],
              env: (config as any).env || {}
            }

            const result = await api.mcpAddJson(name, JSON.stringify(serverConfig), importScope)
            if (result.success) {
              imported++
            } else {
              failed++
            }
          } catch (e) {
            failed++
          }
        }

        onImportCompleted(imported, failed)
      } else if (jsonData.type && jsonData.command) {
        // Single server format
        const name = prompt(t('importExport.messages.enterServerName'))
        if (!name) return

        const result = await api.mcpAddJson(name, content, importScope)
        if (result.success) {
          onImportCompleted(1, 0)
        } else {
          onError(result.message)
        }
      } else {
        onError(t('importExport.messages.unrecognizedFormat'))
      }
    } catch (error) {
      console.error('Failed to import JSON:', error)
      onError(t('importExport.messages.importJsonFailed'))
    } finally {
      setImportingJson(false)
      // Reset the input
      event.target.value = ''
    }
  }

  /**
   * Handles exporting servers (placeholder)
   */
  const handleExport = () => {
    // TODO: Implement export functionality
    onError(t('importExport.messages.exportComingSoon'))
  }

  /**
   * Starts Claude Code as MCP server
   */
  const handleStartMCPServer = async () => {
    try {
      await api.mcpServe()
      onError(t('importExport.messages.mcpServerStarted'))
    } catch (error) {
      console.error('Failed to start MCP server:', error)
      onError(t('importExport.messages.mcpServerFailed'))
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-base font-semibold">{t('importExport.title')}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t('importExport.description')}</p>
      </div>

      <div className="space-y-4">
        {/* Import Scope Selection */}
        <Card className="p-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Settings2 className="h-4 w-4 text-slate-500" />
              <Label className="text-sm font-medium">{t('importExport.importScope.label')}</Label>
            </div>
            <Select value={importScope} onValueChange={(value: string) => setImportScope(value)}>
              <SelectTrigger>
                <SelectValue placeholder={t('addServer.fields.scope.placeholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">{t('addServer.fields.scope.options.local')}</SelectItem>
                <SelectItem value="project">
                  {t('addServer.fields.scope.options.project')}
                </SelectItem>
                <SelectItem value="user">{t('addServer.fields.scope.options.user')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('importExport.importScope.description')}
            </p>
          </div>
        </Card>

        {/* Import from Claude Desktop */}
        <Card className="p-4 hover:bg-accent/5 transition-colors">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-blue-500/10 rounded-lg">
                <Download className="h-5 w-5 text-blue-500" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium">{t('importExport.importDesktop.title')}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('importExport.importDesktop.description')}
                </p>
              </div>
            </div>
            <Button
              onClick={handleImportFromDesktop}
              disabled={importingDesktop}
              className="w-full gap-2 bg-primary hover:bg-primary/90"
            >
              {importingDesktop ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('importExport.importDesktop.importing')}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  {t('importExport.importDesktop.button')}
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Import from JSON */}
        <Card className="p-4 hover:bg-accent/5 transition-colors">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-purple-500/10 rounded-lg">
                <FileText className="h-5 w-5 text-purple-500" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium">{t('importExport.importJson.title')}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('importExport.importJson.description')}
                </p>
              </div>
            </div>
            <div>
              <input
                type="file"
                accept=".json"
                onChange={handleJsonFileSelect}
                disabled={importingJson}
                className="hidden"
                id="json-file-input"
              />
              <Button
                onClick={() => document.getElementById('json-file-input')?.click()}
                disabled={importingJson}
                className="w-full gap-2"
                variant="outline"
              >
                {importingJson ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('importExport.importJson.importing')}
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    {t('importExport.importJson.button')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>

        {/* Export (Coming Soon) */}
        <Card className="p-4 opacity-60">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-muted rounded-lg">
                <Upload className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium">{t('importExport.export.title')}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('importExport.export.description')}
                </p>
              </div>
            </div>
            <Button
              onClick={handleExport}
              disabled={true}
              variant="secondary"
              className="w-full gap-2"
            >
              <Upload className="h-4 w-4" />
              {t('importExport.export.button')}
            </Button>
          </div>
        </Card>

        {/* Serve as MCP */}
        <Card className="p-4 border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-green-500/20 rounded-lg">
                <Network className="h-5 w-5 text-green-500" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium">{t('importExport.mcpServer.title')}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('importExport.mcpServer.description')}
                </p>
              </div>
            </div>
            <Button
              onClick={handleStartMCPServer}
              variant="outline"
              className="w-full gap-2 border-green-500/20 hover:bg-green-500/10 hover:text-green-600 hover:border-green-500/50"
            >
              <Network className="h-4 w-4" />
              {t('importExport.mcpServer.button')}
            </Button>
          </div>
        </Card>
      </div>

      {/* Info Box */}
      <Card className="p-4 bg-muted/30">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Info className="h-4 w-4 text-primary" />
            <span>{t('importExport.jsonExamples.title')}</span>
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <p className="font-medium text-muted-foreground mb-1">
                {t('importExport.jsonExamples.singleServer')}
              </p>
              <pre className="bg-background p-3 rounded-lg overflow-x-auto">
                {`{
  "type": "stdio",
  "command": "/path/to/server",
  "args": ["--arg1", "value"],
  "env": { "KEY": "value" }
}`}
              </pre>
            </div>
            <div>
              <p className="font-medium text-muted-foreground mb-1">
                {t('importExport.jsonExamples.multipleServers')}
              </p>
              <pre className="bg-background p-3 rounded-lg overflow-x-auto">
                {`{
  "mcpServers": {
    "server1": {
      "command": "/path/to/server1",
      "args": [],
      "env": {}
    },
    "server2": {
      "command": "/path/to/server2",
      "args": ["--port", "8080"],
      "env": { "API_KEY": "..." }
    }
  }
}`}
              </pre>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
