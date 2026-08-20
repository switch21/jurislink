'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, addMonths, subMonths, isToday, startOfWeek, endOfWeek, isSameMonth } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import { useAppStore, type ViewName, type UserInfo } from '@/store/appStore'
import { cn } from '@/lib/utils'

// ==================== shadcn/ui imports ====================
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Toaster } from '@/components/ui/sonner'

// ==================== lucide icons ====================
import {
  LayoutDashboard, Briefcase, Users, FileText, Calendar, Receipt, MessageSquare, BarChart3,
  Shield, Settings, Menu, X, Search, Bell, LogOut, User, ChevronDown, ChevronRight,
  ChevronLeft, Plus, Edit, Trash2, Eye, Lock, Clock, Send, ArrowLeft, Download,
  Filter, MoreHorizontal, Archive, AlertTriangle, CheckCircle2, Circle, Phone, Mail,
  Building2, RefreshCw, TrendingUp, DollarSign, FileCheck, FileWarning, Activity,
  Sun, Moon, Inbox, FolderOpen, Scale, ClipboardList
} from 'lucide-react'

// ==================== Types ====================
interface Client {
  id: string; firstName: string; lastName: string; company?: string | null; email?: string | null;
  phone?: string | null; address?: string | null; notes?: string | null; isActive: boolean;
  tenantId: string; createdAt: string; _count?: { cases: number; invoices: number };
}
interface CaseItem {
  id: string; reference: string; title: string; description?: string | null; type: string;
  status: string; priority: string; isSecret: boolean; nextDueDate?: string | null;
  closingDate?: string | null; createdAt: string; tenantId: string; clientId: string;
  client?: Client; assignments?: CaseAssignment[]; notes?: CaseNote[]; documents?: Doc[]; events?: EventItem[];
}
interface CaseAssignment { id: string; userId: string; caseId: string; user?: UserItem }
interface CaseNote { id: string; content: string; createdAt: string; userId?: string | null; user?: UserItem }
interface Doc {
  id: string; name: string; fileName: string; fileType: string; fileSize: number; filePath: string;
  version: number; description?: string | null; createdAt: string; tenantId: string; caseId?: string | null;
  userId?: string | null; case?: CaseItem;
}
interface EventItem {
  id: string; title: string; description?: string | null; startTime: string; endTime?: string | null;
  eventType: string; criticality: string; location?: string | null; createdAt: string;
  tenantId: string; caseId?: string | null; case?: CaseItem; assignments?: EventAssignment[];
}
interface EventAssignment { id: string; userId: string; eventId: string; user?: UserItem }
interface Invoice {
  id: string; reference: string; amount: number; status: string; dueDate?: string | null;
  paidDate?: string | null; paidAmount?: number | null; notes?: string | null; createdAt: string;
  tenantId: string; clientId: string; client?: Client; caseId?: string | null; case?: CaseItem; currencyCode: string;
}
interface Message {
  id: string; content: string; isRead: boolean; createdAt: string; tenantId: string;
  senderId: string; receiverId: string; sender?: UserItem; receiver?: UserItem;
}
interface Notification {
  id: string; title: string; message: string; category: string; isRead: boolean;
  resourceType?: string | null; resourceId?: string | null; createdAt: string;
}
interface AuditLogItem {
  id: string; action: string; resourceType?: string | null; resourceId?: string | null;
  metadata?: string | null; ipAddress?: string | null; userAgent?: string | null;
  createdAt: string; tenantId: string; userId?: string | null; user?: UserItem;
}
interface UserItem {
  id: string; email: string; name: string; role: string; tenantId?: string | null;
  phone?: string | null; avatarUrl?: string | null; preferredLanguage?: string; isActive?: boolean;
}
interface TenantItem {
  id: string; name: string; slug: string; plan: string; maxUsers: number; maxStorageGb: number;
  isActive: boolean; createdAt: string; _count?: { users: number; clients: number; cases: number };
}
interface DashboardStats {
  totalCases: number; activeCases: number; totalClients: number; upcomingEvents: number;
  unpaidInvoices: number; totalRevenue: number; paidInvoices: number;
  casesByStatus: Record<string, number>; casesByType: Record<string, number>;
  recentActivity: AuditLogItem[]; upcomingEventsList: EventItem[];
}
interface CurrencyItem { id: string; code: string; name: string; symbol: string }

// ==================== Query Client ====================
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30000, retry: 1 } }
})

// ==================== Constants ====================
const STATUS_COLORS: Record<string, string> = {
  nouveau: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  ouvert: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  en_cours: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  en_attente: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  clos: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  archive: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  non_paye: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  partiel: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  paye: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  annule: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}
const STATUS_LABELS: Record<string, string> = {
  nouveau: 'Nouveau', ouvert: 'Ouvert', en_cours: 'En cours', en_attente: 'En attente',
  clos: 'Clos', archive: 'Archivé', non_paye: 'Non payé', partiel: 'Partiel',
  paye: 'Payé', annule: 'Annulé',
}
const PRIORITY_COLORS: Record<string, string> = {
  basse: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  normal: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  haute: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  urgente: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
}
const PRIORITY_LABELS: Record<string, string> = { basse: 'Basse', normal: 'Normal', haute: 'Haute', urgente: 'Urgente' }
const TYPE_LABELS: Record<string, string> = { civil: 'Civil', penal: 'Pénal', commercial: 'Commercial', social: 'Social', administratif: 'Administratif' }
const EVENT_TYPE_LABELS: Record<string, string> = { audience: 'Audience', rdv: 'Rendez-vous', echeance: 'Échéance', depot: 'Dépôt', autre: 'Autre' }
const CRIT_COLORS: Record<string, string> = { basse: 'bg-slate-300 dark:bg-slate-600', normal: 'bg-amber-300 dark:bg-amber-600', haute: 'bg-orange-400 dark:bg-orange-500', urgente: 'bg-rose-500 dark:bg-rose-400' }
const ROLE_LABELS: Record<string, string> = { root_admin: 'Admin Racine', firm_admin: 'Admin Cabinet', lawyer: 'Avocat', secretary: 'Secrétaire', client: 'Client' }

// Legal palette: slate, amber, emerald, rose
const CHART_COLORS = ['#475569', '#d97706', '#059669', '#e11d48', '#94a3b8', '#f59e0b']
const CHART_COLORS_DARK = ['#94a3b8', '#f59e0b', '#34d399', '#fb7185', '#64748b', '#fbbf24']

const NAV_ITEMS: { view: ViewName; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
  { view: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { view: 'cases', label: 'Dossiers', icon: Briefcase },
  { view: 'clients', label: 'Clients', icon: Users },
  { view: 'documents', label: 'Documents', icon: FileText },
  { view: 'calendar', label: 'Calendrier', icon: Calendar },
  { view: 'invoices', label: 'Factures', icon: Receipt },
  { view: 'messages', label: 'Messages', icon: MessageSquare },
  { view: 'reports', label: 'Rapports', icon: BarChart3 },
  { view: 'audit-logs', label: "Journal d'audit", icon: Shield, adminOnly: true },
  { view: 'settings', label: 'Paramètres', icon: Settings },
]

// ==================== Helpers ====================
function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  try { return format(parseISO(d), 'dd/MM/yyyy', { locale: fr }) } catch { return '—' }
}
function fmtMoney(amount: number, code: string = 'XAF') {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: code, minimumFractionDigits: 0 }).format(amount)
}
function fmtFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' o'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' Ko'
  return (bytes / 1048576).toFixed(1) + ' Mo'
}
function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

// ==================== Theme Toggle ====================
function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            <Sun className="size-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute size-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Basculer le thème</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{theme === 'dark' ? 'Mode clair' : 'Mode sombre'}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ==================== Empty State Component ====================
function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="size-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <Icon className="size-8 text-slate-400 dark:text-slate-500" />
      </div>
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</h3>
      {description && <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 text-center max-w-sm">{description}</p>}
    </div>
  )
}

