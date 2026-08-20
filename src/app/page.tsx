'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, addMonths, subMonths, isToday, startOfWeek, endOfWeek, isSameMonth, differenceInDays, isBefore, addDays } from 'date-fns'
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
import { Progress } from '@/components/ui/progress'
import { Toaster } from '@/components/ui/sonner'

// ==================== lucide icons ====================
import {
  LayoutDashboard, Briefcase, Users, FileText, Calendar, Receipt, MessageSquare, BarChart3,
  Shield, Settings, Menu, X, Search, Bell, LogOut, User, ChevronDown, ChevronRight,
  ChevronLeft, Plus, Edit, Trash2, Eye, Lock, Clock, Send, ArrowLeft, Download,
  Filter, MoreHorizontal, Archive, AlertTriangle, CheckCircle2, Circle, Phone, Mail,
  Building2, RefreshCw, TrendingUp, DollarSign, FileCheck, FileWarning, Activity,
  Sun, Moon, Inbox, FolderOpen, Scale, ClipboardList, Zap, AlertOctagon,
  ChevronUp, ExternalLink, Timer, Target, Flag, Folder, Tag, MapPin, Banknote, Gavel,
  UserCheck, Check, CircleDot, ArrowUpRight, ArrowDownRight, Minus, AlertCircle
} from 'lucide-react'

// ==================== Types ====================
interface Client {
  id: string; firstName: string; lastName: string; company?: string | null;
  clientType?: string; niu?: string | null; email?: string | null;
  phone?: string | null; address?: string | null; city?: string | null; country?: string | null;
  notes?: string | null; riskLevel?: string; source?: string | null;
  isActive: boolean; tenantId: string; createdAt: string; _count?: { cases: number; invoices: number };
}
interface CaseItem {
  id: string; reference: string; title: string; description?: string | null; type: string;
  status: string; priority: string; isSecret: boolean; nextDueDate?: string | null;
  closingDate?: string | null; createdAt: string; tenantId: string; clientId: string;
  adversary?: string | null; jurisdiction?: string | null; amountInDispute?: number | null;
  billingType?: string | null;
  client?: Client; assignments?: CaseAssignment[]; notes?: CaseNote[]; documents?: Doc[]; events?: EventItem[];
}
interface CaseAssignment { id: string; userId: string; caseId: string; user?: UserItem }
interface CaseNote { id: string; content: string; createdAt: string; userId?: string | null; user?: UserItem }
interface Doc {
  id: string; name: string; fileName: string; fileType: string; fileSize: number; filePath: string;
  version: number; isFinal?: boolean; folder?: string | null; tags?: string | null;
  description?: string | null; createdAt: string; tenantId: string; caseId?: string | null;
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
  paymentMethod?: string | null;
}
interface Message {
  id: string; content: string; isRead: boolean; createdAt: string; tenantId: string;
  senderId: string; receiverId: string; sender?: UserItem; receiver?: UserItem;
}
interface Notification {
  id: string; title: string; message: string; category: string; priority?: string; isRead: boolean;
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
interface TaskItem {
  id: string; title: string; description?: string | null; status: string; priority: string;
  dueDate?: string | null; completedAt?: string | null; createdAt: string;
  tenantId: string; caseId?: string | null; userId?: string | null; creatorId?: string | null; eventId?: string | null;
  user?: UserItem; creator?: UserItem; case?: { id: string; reference: string; title: string } | null;
  event?: { id: string; title: string } | null;
}
interface DashboardStats {
  totalCases: number; activeCases: number; totalClients: number; upcomingEvents: number;
  unpaidInvoices: number; totalRevenue: number; paidInvoices: number;
  casesByStatus: Record<string, number>; casesByType: Record<string, number>;
  recentActivity: AuditLogItem[]; upcomingEventsList: EventItem[];
  urgencies: Array<{ id: string; reference: string; title: string; clientName: string; nextDueDate: string; daysRemaining: number }>;
  overdueInvoices: Array<{ id: string; reference: string; clientName: string; amount: number; currencyCode: string; daysOverdue: number }>;
  urgentTasks: Array<{ id: string; title: string; priority: string; status: string; dueDate: string | null; caseReference: string | null; assigneeName: string | null }>;
  upcomingEventsEnhanced: Array<{ id: string; title: string; startTime: string; eventType: string; criticality: string; location?: string | null; caseReference: string | null; assignments: Array<{ userId: string; userName: string }> }>;
  myTasks: Array<{ id: string; title: string; priority: string; status: string; dueDate: string | null; caseReference: string | null }>;
}
interface ConflictResult {
  type: string; case: { id: string; reference: string; title: string; clientName: string }; description: string;
}
interface CurrencyItem { id: string; code: string; name: string; symbol: string }

// ==================== Query Client ====================
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30000, retry: 1 } } })

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
  a_faire: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  en_cours_t: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  terminee: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  annulee: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}
const STATUS_LABELS: Record<string, string> = {
  nouveau: 'Nouveau', ouvert: 'Ouvert', en_cours: 'En cours', en_attente: 'En attente',
  clos: 'Clos', archive: 'Archivé', non_paye: 'Non payé', partiel: 'Partiel',
  paye: 'Payé', annule: 'Annulé',
  a_faire: 'À faire', en_cours_t: 'En cours', terminee: 'Terminée', annulee: 'Annulée',
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
const ROLE_LABELS: Record<string, string> = {
  root_admin: 'Admin Racine', associate: 'Associé', firm_admin: 'Admin Cabinet',
  lawyer: 'Avocat', jurist: 'Juriste', assistant: 'Assistant', accountant: 'Comptable', client: 'Client',
}
const RISK_COLORS: Record<string, string> = {
  faible: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  moyen: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  eleve: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
}
const BILLING_LABELS: Record<string, string> = { forfait: 'Forfait', horaire: 'Horaire', abonnement: 'Abonnement', success_fee: 'Success fee', provision: 'Provision' }
const CHART_COLORS = ['#475569', '#d97706', '#059669', '#e11d48', '#94a3b8', '#f59e0b']
const CHART_COLORS_DARK = ['#94a3b8', '#f59e0b', '#34d399', '#fb7185', '#64748b', '#fbbf24']

const NAV_ITEMS: { view: ViewName; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
  { view: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { view: 'cases', label: 'Dossiers', icon: Briefcase },
  { view: 'clients', label: 'Clients', icon: Users },
  { view: 'tasks', label: 'Tâches', icon: ClipboardList },
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
function fmtDateTime(d: string | null | undefined) {
  if (!d) return '—'
  try { return format(parseISO(d), 'dd/MM/yyyy HH:mm', { locale: fr }) } catch { return '—' }
}
function fmtMoney(amount: number, code: string = 'XAF') {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: code, minimumFractionDigits: 0 }).format(amount)
}
function fmtFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' o'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' Ko'
  return (bytes / 1048576).toFixed(1) + ' Mo'
}
function initials(name: string) { return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) }
function taskStatusColor(s: string) { return STATUS_COLORS[s === 'en_cours' ? 'en_cours_t' : s] || STATUS_COLORS[s] || '' }
function taskStatusLabel(s: string) { return STATUS_LABELS[s === 'en_cours' ? 'en_cours_t' : s] || s }

// ==================== Theme Toggle ====================
function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <TooltipProvider><Tooltip><TooltipTrigger asChild>
      <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
        <Sun className="size-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute size-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Basculer le thème</span>
      </Button>
    </TooltipTrigger><TooltipContent>{theme === 'dark' ? 'Mode clair' : 'Mode sombre'}</TooltipContent></Tooltip></TooltipProvider>
  )
}

// ==================== Empty State ====================
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
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erreur de connexion'); return }
      login(data); toast.success(`Bienvenue, ${data.name} !`)
    } catch { toast.error('Erreur de connexion au serveur') } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center login-pattern p-4 relative overflow-hidden">
      <motion.div animate={{ y: [0, -12, 0], rotate: [0, 5, -5, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} className="absolute top-[12%] left-[8%] md:top-[10%] md:left-[12%] opacity-[0.08] dark:opacity-[0.05] pointer-events-none"><Scale className="size-16 md:size-20 text-slate-900 dark:text-white" /></motion.div>
      <motion.div animate={{ y: [0, -10, 0], rotate: [0, -8, 4, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }} className="absolute top-[18%] right-[10%] md:top-[15%] md:right-[14%] opacity-[0.07] dark:opacity-[0.04] pointer-events-none"><FileText className="size-14 md:size-18 text-slate-900 dark:text-white" /></motion.div>
      <motion.div animate={{ y: [0, -14, 0], rotate: [0, 3, -6, 0] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 2 }} className="absolute bottom-[15%] left-[10%] md:bottom-[18%] md:left-[15%] opacity-[0.06] dark:opacity-[0.04] pointer-events-none"><Building2 className="size-16 md:size-20 text-slate-900 dark:text-white" /></motion.div>
      <motion.div animate={{ y: [0, -8, 0], rotate: [0, -4, 6, 0] }} transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }} className="absolute bottom-[20%] right-[8%] md:bottom-[22%] md:right-[11%] opacity-[0.07] dark:opacity-[0.04] pointer-events-none"><Shield className="size-14 md:size-18 text-slate-900 dark:text-white" /></motion.div>
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md relative z-10">
        <Card className="shadow-2xl border-slate-200/80 dark:border-slate-700/50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm">
          <CardHeader className="text-center pb-2 pt-8">
            <div className="mx-auto mb-4 flex items-center justify-center gap-2">
              <div className="size-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20"><Scale className="size-6 text-white" /></div>
            </div>
            <div className="mb-1"><span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Juris</span><span className="text-2xl font-bold tracking-tight text-amber-600">Link</span></div>
            <CardDescription className="text-sm mt-1">Le système d'exploitation de votre cabinet</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="email">Adresse e-mail</Label><Input id="email" type="email" placeholder="email@jurislink.com" value={email} onChange={e => setEmail(e.target.value)} className="h-11" /></div>
              <div className="space-y-2"><Label htmlFor="password">Mot de passe</Label><Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="h-11" /></div>
              <Button type="submit" className="w-full h-11 bg-slate-900 hover:bg-slate-800 dark:bg-amber-600 dark:hover:bg-amber-700 text-white" disabled={loading}>{loading ? <RefreshCw className="size-4 animate-spin" /> : 'Se connecter'}</Button>
            </form>
          </CardContent>
          <CardFooter className="flex-col gap-2 pb-8"><Separator className="mb-2" /><p className="text-xs text-slate-400 dark:text-slate-500">Compte démo</p><p className="text-xs text-slate-500 dark:text-slate-400 font-mono bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-md">ngassa@jurislink.com / Admin@123</p></CardFooter>
        </Card>
        <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-6">© 2025 JurisLink — Tous droits réservés</p>
      </motion.div>
    </div>
  )
}

