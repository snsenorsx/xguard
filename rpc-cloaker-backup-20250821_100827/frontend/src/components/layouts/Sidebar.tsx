import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Target,
  BarChart3,
  Settings,
  ChevronLeft,
  Shield,
  Bot,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface SidebarProps {
  collapsed: boolean
  onCollapse: (collapsed: boolean) => void
}

const menuItems = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
  },
  {
    title: 'Campaigns',
    icon: Target,
    path: '/campaigns',
  },
  {
    title: 'Analytics',
    icon: BarChart3,
    path: '/analytics',
  },
  {
    title: 'Blacklist',
    icon: Shield,
    path: '/blacklist',
  },
  {
    title: 'Settings',
    icon: Settings,
    path: '/settings',
  },
]

export function Sidebar({ collapsed, onCollapse }: SidebarProps) {
  const location = useLocation()

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 256 }}
      transition={{ duration: 0.3 }}
      className="h-full bg-card border-r border-border flex flex-col"
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        <Link to="/dashboard" className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="font-bold text-lg"
            >
              RPC Cloaker
            </motion.span>
          )}
        </Link>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onCollapse(!collapsed)}
          className="ml-auto"
        >
          <ChevronLeft className={cn(
            "h-4 w-4 transition-transform",
            collapsed && "rotate-180"
          )} />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path)
            
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    isActive && "bg-accent text-accent-foreground"
                  )}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {item.title}
                    </motion.span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Stats */}
      {!collapsed && (
        <div className="p-4 border-t border-border">
          <div className="bg-accent rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Bot className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Bot Detection</span>
              </div>
              <span className="text-sm font-medium text-green-500">Active</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">ML Model</span>
              </div>
              <span className="text-sm font-medium">v2.1.0</span>
            </div>
          </div>
        </div>
      )}
    </motion.aside>
  )
}