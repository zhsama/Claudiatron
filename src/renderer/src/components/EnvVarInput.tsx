import React, { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EnvVarSuggestion {
  key: string
  description: string
}

interface EnvVarInputProps {
  value: string
  onChange: (value: string) => void
  suggestions: EnvVarSuggestion[]
  existingKeys: string[]
  placeholder?: string
  className?: string
}

export const EnvVarInput: React.FC<EnvVarInputProps> = ({
  value,
  onChange,
  suggestions,
  existingKeys,
  placeholder,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [filteredSuggestions, setFilteredSuggestions] = useState<EnvVarSuggestion[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const filtered = suggestions.filter(
      (suggestion) =>
        !existingKeys.includes(suggestion.key) &&
        suggestion.key.toLowerCase().includes(value.toLowerCase())
    )
    setFilteredSuggestions(filtered)
    setSelectedIndex(-1) // Reset selection when suggestions change
    itemRefs.current = new Array(filtered.length).fill(null)
  }, [value, suggestions, existingKeys])

  // Auto scroll to selected item
  useEffect(() => {
    if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      })
    }
  }, [selectedIndex])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
    // Only open if there's input, close if input is empty
    if (e.target.value) {
      setIsOpen(true)
    } else {
      setIsOpen(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || filteredSuggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < filteredSuggestions.length) {
          handleSuggestionSelect(filteredSuggestions[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setSelectedIndex(-1)
        break
    }
  }

  const handleSuggestionSelect = (suggestion: EnvVarSuggestion) => {
    onChange(suggestion.key)
    setIsOpen(false)
    setSelectedIndex(-1)
    inputRef.current?.focus()
  }

  const handleSuggestionClick = (suggestion: EnvVarSuggestion) => {
    handleSuggestionSelect(suggestion)
  }

  const toggleDropdown = () => {
    if (filteredSuggestions.length > 0) {
      setIsOpen(!isOpen)
    }
  }

  return (
    <div className="relative flex-1">
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn('font-mono text-sm pr-8', className)}
        />
        <button
          type="button"
          onClick={toggleDropdown}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
        </button>
      </div>

      {isOpen && filteredSuggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 left-0 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
          style={{ width: 'max-content', minWidth: '100%' }}
        >
          <div className="max-h-60 overflow-y-auto custom-scrollbar-thin">
            {filteredSuggestions.map((suggestion, index) => (
              <div
                key={suggestion.key}
                ref={(el) => { itemRefs.current[index] = el }}
                onClick={() => handleSuggestionClick(suggestion)}
                className={cn(
                  'relative flex cursor-pointer select-none items-center justify-between gap-3 rounded-sm px-2 py-1 text-sm outline-none transition-colors',
                  index === selectedIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <div className="font-mono font-medium whitespace-nowrap">{suggestion.key}</div>
                <div className="text-xs text-muted-foreground text-right">
                  {suggestion.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