// ==================== Sidebar ====================
function Sidebar() {
  const { currentView, setCurrentView, user, sidebarOpen, setSidebarOpen } = useAppStore()
  const isAdmin = user?.role === 'firm_admin' || user?.role === 'root_admin' || user?.role === 'associate'
  const navContent = (
    <nav className="space-y-1 px-3">
      {NAV_ITEMS.filter(item => !item.adminOnly || isAdmin).map(item => {
        const Icon = item.icon; const active = currentView === item.view
        return (
          <button key={item.view} onClick={() => { setCurrentView(item.view); setSidebarOpen(false) }}
            className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border-l-2',
              active ? 'bg-amber-500/10 text-amber-400 dark:bg-amber-500/15 dark:text-amber-400 border-amber-500' : 'border-transparent text-slate-300 hover:bg-slate-800 hover:text-white dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200')}>
            {active && <span className="size-1.5 rounded-full bg-amber-500 shrink-0" />}
            <Icon className="size-5 shrink-0" /><span className="whitespace-nowrap">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
  return (<>
    <aside className="hidden lg:flex fixed top-0 left-0 z-40 h-full bg-slate-900 dark:bg-slate-950 text-white flex-col w-[260px]">
      <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-700/50 shrink-0">
        <div className="size-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shrink-0"><Scale className="size-4 text-white" /></div>
        <span className="text-lg font-bold tracking-tight whitespace-nowrap"><span className="text-white">Juris</span><span className="text-amber-500">Link</span></span>
      </div>
      <ScrollArea className="flex-1 py-4 custom-scrollbar">{navContent}</ScrollArea>
      <div className="p-4 border-t border-slate-700/50"><div className="flex items-center gap-3"><Avatar className="size-8 shrink-0"><AvatarFallback className="bg-amber-600 text-white text-xs">{user?.name ? initials(user.name) : 'U'}</AvatarFallback></Avatar><div className="min-w-0"><p className="text-sm font-medium truncate text-white">{user?.name}</p><p className="text-xs text-slate-400 truncate">{ROLE_LABELS[user?.role || ''] || user?.role}</p></div></div></div>
    </aside>
    <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}><SheetContent side="left" className="w-[280px] p-0 bg-slate-900 dark:bg-slate-950 text-white border-slate-700/50">
      <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-700/50 shrink-0"><div className="size-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shrink-0"><Scale className="size-4 text-white" /></div><span className="text-lg font-bold tracking-tight whitespace-nowrap"><span className="text-white">Juris</span><span className="text-amber-500">Link</span></span><Button variant="ghost" size="icon" className="ml-auto text-slate-400 hover:text-white" onClick={() => setSidebarOpen(false)}><X className="size-5" /></Button></div>
      <ScrollArea className="flex-1 py-4 custom-scrollbar">{navContent}</ScrollArea>
    </SheetContent></Sheet>
  </>)
}

// ==================== Header ====================
function Header() {
  const { currentView, user, logout, setCurrentView } = useAppStore()
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<{type: string; label: string; sub: string; view: ViewName; id: string}[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const viewLabel = NAV_ITEMS.find(n => n.view === currentView)?.label || 'JurisLink'

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim() || !user?.tenantId) return
    try {
      const base = `tenantId=${user.tenantId}&search=${encodeURIComponent(q.trim())}`
      const [casesRes, clientsRes, invoicesRes, tasksRes] = await Promise.all([
        fetch(`/api/cases?${base}`).then(r => r.json()).catch(() => []),
        fetch(`/api/clients?${base}`).then(r => r.json()).catch(() => []),
        fetch(`/api/invoices?${base}`).then(r => r.json()).catch(() => []),
        fetch(`/api/tasks?${base}`).then(r => r.json()).catch(() => ({ tasks: [] })),
      ])
      const results: {type: string; label: string; sub: string; view: ViewName; id: string}[] = []
      for (const c of (casesRes.cases || casesRes || [])) results.push({ type: 'Dossier', label: c.reference, sub: c.title, view: 'cases', id: c.id })
      for (const c of (clientsRes.clients || clientsRes || [])) results.push({ type: 'Client', label: `${c.firstName} ${c.lastName}`, sub: c.company || c.email || '', view: 'clients', id: c.id })
      for (const i of (invoicesRes.invoices || invoicesRes || [])) results.push({ type: 'Facture', label: i.reference, sub: fmtMoney(i.amount, i.currencyCode), view: 'invoices', id: i.id })
      for (const t of (tasksRes.tasks || [])) results.push({ type: 'Tâche', label: t.title, sub: PRIORITY_LABELS[t.priority] || '', view: 'tasks', id: t.id })
      setSearchResults(results.slice(0, 10))
    } catch { /* ignore */ }
  }, [user])

  const handleSearchChange = (val: string) => { setSearch(val); setSearchOpen(true); if (searchTimerRef.current) clearTimeout(searchTimerRef.current); searchTimerRef.current = setTimeout(() => doSearch(val), 300) }

  const { data: notifs } = useQuery({ queryKey: ['notifications', user?.tenantId], queryFn: () => fetch(`/api/notifications?tenantId=${user!.tenantId}`).then(r => r.json()), enabled: !!user?.tenantId, refetchInterval: 30000 })
  const { data: msgCount } = useQuery({ queryKey: ['msg-count', user?.id], queryFn: () => fetch(`/api/messages?tenantId=${user!.tenantId}`).then(r => r.json()).then(d => (d.messages || []).filter((m: Message) => m.receiverId === user!.id && !m.isRead).length), enabled: !!user?.tenantId, refetchInterval: 10000 })
  const unreadCount = (notifs?.notifications || []).filter((n: Notification) => !n.isRead).length

  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700/50">
      <div className="flex items-center gap-4 h-16 px-4 lg:px-6">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => useAppStore.getState().toggleSidebar()}><Menu className="size-5" /></Button>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white hidden sm:block">{viewLabel}</h1>
        <div className="relative flex-1 max-w-md ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input placeholder="Rechercher dossiers, clients, factures, tâches..." className="pl-9 h-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700" value={search} onChange={e => handleSearchChange(e.target.value)} onFocus={() => search && setSearchOpen(true)} />
          {searchOpen && searchResults.length > 0 && (
            <div className="absolute top-full mt-1 w-full bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg z-50 max-h-80 overflow-y-auto">
              {searchResults.map((r, i) => (
                <button key={i} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left" onMouseDown={e => { e.preventDefault(); setSearchOpen(false); setCurrentView(r.view); setSearch('') }}>
                  <div className="size-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">{r.type === 'Dossier' ? <Briefcase className="size-4 text-amber-600" /> : r.type === 'Client' ? <Users className="size-4 text-emerald-600" /> : r.type === 'Facture' ? <Receipt className="size-4 text-rose-600" /> : <ClipboardList className="size-4 text-blue-600" />}</div>
                  <div className="min-w-0"><p className="text-sm font-medium truncate">{r.label}</p><p className="text-xs text-slate-400 truncate">{r.type} — {r.sub}</p></div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="relative" onClick={() => { setCurrentView('messages') }}><MessageSquare className="size-5" />{msgCount ? <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center font-bold">{msgCount > 9 ? '9+' : msgCount}</span> : null}</Button></TooltipTrigger><TooltipContent>Messages</TooltipContent></Tooltip></TooltipProvider>
          <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="relative"><Bell className="size-5" />{unreadCount ? <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-bold">{unreadCount > 9 ? '9+' : unreadCount}</span> : null}</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto"><DropdownMenuLabel>Notifications ({unreadCount})</DropdownMenuLabel><DropdownMenuSeparator />{(notifs?.notifications || []).slice(0, 8).map((n: Notification) => (<DropdownMenuItem key={n.id} className="flex flex-col items-start gap-1 p-3 cursor-pointer" onClick={() => { const vmap: Record<string, ViewName> = { dossier: 'cases', echeance: 'calendar', facture: 'invoices', document: 'documents', tache: 'tasks', message: 'messages' }; setCurrentView(vmap[n.category] || 'dashboard'); setNotifOpen(false) }}><p className={cn('text-sm font-medium', !n.isRead && 'text-slate-900 dark:text-white')}>{n.title}</p><p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{n.message}</p></DropdownMenuItem>))}</DropdownMenuContent></DropdownMenu>
          <ThemeToggle />
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><LogOut className="size-5 text-slate-500" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={logout} className="text-rose-600 cursor-pointer"><LogOut className="size-4 mr-2" />Déconnexion</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        </div>
      </div>
    </header>
  )
}

// ==================== Dashboard ====================
function DashboardView() {
  const { user, setCurrentView } = useAppStore()
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard', user?.tenantId],
    queryFn: () => fetch(`/api/dashboard?tenantId=${user!.tenantId}&userId=${user!.id}`).then(r => r.json()),
    enabled: !!user?.tenantId, refetchInterval: 60000
  })
  const { theme } = useTheme()
  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Bonjour' : now.getHours() < 18 ? 'Bon après-midi' : 'Bonsoir'
  const hour = new Date().getHours()
  const minute = new Date().getMinutes()

  if (isLoading) return <div className="p-6"><Skeleton className="h-8 w-48 mb-6" /><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div></div>
  if (!stats) return null

  const urgencyCount = (stats.urgencies?.length || 0) + (stats.overdueInvoices?.length || 0)
  const myTaskCount = stats.myTasks?.length || 0
  const totalPending = (stats.overdueInvoices || []).reduce((s, i) => s + i.amount, 0)

  const statusChartData = Object.entries(stats.casesByStatus).map(([name, value]) => ({ name: STATUS_LABELS[name] || name, value })).filter(d => d.value > 0)
  const typeChartData = Object.entries(stats.casesByType).map(([name, value]) => ({ name: TYPE_LABELS[name] || name, value })).filter(d => d.value > 0)
  const colors = (theme === 'dark' ? CHART_COLORS_DARK : CHART_COLORS)

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Welcome + Aujourd'hui section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div><h2 className="text-xl font-bold text-slate-900 dark:text-white">{greeting}, {user?.name?.split(' ').slice(-1)}</h2><p className="text-sm text-slate-500 dark:text-slate-400">{format(now, 'EEEE d MMMM yyyy', { locale: fr })} — {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')}</p></div>
              <div className="flex gap-2"><Button size="sm" onClick={() => setCurrentView('cases')} className="hidden sm:flex"><Plus className="size-4 mr-1" />Nouveau dossier</Button><Button size="sm" variant="outline" onClick={() => setCurrentView('invoices')} className="hidden sm:flex"><Receipt className="size-4 mr-1" />Nouvelle facture</Button></div>
            </div>
            <Separator className="mb-4" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className={cn('rounded-xl p-4 border-l-4', urgencyCount > 0 ? 'border-l-rose-500 bg-rose-50 dark:bg-rose-950/30' : 'border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/30')}>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Aujourd'hui</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{urgencyCount > 0 ? <><span className="text-rose-600">{urgencyCount}</span> <span className="text-sm font-normal">urgence{urgencyCount > 1 ? 's' : ''}</span></> : <><CheckCircle2 className="size-6 text-emerald-500 inline" /> <span className="text-sm font-normal text-emerald-600">Tout va bien</span></>}</p>
              </div>
              <div className="rounded-xl p-4 border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/30">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Actions à faire</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{myTaskCount} <span className="text-sm font-normal text-slate-500">tâche{myTaskCount > 1 ? 's' : ''}</span></p>
              </div>
              <div className="rounded-xl p-4 border-l-4 border-l-slate-500 bg-slate-50 dark:bg-slate-800/50">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Dossiers actifs</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.activeCases}</p>
              </div>
              <div className="rounded-xl p-4 border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-950/30">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Honoraires en attente</p>
                <p className="text-2xl font-bold text-orange-600">{fmtMoney(totalPending, 'XAF')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* My Tasks quick panel */}
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><ClipboardList className="size-4 text-amber-500" />Mes tâches en cours</CardTitle></CardHeader><CardContent className="p-4 pt-0"><div className="space-y-2 max-h-48 overflow-y-auto">{(stats.myTasks || []).length === 0 ? <p className="text-xs text-slate-400 py-4 text-center">Aucune tâche en cours</p> : (stats.myTasks || []).map(t => (<div key={t.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => setCurrentView('tasks')}><span className={cn('size-2 rounded-full shrink-0', t.priority === 'urgente' ? 'bg-rose-500' : t.priority === 'haute' ? 'bg-orange-500' : 'bg-amber-400')} /><div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{t.title}</p><p className="text-xs text-slate-400">{t.caseReference ? `${t.caseReference} — ` : ''}{t.dueDate ? `Échéance: ${fmtDate(t.dueDate)}` : ''}</p></div></div>))}</div></CardContent></Card>
      </div>

      {/* Urgencies + Upcoming Events */}
      {(urgencyCount > 0 || (stats.urgentTasks?.length || 0) > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Urgencies */}
          <Card className="border-l-4 border-l-rose-500"><CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2 text-rose-700 dark:text-rose-400"><AlertOctagon className="size-4" />Urgences</CardTitle></CardHeader><CardContent className="p-4 pt-0"><div className="space-y-3 max-h-64 overflow-y-auto">
            {stats.urgencies?.map(u => (<div key={u.id} className="flex items-start gap-3 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/20 cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-950/40" onClick={() => setCurrentView('cases')}><div className="mt-0.5"><Gavel className="size-4 text-rose-500" /></div><div className="min-w-0"><p className="text-sm font-medium">{u.reference} — {u.title}</p><p className="text-xs text-slate-500">{u.clientName} • <span className="font-semibold text-rose-600">{u.daysRemaining <= 0 ? 'Aujourd\'hui !' : `Dans ${u.daysRemaining} jour${u.daysRemaining > 1 ? 's' : ''}`}</span></p></div></div>))}
            {stats.overdueInvoices?.map(inv => (<div key={inv.id} className="flex items-start gap-3 p-2 rounded-lg bg-orange-50 dark:bg-orange-950/20 cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-950/40" onClick={() => setCurrentView('invoices')}><div className="mt-0.5"><AlertTriangle className="size-4 text-orange-500" /></div><div className="min-w-0"><p className="text-sm font-medium">{inv.reference} — {inv.clientName}</p><p className="text-xs text-slate-500">{fmtMoney(inv.amount, inv.currencyCode)} • <span className="font-semibold text-orange-600">{inv.daysOverdue}j de retard</span></p></div></div>))}
            {stats.urgentTasks?.slice(0, 3).map(t => (<div key={t.id} className="flex items-start gap-3 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-950/40" onClick={() => setCurrentView('tasks')}><div className="mt-0.5"><Timer className="size-4 text-amber-500" /></div><div className="min-w-0"><p className="text-sm font-medium">{t.title}</p><p className="text-xs text-slate-500">{t.assigneeName ? `→ ${t.assigneeName}` : ''} {t.caseReference ? `• ${t.caseReference}` : ''}</p></div></div>))}
          </div></CardContent></Card>
          {/* Upcoming Events */}
          <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Calendar className="size-4 text-amber-500" />Prochains événements (7j)</CardTitle></CardHeader><CardContent className="p-4 pt-0"><div className="space-y-2 max-h-64 overflow-y-auto">{(stats.upcomingEventsEnhanced || []).length === 0 ? <p className="text-xs text-slate-400 py-4 text-center">Aucun événement à venir</p> : (stats.upcomingEventsEnhanced || []).map(e => (<div key={e.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => setCurrentView('calendar')}><span className={cn('w-1 h-8 rounded-full shrink-0', CRIT_COLORS[e.criticality] || CRIT_COLORS.normal)} /><div className="min-w-0 flex-1"><p className="text-sm font-medium">{e.title}</p><p className="text-xs text-slate-500">{fmtDateTime(e.startTime)}{e.location ? ` • ${e.location}` : ''}{e.caseReference ? ` • ${e.caseReference}` : ''}</p><p className="text-xs text-slate-400 mt-0.5">{e.assignments.map(a => a.userName).join(', ')}</p></div><Badge variant="outline" className="text-[10px] shrink-0">{EVENT_TYPE_LABELS[e.eventType] || e.eventType}</Badge></div>))}</div></CardContent></Card>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Dossiers par statut</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={220}><BarChart data={statusChartData}><CartesianGrid strokeDasharray="3 3" className="opacity-30" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><RechartsTooltip /><Bar dataKey="value" fill={colors[0]} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Dossiers par type</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={typeChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} paddingAngle={2}>{typeChartData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}</Pie><Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer></CardContent></Card>
      </div>
    </div>
  )
}

