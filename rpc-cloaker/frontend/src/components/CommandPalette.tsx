import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  LayoutDashboard,
  Target,
  BarChart3,
  Settings,
  LogOut,
  Plus,
  Search,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)

  const handleSelect = (value: string) => {
    onOpenChange(false)
    
    switch (value) {
      case 'dashboard':
        navigate('/dashboard')
        break
      case 'campaigns':
        navigate('/campaigns')
        break
      case 'new-campaign':
        navigate('/campaigns/new')
        break
      case 'analytics':
        navigate('/analytics')
        break
      case 'settings':
        navigate('/settings')
        break
      case 'logout':
        logout()
        navigate('/login')
        break
    }
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Navigation">
          <CommandItem value="dashboard" onSelect={handleSelect}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem value="campaigns" onSelect={handleSelect}>
            <Target className="mr-2 h-4 w-4" />
            <span>Campaigns</span>
          </CommandItem>
          <CommandItem value="analytics" onSelect={handleSelect}>
            <BarChart3 className="mr-2 h-4 w-4" />
            <span>Analytics</span>
          </CommandItem>
          <CommandItem value="settings" onSelect={handleSelect}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </CommandItem>
        </CommandGroup>
        
        <CommandSeparator />
        
        <CommandGroup heading="Actions">
          <CommandItem value="new-campaign" onSelect={handleSelect}>
            <Plus className="mr-2 h-4 w-4" />
            <span>New Campaign</span>
          </CommandItem>
          <CommandItem value="search" onSelect={handleSelect}>
            <Search className="mr-2 h-4 w-4" />
            <span>Search Campaigns</span>
          </CommandItem>
        </CommandGroup>
        
        <CommandSeparator />
        
        <CommandGroup heading="Account">
          <CommandItem value="logout" onSelect={handleSelect}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}