// ==================== Login Page ====================
function LoginPage() {
  const { login } = useAppStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { toast.error('Veuillez remplir tous les champs'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erreur de connexion'); return }
      login(data)
      toast.success(`Bienvenue, ${data.name} !`)
    } catch {
      toast.error('Erreur de connexion au serveur')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center login-pattern p-4">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md">
        <Card className="shadow-2xl border-slate-200/80 dark:border-slate-700/50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm">
          <CardHeader className="text-center pb-2 pt-8">
            <div className="mx-auto mb-4 flex items-center justify-center gap-2">
              <div className="size-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Scale className="size-6 text-white" />
              </div>
            </div>
            <div className="mb-1">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Juris</span><span className="text-2xl font-bold tracking-tight text-amber-600">Link</span>
            </div>
            <CardDescription className="text-sm mt-1">Gestion juridique intelligente</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Adresse e-mail</Label>
                <Input id="email" type="email" placeholder="email@jurislink.com" value={email} onChange={e => setEmail(e.target.value)} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="h-11" />
              </div>
              <Button type="submit" className="w-full h-11 bg-slate-900 hover:bg-slate-800 dark:bg-amber-600 dark:hover:bg-amber-700 text-white" disabled={loading}>
                {loading ? <RefreshCw className="size-4 animate-spin" /> : 'Se connecter'}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex-col gap-2 pb-8">
            <Separator className="mb-2" />
            <p className="text-xs text-slate-400 dark:text-slate-500">Compte démo</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-md">
              ngassa@jurislink.com / Admin@123
            </p>
          </CardFooter>
        </Card>
        <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-6">© 2025 JurisLink — Tous droits réservés</p>
      </motion.div>
    </div>
  )
}

// ==================== Sidebar ====================
function Sidebar() {
  const { currentView, setCurrentView, user, sidebarOpen, setSidebarOpen } = useAppStore()
  const isAdmin = user?.role === 'firm_admin' || user?.role === 'root_admin'

  const navContent = (
    <nav className="space-y-1 px-3">
      {NAV_ITEMS.filter(item => !item.adminOnly || isAdmin).map(item => {
        const Icon = item.icon
        const active = currentView === item.view
        return (
          <button key={item.view} onClick={() => { setCurrentView(item.view); setSidebarOpen(false) }}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
              active
                ? 'bg-amber-500/15 text-amber-400 dark:bg-amber-500/20 dark:text-amber-400'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200'
            )}>
            <Icon className="size-5 shrink-0" />
            <span className="whitespace-nowrap">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )

  const sidebarHeader = (
    <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-700/50 shrink-0">
      <div className="size-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shrink-0">
        <Scale className="size-4 text-white" />
      </div>
      <span className="text-lg font-bold tracking-tight whitespace-nowrap">
        <span className="text-white">Juris</span><span className="text-amber-500">Link</span>
      </span>
      <Button variant="ghost" size="icon" className="ml-auto text-slate-400 hover:text-white lg:hidden" onClick={() => setSidebarOpen(false)}>
        <X className="size-5" />
      </Button>
    </div>
  )

  const sidebarFooter = (
    <div className="p-4 border-t border-slate-700/50">
      <div className="flex items-center gap-3">
        <Avatar className="size-8 shrink-0">
          <AvatarFallback className="bg-amber-600 text-white text-xs">{user?.name ? initials(user.name) : 'U'}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate text-white">{user?.name}</p>
          <p className="text-xs text-slate-400 truncate">{ROLE_LABELS[user?.role || ''] || user?.role}</p>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar - always visible with full labels */}
      <aside className="hidden lg:flex fixed top-0 left-0 z-40 h-full bg-slate-900 dark:bg-slate-950 text-white flex-col w-[260px]">
        {sidebarHeader}
        <ScrollArea className="flex-1 py-4 custom-scrollbar">
          {navContent}
        </ScrollArea>
        {sidebarFooter}
      </aside>

      {/* Mobile sidebar - Sheet overlay */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[280px] p-0 bg-slate-900 dark:bg-slate-950 text-white border-slate-700/50">
          {sidebarHeader}
          <ScrollArea className="flex-1 py-4 custom-scrollbar">
            {navContent}
          </ScrollArea>
          {sidebarFooter}
        </SheetContent>
      </Sheet>
    </>
  )
}

// ==================== Header ====================
function Header() {
  const { currentView, user, logout, setCurrentView } = useAppStore()
  const [search, setSearch] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)

  const viewLabel = NAV_ITEMS.find(n => n.view === currentView)?.label || 'JurisLink'

  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ['notifications', user?.tenantId, user?.id],
    queryFn: () => fetch(`/api/notifications?tenantId=${user!.tenantId}&userId=${user!.id}`).then(r => r.json()),
    enabled: !!user?.tenantId
  })
  const unreadCount = notifications?.filter(n => !n.isRead).length || 0

  const { data: messages } = useQuery<Message[]>({
    queryKey: ['messages-unread', user?.tenantId, user?.id],
    queryFn: () => fetch(`/api/messages?tenantId=${user!.tenantId}&userId=${user!.id}`).then(r => r.json()),
    enabled: !!user?.tenantId
  })
  const unreadMsgCount = messages?.filter(m => !m.isRead && m.receiverId === user?.id).length || 0

  const markAllRead = async () => {
    if (!user?.tenantId || !user?.id) return
    await fetch('/api/notifications/read-all', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: user.tenantId, userId: user.id })
    })
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
    setNotifOpen(false)
  }

  const markNotifRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isRead: true }) })
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700/50 h-16 flex items-center px-4 md:px-6 gap-4">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => useAppStore.getState().toggleSidebar()}>
        <Menu className="size-5" />
      </Button>
      <h1 className="text-lg font-semibold text-slate-900 dark:text-white hidden sm:block">{viewLabel}</h1>
      <div className="flex-1 max-w-md mx-auto">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 h-9" />
        </div>
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="relative" onClick={() => setCurrentView('messages')}>
                <MessageSquare className="size-5 text-slate-600 dark:text-slate-300" />
                {unreadMsgCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 size-4 bg-amber-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadMsgCount > 9 ? '9+' : unreadMsgCount}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Messages</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="size-5 text-slate-600 dark:text-slate-300" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 size-4 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Bell className="size-4" />Notifications</div>
              {unreadCount > 0 && <Button variant="ghost" size="sm" className="text-xs h-6 text-amber-600" onClick={markAllRead}>Tout marquer lu</Button>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications && notifications.length > 0 ? (
              <ScrollArea className="max-h-72">
                {notifications.slice(0, 10).map(n => (
                  <DropdownMenuItem key={n.id} className={cn('flex flex-col items-start gap-1 p-3 cursor-pointer rounded-md mx-1 my-0.5',
                    !n.isRead && 'bg-amber-50 dark:bg-amber-500/10'
                  )}
                    onClick={() => { markNotifRead(n.id); const viewMap: Record<string, ViewName> = { dossier: 'cases', echeance: 'calendar', facture: 'invoices', document: 'documents', message: 'messages', securite: 'settings' }; const target = viewMap[n.category]; if (target) useAppStore.getState().setCurrentView(target); }}>
                    <div className="flex items-center gap-2 w-full">
                      {!n.isRead && <span className="size-2 bg-amber-500 rounded-full shrink-0" />}
                      <span className={cn('text-sm font-medium', !n.isRead ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300')}>{n.title}</span>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 ml-4">{n.message}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-4">{fmtDate(n.createdAt)}</span>
                  </DropdownMenuItem>
                ))}
              </ScrollArea>
            ) : (
              <div className="py-6 flex flex-col items-center gap-2">
                <Bell className="size-8 text-slate-300 dark:text-slate-600" />
                <p className="text-sm text-slate-400 dark:text-slate-500">Aucune notification</p>
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2">
              <Avatar className="size-7">
                <AvatarFallback className="bg-amber-600 text-white text-xs">{user?.name ? initials(user.name) : 'U'}</AvatarFallback>
              </Avatar>
              <span className="hidden md:block text-sm text-slate-700 dark:text-slate-200">{user?.name}</span>
              <ChevronDown className="size-3 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Mon compte</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setCurrentView('settings')}><User className="size-4 mr-2" />Profil</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCurrentView('settings')}><Settings className="size-4 mr-2" />Paramètres</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-rose-600 dark:text-rose-400"><LogOut className="size-4 mr-2" />Déconnexion</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

// ==================== Dashboard View ====================
function DashboardView() {
  const { user } = useAppStore()
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats', user?.tenantId],
    queryFn: () => fetch(`/api/dashboard/stats?tenantId=${user!.tenantId}`).then(r => r.json()),
    enabled: !!user?.tenantId
  })

  const statusData = stats?.casesByStatus ? Object.entries(stats.casesByStatus).map(([k, v]) => ({ name: STATUS_LABELS[k] || k, value: v })) : []
  const typeData = stats?.casesByType ? Object.entries(stats.casesByType).map(([k, v]) => ({ name: TYPE_LABELS[k] || k, value: v })) : []

  const kpis = [
    { label: 'Dossiers actifs', value: stats?.activeCases || 0, icon: Briefcase, color: 'text-slate-700 dark:text-slate-200', bg: 'bg-slate-100 dark:bg-slate-800' },
    { label: 'Clients', value: stats?.totalClients || 0, icon: Users, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30' },
    { label: 'Échéances', value: stats?.upcomingEvents || 0, icon: Clock, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/30' },
    { label: 'Factures impayées', value: stats?.unpaidInvoices || 0, icon: Receipt, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/30' },
  ]

  if (isLoading) return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-80 rounded-xl" /><Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  )

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden relative">
                <div className={cn('absolute left-0 top-0 bottom-0 w-1', i === 0 ? 'bg-slate-500' : i === 1 ? 'bg-amber-500' : i === 2 ? 'bg-rose-500' : 'bg-orange-500')} />
                <CardContent className="p-4 pl-5 flex items-center gap-4">
                  <div className={cn('p-3 rounded-xl', kpi.bg)}><Icon className={cn('size-6', kpi.color)} /></div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{kpi.value}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{kpi.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader><CardTitle className="text-base">Dossiers par statut</CardTitle></CardHeader>
          <CardContent><div className="h-64"><ResponsiveContainer width="100%" height="100%">
            <BarChart data={statusData}><CartesianGrid strokeDasharray="3 3" stroke="" className="stroke-slate-200 dark:stroke-slate-700" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-slate-500)' }} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--color-slate-500)' }} />
              <RechartsTooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {statusData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer></div></CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader><CardTitle className="text-base">Dossiers par type</CardTitle></CardHeader>
          <CardContent><div className="h-64"><ResponsiveContainer width="100%" height="100%">
            <PieChart><Pie data={typeData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" nameKey="name" label>
              {typeData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie><Legend formatter={(value: string) => <span className="text-xs text-slate-600 dark:text-slate-300">{value}</span>} /><RechartsTooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} /></PieChart>
          </ResponsiveContainer></div></CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader><CardTitle className="text-base">Échéances prochaines</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {stats?.upcomingEventsList && stats.upcomingEventsList.length > 0 ? stats.upcomingEventsList.slice(0, 5).map(ev => (
              <div key={ev.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <div className={cn('w-1 h-10 rounded-full shrink-0', CRIT_COLORS[ev.criticality] || 'bg-slate-300')} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{ev.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{EVENT_TYPE_LABELS[ev.eventType] || ev.eventType} • {fmtDate(ev.startTime)}</p>
                </div>
              </div>
            )) : <EmptyState icon={Calendar} title="Aucune échéance à venir" description="Les événements à venir apparaîtront ici" />}
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader><CardTitle className="text-base">Activité récente</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {stats?.recentActivity && stats.recentActivity.length > 0 ? stats.recentActivity.slice(0, 10).map(log => (
              <div key={log.id} className="flex items-start gap-3">
                <div className="size-2 mt-1.5 rounded-full bg-amber-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-slate-700 dark:text-slate-300"><span className="font-medium text-slate-900 dark:text-white">{log.user?.name || 'Système'}</span> {log.action}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{fmtDate(log.createdAt)}</p>
                </div>
              </div>
            )) : <EmptyState icon={Activity} title="Aucune activité récente" description="L’activité de l’équipe apparaîtra ici" />}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ==================== Clients View ====================
function ClientsView() {
  const { user } = useAppStore()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState({ firstName: '', lastName: '', company: '', email: '', phone: '', address: '', notes: '' })

  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ['clients', user?.tenantId, search, statusFilter],
    queryFn: () => {
      const p = new URLSearchParams({ tenantId: user!.tenantId })
      if (search) p.set('search', search)
      if (statusFilter !== 'all') p.set('status', statusFilter)
      return fetch(`/api/clients?${p}`).then(r => r.json())
    },
    enabled: !!user?.tenantId
  })

  const mutation = useMutation({
    mutationFn: async (body: Record<string, string>) => {
      if (editing) {
        return fetch(`/api/clients/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
      }
      return fetch('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, tenantId: user!.tenantId }) }).then(r => r.json())
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success(editing ? 'Client modifié' : 'Client créé'); setOpen(false); setEditing(null) },
    onError: () => toast.error('Erreur lors de l\'enregistrement')
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/clients/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success('Client supprimé') },
    onError: () => toast.error('Erreur lors de la suppression')
  })

  const openCreate = () => { setEditing(null); setForm({ firstName: '', lastName: '', company: '', email: '', phone: '', address: '', notes: '' }); setOpen(true) }
  const openEdit = (c: Client) => { setEditing(c); setForm({ firstName: c.firstName, lastName: c.lastName, company: c.company || '', email: c.email || '', phone: c.phone || '', address: c.address || '', notes: c.notes || '' }); setOpen(true) }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.firstName || !form.lastName) { toast.error('Nom et prénom requis'); return }
    mutation.mutate(form)
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input placeholder="Rechercher un client..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Tous</SelectItem><SelectItem value="active">Actif</SelectItem><SelectItem value="inactive">Inactif</SelectItem></SelectContent>
          </Select>
        </div>
        <Button onClick={openCreate} className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"><Plus className="size-4" />Nouveau client</Button>
      </div>

      {isLoading ? <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div> : (
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <div className="overflow-x-auto">
            <Table><TableHeader><TableRow>
              <TableHead>Nom complet</TableHead><TableHead className="hidden md:table-cell">Société</TableHead>
              <TableHead className="hidden lg:table-cell">Email</TableHead><TableHead className="hidden lg:table-cell">Téléphone</TableHead>
              <TableHead>Dossiers</TableHead><TableHead>Statut</TableHead><TableHead className="w-10"></TableHead>
            </TableRow></TableHeader><TableBody>
              {clients?.map(c => (
                <TableRow key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <TableCell className="font-medium">{c.firstName} {c.lastName}</TableCell>
                  <TableCell className="hidden md:table-cell">{c.company || '—'}</TableCell>
                  <TableCell className="hidden lg:table-cell">{c.email || '—'}</TableCell>
                  <TableCell className="hidden lg:table-cell">{c.phone || '—'}</TableCell>
                  <TableCell>{c._count?.cases || 0}</TableCell>
                  <TableCell><Badge variant={c.isActive ? 'default' : 'secondary'} className={cn('rounded-full px-2.5', c.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400')}>{c.isActive ? 'Actif' : 'Inactif'}</Badge></TableCell>
                  <TableCell>
                    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(c)}><Edit className="size-4 mr-2" />Modifier</DropdownMenuItem>
                        <DropdownMenuItem className="text-rose-600 dark:text-rose-400" onClick={() => deleteMutation.mutate(c.id)}><Trash2 className="size-4 mr-2" />Supprimer</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {(!clients || clients.length === 0) && (
                <TableRow><TableCell colSpan={7} className="p-0"><EmptyState icon={Users} title="Aucun client trouvé" description="Commencez par ajouter votre premier client" /></TableCell></TableRow>
              )}
            </TableBody></Table>
          </div>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{editing ? 'Modifier le client' : 'Nouveau client'}</DialogTitle>
          <DialogDescription>{editing ? 'Modifiez les informations du client' : 'Ajoutez un nouveau client'}</DialogDescription></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Prénom *</Label><Input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} required /></div>
              <div className="space-y-2"><Label>Nom *</Label><Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} required /></div></div>
            <div className="space-y-2"><Label>Société</Label><Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Téléphone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div></div>
            <div className="space-y-2"><Label>Adresse</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white" disabled={mutation.isPending}>{mutation.isPending ? <RefreshCw className="size-4 animate-spin" /> : editing ? 'Enregistrer' : 'Créer'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ==================== Cases View ====================
function CasesView({ archiveMode = false }: { archiveMode?: boolean }) {
  const { user } = useAppStore()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CaseItem | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [form, setForm] = useState({ title: '', type: 'civil', priority: 'normal', status: 'nouveau', description: '', clientId: '', isSecret: false, assignedUserIds: '' as string })

  const { data: clients } = useQuery<Client[]>({
    queryKey: ['clients-list', user?.tenantId], queryFn: () => fetch(`/api/clients?tenantId=${user!.tenantId}`).then(r => r.json()), enabled: !!user?.tenantId
  })
  const { data: users } = useQuery<UserItem[]>({
    queryKey: ['users-list', user?.tenantId], queryFn: () => fetch(`/api/users?tenantId=${user!.tenantId}`).then(r => r.json()), enabled: !!user?.tenantId
  })

  const statuses = archiveMode ? 'clos,archive' : ''
  const { data: cases, isLoading } = useQuery<CaseItem[]>({
    queryKey: ['cases', user?.tenantId, search, statusFilter, typeFilter, priorityFilter, archiveMode],
    queryFn: () => {
      const p = new URLSearchParams({ tenantId: user!.tenantId })
      if (search) p.set('search', search)
      if (statusFilter !== 'all') p.set('status', statusFilter)
      else if (statuses) p.set('status', statuses)
      if (typeFilter !== 'all') p.set('type', typeFilter)
      if (priorityFilter !== 'all') p.set('priority', priorityFilter)
      return fetch(`/api/cases?${p}`).then(r => r.json())
    },
    enabled: !!user?.tenantId
  })

  const mutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      if (editing) {
        return fetch(`/api/cases/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
      }
      return fetch('/api/cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, tenantId: user!.tenantId }) }).then(r => r.json())
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cases'] }); toast.success(editing ? 'Dossier modifié' : 'Dossier créé'); setOpen(false); setEditing(null) },
    onError: () => toast.error('Erreur')
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/cases/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cases'] }); toast.success('Dossier supprimé') },
    onError: () => toast.error('Erreur')
  })

  const noteMutation = useMutation({
    mutationFn: ({ caseId, content }: { caseId: string; content: string }) =>
      fetch(`/api/cases/${caseId}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, userId: user!.id, tenantId: user!.tenantId }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cases'] }); setNoteText(''); toast.success('Note ajoutée') },
    onError: () => toast.error('Erreur')
  })

  const openCreate = () => { setEditing(null); setForm({ title: '', type: 'civil', priority: 'normal', status: 'nouveau', description: '', clientId: '', isSecret: false, assignedUserIds: '' }); setOpen(true) }
  const openEdit = (c: CaseItem) => {
    setEditing(c); setForm({
      title: c.title, type: c.type, priority: c.priority, status: c.status,
      description: c.description || '', clientId: c.clientId, isSecret: c.isSecret,
      assignedUserIds: c.assignments?.map(a => a.userId).join(',') || ''
    }); setOpen(true)
  }
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.clientId) { toast.error('Titre et client requis'); return }
    const assignedUserIds = form.assignedUserIds ? form.assignedUserIds.split(',') : []
    mutation.mutate({ ...form, assignedUserIds })
  }

  const expandedCase = cases?.find(c => c.id === expanded)

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto flex-wrap">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input placeholder="Rechercher un dossier..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Tous</SelectItem><SelectItem value="nouveau">Nouveau</SelectItem><SelectItem value="ouvert">Ouvert</SelectItem><SelectItem value="en_cours">En cours</SelectItem><SelectItem value="en_attente">En attente</SelectItem><SelectItem value="clos">Clos</SelectItem></SelectContent></Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Tous</SelectItem><SelectItem value="civil">Civil</SelectItem><SelectItem value="penal">Pénal</SelectItem><SelectItem value="commercial">Commercial</SelectItem><SelectItem value="social">Social</SelectItem><SelectItem value="administratif">Administratif</SelectItem></SelectContent></Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}><SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Priorité" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Toutes</SelectItem><SelectItem value="basse">Basse</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="haute">Haute</SelectItem><SelectItem value="urgente">Urgente</SelectItem></SelectContent></Select>
        </div>
        {!archiveMode && <Button onClick={openCreate} className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"><Plus className="size-4" />Nouveau dossier</Button>}
      </div>

      {isLoading ? <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div> : (
        <div className="space-y-3">
          {cases?.map(c => (
            <Collapsible key={c.id} open={expanded === c.id} onOpenChange={(o) => setExpanded(o ? c.id : null)}>
              <Card className="hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
                <div className={cn('absolute left-0 top-0 bottom-0 w-1 rounded-l-lg', c.priority === 'urgente' ? 'bg-rose-500' : c.priority === 'haute' ? 'bg-orange-500' : c.priority === 'basse' ? 'bg-slate-300 dark:bg-slate-600' : 'bg-slate-400 dark:bg-slate-500')} />
                <CollapsibleTrigger asChild>
                  <div className="p-4 flex flex-col md:flex-row md:items-center gap-3 cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">{c.reference}</span>
                        {c.isSecret && <Lock className="size-3.5 text-amber-600" />}
                        <Badge className={cn('rounded-full px-2.5', STATUS_COLORS[c.status] || '')}>{STATUS_LABELS[c.status] || c.status}</Badge>
                        <Badge className={cn('rounded-full px-2.5', PRIORITY_COLORS[c.priority] || '')}>{PRIORITY_LABELS[c.priority] || c.priority}</Badge>
                      </div>
                      <p className="font-medium text-slate-900 dark:text-white mt-1 truncate">{c.title}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{c.client?.firstName} {c.client?.lastName} {c.client?.company ? `• ${c.client.company}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-slate-400 dark:text-slate-500">{TYPE_LABELS[c.type] || c.type}</span>
                      {c.nextDueDate && <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1"><Clock className="size-3" />{fmtDate(c.nextDueDate)}</span>}
                      {!archiveMode && (
                        <DropdownMenu><DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}><Button variant="ghost" size="icon"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(c) }}><Edit className="size-4 mr-2" />Modifier</DropdownMenuItem>
                            <DropdownMenuItem className="text-rose-600 dark:text-rose-400" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(c.id) }}><Trash2 className="size-4 mr-2" />Supprimer</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      <ChevronDown className={cn('size-4 text-slate-400 dark:text-slate-500 transition-transform', expanded === c.id && 'rotate-180')} />
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {expandedCase && (
                    <div className="border-t border-slate-100 dark:border-slate-700 p-4 space-y-4">
                      {expandedCase.description && <p className="text-sm text-slate-600 dark:text-slate-300">{expandedCase.description}</p>}
                      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                        {expandedCase.assignments?.map(a => (
                          <Badge key={a.id} variant="outline" className="text-xs rounded-full">{a.user?.name || 'Avocat'}</Badge>
                        ))}
                      </div>
                      {expandedCase.documents && expandedCase.documents.length > 0 && (
                        <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Documents ({expandedCase.documents.length})</p>
                          <div className="flex flex-wrap gap-2">{expandedCase.documents.map(d => (
                            <Badge key={d.id} variant="outline" className="text-xs gap-1 rounded-full"><FileText className="size-3" />{d.name}</Badge>
                          ))}</div></div>
                      )}
                      <div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Notes</p>
                        <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                          {expandedCase.notes?.map(n => (
                            <div key={n.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2 text-sm"><p className="text-slate-700 dark:text-slate-300">{n.content}</p>
                              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{n.user?.name || ''} — {fmtDate(n.createdAt)}</p></div>
                          ))}
                        </div>
                        {!archiveMode && (
                          <div className="flex gap-2 mt-2">
                            <Input placeholder="Ajouter une note..." value={noteText} onChange={e => setNoteText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && noteText.trim()) noteMutation.mutate({ caseId: expandedCase!.id, content: noteText.trim() }) }} className="text-sm" />
                            <Button size="icon" onClick={() => { if (noteText.trim()) noteMutation.mutate({ caseId: expandedCase!.id, content: noteText.trim() }) }} className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"><Send className="size-4" /></Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
          {(!cases || cases.length === 0) && (
            <EmptyState icon={archiveMode ? Archive : Briefcase} title={archiveMode ? 'Aucun dossier archivé' : 'Aucun dossier trouvé'} description={archiveMode ? 'Les dossiers clos et archivés apparaîtront ici' : 'Commencez par créer votre premier dossier'} />
          )}
        </div>
      )}

      {!archiveMode && <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? 'Modifier le dossier' : 'Nouveau dossier'}</DialogTitle>
          <DialogDescription>{editing ? 'Modifiez les informations' : 'Créez un nouveau dossier'}</DialogDescription></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2"><Label>Titre *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Type</Label><Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="civil">Civil</SelectItem><SelectItem value="penal">Pénal</SelectItem><SelectItem value="commercial">Commercial</SelectItem><SelectItem value="social">Social</SelectItem><SelectItem value="administratif">Administratif</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Priorité</Label><Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="basse">Basse</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="haute">Haute</SelectItem><SelectItem value="urgente">Urgente</SelectItem></SelectContent></Select></div>
          </div>
          <div className="space-y-2"><Label>Statut</Label><Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="nouveau">Nouveau</SelectItem><SelectItem value="ouvert">Ouvert</SelectItem><SelectItem value="en_cours">En cours</SelectItem><SelectItem value="en_attente">En attente</SelectItem><SelectItem value="clos">Clos</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>Client *</Label><Select value={form.clientId} onValueChange={v => setForm(f => ({ ...f, clientId: v }))}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
            <SelectContent>{clients?.map(c => <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}{c.company ? ` (${c.company})` : ''}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
          <div className="flex items-center gap-2"><Checkbox checked={form.isSecret} onCheckedChange={v => setForm(f => ({ ...f, isSecret: !!v }))} />
            <Label>Confidentiel (secret)</Label></div>
          <div className="space-y-2"><Label>Avocats assignés</Label><Select value={form.assignedUserIds} onValueChange={v => setForm(f => ({ ...f, assignedUserIds: v }))}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
            <SelectContent>{users?.filter(u => u.role === 'lawyer' || u.role === 'firm_admin').map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white" disabled={mutation.isPending}>{mutation.isPending ? <RefreshCw className="size-4 animate-spin" /> : editing ? 'Enregistrer' : 'Créer'}</Button></DialogFooter>
        </form>
      </DialogContent></Dialog>}
    </div>
  )
}

// ==================== Documents View ====================
function DocumentsView() {
  const { user } = useAppStore()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [caseFilter, setCaseFilter] = useState('all')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', caseId: '' })

  const { data: cases } = useQuery<CaseItem[]>({
    queryKey: ['cases-docs', user?.tenantId], queryFn: () => fetch(`/api/cases?tenantId=${user!.tenantId}`).then(r => r.json()), enabled: !!user?.tenantId
  })
  const { data: documents, isLoading } = useQuery<Doc[]>({
    queryKey: ['documents', user?.tenantId, search, caseFilter],
    queryFn: () => {
      const p = new URLSearchParams({ tenantId: user!.tenantId })
      if (search) p.set('search', search)
      return fetch(`/api/documents?${p}`).then(r => r.json())
    },
    enabled: !!user?.tenantId
  })

  const mutation = useMutation({
    mutationFn: (body: Record<string, string>) =>
      fetch('/api/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, tenantId: user!.tenantId, userId: user!.id, fileName: body.name, fileType: 'pdf', filePath: '/uploads/' + body.name, fileSize: 0 }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['documents'] }); toast.success('Document ajouté'); setOpen(false) },
    onError: () => toast.error('Erreur')
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/documents/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['documents'] }); toast.success('Document supprimé') },
    onError: () => toast.error('Erreur')
  })

  const filtered = caseFilter === 'all' ? documents : documents?.filter(d => d.caseId === caseFilter)

  const grouped = useMemo(() => {
    const map = new Map<string, { clientName: string; cases: { caseName: string; docs: Doc[] }[] }>()
    filtered?.forEach(d => {
      const clientName = d.case?.client ? `${d.case.client.firstName} ${d.case.client.lastName}` : 'Sans client'
      const caseName = d.case?.title || 'Sans dossier'
      const key = `${clientName}::${d.caseId || 'none'}`
      if (!map.has(key)) { map.set(key, { clientName, cases: [] }) }
      const entry = map.get(key)!
      let caseEntry = entry.cases.find(c => c.caseName === caseName)
      if (!caseEntry) { caseEntry = { caseName, docs: [] }; entry.cases.push(caseEntry) }
      caseEntry.docs.push(d)
    })
    return map
  }, [filtered])

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input placeholder="Rechercher un document..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={caseFilter} onValueChange={setCaseFilter}><SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Filtrer par dossier" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Tous les dossiers</SelectItem>
              {cases?.map(c => <SelectItem key={c.id} value={c.id}>{c.reference} - {c.title}</SelectItem>)}</SelectContent></Select>
        </div>
        <Button onClick={() => { setForm({ name: '', description: '', caseId: '' }); setOpen(true) }} className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"><Plus className="size-4" />Ajouter un document</Button>
      </div>

      {isLoading ? <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div> : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([key, group]) => (
            <div key={key}>
              <h3 className="font-medium text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2"><Users className="size-4" />{group.clientName}</h3>
              {group.cases.map((caseGroup, ci) => (
                <div key={ci} className="ml-4 mb-3">
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-2"><Briefcase className="size-3 inline mr-1" />{caseGroup.caseName}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {caseGroup.docs.map(d => (
                      <Card key={d.id} className="hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
                        <CardContent className="p-4 flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800"><FileText className="size-5 text-slate-600 dark:text-slate-300" /></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{d.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{d.fileType.toUpperCase()} • {fmtFileSize(d.fileSize)}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">{fmtDate(d.createdAt)}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="size-8"><Download className="size-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="size-8 text-rose-600 dark:text-rose-400" onClick={() => deleteMutation.mutate(d.id)}><Trash2 className="size-3.5" /></Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
              <Separator className="mt-4" />
            </div>
          ))}
          {grouped.size === 0 && <EmptyState icon={FileText} title="Aucun document trouvé" description="Les documents ajoutés aux dossiers apparaîtront ici" />}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Ajouter un document</DialogTitle><DialogDescription>Enregistrez les métadonnées du document</DialogDescription></DialogHeader>
        <form onSubmit={e => { e.preventDefault(); if (!form.name) { toast.error('Nom requis'); return } mutation.mutate(form) }} className="space-y-4">
          <div className="space-y-2"><Label>Nom du document *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
          <div className="space-y-2"><Label>Dossier</Label><Select value={form.caseId} onValueChange={v => setForm(f => ({ ...f, caseId: v }))}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
            <SelectContent>{cases?.map(c => <SelectItem key={c.id} value={c.id}>{c.reference} - {c.title}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white" disabled={mutation.isPending}>{mutation.isPending ? <RefreshCw className="size-4 animate-spin" /> : 'Ajouter'}</Button></DialogFooter>
        </form>
      </DialogContent></Dialog>
    </div>
  )
}

// ==================== Calendar View ====================
function CalendarView() {
  const { user } = useAppStore()
  const qc = useQueryClient()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', date: '', time: '', eventType: 'audience', criticality: 'normal', caseId: '', location: '', assignedUserIds: '' })

  const monthStr = format(currentMonth, 'yyyy-MM')
  const { data: events, isLoading } = useQuery<EventItem[]>({
    queryKey: ['events', user?.tenantId, monthStr],
    queryFn: () => fetch(`/api/events?tenantId=${user!.tenantId}&month=${monthStr}`).then(r => r.json()),
    enabled: !!user?.tenantId
  })
  const { data: cases } = useQuery<CaseItem[]>({
    queryKey: ['cases-cal', user?.tenantId], queryFn: () => fetch(`/api/cases?tenantId=${user!.tenantId}`).then(r => r.json()), enabled: !!user?.tenantId
  })
  const { data: users } = useQuery<UserItem[]>({
    queryKey: ['users-cal', user?.tenantId], queryFn: () => fetch(`/api/users?tenantId=${user!.tenantId}`).then(r => r.json()), enabled: !!user?.tenantId
  })

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, tenantId: user!.tenantId, assignedUserIds: body.assignedUserIds ? (body.assignedUserIds as string).split(',') : [] }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); toast.success('Événement créé'); setOpen(false) },
    onError: () => toast.error('Erreur')
  })

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calEnd = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
    return eachDayOfInterval({ start: calStart, end: calEnd })
  }, [currentMonth])

  const dayEvents = (day: Date) => events?.filter(e => isSameDay(parseISO(e.startTime), day)) || []
  const selectedDayEvents = selectedDay ? dayEvents(selectedDay) : []

  const handleDayClick = (day: Date) => {
    setSelectedDay(day)
    setForm(f => ({ ...f, date: format(day, 'yyyy-MM-dd') }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.date) { toast.error('Titre et date requis'); return }
    mutation.mutate({ ...form, startTime: form.date + 'T' + (form.time || '09:00') + ':00.000Z' })
  }

  const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="size-4" /></Button>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white capitalize min-w-[180px] text-center">{format(currentMonth, 'MMMM yyyy', { locale: fr })}</h2>
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="size-4" /></Button>
        <Button variant="outline" size="sm" onClick={() => { setCurrentMonth(new Date()); setSelectedDay(new Date()) }}>Aujourd'hui</Button>
        <Button className="bg-amber-600 hover:bg-amber-700 text-white ml-auto" onClick={() => { setForm({ title: '', description: '', date: selectedDay ? format(selectedDay, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'), time: '09:00', eventType: 'audience', criticality: 'normal', caseId: '', location: '', assignedUserIds: '' }); setOpen(true) }}>
          <Plus className="size-4" />Nouvel événement
        </Button>
      </div>

      {isLoading ? <Skeleton className="h-96 rounded-xl" /> : (
        <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-700 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
          {weekDays.map(d => <div key={d} className="bg-slate-50 dark:bg-slate-800 p-2 text-center text-xs font-medium text-slate-600 dark:text-slate-400">{d}</div>)}
          {days.map(day => {
            const evts = dayEvents(day)
            const isCurrentMonth = isSameMonth(day, currentMonth)
            return (
              <div key={day.toISOString()} onClick={() => handleDayClick(day)}
                className={cn('bg-white dark:bg-slate-900 p-1.5 min-h-[80px] md:min-h-[100px] cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors',
                  !isCurrentMonth && 'bg-slate-50/50 dark:bg-slate-800/50',
                  isToday(day) && 'bg-amber-50 dark:bg-amber-500/10',
                  selectedDay && isSameDay(day, selectedDay) && 'ring-2 ring-amber-500 ring-inset'
                )}>
                <span className={cn('text-xs font-medium',
                  isCurrentMonth ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-600',
                  isToday(day) && 'text-amber-600 dark:text-amber-400 font-bold'
                )}>{format(day, 'd')}</span>
                <div className="mt-1 space-y-0.5">
                  {evts.slice(0, 2).map(ev => (
                    <div key={ev.id} className={cn('text-[10px] leading-tight px-1 py-0.5 rounded truncate', CRIT_COLORS[ev.criticality] || 'bg-slate-200 dark:bg-slate-700', 'text-slate-800 dark:text-slate-200')}>
                      {ev.title}
                    </div>
                  ))}
                  {evts.length > 2 && <p className="text-[10px] text-slate-400 dark:text-slate-500">+{evts.length - 2} autres</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selectedDay && (
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader className="pb-2"><CardTitle className="text-base">{format(selectedDay, 'EEEE dd MMMM yyyy', { locale: fr })}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {selectedDayEvents.length > 0 ? selectedDayEvents.map(ev => (
              <div key={ev.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <div className={cn('w-1.5 h-10 rounded-full shrink-0', CRIT_COLORS[ev.criticality] || 'bg-slate-300')} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{ev.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{EVENT_TYPE_LABELS[ev.eventType] || ev.eventType} • {format(parseISO(ev.startTime), 'HH:mm')}{ev.location ? ` • ${ev.location}` : ''}</p>
                  {ev.case && <p className="text-xs text-slate-400 dark:text-slate-500">Dossier : {ev.case.reference}</p>}
                </div>
              </div>
            )) : <EmptyState icon={Calendar} title="Aucun événement ce jour" description="Cliquez sur « Nouvel événement » pour en créer un" />}
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nouvel événement</DialogTitle><DialogDescription>Créez un événement au calendrier</DialogDescription></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2"><Label>Titre *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Date *</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required /></div>
            <div className="space-y-2"><Label>Heure</Label><Input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Type</Label><Select value={form.eventType} onValueChange={v => setForm(f => ({ ...f, eventType: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="audience">Audience</SelectItem><SelectItem value="rdv">Rendez-vous</SelectItem><SelectItem value="echeance">Échéance</SelectItem><SelectItem value="depot">Dépôt</SelectItem><SelectItem value="autre">Autre</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Criticité</Label><Select value={form.criticality} onValueChange={v => setForm(f => ({ ...f, criticality: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="basse">Basse</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="haute">Haute</SelectItem><SelectItem value="urgente">Urgente</SelectItem></SelectContent></Select></div>
          </div>
          <div className="space-y-2"><Label>Dossier lié</Label><Select value={form.caseId} onValueChange={v => setForm(f => ({ ...f, caseId: v }))}><SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
            <SelectContent><SelectItem value="">Aucun</SelectItem>{cases?.map(c => <SelectItem key={c.id} value={c.id}>{c.reference} - {c.title}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Lieu</Label><Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
          <div className="space-y-2"><Label>Personnes assignées</Label><Select value={form.assignedUserIds} onValueChange={v => setForm(f => ({ ...f, assignedUserIds: v }))}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
            <SelectContent>{users?.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white" disabled={mutation.isPending}>{mutation.isPending ? <RefreshCw className="size-4 animate-spin" /> : 'Créer'}</Button></DialogFooter>
        </form>
      </DialogContent></Dialog>
    </div>
  )
}

// ==================== Invoices View ====================
function InvoicesView() {
  const { user } = useAppStore()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ clientId: '', caseId: '', amount: '', currencyCode: 'XAF', dueDate: '', notes: '' })

  const { data: clients } = useQuery<Client[]>({
    queryKey: ['clients-inv', user?.tenantId], queryFn: () => fetch(`/api/clients?tenantId=${user!.tenantId}`).then(r => r.json()), enabled: !!user?.tenantId
  })
  const { data: cases } = useQuery<CaseItem[]>({
    queryKey: ['cases-inv', user?.tenantId], queryFn: () => fetch(`/api/cases?tenantId=${user!.tenantId}`).then(r => r.json()), enabled: !!user?.tenantId
  })
  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: ['invoices', user?.tenantId, search, statusFilter],
    queryFn: () => {
      const p = new URLSearchParams({ tenantId: user!.tenantId })
      if (search) p.set('search', search)
      if (statusFilter !== 'all') p.set('status', statusFilter)
      return fetch(`/api/invoices?${p}`).then(r => r.json())
    },
    enabled: !!user?.tenantId
  })

  const mutation = useMutation({
    mutationFn: (body: Record<string, string>) =>
      fetch('/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, tenantId: user!.tenantId, amount: parseFloat(body.amount) || 0 }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Facture créée'); setOpen(false) },
    onError: () => toast.error('Erreur')
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/invoices/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Facture supprimée') },
    onError: () => toast.error('Erreur')
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.clientId || !form.amount) { toast.error('Client et montant requis'); return }
    mutation.mutate(form)
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input placeholder="Rechercher une facture..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Toutes</SelectItem><SelectItem value="non_paye">Non payé</SelectItem><SelectItem value="partiel">Partiel</SelectItem><SelectItem value="paye">Payé</SelectItem><SelectItem value="annule">Annulé</SelectItem></SelectContent></Select>
        </div>
        <Button onClick={() => { setForm({ clientId: '', caseId: '', amount: '', currencyCode: 'XAF', dueDate: '', notes: '' }); setOpen(true) }} className="bg-amber-600 hover:bg-amber-700 text-white shrink-0">
          <Plus className="size-4" />Nouvelle facture
        </Button>
      </div>

      {isLoading ? <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div> : (
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <div className="overflow-x-auto">
            <Table><TableHeader><TableRow>
              <TableHead>Référence</TableHead><TableHead>Client</TableHead><TableHead className="hidden md:table-cell">Dossier</TableHead>
              <TableHead>Montant</TableHead><TableHead>Statut</TableHead><TableHead className="hidden lg:table-cell">Échéance</TableHead><TableHead className="w-10"></TableHead>
            </TableRow></TableHeader><TableBody>
              {invoices?.map(inv => (
                <TableRow key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <TableCell className="font-mono text-xs">{inv.reference}</TableCell>
                  <TableCell className="font-medium">{inv.client?.firstName} {inv.client?.lastName}</TableCell>
                  <TableCell className="hidden md:table-cell">{inv.case?.reference || '—'}</TableCell>
                  <TableCell className="font-medium">{fmtMoney(inv.amount, inv.currencyCode)}</TableCell>
                  <TableCell><Badge className={cn('rounded-full px-2.5', STATUS_COLORS[inv.status] || '')}>{STATUS_LABELS[inv.status] || inv.status}</Badge></TableCell>
                  <TableCell className="hidden lg:table-cell">{fmtDate(inv.dueDate)}</TableCell>
                  <TableCell>
                    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="text-rose-600 dark:text-rose-400" onClick={() => deleteMutation.mutate(inv.id)}><Trash2 className="size-4 mr-2" />Supprimer</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {(!invoices || invoices.length === 0) && (
                <TableRow><TableCell colSpan={7} className="p-0"><EmptyState icon={Receipt} title="Aucune facture trouvée" description="Créez votre première facture" /></TableCell></TableRow>
              )}
            </TableBody></Table>
          </div>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nouvelle facture</DialogTitle><DialogDescription>Créez une facture pour un client</DialogDescription></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2"><Label>Client *</Label><Select value={form.clientId} onValueChange={v => setForm(f => ({ ...f, clientId: v }))}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
            <SelectContent>{clients?.map(c => <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}{c.company ? ` (${c.company})` : ''}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Dossier</Label><Select value={form.caseId} onValueChange={v => setForm(f => ({ ...f, caseId: v }))}><SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
            <SelectContent><SelectItem value="">Aucun</SelectItem>{cases?.filter(c => c.clientId === form.clientId).map(c => <SelectItem key={c.id} value={c.id}>{c.reference} - {c.title}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Montant *</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required /></div>
            <div className="space-y-2"><Label>Devise</Label><Select value={form.currencyCode} onValueChange={v => setForm(f => ({ ...f, currencyCode: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="XAF">XAF</SelectItem><SelectItem value="XOF">XOF</SelectItem><SelectItem value="EUR">EUR</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></div>
          </div>
          <div className="space-y-2"><Label>Date d'échéance</Label><Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
          <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white" disabled={mutation.isPending}>{mutation.isPending ? <RefreshCw className="size-4 animate-spin" /> : 'Créer'}</Button></DialogFooter>
        </form>
      </DialogContent></Dialog>
    </div>
  )
}

// ==================== Messages View ====================
function MessagesView() {
  const { user } = useAppStore()
  const qc = useQueryClient()
  const [selectedContact, setSelectedContact] = useState<string | null>(null)
  const [messageText, setMessageText] = useState('')
  const [showContacts, setShowContacts] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: ['messages', user?.tenantId, user?.id],
    queryFn: () => fetch(`/api/messages?tenantId=${user!.tenantId}&userId=${user!.id}`).then(r => r.json()),
    enabled: !!user?.tenantId,
    refetchInterval: 5000
  })

  const sendMutation = useMutation({
    mutationFn: (content: string) => fetch('/api/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, senderId: user!.id, receiverId: selectedContact, tenantId: user!.tenantId })
    }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['messages'] }); setMessageText('') },
    onError: () => toast.error('Erreur d\'envoi')
  })

  const contacts = useMemo(() => {
    const map = new Map<string, { id: string; name: string; lastMessage: string; lastTime: string; unread: number }>()
    messages?.forEach(m => {
      const other = m.senderId === user?.id ? m.receiver : m.sender
      if (!other) return
      const existing = map.get(other.id)
      if (!existing || new Date(m.createdAt) > new Date(existing.lastTime)) {
        map.set(other.id, { id: other.id, name: other.name, lastMessage: m.content, lastTime: m.createdAt, unread: existing?.unread || 0 })
      }
      if (m.receiverId === user?.id && !m.isRead && m.senderId !== selectedContact) {
        const e = map.get(other.id)
        if (e) e.unread++
      }
    })
    return Array.from(map.values()).sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime())
  }, [messages, user?.id, selectedContact])

  const conversation = useMemo(() => {
    if (!selectedContact || !messages) return []
    return messages.filter(m =>
      (m.senderId === selectedContact && m.receiverId === user?.id) ||
      (m.receiverId === selectedContact && m.senderId === user?.id)
    ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }, [messages, selectedContact, user?.id])

  const selectedContactName = contacts.find(c => c.id === selectedContact)?.name

  useEffect(() => {
    if (!selectedContact || !messages) return
    const unread = messages.filter(m => m.senderId === selectedContact && m.receiverId === user?.id && !m.isRead)
    unread.forEach(m => {
      fetch(`/api/messages/${m.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isRead: true }) })
    })
    if (unread.length > 0) qc.invalidateQueries({ queryKey: ['messages'] })
  }, [selectedContact, messages, user?.id, qc])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation.length])

  const handleSend = () => {
    if (!messageText.trim() || !selectedContact) return
    sendMutation.mutate(messageText.trim())
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      {/* Contacts panel */}
      <div className={cn('w-full md:w-80 border-r border-slate-200 dark:border-slate-700 flex flex-col bg-white dark:bg-slate-900',
        !showContacts && 'hidden md:flex'
      )}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input placeholder="Contacts..." className="pl-9 h-9 bg-slate-50 dark:bg-slate-800" />
          </div>
        </div>
        <ScrollArea className="flex-1 custom-scrollbar">
          {contacts.map(c => (
            <button key={c.id} onClick={() => { setSelectedContact(c.id); setShowContacts(false) }}
              className={cn('w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-50 dark:border-slate-800',
                selectedContact === c.id && 'bg-amber-50 dark:bg-amber-500/10'
              )}>
              <Avatar className="size-10 shrink-0"><AvatarFallback className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm">{initials(c.name)}</AvatarFallback></Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{c.name}</p>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">{fmtDate(c.lastTime)}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{c.lastMessage}</p>
              </div>
              {c.unread > 0 && <span className="size-5 bg-amber-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">{c.unread}</span>}
            </button>
          ))}
          {contacts.length === 0 && <EmptyState icon={MessageSquare} title="Aucune conversation" description="Envoyez un message pour commencer" />}
        </ScrollArea>
      </div>

      {/* Chat panel */}
      <div className={cn('flex-1 flex flex-col bg-slate-50 dark:bg-slate-950', showContacts && 'hidden md:flex')}>
        {selectedContact ? (
          <>
            <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setShowContacts(true)}><ArrowLeft className="size-5" /></Button>
              <Avatar className="size-8"><AvatarFallback className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs">{initials(selectedContactName || '')}</AvatarFallback></Avatar>
              <span className="font-medium text-slate-900 dark:text-white">{selectedContactName}</span>
            </div>
            <ScrollArea className="flex-1 p-4 custom-scrollbar">
              <div className="space-y-3 max-w-2xl mx-auto">
                {isLoading ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-48 rounded-2xl" />) :
                  conversation.map(m => {
                    const isMine = m.senderId === user?.id
                    return (
                      <div key={m.id} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
                        <div className={cn('max-w-[75%] rounded-2xl px-4 py-2.5',
                          isMine ? 'bg-emerald-600 text-white rounded-br-md' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-md shadow-sm'
                        )}>
                          <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                          <p className={cn('text-[10px] mt-1', isMine ? 'text-emerald-200' : 'text-slate-400 dark:text-slate-500')}>{format(parseISO(m.createdAt), 'HH:mm')}</p>
                        </div>
                      </div>
                    )
                  })
                }
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
              <div className="flex gap-2 max-w-2xl mx-auto">
                <Input placeholder="Écrire un message..." value={messageText} onChange={e => setMessageText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }} className="flex-1" />
                <Button onClick={handleSend} className="bg-amber-600 hover:bg-amber-700 text-white" disabled={sendMutation.isPending || !messageText.trim()}>
                  {sendMutation.isPending ? <RefreshCw className="size-4 animate-spin" /> : <Send className="size-4" />}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <EmptyState icon={MessageSquare} title="Sélectionnez une conversation" description="Choisissez un contact pour commencer à discuter" />
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== Reports View ====================
function ReportsView() {
  const { user } = useAppStore()

  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: ['invoices-report', user?.tenantId], queryFn: () => fetch(`/api/invoices?tenantId=${user!.tenantId}`).then(r => r.json()), enabled: !!user?.tenantId
  })

  const stats = useMemo(() => {
    if (!invoices) return { totalRevenue: 0, paidTotal: 0, unpaidTotal: 0, paidCount: 0, unpaidCount: 0, rate: 0 }
    const paid = invoices.filter(i => i.status === 'paye')
    const unpaid = invoices.filter(i => i.status === 'non_paye' || i.status === 'partiel')
    const paidTotal = paid.reduce((s, i) => s + i.amount, 0)
    const unpaidTotal = unpaid.reduce((s, i) => s + i.amount, 0)
    return { totalRevenue: paidTotal, paidTotal, unpaidTotal, paidCount: paid.length, unpaidCount: unpaid.length, rate: invoices.length > 0 ? (paid.length / invoices.length) * 100 : 0 }
  }, [invoices])

  const monthlyData = useMemo(() => {
    if (!invoices) return []
    const map = new Map<string, number>()
    invoices.filter(i => i.status === 'paye').forEach(i => {
      const month = i.paidDate ? format(parseISO(i.paidDate), 'MMM yyyy', { locale: fr }) : format(parseISO(i.createdAt), 'MMM yyyy', { locale: fr })
      map.set(month, (map.get(month) || 0) + i.amount)
    })
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [invoices])

  const topClients = useMemo(() => {
    if (!invoices) return []
    const map = new Map<string, { name: string; total: number; count: number }>()
    invoices.forEach(i => {
      const name = i.client ? `${i.client.firstName} ${i.client.lastName}` : 'Inconnu'
      const existing = map.get(name) || { name, total: 0, count: 0 }
      existing.total += i.amount
      existing.count++
      map.set(name, existing)
    })
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 10)
  }, [invoices])

  const kpis = [
    { label: 'Total revenus', value: fmtMoney(stats.totalRevenue), icon: DollarSign, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
    { label: 'Factures payées', value: stats.paidCount.toString(), icon: FileCheck, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
    { label: 'Factures impayées', value: stats.unpaidCount.toString(), icon: FileWarning, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/30' },
    { label: 'Taux de recouvrement', value: stats.rate.toFixed(1) + '%', icon: TrendingUp, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30' },
  ]

  if (isLoading) return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon
          return (
            <Card key={i} className="hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
              <CardContent className="p-4 flex items-center gap-4">
                <div className={cn('p-3 rounded-xl', kpi.bg)}><Icon className={cn('size-6', kpi.color)} /></div>
                <div><p className="text-2xl font-bold text-slate-900 dark:text-white">{kpi.value}</p><p className="text-sm text-slate-500 dark:text-slate-400">{kpi.label}</p></div>
              </CardContent>
            </Card>
          )}
        )}
      </div>
      <Card className="hover:shadow-lg transition-shadow duration-300">
        <CardHeader><CardTitle className="text-base">Revenus par mois</CardTitle></CardHeader>
        <CardContent><div className="h-64"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-slate-500)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--color-slate-500)' }} />
            <RechartsTooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
            <Bar dataKey="value" fill="#059669" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer></div></CardContent>
      </Card>
      <Card className="hover:shadow-lg transition-shadow duration-300">
        <CardHeader><CardTitle className="text-base">Top clients par facturation</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table><TableHeader><TableRow><TableHead>Client</TableHead><TableHead>Factures</TableHead><TableHead className="text-right">Montant total</TableHead></TableRow></TableHeader>
              <TableBody>{topClients.map((c, i) => (
                <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <TableCell className="font-medium text-slate-900 dark:text-white">{c.name}</TableCell><TableCell>{c.count}</TableCell>
                  <TableCell className="text-right font-medium">{fmtMoney(c.total)}</TableCell></TableRow>
              ))}
                {topClients.length === 0 && <TableRow><TableCell colSpan={3} className="p-0"><EmptyState icon={Users} title="Aucune donnée" description="Les données de facturation apparaîtront ici" /></TableCell></TableRow>}
              </TableBody></Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ==================== Audit Logs View ====================
function AuditLogsView() {
  const { user } = useAppStore()
  const [actionFilter, setActionFilter] = useState('all')
  const [resourceFilter, setResourceFilter] = useState('all')

  const { data: logs, isLoading } = useQuery<AuditLogItem[]>({
    queryKey: ['audit-logs', user?.tenantId, actionFilter, resourceFilter],
    queryFn: () => {
      const p = new URLSearchParams({ tenantId: user!.tenantId })
      if (actionFilter !== 'all') p.set('action', actionFilter)
      if (resourceFilter !== 'all') p.set('resourceType', resourceFilter)
      return fetch(`/api/audit-logs?${p}`).then(r => r.json())
    },
    enabled: !!user?.tenantId
  })

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="space-y-2"><Label className="text-xs">Action</Label>
          <Select value={actionFilter} onValueChange={setActionFilter}><SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Action" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Toutes</SelectItem><SelectItem value="CREATE">Création</SelectItem><SelectItem value="UPDATE">Modification</SelectItem><SelectItem value="DELETE">Suppression</SelectItem><SelectItem value="LOGIN">Connexion</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label className="text-xs">Ressource</Label>
          <Select value={resourceFilter} onValueChange={setResourceFilter}><SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Ressource" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Toutes</SelectItem><SelectItem value="Case">Dossier</SelectItem><SelectItem value="Client">Client</SelectItem><SelectItem value="Invoice">Facture</SelectItem><SelectItem value="Document">Document</SelectItem><SelectItem value="User">Utilisateur</SelectItem></SelectContent></Select></div>
      </div>
      <Card className="hover:shadow-lg transition-shadow duration-300">
        {isLoading ? <div className="p-4 space-y-2">{[...Array(10)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div> : (
          <div className="overflow-x-auto">
            <Table><TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Utilisateur</TableHead><TableHead>Action</TableHead>
              <TableHead>Ressource</TableHead><TableHead className="hidden lg:table-cell">Détails</TableHead>
            </TableRow></TableHeader><TableBody>
              {logs?.slice(0, 50).map(log => (
                <TableRow key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <TableCell className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtDate(log.createdAt)}</TableCell>
                  <TableCell className="text-sm font-medium text-slate-900 dark:text-white">{log.user?.name || 'Système'}</TableCell>
                  <TableCell><Badge variant="outline" className="rounded-full text-xs">{log.action}</Badge></TableCell>
                  <TableCell className="text-sm text-slate-600 dark:text-slate-300">{log.resourceType || '—'}</TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-slate-400 dark:text-slate-500 max-w-[200px] truncate">{log.metadata ? JSON.stringify(JSON.parse(log.metadata)).slice(0, 80) : '—'}</TableCell>
                </TableRow>
              ))}
              {(!logs || logs.length === 0) && <TableRow><TableCell colSpan={5} className="p-0"><EmptyState icon={ClipboardList} title="Aucun log trouvé" description="Les actions auditées apparaîtront ici" /></TableCell></TableRow>}
            </TableBody></Table>
          </div>
        )}
      </Card>
    </div>
  )
}

// ==================== Settings View ====================
function SettingsView() {
  const { user } = useAppStore()
  const qc = useQueryClient()
  const [name, setName] = useState(user?.name || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [saving, setSaving] = useState(false)

  const { data: tenant, isLoading: tenantLoading } = useQuery<TenantItem>({
    queryKey: ['tenant', user?.tenantId],
    queryFn: () => fetch(`/api/tenants/${user!.tenantId}`).then(r => r.json()),
    enabled: !!user?.tenantId
  })

  const { data: tenants } = useQuery<TenantItem[]>({
    queryKey: ['tenants-all'],
    queryFn: () => fetch('/api/tenants').then(r => r.json()),
    enabled: user?.role === 'root_admin'
  })

  const { data: allUsers } = useQuery<UserItem[]>({
    queryKey: ['users-all'],
    queryFn: () => fetch('/api/users').then(r => r.json()),
    enabled: user?.role === 'root_admin'
  })

  const { data: currencies } = useQuery<CurrencyItem[]>({
    queryKey: ['currencies-all'],
    queryFn: () => fetch('/api/currencies').then(r => r.json()),
    enabled: user?.role === 'root_admin'
  })

  const handleSave = async () => {
    if (!user?.id) return
    setSaving(true)
    try {
      await fetch(`/api/users/${user.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone })
      })
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('Profil mis à jour')
    } catch { toast.error('Erreur') }
    setSaving(false)
  }

  const isAdmin = user?.role === 'firm_admin' || user?.role === 'root_admin'
  const isRootAdmin = user?.role === 'root_admin'

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      <Card className="hover:shadow-lg transition-shadow duration-300">
        <CardHeader><CardTitle className="text-base">Profil utilisateur</CardTitle><CardDescription>Vos informations personnelles</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Nom complet</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="space-y-2"><Label>E-mail</Label><Input value={user?.email || ''} disabled /></div>
            <div className="space-y-2"><Label>Téléphone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
            <div className="space-y-2"><Label>Rôle</Label><Input value={ROLE_LABELS[user?.role || ''] || user?.role || ''} disabled /></div>
          </div>
          <Button onClick={handleSave} className="bg-amber-600 hover:bg-amber-700 text-white" disabled={saving}>
            {saving ? <RefreshCw className="size-4 animate-spin" /> : 'Enregistrer'}
          </Button>
        </CardContent>
      </Card>

      {tenantLoading ? <Skeleton className="h-40 rounded-xl" /> : tenant && (
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader><CardTitle className="text-base">Informations du cabinet</CardTitle><CardDescription>Détails de votre organisation</CardDescription></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><p className="text-xs text-slate-500 dark:text-slate-400">Nom</p><p className="text-sm font-medium text-slate-900 dark:text-white">{tenant.name}</p></div>
              <div><p className="text-xs text-slate-500 dark:text-slate-400">Plan</p><Badge variant="outline" className="rounded-full">{tenant.plan}</Badge></div>
              <div><p className="text-xs text-slate-500 dark:text-slate-400">Utilisateurs</p><p className="text-sm font-medium text-slate-900 dark:text-white">{tenant._count?.users || 0} / {tenant.maxUsers}</p></div>
              <div><p className="text-xs text-slate-500 dark:text-slate-400">Stockage</p><p className="text-sm font-medium text-slate-900 dark:text-white">{tenant.maxStorageGb} Go</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      {isRootAdmin && (
        <Tabs defaultValue="tenants">
          <TabsList><TabsTrigger value="tenants">Cabinets</TabsTrigger><TabsTrigger value="users">Utilisateurs</TabsTrigger><TabsTrigger value="currencies">Devises</TabsTrigger></TabsList>
          <TabsContent value="tenants">
            <Card className="hover:shadow-lg transition-shadow duration-300"><CardHeader><CardTitle className="text-base">Tous les cabinets</CardTitle></CardHeader>
              <CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Nom</TableHead><TableHead>Plan</TableHead><TableHead>Utilisateurs</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
                <TableBody>{tenants?.map(t => (
                  <TableRow key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <TableCell className="font-medium text-slate-900 dark:text-white">{t.name}</TableCell><TableCell><Badge variant="outline" className="rounded-full">{t.plan}</Badge></TableCell>
                    <TableCell>{t._count?.users || 0}</TableCell><TableCell><Badge className={cn('rounded-full px-2.5', t.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300')}>{t.isActive ? 'Actif' : 'Inactif'}</Badge></TableCell></TableRow>
                ))}</TableBody></Table></div></CardContent></Card>
          </TabsContent>
          <TabsContent value="users">
            <Card className="hover:shadow-lg transition-shadow duration-300"><CardHeader><CardTitle className="text-base">Tous les utilisateurs</CardTitle></CardHeader>
              <CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Nom</TableHead><TableHead>Email</TableHead><TableHead>Rôle</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
                <TableBody>{allUsers?.map(u => (
                  <TableRow key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <TableCell className="font-medium text-slate-900 dark:text-white">{u.name}</TableCell><TableCell className="text-slate-600 dark:text-slate-300">{u.email}</TableCell>
                    <TableCell><Badge variant="outline" className="rounded-full">{ROLE_LABELS[u.role] || u.role}</Badge></TableCell>
                    <TableCell><Badge className={cn('rounded-full px-2.5', u.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300')}>{u.isActive ? 'Actif' : 'Inactif'}</Badge></TableCell></TableRow>
                ))}</TableBody></Table></div></CardContent></Card>
          </TabsContent>
          <TabsContent value="currencies">
            <Card className="hover:shadow-lg transition-shadow duration-300"><CardHeader><CardTitle className="text-base">Devises disponibles</CardTitle></CardHeader>
              <CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Nom</TableHead><TableHead>Symbole</TableHead></TableRow></TableHeader>
                <TableBody>{currencies?.map(c => (
                  <TableRow key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <TableCell className="font-mono font-medium text-slate-900 dark:text-white">{c.code}</TableCell>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{c.symbol}</TableCell></TableRow>
                ))}</TableBody></Table></div></CardContent></Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

// ==================== Archives View ====================
function ArchivesView() {
  return <CasesView archiveMode />
}

// ==================== Main Layout ====================
function AppLayout() {
  const { currentView, isAuthenticated } = useAppStore()

  if (!isAuthenticated) return <LoginPage />

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <DashboardView />
      case 'clients': return <ClientsView />
      case 'cases': return <CasesView />
      case 'documents': return <DocumentsView />
      case 'calendar': return <CalendarView />
      case 'invoices': return <InvoicesView />
      case 'messages': return <MessagesView />
      case 'reports': return <ReportsView />
      case 'audit-logs': return <AuditLogsView />
      case 'settings': return <SettingsView />
      case 'archives': return <ArchivesView />
      default: return <DashboardView />
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <Sidebar />
      <div className="flex-1 flex flex-col lg:ml-[260px] transition-all duration-300">
        <Header />
        <main className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div key={currentView} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </main>
        <footer className="mt-auto py-4 px-6">
          <Separator className="mb-4" />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-slate-400 dark:text-slate-500">© 2025 JurisLink — Gestion Juridique Intelligente</p>
            <p className="text-xs text-slate-400 dark:text-slate-600">v2.0 • Tous droits réservés</p>
          </div>
        </footer>
      </div>
    </div>
  )
}

// ==================== Page Component ====================
export default function Home() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppLayout />
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  )
}