// ==================== TASKS VIEW ====================
function TasksView() {
  const { user } = useAppStore()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<TaskItem | null>(null)
  const [form, setForm] = useState({ title: '', description: '', priority: 'normal', dueDate: '', userId: '', caseId: '' })

  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['tasks', user?.tenantId, statusFilter, priorityFilter],
    queryFn: () => {
      const p = new URLSearchParams()
      if (user?.tenantId) p.set('tenantId', user.tenantId)
      if (statusFilter !== 'all') p.set('status', statusFilter)
      if (priorityFilter !== 'all') p.set('priority', priorityFilter)
      return fetch(`/api/tasks?${p}`).then(r => r.json()).then(d => d.tasks || d)
    },
  })

  const { data: users } = useQuery({
    queryKey: ['users', user?.tenantId],
    queryFn: () => fetch(`/api/users?tenantId=${user?.tenantId}`).then(r => r.json()),
  })

  const { data: cases } = useQuery({
    queryKey: ['cases-mini', user?.tenantId],
    queryFn: () => fetch(`/api/cases?tenantId=${user?.tenantId}`).then(r => r.json()),
  })

  const createMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, tenantId: user?.tenantId, creatorId: user?.id }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); toast.success('Tâche créée'); setDialogOpen(false); resetForm() },
    onError: () => toast.error('Erreur lors de la création'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...body }: Record<string, unknown>) => fetch(`/api/tasks/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); toast.success('Tâche mise à jour') },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => fetch(`/api/tasks/${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); toast.success('Tâche supprimée') },
    onError: () => toast.error('Erreur lors de la suppression'),
  })

  const resetForm = () => { setForm({ title: '', description: '', priority: 'normal', dueDate: '', userId: '', caseId: '' }); setEditing(null) }
  const openEdit = (t: TaskItem) => { setEditing(t); setForm({ title: t.title, description: t.description || '', priority: t.priority, dueDate: t.dueDate?.slice(0, 10) || '', userId: t.userId || '', caseId: t.caseId || '' }); setDialogOpen(true) }
  const handleSubmit = () => {
    if (!form.title.trim()) return
    if (editing) { updateMut.mutate({ id: editing.id, title: form.title, description: form.description || null, priority: form.priority, dueDate: form.dueDate || null, userId: form.userId || null, caseId: form.caseId || null }) }
    else { createMut.mutate({ title: form.title, description: form.description || null, priority: form.priority, dueDate: form.dueDate || null, userId: form.userId || null, caseId: form.caseId || null }) }
  }

  const toggleStatus = (t: TaskItem) => {
    const newStatus = t.status === 'terminee' ? 'a_faire' : 'terminee'
    updateMut.mutate({ id: t.id, status: newStatus })
  }

  const tasks: TaskItem[] = tasksData || []

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-semibold">Tâches</h2>
        <Button onClick={() => { resetForm(); setDialogOpen(true) }} size="sm"><Plus className="size-4 mr-1" />Nouvelle tâche</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="a_faire">À faire</SelectItem>
            <SelectItem value="en_cours">En cours</SelectItem>
            <SelectItem value="terminee">Terminée</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[150px] h-9 text-xs"><SelectValue placeholder="Priorité" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les priorités</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="haute">Haute</SelectItem>
            <SelectItem value="urgente">Urgente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <div className="flex justify-center py-12"><Skeleton className="h-6 w-48" /></div> :
        tasks.length === 0 ? <EmptyState icon={ClipboardList} title="Aucune tâche" description="Créez votre première tâche" /> :
        <Card><CardContent className="p-0"><div className="max-h-[500px] overflow-y-auto">
          <Table><TableHeader><TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>Titre</TableHead>
            <TableHead className="hidden md:table-cell">Priorité</TableHead>
            <TableHead className="hidden sm:table-cell">Statut</TableHead>
            <TableHead className="hidden lg:table-cell">Assigné</TableHead>
            <TableHead className="hidden lg:table-cell">Dossier</TableHead>
            <TableHead className="hidden md:table-cell">Échéance</TableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow></TableHeader><TableBody>
            {tasks.map(t => (
              <TableRow key={t.id} className={cn(t.status === 'terminee' && 'opacity-60')}>
                <TableCell><Checkbox checked={t.status === 'terminee'} onCheckedChange={() => toggleStatus(t)} /></TableCell>
                <TableCell className="font-medium"><span className={cn(t.status === 'terminee' && 'line-through')}>{t.title}</span></TableCell>
                <TableCell className="hidden md:table-cell"><Badge variant="outline" className={cn('text-[10px]', PRIORITY_COLORS[t.priority])}>{PRIORITY_LABELS[t.priority] || t.priority}</Badge></TableCell>
                <TableCell className="hidden sm:table-cell"><Badge variant="outline" className={cn('text-[10px]', taskStatusColor(t.status))}>{taskStatusLabel(t.status)}</Badge></TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-slate-500 dark:text-slate-400">{t.user?.name || '—'}</TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-slate-500 dark:text-slate-400">{t.case?.reference || '—'}</TableCell>
                <TableCell className="hidden md:table-cell text-sm text-slate-500 dark:text-slate-400">{fmtDate(t.dueDate)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(t)}><Edit className="size-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="size-7 text-rose-500 hover:text-rose-700" onClick={() => deleteMut.mutate(t.id)}><Trash2 className="size-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody></Table>
        </div></CardContent></Card>}

      <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) resetForm() }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Modifier la tâche' : 'Nouvelle tâche'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Titre *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Titre de la tâche" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Priorité</Label><Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="basse">Basse</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="haute">Haute</SelectItem><SelectItem value="urgente">Urgente</SelectItem></SelectContent></Select></div>
              <div><Label>Échéance</Label><Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Assigné à</Label><Select value={form.userId} onValueChange={v => setForm(f => ({ ...f, userId: v }))}><SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger><SelectContent>{(users || []).map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Dossier</Label><Select value={form.caseId} onValueChange={v => setForm(f => ({ ...f, caseId: v }))}><SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger><SelectContent>{(cases || []).map(c => <SelectItem key={c.id} value={c.id}>{c.reference} — {c.title}</SelectItem>)}</SelectContent></Select></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button><Button onClick={handleSubmit} disabled={!form.title.trim() || createMut.isPending || updateMut.isPending}>{editing ? 'Enregistrer' : 'Créer'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ==================== CASES VIEW ====================
function CasesView() {
  const { user } = useAppStore()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editing, setEditing] = useState<CaseItem | null>(null)
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null)
  const [conflicts, setConflicts] = useState<ConflictResult[]>([])
  const [form, setForm] = useState({ title: '', description: '', type: 'civil', status: 'nouveau', priority: 'normal', clientId: '', reference: '', nextDueDate: '', adversary: '', jurisdiction: '', amountInDispute: '', billingType: '' })

  const { data: cases, isLoading } = useQuery({
    queryKey: ['cases', user?.tenantId, statusFilter, typeFilter, priorityFilter, search],
    queryFn: () => {
      const p = new URLSearchParams()
      if (user?.tenantId) p.set('tenantId', user.tenantId)
      if (statusFilter !== 'all') p.set('status', statusFilter)
      if (typeFilter !== 'all') p.set('type', typeFilter)
      if (priorityFilter !== 'all') p.set('priority', priorityFilter)
      if (search) p.set('search', search)
      return fetch(`/api/cases?${p}`).then(r => r.json())
    },
  })

  const { data: clients } = useQuery({
    queryKey: ['clients-mini', user?.tenantId],
    queryFn: () => fetch(`/api/clients?tenantId=${user?.tenantId}`).then(r => r.json()),
  })

  const { data: caseDetail } = useQuery({
    queryKey: ['case-detail', selectedCase?.id],
    queryFn: () => fetch(`/api/cases/${selectedCase!.id}`).then(r => r.json()),
    enabled: !!selectedCase?.id && detailOpen,
  })

  const createMut = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      if (body.adversary && body.clientId) {
        try {
          const conflictRes = await fetch('/api/conflicts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: user?.tenantId, clientId: body.clientId, adversary: body.adversary }) }).then(r => r.json())
          if (conflictRes.conflicts?.length > 0) setConflicts(conflictRes.conflicts)
        } catch { /* ignore */ }
      }
      return fetch('/api/cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cases'] }); toast.success('Dossier créé'); setDialogOpen(false); resetForm() },
    onError: () => toast.error('Erreur lors de la création'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...body }: Record<string, unknown>) => fetch(`/api/cases/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cases'] }); qc.invalidateQueries({ queryKey: ['case-detail'] }); toast.success('Dossier mis à jour') },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  })

  const resetForm = () => { setForm({ title: '', description: '', type: 'civil', status: 'nouveau', priority: 'normal', clientId: '', reference: '', nextDueDate: '', adversary: '', jurisdiction: '', amountInDispute: '', billingType: '' }); setEditing(null); setConflicts([]) }
  const openEdit = (c: CaseItem) => {
    setEditing(c)
    setForm({ title: c.title, description: c.description || '', type: c.type, status: c.status, priority: c.priority, clientId: c.clientId, reference: c.reference, nextDueDate: c.nextDueDate?.slice(0, 10) || '', adversary: c.adversary || '', jurisdiction: c.jurisdiction || '', amountInDispute: c.amountInDispute?.toString() || '', billingType: c.billingType || '' })
    setDialogOpen(true)
  }
  const handleSubmit = () => {
    if (!form.title.trim() || !form.clientId) return
    const payload = { title: form.title, description: form.description || null, type: form.type, status: form.status, priority: form.priority, clientId: form.clientId, reference: form.reference, nextDueDate: form.nextDueDate || null, tenantId: user?.tenantId, adversary: form.adversary || null, jurisdiction: form.jurisdiction || null, amountInDispute: form.amountInDispute ? parseFloat(form.amountInDispute) : null, billingType: form.billingType || null }
    if (editing) { updateMut.mutate({ id: editing.id, ...payload }) } else { createMut.mutate(payload) }
  }

  const timeline = useMemo(() => {
    if (!caseDetail) return []
    const items: Array<{ date: string; type: 'event' | 'note' | 'doc'; icon: React.ElementType; title: string; description: string }> = []
    for (const e of (caseDetail.events || [])) { items.push({ date: e.startTime, type: 'event', icon: Calendar, title: e.title, description: e.description || '' }) }
    for (const n of (caseDetail.notes || [])) { items.push({ date: n.createdAt, type: 'note', icon: FileText, title: 'Note', description: n.content }) }
    for (const d of (caseDetail.documents || [])) { items.push({ date: d.createdAt, type: 'doc', icon: FileCheck, title: d.name, description: `${d.fileType} • ${fmtFileSize(d.fileSize)}` }) }
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [caseDetail])

  const getClientName = (c: CaseItem) => c.client ? `${c.client.firstName} ${c.client.lastName}` : '—'

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-semibold">Dossiers</h2>
        <Button onClick={() => { resetForm(); setDialogOpen(true) }} size="sm"><Plus className="size-4 mr-1" />Nouveau dossier</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" /><Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-xs" /></div>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue placeholder="Statut" /></SelectTrigger><SelectContent><SelectItem value="all">Tous</SelectItem><SelectItem value="nouveau">Nouveau</SelectItem><SelectItem value="ouvert">Ouvert</SelectItem><SelectItem value="en_cours">En cours</SelectItem><SelectItem value="en_attente">En attente</SelectItem><SelectItem value="clos">Clos</SelectItem></SelectContent></Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue placeholder="Type" /></SelectTrigger><SelectContent><SelectItem value="all">Tous</SelectItem><SelectItem value="civil">Civil</SelectItem><SelectItem value="penal">Pénal</SelectItem><SelectItem value="commercial">Commercial</SelectItem><SelectItem value="social">Social</SelectItem><SelectItem value="administratif">Administratif</SelectItem></SelectContent></Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}><SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue placeholder="Priorité" /></SelectTrigger><SelectContent><SelectItem value="all">Tous</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="haute">Haute</SelectItem><SelectItem value="urgente">Urgente</SelectItem></SelectContent></Select>
      </div>

      {isLoading ? <div className="flex justify-center py-12"><Skeleton className="h-6 w-48" /></div> :
        (cases || []).length === 0 ? <EmptyState icon={Briefcase} title="Aucun dossier" description="Créez votre premier dossier" /> :
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto">
          {(cases || []).map(c => (
            <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => { setSelectedCase(c); setDetailOpen(true) }}>
              <CardHeader className="pb-2"><div className="flex items-start justify-between"><CardTitle className="text-sm font-semibold">{c.reference}</CardTitle><Badge variant="outline" className={cn('text-[10px]', STATUS_COLORS[c.status])}>{STATUS_LABELS[c.status] || c.status}</Badge></div><CardDescription className="text-xs mt-1 line-clamp-2">{c.title}</CardDescription></CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                <p className="text-xs text-slate-500 dark:text-slate-400"><Users className="size-3 inline mr-1" />{getClientName(c)}</p>
                {c.adversary && <p className="text-xs text-slate-500 dark:text-slate-400"><Scale className="size-3 inline mr-1" />Contre : {c.adversary}</p>}
                {c.jurisdiction && <p className="text-xs text-slate-500 dark:text-slate-400"><MapPin className="size-3 inline mr-1" />{c.jurisdiction}</p>}
                {c.amountInDispute != null && c.amountInDispute > 0 && <p className="text-xs font-medium text-amber-600"><Banknote className="size-3 inline mr-1" />{fmtMoney(c.amountInDispute)}</p>}
                {c.billingType && <Badge variant="secondary" className="text-[10px]">{BILLING_LABELS[c.billingType] || c.billingType}</Badge>}
                <div className="flex items-center justify-between pt-2">
                  <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[c.type] || c.type}</Badge>
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(c)}><Edit className="size-3.5" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>}

      <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) resetForm() }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Modifier le dossier' : 'Nouveau dossier'}</DialogTitle></DialogHeader>
          {conflicts.length > 0 && <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-1">{conflicts.map((c, i) => <div key={i} className="flex items-start gap-2 text-xs"><AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" /><span className="text-amber-700 dark:text-amber-300">{c.description}</span></div>)}</div>}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Référence *</Label><Input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="REF-001" /></div>
              <div><Label>Client *</Label><Select value={form.clientId} onValueChange={v => setForm(f => ({ ...f, clientId: v }))}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent>{(clients || []).map(cl => <SelectItem key={cl.id} value={cl.id}>{cl.firstName} {cl.lastName}{cl.company ? ` (${cl.company})` : ''}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div><Label>Titre *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Type</Label><Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="civil">Civil</SelectItem><SelectItem value="penal">Pénal</SelectItem><SelectItem value="commercial">Commercial</SelectItem><SelectItem value="social">Social</SelectItem><SelectItem value="administratif">Administratif</SelectItem></SelectContent></Select></div>
              <div><Label>Statut</Label><Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nouveau">Nouveau</SelectItem><SelectItem value="ouvert">Ouvert</SelectItem><SelectItem value="en_cours">En cours</SelectItem><SelectItem value="en_attente">En attente</SelectItem><SelectItem value="clos">Clos</SelectItem></SelectContent></Select></div>
              <div><Label>Priorité</Label><Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="haute">Haute</SelectItem><SelectItem value="urgente">Urgente</SelectItem></SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Partie adverse</Label><Input value={form.adversary} onChange={e => setForm(f => ({ ...f, adversary: e.target.value }))} placeholder="Nom de la partie adverse" /></div>
              <div><Label>Juridiction</Label><Input value={form.jurisdiction} onChange={e => setForm(f => ({ ...f, jurisdiction: e.target.value }))} placeholder="TPI de Douala" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Montant en jeu</Label><Input type="number" value={form.amountInDispute} onChange={e => setForm(f => ({ ...f, amountInDispute: e.target.value }))} placeholder="0" /></div>
              <div><Label>Facturation</Label><Select value={form.billingType} onValueChange={v => setForm(f => ({ ...f, billingType: v }))}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent><SelectItem value="forfait">Forfait</SelectItem><SelectItem value="horaire">Horaire</SelectItem><SelectItem value="abonnement">Abonnement</SelectItem><SelectItem value="success_fee">Success fee</SelectItem><SelectItem value="provision">Provision</SelectItem></SelectContent></Select></div>
              <div><Label>Prochaine échéance</Label><Input type="date" value={form.nextDueDate} onChange={e => setForm(f => ({ ...f, nextDueDate: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button><Button onClick={handleSubmit} disabled={!form.title.trim() || !form.clientId || createMut.isPending}>{editing ? 'Enregistrer' : 'Créer'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle className="flex items-center gap-2">{selectedCase?.reference} — {selectedCase?.title}</DialogTitle></DialogHeader>
          <Tabs defaultValue="resume" className="flex-1 overflow-hidden">
            <TabsList className="w-full"><TabsTrigger value="resume">Résumé</TabsTrigger><TabsTrigger value="timeline">Chronologie</TabsTrigger><TabsTrigger value="notes">Notes</TabsTrigger><TabsTrigger value="documents">Documents</TabsTrigger></TabsList>
            <TabsContent value="resume" className="mt-4 space-y-3 overflow-y-auto max-h-[50vh]">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-500">Client :</span> <span className="font-medium">{caseDetail?.client ? `${caseDetail.client.firstName} ${caseDetail.client.lastName}` : '—'}</span></div>
                <div><span className="text-slate-500">Type :</span> <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[caseDetail?.type || ''] || caseDetail?.type}</Badge></div>
                <div><span className="text-slate-500">Statut :</span> <Badge variant="outline" className={cn('text-[10px]', STATUS_COLORS[caseDetail?.status || ''])}>{STATUS_LABELS[caseDetail?.status || ''] || caseDetail?.status}</Badge></div>
                <div><span className="text-slate-500">Priorité :</span> <Badge variant="outline" className={cn('text-[10px]', PRIORITY_COLORS[caseDetail?.priority || ''])}>{PRIORITY_LABELS[caseDetail?.priority || ''] || caseDetail?.priority}</Badge></div>
                {caseDetail?.adversary && <div className="col-span-2"><span className="text-slate-500">Partie adverse :</span> <span className="font-medium">{caseDetail.adversary}</span></div>}
                {caseDetail?.jurisdiction && <div className="col-span-2"><span className="text-slate-500">Juridiction :</span> <span className="font-medium">{caseDetail.jurisdiction}</span></div>}
                {caseDetail?.amountInDispute != null && <div><span className="text-slate-500">Montant en jeu :</span> <span className="font-medium">{fmtMoney(caseDetail.amountInDispute)}</span></div>}
                {caseDetail?.billingType && <div><span className="text-slate-500">Facturation :</span> <Badge variant="secondary" className="text-[10px]">{BILLING_LABELS[caseDetail.billingType] || caseDetail.billingType}</Badge></div>}
                <div className="col-span-2"><span className="text-slate-500">Description :</span><p className="mt-1 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{caseDetail?.description || 'Aucune description'}</p></div>
              </div>
            </TabsContent>
            <TabsContent value="timeline" className="mt-4 overflow-y-auto max-h-[50vh]">
              {timeline.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">Aucune activité</p> :
              <div className="relative pl-6">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200 dark:bg-slate-700" />
                {timeline.map((item, i) => {
                  const Icon = item.icon
                  return (
                    <div key={i} className="relative pb-4">
                      <div className="absolute -left-6 top-1 size-[15px] rounded-full bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center"><Icon className="size-2.5 text-slate-500" /></div>
                      <div><p className="text-xs text-slate-400">{fmtDateTime(item.date)}</p><p className="text-sm font-medium mt-0.5">{item.title}</p>{item.description && <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>}</div>
                    </div>
                  )
                })}
              </div>}
            </TabsContent>
            <TabsContent value="notes" className="mt-4 space-y-3 overflow-y-auto max-h-[50vh]">
              {(caseDetail?.notes || []).length === 0 ? <p className="text-sm text-slate-400 text-center py-8">Aucune note</p> :
                (caseDetail?.notes || []).map(n => (
                  <div key={n.id} className="border rounded-lg p-3"><div className="flex items-center justify-between mb-1"><span className="text-xs font-medium">{n.user?.name || '—'}</span><span className="text-[10px] text-slate-400">{fmtDateTime(n.createdAt)}</span></div><p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{n.content}</p></div>
                ))}
            </TabsContent>
            <TabsContent value="documents" className="mt-4 space-y-2 overflow-y-auto max-h-[50vh]">
              {(caseDetail?.documents || []).length === 0 ? <p className="text-sm text-slate-400 text-center py-8">Aucun document</p> :
                (caseDetail?.documents || []).map(d => (
                  <div key={d.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50"><FileText className="size-4 text-slate-400 shrink-0" /><div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{d.name}</p><p className="text-[10px] text-slate-400">{d.fileType} • {fmtFileSize(d.fileSize)}</p></div>{d.isFinal && <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Officielle</Badge>}</div>
                ))}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ==================== CLIENTS VIEW ====================
function ClientsView() {
  const { user } = useAppStore()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState({ firstName: '', lastName: '', company: '', email: '', phone: '', address: '', city: '', country: 'Cameroun', notes: '', clientType: 'particulier', niu: '', riskLevel: 'faible', source: '', isActive: true })

  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients', user?.tenantId, search],
    queryFn: () => {
      const p = new URLSearchParams()
      if (user?.tenantId) p.set('tenantId', user.tenantId)
      if (search) p.set('search', search)
      return fetch(`/api/clients?${p}`).then(r => r.json())
    },
  })

  const createMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => fetch('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, tenantId: user?.tenantId }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success('Client créé'); setDialogOpen(false); resetForm() },
    onError: () => toast.error('Erreur lors de la création'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...body }: Record<string, unknown>) => fetch(`/api/clients/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success('Client mis à jour'); setDialogOpen(false); resetForm() },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => fetch(`/api/clients/${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success('Client supprimé') },
    onError: () => toast.error('Erreur lors de la suppression'),
  })

  const resetForm = () => { setForm({ firstName: '', lastName: '', company: '', email: '', phone: '', address: '', city: '', country: 'Cameroun', notes: '', clientType: 'particulier', niu: '', riskLevel: 'faible', source: '', isActive: true }); setEditing(null) }
  const openEdit = (c: Client) => { setEditing(c); setForm({ firstName: c.firstName, lastName: c.lastName, company: c.company || '', email: c.email || '', phone: c.phone || '', address: c.address || '', city: c.city || '', country: c.country || 'Cameroun', notes: c.notes || '', clientType: c.clientType || 'particulier', niu: c.niu || '', riskLevel: c.riskLevel || 'faible', source: c.source || '', isActive: c.isActive }); setDialogOpen(true) }
  const handleSubmit = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) return
    const payload = { ...form, company: form.company || null, email: form.email || null, phone: form.phone || null, address: form.address || null, city: form.city || null, niu: form.niu || null, notes: form.notes || null, source: form.source || null }
    if (editing) { updateMut.mutate({ id: editing.id, ...payload }) } else { createMut.mutate(payload) }
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-semibold">Clients</h2>
        <Button onClick={() => { resetForm(); setDialogOpen(true) }} size="sm"><Plus className="size-4 mr-1" />Nouveau client</Button>
      </div>

      <div className="relative max-w-xs"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" /><Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-xs" /></div>

      {isLoading ? <div className="flex justify-center py-12"><Skeleton className="h-6 w-48" /></div> :
        (clients || []).length === 0 ? <EmptyState icon={Users} title="Aucun client" description="Ajoutez votre premier client" /> :
        <Card><CardContent className="p-0"><div className="max-h-[500px] overflow-y-auto">
          <Table><TableHeader><TableRow>
            <TableHead>Nom</TableHead>
            <TableHead className="hidden md:table-cell">Type</TableHead>
            <TableHead className="hidden lg:table-cell">Ville</TableHead>
            <TableHead className="hidden md:table-cell">Risque</TableHead>
            <TableHead className="hidden sm:table-cell">Dossiers</TableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow></TableHeader><TableBody>
            {(clients || []).map((c: Client, i: number) => (
              <TableRow key={c.id} className={cn(i % 2 === 1 && 'bg-slate-50/50 dark:bg-slate-900/30')}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="size-7"><AvatarFallback className="text-[10px] bg-slate-100 dark:bg-slate-800">{initials(`${c.firstName} ${c.lastName}`)}</AvatarFallback></Avatar>
                    <div><p className="text-sm font-medium">{c.firstName} {c.lastName}</p>{c.company && <p className="text-[10px] text-slate-400">{c.company}</p>}</div>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell"><Badge variant="outline" className="text-[10px]">{c.clientType === 'entreprise' ? 'Entreprise' : 'Particulier'}</Badge></TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-slate-500 dark:text-slate-400">{c.city || '—'}</TableCell>
                <TableCell className="hidden md:table-cell"><Badge variant="outline" className={cn('text-[10px]', RISK_COLORS[c.riskLevel || 'faible'])}>{c.riskLevel === 'eleve' ? 'Élevé' : c.riskLevel === 'moyen' ? 'Moyen' : 'Faible'}</Badge></TableCell>
                <TableCell className="hidden sm:table-cell text-sm text-slate-500 dark:text-slate-400">{c._count?.cases || 0}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(c)}><Edit className="size-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="size-7 text-rose-500 hover:text-rose-700" onClick={() => deleteMut.mutate(c.id)}><Trash2 className="size-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody></Table>
        </div></CardContent></Card>}

      <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) resetForm() }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Modifier le client' : 'Nouveau client'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Prénom *</Label><Input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} /></div>
              <div><Label>Nom *</Label><Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} /></div>
            </div>
            <div><Label>Société</Label><Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><Label>Téléphone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            </div>
            <div><Label>Adresse</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Ville</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
              <div><Label>Pays</Label><Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Type</Label><Select value={form.clientType} onValueChange={v => setForm(f => ({ ...f, clientType: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="particulier">Particulier</SelectItem><SelectItem value="entreprise">Entreprise</SelectItem></SelectContent></Select></div>
              <div><Label>NIU</Label><Input value={form.niu} onChange={e => setForm(f => ({ ...f, niu: e.target.value }))} placeholder="Numéro d'Identification Unique" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Niveau de risque</Label><Select value={form.riskLevel} onValueChange={v => setForm(f => ({ ...f, riskLevel: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="faible">Faible</SelectItem><SelectItem value="moyen">Moyen</SelectItem><SelectItem value="eleve">Élevé</SelectItem></SelectContent></Select></div>
              <div><Label>Source</Label><Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v }))}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent><SelectItem value="bouche_a_oreille">Bouche à oreille</SelectItem><SelectItem value="internet">Internet</SelectItem><SelectItem value="recommandation">Recommandation</SelectItem><SelectItem value="autre">Autre</SelectItem></SelectContent></Select></div>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button><Button onClick={handleSubmit} disabled={!form.firstName.trim() || !form.lastName.trim() || createMut.isPending || updateMut.isPending}>{editing ? 'Enregistrer' : 'Créer'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ==================== DOCUMENTS VIEW ====================
function DocumentsView() {
  const { user } = useAppStore()
  const [caseFilter, setCaseFilter] = useState('all')

  const { data: cases } = useQuery({
    queryKey: ['cases-mini-docs', user?.tenantId],
    queryFn: () => fetch(`/api/cases?tenantId=${user?.tenantId}`).then(r => r.json()),
  })

  const { data: docs, isLoading } = useQuery({
    queryKey: ['documents', user?.tenantId, caseFilter],
    queryFn: () => {
      const p = new URLSearchParams()
      if (user?.tenantId) p.set('tenantId', user.tenantId)
      if (caseFilter !== 'all') p.set('caseId', caseFilter)
      return fetch(`/api/documents?${p}`).then(r => r.json())
    },
  })

  const grouped = useMemo(() => {
    const groups: Record<string, Doc[]> = {}
    for (const d of (docs || []) as Doc[]) {
      const folder = d.folder || 'Sans dossier'
      if (!groups[folder]) groups[folder] = []
      groups[folder].push(d)
    }
    return groups
  }, [docs])

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h2 className="text-lg font-semibold">Documents</h2>
      <Select value={caseFilter} onValueChange={setCaseFilter}>
        <SelectTrigger className="w-[220px] h-9 text-xs"><SelectValue placeholder="Filtrer par dossier" /></SelectTrigger>
        <SelectContent><SelectItem value="all">Tous les dossiers</SelectItem>{(cases || []).map(c => <SelectItem key={c.id} value={c.id}>{c.reference} — {c.title}</SelectItem>)}</SelectContent>
      </Select>

      {isLoading ? <div className="flex justify-center py-12"><Skeleton className="h-6 w-48" /></div> :
        (docs || []).length === 0 ? <EmptyState icon={FileText} title="Aucun document" /> :
        <div className="max-h-[600px] overflow-y-auto space-y-4">
          {Object.entries(grouped).map(([folder, items]) => (
            <Card key={folder}>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Folder className="size-4 text-amber-500" />{folder}<Badge variant="secondary" className="text-[10px]">{items.length}</Badge></CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 space-y-1">
                {items.map(d => (
                  <div key={d.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <FileText className="size-4 text-slate-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><p className="text-sm font-medium truncate">{d.name}</p>{d.isFinal && <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">V</Badge>}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-400">{d.fileType} • {fmtFileSize(d.fileSize)}</span>
                        {d.tags && d.tags.split(',').map((t, i) => <Badge key={i} variant="outline" className="text-[10px] px-1 py-0"><Tag className="size-2.5 mr-0.5" />{t.trim()}</Badge>)}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">{fmtDate(d.createdAt)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>}
    </div>
  )
}

// ==================== CALENDAR VIEW ====================
function CalendarView() {
  const { user } = useAppStore()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const monthStr = format(currentMonth, 'yyyy-MM')

  const { data: events, isLoading } = useQuery({
    queryKey: ['events', user?.tenantId, monthStr],
    queryFn: () => fetch(`/api/events?tenantId=${user?.tenantId}&month=${monthStr}`).then(r => r.json()),
  })

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: calStart, end: calEnd })
  }, [currentMonth])

  const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
  const getEventsForDay = (day: Date) => (events || []).filter((e: EventItem) => isSameDay(parseISO(e.startTime), day))

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Calendrier</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="size-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="size-4" /></Button>
          <span className="text-sm font-medium min-w-[140px] text-center">{format(currentMonth, 'MMMM yyyy', { locale: fr })}</span>
          <Button variant="outline" size="icon" className="size-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="size-4" /></Button>
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-12"><Skeleton className="h-6 w-48" /></div> : (
        <Card><CardContent className="p-2">
          <div className="grid grid-cols-7 gap-px bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
            {weekDays.map(d => <div key={d} className="bg-white dark:bg-slate-950 p-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400">{d}</div>)}
            {days.map(day => {
              const dayEvents = getEventsForDay(day)
              return (
                <div key={day.toISOString()} className={cn('bg-white dark:bg-slate-950 p-1 min-h-[80px] md:min-h-[100px]', !isSameMonth(day, currentMonth) && 'opacity-40', isToday(day) && 'bg-amber-50 dark:bg-amber-950/20')}>
                  <p className={cn('text-xs mb-1', isToday(day) ? 'font-bold text-amber-600' : 'text-slate-500')}>{format(day, 'd')}</p>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map(e => (
                      <div key={e.id} className={cn('text-[10px] px-1 py-0.5 rounded truncate', CRIT_COLORS[e.criticality], e.criticality === 'urgente' || e.criticality === 'haute' ? 'text-white' : 'text-white dark:text-slate-900')} title={`${e.title}${e.location ? ` — ${e.location}` : ''}`}>
                        {e.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && <p className="text-[10px] text-slate-400 pl-1">+{dayEvents.length - 3}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent></Card>
      )}
    </div>
  )
}

// ==================== INVOICES VIEW ====================
function InvoicesView() {
  const { user } = useAppStore()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('all')

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices', user?.tenantId, statusFilter],
    queryFn: () => {
      const p = new URLSearchParams()
      if (user?.tenantId) p.set('tenantId', user.tenantId)
      if (statusFilter !== 'all') p.set('status', statusFilter)
      return fetch(`/api/invoices?${p}`).then(r => r.json())
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...body }: Record<string, unknown>) => fetch(`/api/invoices/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Facture mise à jour') },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  })

  const markStatus = (inv: Invoice, newStatus: string) => {
    const data: Record<string, unknown> = { id: inv.id, status: newStatus }
    if (newStatus === 'paye') { data.paidDate = new Date().toISOString(); data.paidAmount = inv.amount }
    else if (newStatus === 'partiel') { data.paidDate = new Date().toISOString(); data.paidAmount = inv.amount * 0.5 }
    updateMut.mutate(data)
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h2 className="text-lg font-semibold">Factures</h2>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue placeholder="Statut" /></SelectTrigger>
        <SelectContent><SelectItem value="all">Tous les statuts</SelectItem><SelectItem value="non_paye">Non payé</SelectItem><SelectItem value="partiel">Partiel</SelectItem><SelectItem value="paye">Payé</SelectItem><SelectItem value="annule">Annulé</SelectItem></SelectContent>
      </Select>

      {isLoading ? <div className="flex justify-center py-12"><Skeleton className="h-6 w-48" /></div> :
        (invoices || []).length === 0 ? <EmptyState icon={Receipt} title="Aucune facture" /> :
        <Card><CardContent className="p-0"><div className="max-h-[500px] overflow-y-auto">
          <Table><TableHeader><TableRow>
            <TableHead>Référence</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Montant</TableHead>
            <TableHead className="hidden md:table-cell">Statut</TableHead>
            <TableHead className="hidden lg:table-cell">Échéance</TableHead>
            <TableHead className="w-36">Actions</TableHead>
          </TableRow></TableHeader><TableBody>
            {(invoices || []).map((inv: Invoice, i: number) => (
              <TableRow key={inv.id} className={cn(i % 2 === 1 && 'bg-slate-50/50 dark:bg-slate-900/30')}>
                <TableCell className="font-medium text-sm">{inv.reference}</TableCell>
                <TableCell className="text-sm text-slate-500 dark:text-slate-400">{inv.client ? `${inv.client.firstName} ${inv.client.lastName}` : '—'}</TableCell>
                <TableCell className="text-sm font-medium">{fmtMoney(inv.amount, inv.currencyCode)}</TableCell>
                <TableCell className="hidden md:table-cell"><Badge variant="outline" className={cn('text-[10px]', STATUS_COLORS[inv.status])}>{STATUS_LABELS[inv.status] || inv.status}</Badge></TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-slate-500 dark:text-slate-400">{fmtDate(inv.dueDate)}</TableCell>
                <TableCell>
                  {(inv.status === 'non_paye' || inv.status === 'partiel') && (
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="text-[10px] h-7" onClick={() => markStatus(inv, 'paye')}>Marquer payée</Button>
                      <Button variant="outline" size="sm" className="text-[10px] h-7" onClick={() => markStatus(inv, 'partiel')}>Marquer partielle</Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody></Table>
        </div></CardContent></Card>}
    </div>
  )
}

// ==================== MESSAGES VIEW ====================
function MessagesView() {
  const { user } = useAppStore()
  const qc = useQueryClient()
  const [selectedContact, setSelectedContact] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data: contacts } = useQuery({
    queryKey: ['users-contacts', user?.tenantId],
    queryFn: () => fetch(`/api/users?tenantId=${user?.tenantId}`).then(r => r.json()),
  })

  const { data: messages } = useQuery({
    queryKey: ['messages', user?.id, selectedContact],
    queryFn: () => {
      const p = new URLSearchParams()
      if (user?.tenantId) p.set('tenantId', user.tenantId)
      if (user?.id) p.set('userId', user.id)
      if (selectedContact) p.set('contactId', selectedContact)
      return fetch(`/api/messages?${p}`).then(r => r.json())
    },
    refetchInterval: 5000,
  })

  const sendMut = useMutation({
    mutationFn: (content: string) => fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, tenantId: user?.tenantId, senderId: user?.id, receiverId: selectedContact }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['messages'] }); setNewMessage('') },
    onError: () => toast.error("Erreur d'envoi"),
  })

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const contactList = (contacts || []).filter((c: UserItem) => c.id !== user?.id)
  const chatMessages = selectedContact ? (messages || []) as Message[] : []

  const handleSend = () => {
    if (!newMessage.trim() || !selectedContact) return
    sendMut.mutate(newMessage.trim())
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h2 className="text-lg font-semibold">Messages</h2>
      <Card className="overflow-hidden"><div className="flex h-[500px]">
        <div className="w-64 border-r dark:border-slate-800 flex-shrink-0 overflow-y-auto hidden sm:block">
          {contactList.length === 0 ? <p className="text-xs text-slate-400 p-4 text-center">Aucun contact</p> :
            contactList.map((c: UserItem) => (
              <button key={c.id} className={cn('w-full flex items-center gap-2 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left transition-colors', selectedContact === c.id && 'bg-slate-100 dark:bg-slate-800')} onClick={() => setSelectedContact(c.id)}>
                <Avatar className="size-8"><AvatarFallback className="text-[10px] bg-slate-100 dark:bg-slate-700">{initials(c.name)}</AvatarFallback></Avatar>
                <div className="min-w-0"><p className="text-sm font-medium truncate">{c.name}</p><p className="text-[10px] text-slate-400">{ROLE_LABELS[c.role] || c.role}</p></div>
              </button>
            ))}
        </div>
        <div className="flex-1 flex flex-col">
          {!selectedContact ? <div className="flex-1 flex items-center justify-center"><EmptyState icon={MessageSquare} title="Sélectionnez une conversation" description="Choisissez un contact pour commencer" /></div> : (
            <>
              <div className="p-3 border-b dark:border-slate-800"><p className="text-sm font-semibold">{(contacts || []).find((c: UserItem) => c.id === selectedContact)?.name || ''}</p></div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.length === 0 && <p className="text-xs text-slate-400 text-center py-8">Aucun message</p>}
                {chatMessages.map((m: Message) => {
                  const isMine = m.senderId === user?.id
                  return (
                    <div key={m.id} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
                      <div className={cn('max-w-[75%] rounded-xl px-3 py-2', isMine ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100')}>
                        <p className="text-sm">{m.content}</p>
                        <p className={cn('text-[10px] mt-1', isMine ? 'text-emerald-100' : 'text-slate-400')}>{fmtDateTime(m.createdAt)}</p>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>
              <div className="p-3 border-t dark:border-slate-800 flex gap-2">
                <Input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Écrire un message..." className="text-sm" onKeyDown={e => e.key === 'Enter' && handleSend()} />
                <Button size="icon" onClick={handleSend} disabled={!newMessage.trim() || sendMut.isPending}><Send className="size-4" /></Button>
              </div>
            </>
          )}
        </div>
      </div></Card>
    </div>
  )
}

// ==================== REPORTS VIEW ====================
function ReportsView() {
  const { user } = useAppStore()
  const [period, setPeriod] = useState('month')

  const { data: invoices } = useQuery({
    queryKey: ['invoices-report', user?.tenantId],
    queryFn: () => fetch(`/api/invoices?tenantId=${user?.tenantId}`).then(r => r.json()),
  })

  const stats = useMemo(() => {
    const all = (invoices || []) as Invoice[]
    const paid = all.filter(i => i.status === 'paye')
    const unpaid = all.filter(i => i.status === 'non_paye')
    const partial = all.filter(i => i.status === 'partiel')
    const totalRevenue = paid.reduce((s, i) => s + i.amount, 0)
    const totalPending = unpaid.reduce((s, i) => s + i.amount, 0) + partial.reduce((s, i) => s + (i.amount - (i.paidAmount || 0)), 0)
    return { totalRevenue, totalPending, paidCount: paid.length, unpaidCount: unpaid.length + partial.length, totalInvoices: all.length }
  }, [invoices])

  const monthlyData = useMemo(() => {
    const all = (invoices || []) as Invoice[]
    const months: Record<string, { month: string; revenue: number }> = {}
    for (const inv of all) {
      if (inv.status !== 'paye' || !inv.paidDate) continue
      const m = format(parseISO(inv.paidDate), 'MMM yy', { locale: fr })
      if (!months[m]) months[m] = { month: m, revenue: 0 }
      months[m].revenue += inv.amount
    }
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month)).slice(-12)
  }, [invoices])

  const topClients = useMemo(() => {
    const all = (invoices || []) as Invoice[]
    const map: Record<string, { name: string; total: number }> = {}
    for (const inv of all) {
      if (inv.status !== 'paye') continue
      const name = inv.client ? `${inv.client.firstName} ${inv.client.lastName}` : 'Inconnu'
      if (!map[inv.clientId]) map[inv.clientId] = { name, total: 0 }
      map[inv.clientId].total += inv.amount
    }
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5)
  }, [invoices])

  const isDark = useTheme().resolvedTheme === 'dark'
  const colors = isDark ? CHART_COLORS_DARK : CHART_COLORS

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h2 className="text-lg font-semibold">Rapports</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Revenus totaux</p><p className="text-xl font-bold text-emerald-600 mt-1">{fmtMoney(stats.totalRevenue)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">En attente</p><p className="text-xl font-bold text-orange-600 mt-1">{fmtMoney(stats.totalPending)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Factures payées</p><p className="text-xl font-bold mt-1">{stats.paidCount}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Total factures</p><p className="text-xl font-bold mt-1">{stats.totalInvoices}</p></CardContent></Card>
      </div>

      <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Revenus mensuels</CardTitle></CardHeader><CardContent>
        {monthlyData.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">Aucune donnée</p> : (
          <ResponsiveContainer width="100%" height={250}><BarChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" className="opacity-30" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><RechartsTooltip formatter={(v: number) => fmtMoney(v)} /><Bar dataKey="revenue" fill={colors[2]} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        )}
      </CardContent></Card>

      <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Top clients</CardTitle></CardHeader><CardContent>
        {topClients.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">Aucune donnée</p> : (
          <div className="space-y-3">
            {topClients.map((c, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2"><span className="size-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold">{i + 1}</span><span className="text-sm font-medium">{c.name}</span></div>
                <span className="text-sm font-semibold">{fmtMoney(c.total)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>
    </div>
  )
}

// ==================== AUDIT LOGS VIEW ====================
function AuditLogsView() {
  const { user } = useAppStore()
  const [resourceType, setResourceType] = useState('all')
  const isAdmin = user?.role === 'root_admin' || user?.role === 'firm_admin' || user?.role === 'associate'

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs', user?.tenantId, resourceType],
    queryFn: () => {
      const p = new URLSearchParams()
      if (user?.tenantId) p.set('tenantId', user.tenantId)
      if (resourceType !== 'all') p.set('resourceType', resourceType)
      return fetch(`/api/audit-logs?${p}`).then(r => r.json())
    },
    enabled: isAdmin,
  })

  if (!isAdmin) return <div className="p-6"><EmptyState icon={Shield} title="Accès restreint" description="Cette section est réservée aux administrateurs" /></div>

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h2 className="text-lg font-semibold">Journal d'audit</h2>
      <Select value={resourceType} onValueChange={setResourceType}>
        <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue placeholder="Type de ressource" /></SelectTrigger>
        <SelectContent><SelectItem value="all">Tous</SelectItem><SelectItem value="Case">Dossier</SelectItem><SelectItem value="Client">Client</SelectItem><SelectItem value="User">Utilisateur</SelectItem><SelectItem value="Invoice">Facture</SelectItem><SelectItem value="Document">Document</SelectItem><SelectItem value="Task">Tâche</SelectItem></SelectContent>
      </Select>

      {isLoading ? <div className="flex justify-center py-12"><Skeleton className="h-6 w-48" /></div> :
        (logs || []).length === 0 ? <EmptyState icon={Shield} title="Aucune entrée" /> :
        <Card><CardContent className="p-0"><div className="max-h-[500px] overflow-y-auto">
          <Table><TableHeader><TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Utilisateur</TableHead>
            <TableHead>Action</TableHead>
            <TableHead className="hidden md:table-cell">Ressource</TableHead>
            <TableHead className="hidden lg:table-cell">IP</TableHead>
          </TableRow></TableHeader><TableBody>
            {(logs || []).map((log: AuditLogItem) => (
              <TableRow key={log.id}>
                <TableCell className="text-xs text-slate-500 dark:text-slate-400">{fmtDateTime(log.createdAt)}</TableCell>
                <TableCell className="text-sm">{log.user?.name || 'Système'}</TableCell>
                <TableCell className="text-sm font-medium">{log.action}</TableCell>
                <TableCell className="hidden md:table-cell"><Badge variant="outline" className="text-[10px]">{log.resourceType || '—'}</Badge></TableCell>
                <TableCell className="hidden lg:table-cell text-xs text-slate-400">{log.ipAddress || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody></Table>
        </div></CardContent></Card>}
    </div>
  )
}

// ==================== SETTINGS VIEW ====================
function SettingsView() {
  const { user, logout } = useAppStore()
  const qc = useQueryClient()
  const isAdmin = user?.role === 'root_admin' || user?.role === 'firm_admin' || user?.role === 'associate'
  const [profileForm, setProfileForm] = useState({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '' })
  const tenantInfo: TenantItem | null = tenantData || null
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'lawyer', password: '' })
  const [newCurrency, setNewCurrency] = useState({ code: '', name: '', symbol: '' })
  const [showNewUser, setShowNewUser] = useState(false)
  const [showNewCurrency, setShowNewCurrency] = useState(false)

  const { data: tenantData } = useQuery({
    queryKey: ['tenant', user?.tenantId],
    queryFn: () => fetch(`/api/tenants/${user?.tenantId}`).then(r => r.json()),
    enabled: !!user?.tenantId,
  })

  const { data: usersList } = useQuery({
    queryKey: ['settings-users', user?.tenantId],
    queryFn: () => fetch(`/api/users?tenantId=${user?.tenantId}`).then(r => r.json()),
    enabled: isAdmin,
  })

  const { data: currencies } = useQuery({
    queryKey: ['currencies'],
    queryFn: () => fetch('/api/currencies').then(r => r.json()),
    enabled: isAdmin,
  })

  const updateProfile = useMutation({
    mutationFn: (body: Record<string, unknown>) => fetch(`/api/users/${user?.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: () => { toast.success('Profil mis à jour'); qc.invalidateQueries({ queryKey: ['tenant'] }) },
    onError: () => toast.error('Erreur'),
  })

  const createUserMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: () => { toast.success('Utilisateur créé'); qc.invalidateQueries({ queryKey: ['settings-users'] }); setShowNewUser(false); setNewUser({ name: '', email: '', role: 'lawyer', password: '' }) },
    onError: () => toast.error('Erreur lors de la création'),
  })

  const createCurrencyMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => fetch('/api/currencies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: () => { toast.success('Devise ajoutée'); qc.invalidateQueries({ queryKey: ['currencies'] }); setShowNewCurrency(false); setNewCurrency({ code: '', name: '', symbol: '' }) },
    onError: () => toast.error('Erreur'),
  })

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <h2 className="text-lg font-semibold">Paramètres</h2>

      <Card><CardHeader><CardTitle className="text-sm font-semibold">Mon profil</CardTitle></CardHeader><CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Nom</Label><Input value={profileForm.name} onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><Label>Email</Label><Input value={profileForm.email} onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))} /></div>
        </div>
        <div><Label>Téléphone</Label><Input value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} /></div>
        <Button size="sm" onClick={() => updateProfile.mutate(profileForm)} disabled={updateProfile.isPending}>Enregistrer</Button>
      </CardContent></Card>

      {tenantInfo && <Card><CardHeader><CardTitle className="text-sm font-semibold">Informations du cabinet</CardTitle></CardHeader><CardContent>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-slate-500">Nom :</span> <span className="font-medium">{tenantInfo.name}</span></div>
          <div><span className="text-slate-500">Plan :</span> <Badge variant="outline" className="text-[10px]">{tenantInfo.plan}</Badge></div>
          <div><span className="text-slate-500">Email :</span> <span className="font-medium">{tenantInfo.email || '—'}</span></div>
          <div><span className="text-slate-500">Téléphone :</span> <span className="font-medium">{tenantInfo.phone || '—'}</span></div>
          <div className="col-span-2"><span className="text-slate-500">Adresse :</span> <span className="font-medium">{tenantInfo.address || '—'}</span></div>
        </div>
      </CardContent></Card>}

      {isAdmin && <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-sm font-semibold">Utilisateurs</CardTitle><Button size="sm" variant="outline" onClick={() => setShowNewUser(true)}><Plus className="size-3.5 mr-1" />Ajouter</Button></CardHeader><CardContent>
        {showNewUser && <div className="border rounded-lg p-3 mb-3 space-y-2"><div className="grid grid-cols-2 gap-2"><div><Label>Nom</Label><Input value={newUser.name} onChange={e => setNewUser(u => ({ ...u, name: e.target.value }))} /></div><div><Label>Email</Label><Input type="email" value={newUser.email} onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))} /></div><div><Label>Rôle</Label><Select value={newUser.role} onValueChange={v => setNewUser(u => ({ ...u, role: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="lawyer">Avocat</SelectItem><SelectItem value="jurist">Juriste</SelectItem><SelectItem value="assistant">Assistant</SelectItem><SelectItem value="accountant">Comptable</SelectItem></SelectContent></Select></div><div><Label>Mot de passe</Label><Input type="password" value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} /></div></div><div className="flex gap-2"><Button size="sm" onClick={() => createUserMut.mutate({ ...newUser, tenantId: user?.tenantId })} disabled={!newUser.name || !newUser.email}>Créer</Button><Button size="sm" variant="outline" onClick={() => setShowNewUser(false)}>Annuler</Button></div></div>}
        <div className="max-h-64 overflow-y-auto">
          <Table><TableHeader><TableRow><TableHead>Nom</TableHead><TableHead>Email</TableHead><TableHead>Rôle</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader><TableBody>
            {(usersList || []).map((u: UserItem) => (
              <TableRow key={u.id}><TableCell className="text-sm font-medium">{u.name}</TableCell><TableCell className="text-sm text-slate-500">{u.email}</TableCell><TableCell><Badge variant="outline" className="text-[10px]">{ROLE_LABELS[u.role] || u.role}</Badge></TableCell><TableCell><Badge variant={u.isActive ? 'default' : 'secondary'} className="text-[10px]">{u.isActive ? 'Actif' : 'Inactif'}</Badge></TableCell></TableRow>
            ))}
          </TableBody></Table>
        </div>
      </CardContent></Card>}

      {isAdmin && <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-sm font-semibold">Devises</CardTitle><Button size="sm" variant="outline" onClick={() => setShowNewCurrency(true)}><Plus className="size-3.5 mr-1" />Ajouter</Button></CardHeader><CardContent>
        {showNewCurrency && <div className="border rounded-lg p-3 mb-3 space-y-2"><div className="grid grid-cols-3 gap-2"><div><Label>Code</Label><Input value={newCurrency.code} onChange={e => setNewCurrency(c => ({ ...c, code: e.target.value }))} placeholder="XAF" /></div><div><Label>Nom</Label><Input value={newCurrency.name} onChange={e => setNewCurrency(c => ({ ...c, name: e.target.value }))} placeholder="Franc CFA" /></div><div><Label>Symbole</Label><Input value={newCurrency.symbol} onChange={e => setNewCurrency(c => ({ ...c, symbol: e.target.value }))} placeholder="FCFA" /></div></div><div className="flex gap-2"><Button size="sm" onClick={() => createCurrencyMut.mutate(newCurrency)} disabled={!newCurrency.code || !newCurrency.name}>Ajouter</Button><Button size="sm" variant="outline" onClick={() => setShowNewCurrency(false)}>Annuler</Button></div></div>}
        <div className="flex flex-wrap gap-2">
          {(currencies || []).map((c: CurrencyItem) => <Badge key={c.id} variant="outline" className="text-xs py-1 px-2">{c.code} — {c.symbol} ({c.name})</Badge>)}
        </div>
      </CardContent></Card>}

      <Button variant="outline" className="text-rose-600 hover:text-rose-700" onClick={logout}><LogOut className="size-4 mr-2" />Se déconnecter</Button>
    </div>
  )
}

// ==================== ARCHIVES VIEW ====================
function ArchivesView() {
  const { user } = useAppStore()

  const { data: cases, isLoading } = useQuery({
    queryKey: ['archived-cases', user?.tenantId],
    queryFn: () => fetch(`/api/cases?tenantId=${user?.tenantId}&status=archive`).then(r => r.json()),
  })

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h2 className="text-lg font-semibold">Archives</h2>
      {isLoading ? <div className="flex justify-center py-12"><Skeleton className="h-6 w-48" /></div> :
        (cases || []).length === 0 ? <EmptyState icon={Archive} title="Aucun dossier archivé" /> :
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto">
          {(cases || []).map((c: CaseItem) => (
            <Card key={c.id} className="opacity-80">
              <CardHeader className="pb-2"><div className="flex items-start justify-between"><CardTitle className="text-sm font-semibold">{c.reference}</CardTitle><Badge variant="outline" className={cn('text-[10px]', STATUS_COLORS.archive)}>{STATUS_LABELS.archive}</Badge></div><CardDescription className="text-xs mt-1 line-clamp-2">{c.title}</CardDescription></CardHeader>
              <CardContent className="p-4 pt-0 space-y-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">{c.client ? `${c.client.firstName} ${c.client.lastName}` : '—'}</p>
                <p className="text-xs text-slate-400">Type : {TYPE_LABELS[c.type] || c.type}</p>
                {c.closingDate && <p className="text-xs text-slate-400">Clôture : {fmtDate(c.closingDate)}</p>}
              </CardContent>
            </Card>
          ))}
        </div>}
    </div>
  )
}

// ==================== FOOTER ====================
function Footer() {
  return (
    <footer className="mt-auto border-t dark:border-slate-800 px-4 py-3 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-950">
      <span className="flex items-center gap-1"><Scale className="size-3.5" />JurisLink</span>
      <span>v1.0.0</span>
    </footer>
  )
}

// ==================== DASHBOARD ROUTER ====================
function DashboardRouter() {
  const { currentView } = useAppStore()
  switch (currentView) {
    case 'dashboard': return <DashboardView />
    case 'cases': return <CasesView />
    case 'clients': return <ClientsView />
    case 'tasks': return <TasksView />
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

// ==================== MAIN APP ====================
export default function App() {
  const { isAuthenticated, currentView } = useAppStore()
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className='min-h-screen flex flex-col bg-white dark:bg-slate-950'>
          <AnimatePresence mode='wait'>
            {!isAuthenticated ? (
              <LoginPage key='login' />
            ) : (
              <motion.div key={currentView} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className='flex-1 flex flex-col'>
                <Sidebar />
                <div className='lg:pl-[260px] flex-1 flex flex-col'>
                  <Header />
                  <main className='flex-1'><DashboardRouter /></main>
                  <Footer />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <Toaster richColors position='top-right' />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  )
}
