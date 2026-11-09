import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import {
  Brain,
  Images,
  Lightbulb,
  LogOut,
  MessageCircle,
  Shield,
  User,
} from 'lucide-react'
import { signOut } from '../lib/auth-client'
import MemdiaLogo from '@/components/common/MemdiaLogo'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from './ui/sidebar'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

interface AppUser {
  id: string
  email: string
  name: string | null
  image?: string | null
  emailVerified: boolean
  role?: string
  onboardingComplete?: boolean
}

interface AppSidebarProps {
  user: AppUser
  subscriptionTier: string | null
}

export function AppSidebar({ user }: AppSidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { setOpenMobile } = useSidebar()
  const userName = user.name || 'User'
  const userEmail = user.email
  const userRole = user.role

  const handleSignOut = async () => {
    await signOut()
    navigate({ to: '/' })
  }

  // Helper to check active state - supports nested routes
  const isActive = (path: string) => {
    return location.pathname.startsWith(path)
  }

  // Helper to close mobile sheet on navigation
  const handleNavClick = () => {
    setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-border/40">
      <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:mb-10 transition-all">
        <Link
          to="/"
          className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center"
        >
          <div className="h-8 w-8 shrink-0 rounded-xl bg-gradient-to-br from-[#7e9ec9] to-[#5a7ba6] shadow-lg shadow-primary/20 flex items-center justify-center text-primary-foreground font-bold text-sm transition-all">
            <MemdiaLogo className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent group-data-[collapsible=icon]:hidden transition-opacity duration-200">
            Memdia
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 group-data-[collapsible=icon]:px-0">
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden text-sm font-semibold tracking-wider text-muted-foreground/80">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive('/conversations')}
                  tooltip="Conversations"
                  size="lg"
                  className="data-[active=true]:bg-primary/5 data-[active=true]:text-primary group-data-[collapsible=icon]:justify-center"
                  onClick={handleNavClick}
                >
                  <Link to="/conversations">
                    <MessageCircle className="h-5! w-5!" />
                    <span className="text-base font-medium group-data-[collapsible=icon]:hidden">
                      Conversations
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive('/insights')}
                  tooltip="Insights"
                  size="lg"
                  className="data-[active=true]:bg-primary/5 data-[active=true]:text-primary group-data-[collapsible=icon]:justify-center"
                  onClick={handleNavClick}
                >
                  <Link to="/insights">
                    <Lightbulb className="h-5! w-5!" />
                    <span className="text-base font-medium group-data-[collapsible=icon]:hidden">
                      Insights
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive('/timeline')}
                  tooltip="Timeline"
                  size="lg"
                  className="data-[active=true]:bg-primary/5 data-[active=true]:text-primary group-data-[collapsible=icon]:justify-center"
                  onClick={handleNavClick}
                >
                  <Link to="/timeline">
                    <Images className="h-5! w-5!" />
                    <span className="text-base font-medium group-data-[collapsible=icon]:hidden">
                      Timeline
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive('/memory')}
                  tooltip="Memory"
                  size="lg"
                  className="data-[active=true]:bg-primary/5 data-[active=true]:text-primary group-data-[collapsible=icon]:justify-center"
                  onClick={handleNavClick}
                >
                  <Link to="/memory">
                    <Brain className="h-5! w-5!" />
                    <span className="text-base font-medium group-data-[collapsible=icon]:hidden">
                      Memory
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden text-sm font-semibold tracking-wider text-muted-foreground/80">
            Settings
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive('/profile')}
                  tooltip="Profile"
                  size="lg"
                  className="data-[active=true]:bg-primary/5 data-[active=true]:text-primary group-data-[collapsible=icon]:justify-center"
                  onClick={handleNavClick}
                >
                  <Link to="/profile">
                    <User className="h-5! w-5!" />
                    <span className="text-base font-medium group-data-[collapsible=icon]:hidden">
                      Profile
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {userRole === 'admin' && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/admin')}
                    tooltip="Admin"
                    size="lg"
                    className="data-[active=true]:bg-primary/5 data-[active=true]:text-primary group-data-[collapsible=icon]:justify-center"
                    onClick={handleNavClick}
                  >
                    <Link to="/admin">
                      <Shield className="h-5! w-5!" />
                      <span className="text-base font-medium group-data-[collapsible=icon]:hidden">
                        Admin
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 group-data-[collapsible=icon]:p-2">
        <div className="rounded-2xl bg-linear-to-br from-muted/50 to-muted/80 p-4 border border-border/50 shadow-sm group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:border-none group-data-[collapsible=icon]:shadow-none transition-all group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
          <div className="flex items-center gap-3 mb-3 group-data-[collapsible=icon]:mb-0 group-data-[collapsible=icon]:justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary/20 to-primary/10 text-primary border border-primary/20 shadow-sm transition-all cursor-pointer hover:bg-primary/20">
                  {user.image ? (
                    <img
                      src={user.image}
                      alt={userName}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="font-semibold text-sm">
                      {userName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" className="w-48">
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex-1 overflow-hidden group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-bold text-foreground">
                {userName}
              </p>
              <p className="truncate text-xs text-muted-foreground font-medium">
                {userEmail}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors group-data-[collapsible=icon]:hidden font-medium"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
