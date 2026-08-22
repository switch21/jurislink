'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, addMonths, subMonths, isToday, startOfWeek, endOfWeek, isSameMonth, differenceInDays, isBefore, addDays } from 'date-fns'
import { fr, enUS, es, de, it } from 'date-fns/locale'
import { t, useLocale, LOCALE_NAMES, LOCALE_FLAGS, RTL_LOCALES, type Locale } from '@/lib/i18n'
import { toast, Toaster } from 'sonner'
import { ThemeProvider } from 'next-themes'
import { useTheme } from 'next-themes'
import { useAppStore, type ViewName } from '@/store/appStore'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  LayoutDashboard, Briefcase, Users, FileText, Calendar, Receipt, MessageSquare,
  BarChart3, Settings, Shield, Plus, Search, Bell, LogOut, Menu, X, Edit, Trash2,
  Eye, Download, Send, ChevronLeft, ChevronRight, MoreHorizontal, Scale,
  CheckCircle2, AlertTriangle, Clock, Building2, RefreshCw, TrendingUp, DollarSign,
  FileCheck, Activity, Sun, Moon, Inbox, ClipboardList, Zap,
  AlertOctagon, Timer, Gavel, AlertCircle, ArrowUpRight, ArrowDownRight
} from 'lucide-react'

// ==================== Types ====================
interface Client { id: string; firstName: string; lastName: string; company?: string | null; clientType?: string; niu?: string | null; email?: string | null; phone?: string | null; address?: string | null; city?: string | null; country?: string | null; notes?: string | null; riskLevel?: string; source?: string | null; isActive: boolean; tenantId: string; createdAt: string; _count?: { cases: number; invoices: number } }
interface CaseItem { id: string; reference: string; title: string; description?: string | null; type: string; status: string; priority: string; isSecret: boolean; nextDueDate?: string | null; closingDate?: string | null; createdAt: string; tenantId: string; clientId: string; adversary?: string | null; jurisdiction?: string | null; amountInDispute?: number | null; billingType?: string | null; client?: Client; assignments?: CaseAssignment[]; notes?: CaseNote[]; documents?: Doc[]; events?: EventItem[] }
interface CaseAssignment { id: string; userId: string; caseId: string; user?: UserItem }
interface CaseNote { id: string; content: string; createdAt: string; userId?: string | null; user?: UserItem }
interface Doc { id: string; name: string; fileName: string; fileType: string; fileSize: number; filePath: string; version: number; isFinal?: boolean; folder?: string | null; tags?: string | null; description?: string | null; createdAt: string; tenantId: string; caseId?: string | null; userId?: string | null; case?: CaseItem }
interface EventItem { id: string; title: string; description?: string | null; startTime: string; endTime?: string | null; eventType: string; criticality: string; location?: string | null; createdAt: string; tenantId: string; caseId?: string | null; case?: CaseItem; assignments?: EventAssignment[] }
interface EventAssignment { id: string; userId: string; eventId: string; user?: UserItem }
interface Invoice { id: string; reference: string; amount: number; status: string; dueDate?: string | null; paidDate?: string | null; paidAmount?: number | null; notes?: string | null; createdAt: string; tenantId: string; clientId: string; client?: Client; caseId?: string | null; case?: CaseItem; currencyCode: string; paymentMethod?: string | null }
interface Message { id: string; content: string; isRead: boolean; createdAt: string; tenantId: string; senderId: string; receiverId: string; sender?: UserItem; receiver?: UserItem }
interface Notification { id: string; title: string; message: string; category: string; priority?: string; isRead: boolean; resourceType?: string | null; resourceId?: string | null; createdAt: string }
interface AuditLogItem { id: string; action: string; resourceType?: string | null; resourceId?: string | null; metadata?: string | null; ipAddress?: string | null; userAgent?: string | null; createdAt: string; tenantId: string; userId?: string | null; user?: UserItem }
interface UserItem { id: string; email: string; name: string; role: string; tenantId?: string | null; phone?: string | null; avatarUrl?: string | null; preferredLanguage?: string; isActive?: boolean }
interface TenantItem { id: string; name: string; slug: string; plan: string; maxUsers: number; maxStorageGb: number; isActive: boolean; createdAt: string; _count?: { users: number; clients: number; cases: number }; email?: string | null; phone?: string | null; address?: string | null }
interface TaskItem { id: string; title: string; description?: string | null; status: string; priority: string; dueDate?: string | null; completedAt?: string | null; createdAt: string; tenantId: string; caseId?: string | null; userId?: string | null; creatorId?: string | null; eventId?: string | null; user?: UserItem; creator?: UserItem; case?: { id: string; reference: string; title: string } | null; event?: { id: string; title: string } | null }
interface DashboardStats { totalCases: number; activeCases: number; totalClients: number; upcomingEvents: number; unpaidInvoices: number; totalRevenue: number; paidInvoices: number; casesByStatus: Record<string, number>; casesByType: Record<string, number>; recentActivity: AuditLogItem[]; upcomingEventsList: EventItem[]; urgencies: Array<{ id: string; reference: string; title: string; clientName: string; nextDueDate: string; daysRemaining: number }>; overdueInvoices: Array<{ id: string; reference: string; clientName: string; amount: number; currencyCode: string; daysOverdue: number }>; urgentTasks: Array<{ id: string; title: string; priority: string; status: string; dueDate: string | null; caseReference: string | null; assigneeName: string | null }>; upcomingEventsEnhanced: Array<{ id: string; title: string; startTime: string; eventType: string; criticality: string; location?: string | null; caseReference: string | null; assignments: Array<{ userId: string; userName: string }> }>; myTasks: Array<{ id: string; title: string; priority: string; status: string; dueDate: string | null; caseReference: string | null }> }
interface ConflictResult { type: string; case: { id: string; reference: string; title: string; clientName: string }; description: string }
interface CurrencyItem { id: string; code: string; name: string; symbol: string }

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30000, retry: 1 } } })

// ==================== Constants ====================
const STATUS_COLORS: Record<string, string> = { open: 'bg-blue-50 text-blue-700', in_progress: 'bg-amber-50 text-amber-700', closed: 'bg-emerald-50 text-emerald-700', pending: 'bg-orange-50 text-orange-700', resolved: 'bg-emerald-50 text-emerald-700', archived: 'bg-gray-100 text-gray-600', draft: 'bg-gray-100 text-gray-600', overdue: 'bg-rose-50 text-rose-700', unpaid: 'bg-rose-50 text-rose-700', partial: 'bg-orange-50 text-orange-700', paid: 'bg-emerald-50 text-emerald-700', cancelled: 'bg-gray-100 text-gray-600', todo: 'bg-blue-50 text-blue-700', done: 'bg-emerald-50 text-emerald-700', nouveau: 'bg-blue-50 text-blue-700', ouvert: 'bg-cyan-50 text-cyan-700', en_cours: 'bg-amber-50 text-amber-700', en_attente: 'bg-orange-50 text-orange-700', clos: 'bg-emerald-50 text-emerald-700', archive: 'bg-gray-100 text-gray-600', non_paye: 'bg-rose-50 text-rose-700', partiel: 'bg-orange-50 text-orange-700', paye: 'bg-emerald-50 text-emerald-700', annule: 'bg-gray-100 text-gray-600', a_faire: 'bg-blue-50 text-blue-700', en_cours_t: 'bg-amber-50 text-amber-700', terminee: 'bg-emerald-50 text-emerald-700', annulee: 'bg-gray-100 text-gray-600' }
const PRIORITY_COLORS: Record<string, string> = { low: 'bg-gray-100 text-gray-600', normal: 'bg-blue-50 text-blue-700', high: 'bg-orange-50 text-orange-700', urgent: 'bg-rose-50 text-rose-700', basse: 'bg-gray-100 text-gray-600', haute: 'bg-orange-50 text-orange-700', urgente: 'bg-rose-50 text-rose-700' }
const CRIT_COLORS: Record<string, string> = { low: 'bg-gray-300', normal: 'bg-amber-400', high: 'bg-orange-400', urgent: 'bg-rose-500', basse: 'bg-gray-300', haute: 'bg-orange-400', urgente: 'bg-rose-500' }
const RISK_COLORS: Record<string, string> = { faible: 'bg-emerald-50 text-emerald-700', moyen: 'bg-amber-50 text-amber-700', eleve: 'bg-rose-50 text-rose-700', low: 'bg-emerald-50 text-emerald-700', medium: 'bg-amber-50 text-amber-700', high: 'bg-rose-50 text-rose-700' }
const SK = (k: string) => t(k)
const SL = (s: string) => t(`status.${{ open: 'open', in_progress: 'inProgress', closed: 'closed', new: 'new', pending: 'waiting', resolved: 'resolved', archived: 'archived', draft: 'draft', overdue: 'overdue', unpaid: 'unpaid', partial: 'partial', paid: 'paid', cancelled: 'cancelled', todo: 'todo', done: 'done', in_progress: 'inProgress' }[s] || s}`)
const PL = (s: string) => t(`priority.${{ basse: 'low', haute: 'high', urgente: 'urgent' }[s] || s}`)
const TL = (s: string) => t(`type.${{ penal: 'criminal', administratif: 'administrative' }[s] || s}`)
const EL = (s: string) => t(`eventType.${{ audience: 'hearing', rdv: 'appointment', echeance: 'deadline', depot: 'filing', autre: 'other' }[s] || s}`)
const RL = (s: string) => t(`role.${{ root_admin: 'rootAdmin', firm_admin: 'firmAdmin' }[s] || s}`)
const BL = (s: string) => t(`billing.${{ forfait: 'flat', horaire: 'hourly', abonnement: 'subscription', success_fee: 'successFee', provision: 'retainer' }[s] || s}`)
const ML = (s: string) => t(`payment.${{ especes: 'cash', virement: 'transfer', mobile_money: 'mobileMoney', carte: 'card' }[s] || s}`)
// Label lookup objects (used as STATUS_LABELS[x] || x fallback)
const STATUS_LABELS: Record<string, string> = { open: 'Ouvert', in_progress: 'En cours', closed: 'Clôturé', pending: 'En attente', resolved: 'Résolu', archived: 'Archivé', draft: 'Brouillon', overdue: 'En retard', unpaid: 'Non payé', partial: 'Partiel', paid: 'Payé', cancelled: 'Annulé', todo: 'À faire', done: 'Terminé', nouveau: 'Nouveau', ouvert: 'Ouvert', en_cours: 'En cours', clos: 'Clôturé', archive: 'Archivé', non_paye: 'Non payé', partiel: 'Partiel', paye: 'Payé', annule: 'Annulé', a_faire: 'À faire', terminee: 'Terminé' }
const TYPE_LABELS: Record<string, string> = { civil: 'Civil', commercial: 'Commercial', penal: 'Pénal', administratif: 'Administratif', familial: 'Familial', autre: 'Autre', criminal: 'Pénal', administrative: 'Administratif' }
const PRIORITY_LABELS: Record<string, string> = { low: 'Basse', normal: 'Normal', high: 'Haute', urgent: 'Urgente', basse: 'Basse', haute: 'Haute', urgente: 'Urgente' }
const BILLING_LABELS: Record<string, string> = { forfait: 'Forfait', horaire: 'Horaire', abonnement: 'Abonnement', success_fee: 'Success fee', provision: 'Provision', flat: 'Forfait', hourly: 'Horaire', subscription: 'Abonnement' }
const EVENT_TYPE_LABELS: Record<string, string> = { audience: 'Audience', rdv: 'Rendez-vous', echeance: 'Échéance', depot: 'Dépôt', autre: 'Autre', hearing: 'Audience', appointment: 'Rendez-vous', deadline: 'Échéance', filing: 'Dépôt', other: 'Autre' }
const ROLE_LABELS: Record<string, string> = { root_admin: 'Administrateur', firm_admin: 'Admin Cabinet', associate: 'Associé', lawyer: 'Avocat', jurist: 'Juriste', assistant: 'Assistant', accountant: 'Comptable', client: 'Client' }
const ROLE_COLORS: Record<string, string> = { root_admin: 'bg-purple-50 text-purple-700', firm_admin: 'bg-blue-50 text-blue-700', associate: 'bg-indigo-50 text-indigo-700', lawyer: 'bg-[#E8F1F8] text-[#1E5A8A]', jurist: 'bg-teal-50 text-teal-700', assistant: 'bg-gray-100 text-gray-700', accountant: 'bg-amber-50 text-amber-700' }
const CHART_COLORS = ['#1E5A8A', '#C8A45D', '#059669', '#E8A838', '#8B5CF6', '#EC4899']
const CHART_COLORS_DARK = ['#60A5FA', '#FBBF24', '#34D399', '#FB923C', '#A78BFA', '#FB7185']

const NAV_SECTIONS = [
  { label: 'nav.sections.navigation', items: [
    { view: 'dashboard' as ViewName, label: 'nav.dashboard', icon: LayoutDashboard },
    { view: 'cases' as ViewName, label: 'nav.cases', icon: Briefcase },
    { view: 'clients' as ViewName, label: 'nav.clients', icon: Users },
    { view: 'tasks' as ViewName, label: 'nav.tasks', icon: ClipboardList },
    { view: 'documents' as ViewName, label: 'nav.documents', icon: FileText },
    { view: 'calendar' as ViewName, label: 'nav.calendar', icon: Calendar },
  ]},
  { label: 'nav.sections.tools', items: [
    { view: 'invoices' as ViewName, label: 'nav.invoices', icon: Receipt },
    { view: 'messages' as ViewName, label: 'nav.messages', icon: MessageSquare },
    { view: 'reports' as ViewName, label: 'nav.reports', icon: BarChart3 },
  ]},
  { label: 'nav.sections.administration', items: [
    { view: 'audit-logs' as ViewName, label: 'nav.auditLogs', icon: Shield, adminOnly: true },
    { view: 'settings' as ViewName, label: 'nav.settings', icon: Settings },
  ]},
]
const NAV_ITEMS = NAV_SECTIONS.flatMap(s => s.items)

// ==================== Helpers ====================
function getDateLocale() { const m: Record<string, any> = { fr, en: enUS, es, de, it }; return m[useLocaleStore.getState().locale] || fr }
function fmtDate(d: string | null | undefined) { if (!d) return t('common.none'); try { return format(parseISO(d), 'dd/MM/yyyy', { locale: getDateLocale() }) } catch { return t('common.none') } }
function fmtDateTime(d: string | null | undefined) { if (!d) return t('common.none'); try { return format(parseISO(d), 'dd/MM/yyyy HH:mm', { locale: getDateLocale() }) } catch { return t('common.none') } }
function fmtMoney(amount: number, code: string = 'XAF') { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: code, minimumFractionDigits: 0 }).format(amount) }
function fmtFileSize(bytes: number) { if (bytes < 1024) return bytes + ' o'; if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' Ko'; return (bytes / 1048576).toFixed(1) + ' Mo' }
function initials(name: string) { return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) }
function avatarGrad(id: string) { let h = 0; for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h); return `avatar-grad-${Math.abs(h) % 8}` }
function taskStatusColor(s: string) { return STATUS_COLORS[s] || '' }
function taskStatusLabel(s: string) { return SL(s) }

// ==================== Theme Toggle ====================
function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (<TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant='ghost' size='icon' className='text-muted-foreground' onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><Sun className='size-[18px] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0' /><Moon className='absolute size-[18px] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100' /><span className='sr-only'>{t('theme.toggle')}</span></Button></TooltipTrigger><TooltipContent>{t('theme.toggle')}</TooltipContent></Tooltip></TooltipProvider>)
}

function LanguageSwitcher() {
  const { locale, setLocale } = useLocale()
  return (<DropdownMenu><DropdownMenuTrigger asChild><Button variant='ghost' size='sm' className='text-muted-foreground gap-1.5 text-xs font-medium'><span>{LOCALE_FLAGS[locale]}</span><span className='hidden sm:inline'>{LOCALE_NAMES[locale]}</span></Button></DropdownMenuTrigger><DropdownMenuContent align='end' className='w-44'>{(Object.entries(LOCALE_NAMES) as [Locale, string][]).map(([code, name]) => (<DropdownMenuItem key={code} onClick={() => setLocale(code)} className={cn('gap-2 text-sm', locale === code && 'bg-muted font-semibold')}><span>{LOCALE_FLAGS[code]}</span><span>{name}</span></DropdownMenuItem>))}</DropdownMenuContent></DropdownMenu>)
}

// ==================== Empty State ====================
function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description?: string }) {
  return (<div className="flex flex-col items-center justify-center py-16 px-4"><div className="size-14 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4"><Icon className="size-7 text-gray-400" /></div><h3 className="text-sm font-semibold text-foreground">{title}</h3>{description && <p className="text-sm text-muted-foreground mt-1 text-center max-w-sm">{description}</p>}</div>)
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
    <div className="min-h-screen flex items-center justify-center login-pattern p-4">
      <div className="w-full max-w-md animate-fade-in">
        <Card className="shadow-xl border-border rounded-2xl overflow-hidden">
          <div className="bg-[#1E5A8A] px-8 pt-8 pb-6 text-center">
            <div className="mx-auto mb-3 size-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20"><Scale className="size-7 text-white" /></div>
            <div className="mb-1"><span className="text-2xl font-bold tracking-tight text-white">Juris</span><span className="text-2xl font-bold tracking-tight text-[#F5EFE0]">Link</span></div>
            <p className="text-sm text-blue-100/80">Le système d'exploitation de votre cabinet</p>
          </div>
          <CardContent className="pt-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="email" className="text-xs font-medium">Adresse e-mail</Label><Input id="email" type="email" placeholder="email@jurislink.com" value={email} onChange={e => setEmail(e.target.value)} className="h-11 rounded-lg bg-muted/50" /></div>
              <div className="space-y-2"><Label htmlFor="password" className="text-xs font-medium">Mot de passe</Label><Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="h-11 rounded-lg bg-muted/50" /></div>
              <Button type="submit" className="w-full h-11 bg-[#1E5A8A] hover:bg-[#144570] text-white rounded-lg font-medium shadow-md shadow-[#1E5A8A]/20 transition-all" disabled={loading}>{loading ? <RefreshCw className="size-4 animate-spin" /> : 'Se connecter'}</Button>
            </form>
          </CardContent>
          <CardFooter className="flex-col gap-1.5 pb-6 bg-muted/30"><p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Accès démo</p><p className="text-xs text-muted-foreground font-mono bg-card border border-border px-3 py-1.5 rounded-md">pod126@yahoo.fr / votre mot de passe</p></CardFooter>
        </Card>
        <p className="text-center text-xs text-muted-foreground mt-6">© 2025 JurisLink — Tous droits réservés</p>
      </div>
    </div>
  )
}

// ==================== Sidebar ====================
function Sidebar() {
  const { currentView, setCurrentView, user, sidebarOpen, setSidebarOpen } = useAppStore()
  const isAdmin = user?.role === 'firm_admin' || user?.role === 'root_admin' || user?.role === 'associate'
  const navContent = (
    <div className="py-4 px-3">
      {NAV_SECTIONS.map(section => (
        <div key={t(section.label)} className="mb-4">
          <p className="section-label mb-1">{t(section.label)}</p>
          <nav className="space-y-0.5">
            {section.items.filter(item => !item.adminOnly || isAdmin).map(item => {
              const Icon = item.icon; const active = currentView === item.view
              return (
                <button key={item.view} onClick={() => { setCurrentView(item.view); setSidebarOpen(false) }}
                  className={cn('nav-item', active && 'active')}>
                  <Icon className="size-[20px] shrink-0" /><span className="whitespace-nowrap">{t(item.label)}</span>
                </button>
              )
            })}
          </nav>
        </div>
      ))}
    </div>
  )
  return (<>
    <aside className="hidden lg:flex fixed top-0 left-0 z-40 h-full bg-[#F9FAFB] dark:bg-card border-r border-border flex-col w-[260px]">
      <div className="flex items-center gap-3 px-6 h-16 border-b border-border shrink-0">
        <div className="size-8 rounded-lg bg-[#1E5A8A] flex items-center justify-center shrink-0"><Scale className="size-4 text-white" /></div>
        <span className="text-lg font-bold tracking-tight whitespace-nowrap"><span className="text-foreground">Juris</span><span className="text-[#1E5A8A]">Link</span></span>
      </div>
      <ScrollArea className="flex-1 custom-scrollbar">{navContent}</ScrollArea>
      <div className="p-4 border-t border-border"><div className="flex items-center gap-3"><Avatar className="size-8 shrink-0"><AvatarFallback className={cn('text-white text-xs', avatarGrad(user?.id || '0'))}>{user?.name ? initials(user.name) : 'U'}</AvatarFallback></Avatar><div className="min-w-0"><p className="text-sm font-medium truncate text-foreground">{user?.name}</p><p className="text-xs text-muted-foreground truncate"><Badge variant="outline" className={cn('text-[10px]', ROLE_COLORS[user?.role || ''] || 'text-muted-foreground')}>{ROLE_LABELS[user?.role || ''] || user?.role}</Badge></p></div></div></div>
    </aside>
    <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}><SheetContent side="left" className="w-[280px] p-0 bg-[#F9FAFB] dark:bg-card border-border">
      <div className="flex items-center gap-3 px-4 h-16 border-b border-border shrink-0"><div className="size-8 rounded-lg bg-[#1E5A8A] flex items-center justify-center shrink-0"><Scale className="size-4 text-white" /></div><span className="text-lg font-bold tracking-tight whitespace-nowrap"><span className="text-foreground">Juris</span><span className="text-[#1E5A8A]">Link</span></span><Button variant="ghost" size="icon" className="ml-auto text-muted-foreground" onClick={() => setSidebarOpen(false)}><X className="size-5" /></Button></div>
      <ScrollArea className="flex-1 custom-scrollbar">{navContent}</ScrollArea>
    </SheetContent></Sheet>
  </>)
}

// ==================== Header ====================
function Header() {
  const { currentView, user, logout, setCurrentView } = useAppStore()
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<{type:string;label:string;sub:string;view:ViewName;id:string}[]>([])
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
      const results: {type:string;label:string;sub:string;view:ViewName;id:string}[] = []
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
    <header className="sticky top-0 z-30 bg-white dark:bg-card border-b border-border">
      <div className="flex items-center gap-4 h-16 px-4 lg:px-6">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => useAppStore.getState().toggleSidebar()}><Menu className="size-5" /></Button>
        <h1 className="text-xl font-bold text-foreground hidden sm:block">{viewLabel}</h1>
        <div className="relative flex-1 max-w-sm ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." className="pl-9 h-9 bg-muted border-transparent rounded-full text-sm" value={search} onChange={e => handleSearchChange(e.target.value)} onFocus={() => search && setSearchOpen(true)} />
          {searchOpen && searchResults.length > 0 && (
            <div className="absolute top-full mt-1 w-full bg-card rounded-xl border border-border shadow-lg z-50 max-h-80 overflow-y-auto">
              {searchResults.map((r, i) => (
                <button key={i} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted text-left transition-colors" onMouseDown={e => { e.preventDefault(); setSearchOpen(false); setCurrentView(r.view); setSearch('') }}>
                  <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0">{r.type === 'Dossier' ? <Briefcase className="size-4 text-[#1E5A8A]" /> : r.type === 'Client' ? <Users className="size-4 text-emerald-600" /> : r.type === 'Facture' ? <Receipt className="size-4 text-rose-600" /> : <ClipboardList className="size-4 text-amber-600" />}</div>
                  <div className="min-w-0"><p className="text-sm font-medium truncate">{r.label}</p><p className="text-xs text-muted-foreground truncate">{r.type} — {r.sub}</p></div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="relative" onClick={() => setCurrentView('messages')}><MessageSquare className="size-[18px]" />{msgCount ? <span className="absolute top-1 right-1 size-2 rounded-full bg-[#1E5A8A]" /> : null}</Button></TooltipTrigger><TooltipContent>Messages</TooltipContent></Tooltip></TooltipProvider>
          <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="relative"><Bell className="size-[18px]" />{unreadCount ? <span className="absolute top-1 right-1 size-2 rounded-full bg-rose-500" /> : null}</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto"><DropdownMenuLabel>Notifications ({unreadCount})</DropdownMenuLabel><DropdownMenuSeparator />{(notifs?.notifications || []).slice(0, 8).map((n: Notification) => (<DropdownMenuItem key={n.id} className="flex flex-col items-start gap-1 p-3 cursor-pointer" onClick={() => { const vmap: Record<string, ViewName> = { dossier: 'cases', echeance: 'calendar', facture: 'invoices', document: 'documents', tache: 'tasks', message: 'messages' }; setCurrentView(vmap[n.category] || 'dashboard'); setNotifOpen(false) }}><p className={cn('text-sm font-medium', !n.isRead && 'text-foreground')}>{n.title}</p><p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p></DropdownMenuItem>))}</DropdownMenuContent></DropdownMenu>
          <ThemeToggle />
          <LanguageSwitcher />
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><LogOut className="size-[18px] text-muted-foreground" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={logout} className="text-rose-600 cursor-pointer"><LogOut className="size-4 mr-2" />{t('settings.logout')}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
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

  if (isLoading) return (<div className="p-6"><Skeleton className="h-8 w-48 mb-6" /><div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div><div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6"><Skeleton className="h-72" /><Skeleton className="h-72" /></div></div>)
  if (!stats) return null

  const urgencyCount = (stats.urgencies?.length || 0) + (stats.overdueInvoices?.length || 0)
  const totalPending = (stats.overdueInvoices || []).reduce((s, i) => s + i.amount, 0)
  const statusChartData = Object.entries(stats.casesByStatus).map(([name, value]) => ({ name: STATUS_LABELS[name] || name, value })).filter(d => d.value > 0)
  const typeChartData = Object.entries(stats.casesByType).map(([name, value]) => ({ name: TYPE_LABELS[name] || name, value })).filter(d => d.value > 0)
  const colors = theme === 'dark' ? CHART_COLORS_DARK : CHART_COLORS
  const maxCases = Math.max(...Object.values(stats.casesByStatus), 1)

  const kpis = [
    { label: 'Total dossiers', value: stats.totalCases, icon: Briefcase, bg: 'bg-[#E8F1F8]', iconColor: 'text-[#1E5A8A]', pct: stats.totalCases > 0 ? 100 : 0 },
    { label: 'Dossiers actifs', value: stats.activeCases, icon: Activity, bg: 'bg-[#F5EFE0]', iconColor: 'text-[#C8A45D]', pct: stats.totalCases > 0 ? (stats.activeCases / stats.totalCases) * 100 : 0 },
    { label: 'Nouveaux clients', value: stats.totalClients, icon: Users, bg: 'bg-emerald-50', iconColor: 'text-emerald-600', pct: 80 },
    { label: 'Événements à venir', value: stats.upcomingEvents, icon: Clock, bg: 'bg-orange-50', iconColor: 'text-orange-600', pct: 60 },
    { label: 'Impayés', value: stats.unpaidInvoices, icon: AlertCircle, bg: 'bg-rose-50', iconColor: 'text-rose-600', pct: stats.totalCases > 0 ? (stats.unpaidInvoices / stats.totalCases) * 100 : 0 },
  ]

  const barData = statusChartData.map(d => ({ ...d, fill: d.name === 'En cours' ? (theme === 'dark' ? '#60A5FA' : '#1E5A8A') : (theme === 'dark' ? '#334155' : '#E8F1F8') }))

  return (
    <div className="p-6 space-y-6 view-enter">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-foreground">{greeting}, {user?.name?.split(' ').slice(-1)}</h2><p className="text-sm text-muted-foreground mt-0.5">{format(now, 'EEEE d MMMM yyyy', { locale: getDateLocale() })}</p></div>
        <div className="flex gap-2 sm:flex hidden"><Button onClick={() => setCurrentView('cases')} className="bg-[#1E5A8A] hover:bg-[#144570] text-white rounded-lg shadow-sm"><Plus className="size-4 mr-1.5" />Nouveau dossier</Button><Button onClick={() => setCurrentView('tasks')} variant="outline" className="rounded-lg shadow-sm"><ClipboardList className="size-4 mr-1.5" />Nouvelle tâche</Button></div>
      </div>

      {/* KPI Card */}
      <Card className="border-border rounded-xl shadow-sm">
        <CardHeader className="pb-4"><div className="flex items-center justify-between"><CardTitle className="text-base font-semibold">Aperçu des dossiers</CardTitle></div></CardHeader>
        <CardContent className="pt-0 pb-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {kpis.map(kpi => { const Icon = kpi.icon; return (
              <div key={kpi.label} className="kpi-card rounded-lg border border-border p-4">
                <div className="flex items-center justify-between mb-3"><div className={cn('size-10 rounded-lg flex items-center justify-center', kpi.bg)}><Icon className={cn('size-5', kpi.iconColor)} /></div><span className={cn('text-xs font-medium px-1.5 py-0.5 rounded', kpi.bg, kpi.iconColor)}>{kpi.pct > 0 ? `${Math.round(kpi.pct)}%` : ''}</span></div>
                <p className="text-xs font-medium text-muted-foreground mb-0.5">{kpi.label}</p>
                <p className="text-2xl font-bold text-foreground">{typeof kpi.value === 'number' ? kpi.value.toLocaleString('fr-FR') : kpi.value}</p>
                <div className="progress-bar mt-2"><div className="progress-bar-fill" style={{ width: `${Math.min(kpi.pct, 100)}%` }} /></div>
              </div>
            )})}
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut */}
        <Card className="border-border rounded-xl shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Dossiers par domaine</CardTitle></CardHeader>
          <CardContent>
            {typeChartData.length === 0 ? <div className="flex items-center justify-center h-48"><p className="text-sm text-muted-foreground">0 Dossiers</p></div> : (
              <div className="flex items-center gap-6">
                <div className="relative w-44 h-44 shrink-0">
                  <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={typeChartData} cx="50%" cy="50%" innerRadius={52} outerRadius={78} dataKey="value" stroke="none" paddingAngle={2}>{typeChartData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}</Pie></PieChart></ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-bold text-foreground">{stats.totalCases}</span><span className="text-xs text-muted-foreground">Dossiers</span></div>
                </div>
                <div className="space-y-2 flex-1">{typeChartData.map((d, i) => (<div key={d.name} className="flex items-center gap-2"><span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: colors[i % colors.length] }} /><span className="text-sm text-foreground">{d.name}</span><span className="text-sm font-semibold text-foreground ml-auto">{d.value}</span></div>))}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bar */}
        <Card className="border-border rounded-xl shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Dossiers par statut</CardTitle></CardHeader>
          <CardContent>
            {barData.length === 0 ? <div className="flex items-center justify-center h-48"><p className="text-sm text-muted-foreground">Aucune donnée</p></div> : (
              <ResponsiveContainer width="100%" height={192}><BarChart data={barData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}><XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} /><YAxis hide /><Bar dataKey="value" radius={[6, 6, 0, 0]}>{barData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}</Bar><RTooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '12px' }} /></BarChart></ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Urgencies + Events */}
      {(urgencyCount > 0 || (stats.urgentTasks?.length || 0) > 0 || (stats.upcomingEventsEnhanced?.length || 0) > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {(urgencyCount > 0 || (stats.urgentTasks?.length || 0) > 0) && (
            <Card className="border-border rounded-xl shadow-sm border-l-4 border-l-rose-500">
              <CardHeader className="pb-3"><CardTitle className="text-base font-semibold flex items-center gap-2 text-rose-700"><AlertOctagon className="size-4" />Urgences</CardTitle></CardHeader>
              <CardContent className="pt-0"><div className="space-y-2 max-h-64 overflow-y-auto">
                {stats.urgencies?.map(u => (<div key={u.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 cursor-pointer hover:bg-rose-50 transition-colors" onClick={() => setCurrentView('cases')}><Gavel className="size-4 text-rose-500 mt-0.5 shrink-0" /><div className="min-w-0"><p className="text-sm font-medium">{u.reference} — {u.title}</p><p className="text-xs text-muted-foreground">{u.clientName} • <span className="font-semibold text-rose-600">{u.daysRemaining <= 0 ? "Aujourd'hui !" : `Dans ${u.daysRemaining}j`}</span></p></div></div>))}
                {stats.overdueInvoices?.map(inv => (<div key={inv.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-orange-50/50 cursor-pointer hover:bg-orange-50 transition-colors" onClick={() => setCurrentView('invoices')}><AlertTriangle className="size-4 text-orange-500 mt-0.5 shrink-0" /><div className="min-w-0"><p className="text-sm font-medium">{inv.reference} — {inv.clientName}</p><p className="text-xs text-muted-foreground">{fmtMoney(inv.amount, inv.currencyCode)} • <span className="font-semibold text-orange-600">{inv.daysOverdue}j retard</span></p></div></div>))}
                {stats.urgentTasks?.slice(0, 3).map(t => (<div key={t.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-amber-50/50 cursor-pointer hover:bg-amber-50 transition-colors" onClick={() => setCurrentView('tasks')}><Timer className="size-4 text-amber-500 mt-0.5 shrink-0" /><div className="min-w-0"><p className="text-sm font-medium">{t.title}</p><p className="text-xs text-muted-foreground">{t.assigneeName ? `→ ${t.assigneeName}` : ''} {t.caseReference ? `• ${t.caseReference}` : ''}</p></div></div>))}
              </div></CardContent>
            </Card>
          )}
          <Card className="border-border rounded-xl shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base font-semibold flex items-center gap-2"><Calendar className="size-4 text-[#1E5A8A]" />Prochains événements</CardTitle></CardHeader>
            <CardContent className="pt-0"><div className="space-y-2 max-h-64 overflow-y-auto">
              {(stats.upcomingEventsEnhanced || []).length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Aucun événement</p> : (stats.upcomingEventsEnhanced || []).map(e => (<div key={e.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted cursor-pointer transition-colors" onClick={() => setCurrentView('calendar')}><span className={cn('w-1 h-8 rounded-full shrink-0', CRIT_COLORS[e.criticality] || CRIT_COLORS.normal)} /><div className="min-w-0 flex-1"><p className="text-sm font-medium">{e.title}</p><p className="text-xs text-muted-foreground">{fmtDateTime(e.startTime)}{e.location ? ` • ${e.location}` : ''}</p></div><Badge variant="outline" className="text-[10px] shrink-0">{EVENT_TYPE_LABELS[e.eventType] || e.eventType}</Badge></div>))}
            </div></CardContent>
          </Card>
        </div>
      )}

      {/* My Tasks + Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border rounded-xl shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base font-semibold flex items-center gap-2"><ClipboardList className="size-4 text-[#1E5A8A]" />Mes tâches</CardTitle></CardHeader>
          <CardContent className="pt-0"><div className="space-y-2 max-h-64 overflow-y-auto">{(stats.myTasks || []).length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Aucune tâche</p> : (stats.myTasks || []).map(t => (<div key={t.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted cursor-pointer transition-colors" onClick={() => setCurrentView('tasks')}><span className={cn('size-2 rounded-full shrink-0', (t.priority === 'urgent' || t.priority === 'urgente') ? 'bg-rose-500 pulse-dot' : (t.priority === 'high' || t.priority === 'haute') ? 'bg-orange-500' : 'bg-[#1E5A8A]')} /><div className="min-w-0 flex-1"><p className="text-sm font-medium">{t.title}</p><p className="text-xs text-muted-foreground">{t.caseReference ? `${t.caseReference} — ` : ''}{t.dueDate ? `Échéance: ${fmtDate(t.dueDate)}` : ''}</p></div></div>))}</div></CardContent>
        </Card>
        <Card className="border-border rounded-xl shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Résumé financier</CardTitle></CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div><p className="text-xs text-muted-foreground mb-1">Revenus totaux</p><p className="text-lg font-bold text-foreground">{fmtMoney(stats.totalRevenue)}</p></div>
            <div><p className="text-xs text-muted-foreground mb-1">Honoraires en attente</p><p className="text-lg font-bold text-orange-600">{fmtMoney(totalPending)}</p></div>
            <div><p className="text-xs text-muted-foreground mb-1">Factures payées</p><p className="text-lg font-bold text-emerald-600">{stats.paidInvoices}</p></div>
            <Separator />
            <Button variant="outline" className="w-full text-sm" onClick={() => setCurrentView('invoices')}>Voir les factures <ArrowUpRight className="size-3.5 ml-1" /></Button>
          </CardContent>
        </Card>
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

  const { data: tasksData, isLoading } = useQuery({ queryKey: ['tasks', user?.tenantId, statusFilter, priorityFilter], queryFn: () => { const p = new URLSearchParams(); if (user?.tenantId) p.set('tenantId', user.tenantId); if (statusFilter !== 'all') p.set('status', statusFilter); if (priorityFilter !== 'all') p.set('priority', priorityFilter); return fetch(`/api/tasks?${p}`).then(r => r.json()).then(d => d.tasks || d) } })
  const { data: users } = useQuery({ queryKey: ['users', user?.tenantId], queryFn: () => fetch(`/api/users?tenantId=${user?.tenantId}`).then(r => r.json()) })
  const { data: cases } = useQuery({ queryKey: ['cases-mini', user?.tenantId], queryFn: () => fetch(`/api/cases?tenantId=${user?.tenantId}`).then(r => r.json()) })

  const createMut = useMutation({ mutationFn: (body: Record<string, unknown>) => fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, tenantId: user?.tenantId, creatorId: user?.id }) }).then(r => r.json()), onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); toast.success('Tâche créée'); setDialogOpen(false); resetForm() }, onError: () => toast.error('Erreur') })
  const updateMut = useMutation({ mutationFn: ({ id, ...body }: Record<string, unknown>) => fetch(`/api/tasks/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()), onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); toast.success('Tâche mise à jour') }, onError: () => toast.error('Erreur') })
  const deleteMut = useMutation({ mutationFn: (id: string) => fetch(`/api/tasks/${id}`, { method: 'DELETE' }).then(r => r.json()), onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); toast.success('Tâche supprimée') }, onError: () => toast.error('Erreur') })

  const resetForm = () => { setForm({ title: '', description: '', priority: 'normal', dueDate: '', userId: '', caseId: '' }); setEditing(null) }
  const openEdit = (t: TaskItem) => { setEditing(t); setForm({ title: t.title, description: t.description || '', priority: t.priority, dueDate: t.dueDate?.slice(0, 10) || '', userId: t.userId || '', caseId: t.caseId || '' }); setDialogOpen(true) }
  const handleSubmit = () => { if (!form.title.trim()) return; const body = { title: form.title, description: form.description || null, priority: form.priority, dueDate: form.dueDate || null, userId: form.userId || null, caseId: form.caseId || null }; if (editing) { updateMut.mutate({ id: editing.id, ...body }) } else { createMut.mutate(body) } }
  const toggleStatus = (t: TaskItem) => { updateMut.mutate({ id: t.id, status: t.status === 'terminee' ? 'a_faire' : 'terminee' }) }
  const tasks: TaskItem[] = tasksData || []

  return (
    <div className="p-6 space-y-6 view-enter">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h2 className="text-xl font-bold text-foreground">Tâches</h2><p className="text-sm text-muted-foreground">Gérez les tâches de votre cabinet</p></div>
        <Button onClick={() => { resetForm(); setDialogOpen(true) }} className="bg-[#1E5A8A] hover:bg-[#144570] text-white rounded-lg"><Plus className="size-4 mr-1.5" />Nouvelle tâche</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder="Statut" /></SelectTrigger><SelectContent><SelectItem value="all">Tous</SelectItem><SelectItem value="a_faire">À faire</SelectItem><SelectItem value="en_cours">En cours</SelectItem><SelectItem value="terminee">Terminée</SelectItem></SelectContent></Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}><SelectTrigger className="w-[150px] h-9 text-sm"><SelectValue placeholder="Priorité" /></SelectTrigger><SelectContent><SelectItem value="all">Tous</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="haute">Haute</SelectItem><SelectItem value="urgente">Urgente</SelectItem></SelectContent></Select>
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Skeleton className="h-6 w-48" /></div> :
        tasks.length === 0 ? <EmptyState icon={ClipboardList} title="Aucune tâche" description="Créez votre première tâche" /> :
        <Card className="border-border rounded-xl shadow-sm"><CardContent className="p-0"><div className="max-h-[500px] overflow-y-auto"><Table><TableHeader><TableRow><TableHead className="w-10"></TableHead><TableHead>Titre</TableHead><TableHead className="hidden md:table-cell">Priorité</TableHead><TableHead className="hidden sm:table-cell">Statut</TableHead><TableHead className="hidden lg:table-cell">Assigné</TableHead><TableHead className="hidden lg:table-cell">Dossier</TableHead><TableHead className="hidden md:table-cell">Échéance</TableHead><TableHead className="w-24">Actions</TableHead></TableRow></TableHeader><TableBody>{tasks.map(t => (<TableRow key={t.id} className={cn(t.status === 'terminee' && 'opacity-50')}><TableCell><Checkbox checked={t.status === 'terminee'} onCheckedChange={() => toggleStatus(t)} /></TableCell><TableCell className="font-medium"><span className={cn(t.status === 'terminee' && 'line-through')}>{t.title}</span></TableCell><TableCell className="hidden md:table-cell"><Badge variant="outline" className={cn('text-[10px]', PRIORITY_COLORS[t.priority])}>{PRIORITY_LABELS[t.priority] || t.priority}</Badge></TableCell><TableCell className="hidden sm:table-cell"><Badge variant="outline" className={cn('text-[10px]', taskStatusColor(t.status))}>{taskStatusLabel(t.status)}</Badge></TableCell><TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{t.user?.name || '—'}</TableCell><TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{t.case?.reference || '—'}</TableCell><TableCell className="hidden md:table-cell text-sm text-muted-foreground">{fmtDate(t.dueDate)}</TableCell><TableCell><div className="flex gap-1"><Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(t)}><Edit className="size-3.5" /></Button><Button variant="ghost" size="icon" className="size-7 text-rose-500 hover:text-rose-700" onClick={() => deleteMut.mutate(t.id)}><Trash2 className="size-3.5" /></Button></div></TableCell></TableRow>))}</TableBody></Table></div></CardContent></Card>}
      <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) resetForm() }}><DialogContent className="max-w-md rounded-xl"><DialogHeader><DialogTitle>{editing ? 'Modifier la tâche' : 'Nouvelle tâche'}</DialogTitle></DialogHeader><div className="space-y-3"><div><Label>Titre *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Titre de la tâche" /></div><div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div><div className="grid grid-cols-2 gap-3"><div><Label>Priorité</Label><Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="basse">Basse</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="haute">Haute</SelectItem><SelectItem value="urgente">Urgente</SelectItem></SelectContent></Select></div><div><Label>Échéance</Label><Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} /></div></div><div className="grid grid-cols-2 gap-3"><div><Label>Assigné à</Label><Select value={form.userId} onValueChange={v => setForm(f => ({ ...f, userId: v }))}><SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger><SelectContent>{(users || []).map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Dossier</Label><Select value={form.caseId} onValueChange={v => setForm(f => ({ ...f, caseId: v }))}><SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger><SelectContent>{(cases || []).map(c => <SelectItem key={c.id} value={c.id}>{c.reference} — {c.title}</SelectItem>)}</SelectContent></Select></div></div></div><DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button><Button onClick={handleSubmit} className="bg-[#1E5A8A] hover:bg-[#144570]" disabled={!form.title.trim() || createMut.isPending || updateMut.isPending}>{editing ? 'Enregistrer' : 'Créer'}</Button></DialogFooter></DialogContent></Dialog>
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

  const { data: cases, isLoading } = useQuery({ queryKey: ['cases', user?.tenantId, statusFilter, typeFilter, priorityFilter, search], queryFn: () => { const p = new URLSearchParams(); if (user?.tenantId) p.set('tenantId', user.tenantId); if (statusFilter !== 'all') p.set('status', statusFilter); if (typeFilter !== 'all') p.set('type', typeFilter); if (priorityFilter !== 'all') p.set('priority', priorityFilter); if (search) p.set('search', search); return fetch(`/api/cases?${p}`).then(r => r.json()) } })
  const { data: clients } = useQuery({ queryKey: ['clients-mini', user?.tenantId], queryFn: () => fetch(`/api/clients?tenantId=${user?.tenantId}`).then(r => r.json()) })
  const { data: caseDetail } = useQuery({ queryKey: ['case-detail', selectedCase?.id], queryFn: () => fetch(`/api/cases/${selectedCase!.id}`).then(r => r.json()), enabled: !!selectedCase?.id && detailOpen })

  const createMut = useMutation({ mutationFn: async (body: Record<string, unknown>) => { if (body.adversary && body.clientId) { try { const cr = await fetch('/api/conflicts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: user?.tenantId, clientId: body.clientId, adversary: body.adversary }) }).then(r => r.json()); if (cr.conflicts?.length > 0) setConflicts(cr.conflicts) } catch {} } return fetch('/api/cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()) }, onSuccess: () => { qc.invalidateQueries({ queryKey: ['cases'] }); toast.success('Dossier créé'); setDialogOpen(false); resetForm() }, onError: () => toast.error('Erreur') })
  const updateMut = useMutation({ mutationFn: ({ id, ...body }: Record<string, unknown>) => fetch(`/api/cases/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()), onSuccess: () => { qc.invalidateQueries({ queryKey: ['cases'] }); qc.invalidateQueries({ queryKey: ['case-detail'] }); toast.success('Dossier mis à jour') }, onError: () => toast.error('Erreur') })

  const resetForm = () => { setForm({ title: '', description: '', type: 'civil', status: 'nouveau', priority: 'normal', clientId: '', reference: '', nextDueDate: '', adversary: '', jurisdiction: '', amountInDispute: '', billingType: '' }); setEditing(null); setConflicts([]) }
  const openEdit = (c: CaseItem) => { setEditing(c); setForm({ title: c.title, description: c.description || '', type: c.type, status: c.status, priority: c.priority, clientId: c.clientId, reference: c.reference, nextDueDate: c.nextDueDate?.slice(0, 10) || '', adversary: c.adversary || '', jurisdiction: c.jurisdiction || '', amountInDispute: c.amountInDispute?.toString() || '', billingType: c.billingType || '' }); setDialogOpen(true) }
  const handleSubmit = () => { if (!form.title.trim() || !form.clientId) return; const payload = { title: form.title, description: form.description || null, type: form.type, status: form.status, priority: form.priority, clientId: form.clientId, reference: form.reference, nextDueDate: form.nextDueDate || null, tenantId: user?.tenantId, adversary: form.adversary || null, jurisdiction: form.jurisdiction || null, amountInDispute: form.amountInDispute ? parseFloat(form.amountInDispute) : null, billingType: form.billingType || null }; if (editing) { updateMut.mutate({ id: editing.id, ...payload }) } else { createMut.mutate(payload) } }

  const timeline = useMemo(() => { if (!caseDetail) return []; const items: Array<{date:string;type:string;icon:React.ElementType;title:string;description:string}> = []; for (const e of (caseDetail.events || [])) items.push({ date: e.startTime, type: 'event', icon: Calendar, title: e.title, description: e.description || '' }); for (const n of (caseDetail.notes || [])) items.push({ date: n.createdAt, type: 'note', icon: FileText, title: 'Note', description: n.content }); for (const d of (caseDetail.documents || [])) items.push({ date: d.createdAt, type: 'doc', icon: FileCheck, title: d.name, description: `${d.fileType} • ${fmtFileSize(d.fileSize)}` }); return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) }, [caseDetail])
  const getClientName = (c: CaseItem) => c.client ? `${c.client.firstName} ${c.client.lastName}` : '—'

  return (
    <div className="p-6 space-y-6 view-enter">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h2 className="text-xl font-bold text-foreground">Dossiers</h2><p className="text-sm text-muted-foreground">Gérez les dossiers de votre cabinet</p></div>
        <Button onClick={() => { resetForm(); setDialogOpen(true) }} className="bg-[#1E5A8A] hover:bg-[#144570] text-white rounded-lg"><Plus className="size-4 mr-1.5" />Nouveau dossier</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" /></div>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue placeholder="Statut" /></SelectTrigger><SelectContent><SelectItem value="all">Tous</SelectItem><SelectItem value="nouveau">Nouveau</SelectItem><SelectItem value="ouvert">Ouvert</SelectItem><SelectItem value="en_cours">En cours</SelectItem><SelectItem value="en_attente">En attente</SelectItem><SelectItem value="clos">Clos</SelectItem></SelectContent></Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue placeholder="Type" /></SelectTrigger><SelectContent><SelectItem value="all">Tous</SelectItem><SelectItem value="civil">Civil</SelectItem><SelectItem value="penal">Pénal</SelectItem><SelectItem value="commercial">Commercial</SelectItem><SelectItem value="social">Social</SelectItem><SelectItem value="administratif">Administratif</SelectItem></SelectContent></Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}><SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue placeholder="Priorité" /></SelectTrigger><SelectContent><SelectItem value="all">Tous</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="haute">Haute</SelectItem><SelectItem value="urgente">Urgente</SelectItem></SelectContent></Select>
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Skeleton className="h-6 w-48" /></div> :
        (cases || []).length === 0 ? <EmptyState icon={Briefcase} title="Aucun dossier" description="Créez votre premier dossier" /> :
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto">
          {(cases || []).map(c => (
            <Card key={c.id} className="border-border rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => { setSelectedCase(c); setDetailOpen(true) }}>
              <CardHeader className="pb-2"><div className="flex items-start justify-between"><CardTitle className="text-sm font-semibold">{c.reference}</CardTitle><Badge variant="outline" className={cn('text-[10px]', STATUS_COLORS[c.status])}>{STATUS_LABELS[c.status] || c.status}</Badge></div><CardDescription className="text-xs mt-1 line-clamp-2">{c.title}</CardDescription></CardHeader>
              <CardContent className="p-4 pt-0 space-y-1"><p className="text-xs text-muted-foreground">{getClientName(c)}</p><div className="flex items-center gap-2 mt-2"><Badge variant="outline" className="text-[10px]">{TYPE_LABELS[c.type] || c.type}</Badge>{c.isSecret && <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-600">Secret</Badge>}</div></CardContent>
            </Card>
          ))}
        </div>}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}><DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl"><DialogHeader><DialogTitle>{selectedCase?.reference} — {selectedCase?.title}</DialogTitle></DialogHeader>
      {selectedCase && <Tabs defaultValue="resume"><TabsList className="w-full"><TabsTrigger value="resume">Résumé</TabsTrigger><TabsTrigger value="chrono">Chronologie</TabsTrigger><TabsTrigger value="notes">Notes</TabsTrigger><TabsTrigger value="docs">Documents</TabsTrigger></TabsList>
        <TabsContent value="resume" className="mt-4 space-y-3"><div className="grid grid-cols-2 gap-3 text-sm"><div><span className="text-muted-foreground">Client :</span> <span className="font-medium">{getClientName(selectedCase)}</span></div><div><span className="text-muted-foreground">Type :</span> <span className="font-medium">{TYPE_LABELS[selectedCase.type]}</span></div><div><span className="text-muted-foreground">Statut :</span> <Badge variant="outline" className={cn('ml-1', STATUS_COLORS[selectedCase.status])}>{STATUS_LABELS[selectedCase.status]}</Badge></div><div><span className="text-muted-foreground">Priorité :</span> <Badge variant="outline" className={cn('ml-1', PRIORITY_COLORS[selectedCase.priority])}>{PRIORITY_LABELS[selectedCase.priority]}</Badge></div>{selectedCase.adversary && <div className="col-span-2"><span className="text-muted-foreground">Partie adverse :</span> <span className="font-medium">{selectedCase.adversary}</span></div>}{selectedCase.jurisdiction && <div className="col-span-2"><span className="text-muted-foreground">Juridiction :</span> <span className="font-medium">{selectedCase.jurisdiction}</span></div>}{selectedCase.amountInDispute && <div><span className="text-muted-foreground">Montant litigieux :</span> <span className="font-medium">{fmtMoney(selectedCase.amountInDispute)}</span></div>}{selectedCase.billingType && <div><span className="text-muted-foreground">Facturation :</span> <span className="font-medium">{BILLING_LABELS[selectedCase.billingType] || selectedCase.billingType}</span></div>}{selectedCase.nextDueDate && <div><span className="text-muted-foreground">Prochaine échéance :</span> <span className="font-medium">{fmtDate(selectedCase.nextDueDate)}</span></div>}{selectedCase.description && <div className="col-span-2"><span className="text-muted-foreground">Description :</span> <p className="mt-1 text-sm">{selectedCase.description}</p></div>}</div>{selectedCase.assignments && selectedCase.assignments.length > 0 && <><Separator className="my-3" /><p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Avocats assignés</p><div className="flex flex-wrap gap-2">{selectedCase.assignments.map(a => <Badge key={a.id} variant="outline">{a.user?.name || 'Avocat'}</Badge>)}</div></>}</TabsContent>
        <TabsContent value="chrono" className="mt-4">{timeline.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Aucune activité</p> : <div className="space-y-3">{timeline.map((item, i) => { const Icon = item.icon; return (<div key={i} className="flex gap-3"><div className={cn('size-8 rounded-lg flex items-center justify-center shrink-0', item.type === 'event' ? 'bg-blue-50 text-blue-600' : item.type === 'note' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600')}><Icon className="size-4" /></div><div className="min-w-0"><p className="text-sm font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{fmtDateTime(item.date)}</p>{item.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>}</div></div>)})}</div>}</TabsContent>
        <TabsContent value="notes" className="mt-4">{caseDetail?.notes && caseDetail.notes.length > 0 ? <div className="space-y-2">{caseDetail.notes.map(n => (<div key={n.id} className="p-3 rounded-lg bg-muted"><p className="text-sm">{n.content}</p><p className="text-xs text-muted-foreground mt-1">{n.user?.name} — {fmtDateTime(n.createdAt)}</p></div>))}</div> : <p className="text-sm text-muted-foreground text-center py-8">Aucune note</p>}</TabsContent>
        <TabsContent value="docs" className="mt-4">{caseDetail?.documents && caseDetail.documents.length > 0 ? <div className="space-y-2">{caseDetail.documents.map(d => (<div key={d.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted"><FileText className="size-4 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{d.name}</p><p className="text-xs text-muted-foreground">{d.fileType} • {fmtFileSize(d.fileSize)}</p></div></div>))}</div> : <p className="text-sm text-muted-foreground text-center py-8">Aucun document</p>}</TabsContent>
      </Tabs>}
      </DialogContent></Dialog>
      <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) resetForm() }}><DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto rounded-xl"><DialogHeader><DialogTitle>{editing ? 'Modifier le dossier' : 'Nouveau dossier'}</DialogTitle></DialogHeader>
      {conflicts.length > 0 && <div className="rounded-lg bg-rose-50 border border-rose-200 p-3"><p className="text-sm font-semibold text-rose-700">⚠ Conflits détectés</p>{conflicts.map((c, i) => <p key={i} className="text-xs text-rose-600 mt-1">{c.case.reference}: {c.description}</p>)}</div>}
      <div className="space-y-3"><div className="grid grid-cols-2 gap-3"><div><Label>Référence</Label><Input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} /></div><div><Label>Client *</Label><Select value={form.clientId} onValueChange={v => setForm(f => ({ ...f, clientId: v }))}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent>{(clients || []).map(c => <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>)}</SelectContent></Select></div></div><div><Label>Titre *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div><div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div><div className="grid grid-cols-2 gap-3"><div><Label>Type</Label><Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="civil">Civil</SelectItem><SelectItem value="penal">Pénal</SelectItem><SelectItem value="commercial">Commercial</SelectItem><SelectItem value="social">Social</SelectItem><SelectItem value="administratif">Administratif</SelectItem></SelectContent></Select></div><div><Label>Priorité</Label><Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="haute">Haute</SelectItem><SelectItem value="urgente">Urgente</SelectItem></SelectContent></Select></div></div>{editing && <div><Label>Statut</Label><Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nouveau">Nouveau</SelectItem><SelectItem value="ouvert">Ouvert</SelectItem><SelectItem value="en_cours">En cours</SelectItem><SelectItem value="en_attente">En attente</SelectItem><SelectItem value="clos">Clos</SelectItem></SelectContent></Select></div>}<div className="grid grid-cols-2 gap-3"><div><Label>Partie adverse</Label><Input value={form.adversary} onChange={e => setForm(f => ({ ...f, adversary: e.target.value }))} /></div><div><Label>Juridiction</Label><Input value={form.jurisdiction} onChange={e => setForm(f => ({ ...f, jurisdiction: e.target.value }))} /></div></div><div className="grid grid-cols-2 gap-3"><div><Label>Montant litigieux</Label><Input type="number" value={form.amountInDispute} onChange={e => setForm(f => ({ ...f, amountInDispute: e.target.value }))} /></div><div><Label>Prochaine échéance</Label><Input type="date" value={form.nextDueDate} onChange={e => setForm(f => ({ ...f, nextDueDate: e.target.value }))} /></div></div><div><Label>Facturation</Label><Select value={form.billingType} onValueChange={v => setForm(f => ({ ...f, billingType: v }))}><SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger><SelectContent><SelectItem value="forfait">Forfait</SelectItem><SelectItem value="horaire">Horaire</SelectItem><SelectItem value="abonnement">Abonnement</SelectItem><SelectItem value="success_fee">Success fee</SelectItem><SelectItem value="provision">Provision</SelectItem></SelectContent></Select></div></div><DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button><Button onClick={handleSubmit} className="bg-[#1E5A8A] hover:bg-[#144570]" disabled={!form.title.trim() || !form.clientId}>{editing ? 'Enregistrer' : 'Créer'}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  )
}

// ==================== CLIENTS VIEW ====================
function ClientsView() {
  const { user } = useAppStore()
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ firstName: '', lastName: '', company: '', email: '', phone: '', address: '', city: '', country: '', niu: '', clientType: 'particulier', notes: '', riskLevel: 'faible', source: '' })

  const { data: clientsData, isLoading } = useQuery({ queryKey: ['clients', user?.tenantId, search], queryFn: () => { const p = new URLSearchParams(); if (user?.tenantId) p.set('tenantId', user.tenantId); if (search) p.set('search', search); return fetch(`/api/clients?${p}`).then(r => r.json()) } })

  const createMut = useMutation({ mutationFn: (body: Record<string, unknown>) => fetch('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, tenantId: user?.tenantId }) }).then(r => r.json()), onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success('Client créé'); setDialogOpen(false); resetForm() }, onError: () => toast.error('Erreur') })
  const updateMut = useMutation({ mutationFn: ({ id, ...body }: Record<string, unknown>) => fetch(`/api/clients/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()), onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success('Client mis à jour') }, onError: () => toast.error('Erreur') })
  const deleteMut = useMutation({ mutationFn: (id: string) => fetch(`/api/clients/${id}`, { method: 'DELETE' }).then(r => r.json()), onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success('Client supprimé') }, onError: () => toast.error('Erreur') })

  const resetForm = () => { setForm({ firstName: '', lastName: '', company: '', email: '', phone: '', address: '', city: '', country: '', niu: '', clientType: 'particulier', notes: '', riskLevel: 'faible', source: '' }); setEditing(null) }
  const openEdit = (c: Client) => { setEditing(c); setForm({ firstName: c.firstName, lastName: c.lastName, company: c.company || '', email: c.email || '', phone: c.phone || '', address: c.address || '', city: c.city || '', country: c.country || '', niu: c.niu || '', clientType: c.clientType || 'particulier', notes: c.notes || '', riskLevel: c.riskLevel || 'faible', source: c.source || '' }); setDialogOpen(true) }
  const handleSubmit = () => { if (!form.firstName.trim() || !form.lastName.trim()) return; const body = { ...form, name: `${form.firstName} ${form.lastName}` }; if (editing) { updateMut.mutate({ id: editing.id, ...body }) } else { createMut.mutate(body) } }
  const clients: Client[] = (clientsData?.clients || clientsData || [])

  return (
    <div className="p-6 space-y-6 view-enter">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h2 className="text-xl font-bold text-foreground">Clients</h2><p className="text-sm text-muted-foreground">Gérez les clients de votre cabinet</p></div>
        <Button onClick={() => { resetForm(); setDialogOpen(true) }} className="bg-[#1E5A8A] hover:bg-[#144570] text-white rounded-lg"><Plus className="size-4 mr-1.5" />Nouveau client</Button>
      </div>
      <div className="relative max-w-xs"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" /></div>
      {isLoading ? <div className="flex justify-center py-12"><Skeleton className="h-6 w-48" /></div> :
        clients.length === 0 ? <EmptyState icon={Users} title="Aucun client" description="Ajoutez votre premier client" /> :
        <Card className="border-border rounded-xl shadow-sm"><CardContent className="p-0"><div className="max-h-[500px] overflow-y-auto"><Table><TableHeader><TableRow><TableHead>Nom</TableHead><TableHead className="hidden md:table-cell">Email</TableHead><TableHead className="hidden lg:table-cell">Téléphone</TableHead><TableHead className="hidden md:table-cell">Risque</TableHead><TableHead className="hidden lg:table-cell">Dossiers</TableHead><TableHead className="w-24">Actions</TableHead></TableRow></TableHeader><TableBody>{clients.map(c => (<TableRow key={c.id}><TableCell className="font-medium">{c.firstName} {c.lastName}{c.company && <p className="text-xs text-muted-foreground">{c.company}</p>}</TableCell><TableCell className="hidden md:table-cell text-sm text-muted-foreground">{c.email || '—'}</TableCell><TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{c.phone || '—'}</TableCell><TableCell className="hidden md:table-cell"><Badge variant="outline" className={cn('text-[10px]', RISK_COLORS[c.riskLevel || 'faible'])}>{c.riskLevel === 'eleve' ? 'Élevé' : c.riskLevel === 'moyen' ? 'Moyen' : 'Faible'}</Badge></TableCell><TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{c._count?.cases || 0}</TableCell><TableCell><div className="flex gap-1"><Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(c)}><Edit className="size-3.5" /></Button><Button variant="ghost" size="icon" className="size-7 text-rose-500" onClick={() => deleteMut.mutate(c.id)}><Trash2 className="size-3.5" /></Button></div></TableCell></TableRow>))}</TableBody></Table></div></CardContent></Card>}
      <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) resetForm() }}><DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto rounded-xl"><DialogHeader><DialogTitle>{editing ? 'Modifier le client' : 'Nouveau client'}</DialogTitle></DialogHeader><div className="space-y-3"><div className="grid grid-cols-2 gap-3"><div><Label>Prénom *</Label><Input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} /></div><div><Label>Nom *</Label><Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} /></div></div><div><Label>Société</Label><Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} /></div><div className="grid grid-cols-2 gap-3"><div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div><div><Label>Téléphone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div></div><div><Label>Adresse</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div><div className="grid grid-cols-2 gap-3"><div><Label>Ville</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div><div><Label>Pays</Label><Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} /></div></div><div className="grid grid-cols-2 gap-3"><div><Label>NIU</Label><Input value={form.niu} onChange={e => setForm(f => ({ ...f, niu: e.target.value }))} /></div><div><Label>Niveau de risque</Label><Select value={form.riskLevel} onValueChange={v => setForm(f => ({ ...f, riskLevel: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="faible">Faible</SelectItem><SelectItem value="moyen">Moyen</SelectItem><SelectItem value="eleve">Élevé</SelectItem></SelectContent></Select></div></div><div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div></div><DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button><Button onClick={handleSubmit} className="bg-[#1E5A8A] hover:bg-[#144570]" disabled={!form.firstName.trim() || !form.lastName.trim()}>{editing ? 'Enregistrer' : 'Créer'}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  )
}

// ==================== DOCUMENTS VIEW ====================
function DocumentsView() {
  const { user } = useAppStore()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', caseId: '', tags: '' })
  const [file, setFile] = useState<File | null>(null)
  const qc = useQueryClient()

  const { data: docs, isLoading } = useQuery({ queryKey: ['documents', user?.tenantId], queryFn: () => fetch(`/api/documents?tenantId=${user?.tenantId}`).then(r => r.json()) })
  const { data: cases } = useQuery({ queryKey: ['docs-cases', user?.tenantId], queryFn: () => fetch(`/api/cases?tenantId=${user?.tenantId}`).then(r => r.json()) })

  const uploadMut = useMutation({ mutationFn: (fd: FormData) => fetch('/api/documents', { method: 'POST', body: fd }).then(r => r.json()), onSuccess: () => { qc.invalidateQueries({ queryKey: ['documents'] }); toast.success('Document ajouté'); setUploadOpen(false); setForm({ name: '', description: '', caseId: '', tags: '' }); setFile(null) }, onError: () => toast.error('Erreur') })
  const deleteMut = useMutation({ mutationFn: (id: string) => fetch(`/api/documents/${id}`, { method: 'DELETE' }).then(r => r.json()), onSuccess: () => { qc.invalidateQueries({ queryKey: ['documents'] }); toast.success('Document supprimé') }, onError: () => toast.error('Erreur') })

  const handleUpload = () => {
    if (!file || !form.name.trim()) return
    const fd = new FormData(); fd.append('file', file); fd.append('name', form.name); fd.append('tenantId', user?.tenantId || ''); if (form.caseId) fd.append('caseId', form.caseId); if (form.description) fd.append('description', form.description); if (form.tags) fd.append('tags', form.tags)
    uploadMut.mutate(fd)
  }

  const grouped = useMemo(() => { const map: Record<string, Doc[]> = {}; for (const d of (docs || [])) { const key = d.case?.reference || 'Sans dossier'; if (!map[key]) map[key] = []; map[key].push(d) } return map }, [docs])

  return (
    <div className="p-6 space-y-6 view-enter">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h2 className="text-xl font-bold text-foreground">Documents</h2><p className="text-sm text-muted-foreground">Tous les documents de votre cabinet</p></div>
        <Button onClick={() => setUploadOpen(true)} className="bg-[#1E5A8A] hover:bg-[#144570] text-white rounded-lg"><Plus className="size-4 mr-1.5" />Ajouter</Button>
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Skeleton className="h-6 w-48" /></div> :
        (docs || []).length === 0 ? <EmptyState icon={FileText} title="Aucun document" description="Ajoutez votre premier document" /> :
        <div className="space-y-6 max-h-[600px] overflow-y-auto">{Object.entries(grouped).map(([key, items]: [string, Doc[]]) => (
          <Card key={key} className="border-border rounded-xl shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Briefcase className="size-4 text-[#1E5A8A]" />{key}</CardTitle></CardHeader><CardContent className="pt-0"><div className="space-y-1">{items.map(d => (<div key={d.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"><FileText className="size-4 text-muted-foreground shrink-0" /><div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{d.name}</p><p className="text-xs text-muted-foreground">{d.fileType} • {fmtFileSize(d.fileSize)}</p></div><div className="flex gap-1"><Button variant="ghost" size="icon" className="size-7" onClick={() => window.open(d.filePath, '_blank')}><Eye className="size-3.5" /></Button><Button variant="ghost" size="icon" className="size-7 text-rose-500" onClick={() => deleteMut.mutate(d.id)}><Trash2 className="size-3.5" /></Button></div></div>))}</div></CardContent></Card>
        ))}</div>}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}><DialogContent className="max-w-md rounded-xl"><DialogHeader><DialogTitle>Ajouter un document</DialogTitle></DialogHeader><div className="space-y-3"><div><Label>Fichier *</Label><Input type="file" onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); if (!form.name) setForm(p => ({ ...p, name: f.name })) } }} /></div><div><Label>Nom *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div><div><Label>Dossier</Label><Select value={form.caseId} onValueChange={v => setForm(f => ({ ...f, caseId: v }))}><SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger><SelectContent>{(cases || []).map(c => <SelectItem key={c.id} value={c.id}>{c.reference} — {c.title}</SelectItem>)}</SelectContent></Select></div><div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div></div><DialogFooter><Button variant="outline" onClick={() => setUploadOpen(false)}>Annuler</Button><Button onClick={handleUpload} className="bg-[#1E5A8A] hover:bg-[#144570]" disabled={!file || !form.name.trim()}>Ajouter</Button></DialogFooter></DialogContent></Dialog>
    </div>
  )
}

// ==================== CALENDAR VIEW ====================
function CalendarView() {
  const { user } = useAppStore()
  const qc = useQueryClient()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', startTime: '', endTime: '', eventType: 'rdv', criticality: 'normal', location: '', caseId: '' })

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: startOfWeek(monthStart, { weekStartsOn: 1 }), end: endOfWeek(monthEnd, { weekStartsOn: 1 }) })

  const { data: events, isLoading } = useQuery({ queryKey: ['events', user?.tenantId, monthStart.toISOString()], queryFn: () => { const p = new URLSearchParams(); p.set('tenantId', user!.tenantId); p.set('start', monthStart.toISOString()); p.set('end', monthEnd.toISOString()); return fetch(`/api/events?${p}`).then(r => r.json()) }, enabled: !!user?.tenantId })
  const { data: cases } = useQuery({ queryKey: ['cal-cases', user?.tenantId], queryFn: () => fetch(`/api/cases?tenantId=${user?.tenantId}`).then(r => r.json()) })

  const createMut = useMutation({ mutationFn: (body: Record<string, unknown>) => fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()), onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); toast.success('Événement créé'); setDialogOpen(false); setForm({ title: '', description: '', startTime: '', endTime: '', eventType: 'rdv', criticality: 'normal', location: '', caseId: '' }) }, onError: () => toast.error('Erreur') })

  const handleSubmit = () => { if (!form.title.trim() || !form.startTime) return; createMut.mutate({ ...form, tenantId: user?.tenantId }) }

  const getEventsForDay = (day: Date) => (events || []).filter((e: EventItem) => isSameDay(parseISO(e.startTime), day))

  return (
    <div className="p-6 space-y-6 view-enter">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h2 className="text-xl font-bold text-foreground">Calendrier</h2><p className="text-sm text-muted-foreground">Planifiez vos audiences et rendez-vous</p></div>
        <Button onClick={() => setDialogOpen(true)} className="bg-[#1E5A8A] hover:bg-[#144570] text-white rounded-lg"><Plus className="size-4 mr-1.5" />Nouvel événement</Button>
      </div>
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}><ChevronLeft className="size-4" /></Button>
        <span className="text-sm font-semibold min-w-[140px] text-center">{format(currentMonth, 'MMMM yyyy', { locale: fr })}</span>
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}><ChevronRight className="size-4" /></Button>
      </div>
      {isLoading ? <Skeleton className="h-96" /> : (
        <Card className="border-border rounded-xl shadow-sm overflow-hidden"><CardContent className="p-0">
          <div className="grid grid-cols-7">{['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d => <div key={d} className="text-center text-xs font-semibold uppercase text-muted-foreground py-2 border-b border-border">{d}</div>)}
          {days.map(day => { const dayEvents = getEventsForDay(day); const isCurrent = isSameMonth(day, currentMonth); return (<div key={day.toISOString()} className={cn('min-h-[80px] p-1 border-b border-r border-border', !isCurrent && 'bg-muted/50', isToday(day) && 'bg-[#E8F1F8]')}><span className={cn('text-xs', isToday(day) ? 'font-bold text-[#1E5A8A]' : isCurrent ? 'text-foreground' : 'text-muted-foreground')}>{format(day, 'd')}</span><div className="mt-0.5 space-y-0.5">{dayEvents.slice(0, 2).map((e: EventItem) => (<div key={e.id} className={cn('text-[10px] px-1 py-0.5 rounded truncate', CRIT_COLORS[e.criticality] || 'bg-muted')} title={e.title}>{e.title}</div>))}{dayEvents.length > 2 && <p className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 2}</p>}</div></div>)})}
          </div>
        </CardContent></Card>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-w-md rounded-xl"><DialogHeader><DialogTitle>Nouvel événement</DialogTitle></DialogHeader><div className="space-y-3"><div><Label>Titre *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div><div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div><div className="grid grid-cols-2 gap-3"><div><Label>Début *</Label><Input type="datetime-local" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} /></div><div><Label>Fin</Label><Input type="datetime-local" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} /></div></div><div className="grid grid-cols-2 gap-3"><div><Label>Type</Label><Select value={form.eventType} onValueChange={v => setForm(f => ({ ...f, eventType: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="audience">Audience</SelectItem><SelectItem value="rdv">Rendez-vous</SelectItem><SelectItem value="echeance">Échéance</SelectItem><SelectItem value="depot">Dépôt</SelectItem><SelectItem value="autre">Autre</SelectItem></SelectContent></Select></div><div><Label>Criticité</Label><Select value={form.criticality} onValueChange={v => setForm(f => ({ ...f, criticality: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="basse">Basse</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="haute">Haute</SelectItem><SelectItem value="urgente">Urgente</SelectItem></SelectContent></Select></div></div><div><Label>Lieu</Label><Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div><div><Label>Dossier</Label><Select value={form.caseId} onValueChange={v => setForm(f => ({ ...f, caseId: v }))}><SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger><SelectContent>{(cases || []).map(c => <SelectItem key={c.id} value={c.id}>{c.reference} — {c.title}</SelectItem>)}</SelectContent></Select></div></div><DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button><Button onClick={handleSubmit} className="bg-[#1E5A8A] hover:bg-[#144570]" disabled={!form.title.trim() || !form.startTime}>Créer</Button></DialogFooter></DialogContent></Dialog>
    </div>
  )
}

// ==================== INVOICES VIEW ====================
function InvoicesView() {
  const { user } = useAppStore()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ amount: '', dueDate: '', notes: '', clientId: '', caseId: '', currencyCode: 'XAF', paymentMethod: '' })

  const { data: invoicesData, isLoading } = useQuery({ queryKey: ['invoices', user?.tenantId, statusFilter], queryFn: () => { const p = new URLSearchParams(); if (user?.tenantId) p.set('tenantId', user.tenantId); if (statusFilter !== 'all') p.set('status', statusFilter); return fetch(`/api/invoices?${p}`).then(r => r.json()) } })
  const { data: clients } = useQuery({ queryKey: ['inv-clients', user?.tenantId], queryFn: () => fetch(`/api/clients?tenantId=${user?.tenantId}`).then(r => r.json()) })
  const { data: cases } = useQuery({ queryKey: ['inv-cases', user?.tenantId], queryFn: () => fetch(`/api/cases?tenantId=${user?.tenantId}`).then(r => r.json()) })

  const createMut = useMutation({ mutationFn: (body: Record<string, unknown>) => fetch('/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()), onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Facture créée'); setDialogOpen(false); setForm({ amount: '', dueDate: '', notes: '', clientId: '', caseId: '', currencyCode: 'XAF', paymentMethod: '' }) }, onError: () => toast.error('Erreur') })
  const updateMut = useMutation({ mutationFn: ({ id, ...body }: Record<string, unknown>) => fetch(`/api/invoices/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()), onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Facture mise à jour') }, onError: () => toast.error('Erreur') })

  const invoices: Invoice[] = (invoicesData?.invoices || invoicesData || [])

  return (
    <div className="p-6 space-y-6 view-enter">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h2 className="text-xl font-bold text-foreground">Factures</h2><p className="text-sm text-muted-foreground">Suivi de vos facturations</p></div>
        <Button onClick={() => setDialogOpen(true)} className="bg-[#1E5A8A] hover:bg-[#144570] text-white rounded-lg"><Plus className="size-4 mr-1.5" />Nouvelle facture</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder="Statut" /></SelectTrigger><SelectContent><SelectItem value="all">Tous</SelectItem><SelectItem value="non_paye">Non payé</SelectItem><SelectItem value="partiel">Partiel</SelectItem><SelectItem value="paye">Payé</SelectItem><SelectItem value="annule">Annulé</SelectItem></SelectContent></Select>
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Skeleton className="h-6 w-48" /></div> :
        invoices.length === 0 ? <EmptyState icon={Receipt} title="Aucune facture" description="Créez votre première facture" /> :
        <Card className="border-border rounded-xl shadow-sm"><CardContent className="p-0"><div className="max-h-[500px] overflow-y-auto"><Table><TableHeader><TableRow><TableHead>Référence</TableHead><TableHead>Client</TableHead><TableHead className="hidden md:table-cell">Montant</TableHead><TableHead className="hidden sm:table-cell">Statut</TableHead><TableHead className="hidden lg:table-cell">Échéance</TableHead><TableHead className="w-32">Actions</TableHead></TableRow></TableHeader><TableBody>{invoices.map(inv => (<TableRow key={inv.id}><TableCell className="font-medium">{inv.reference}</TableCell><TableCell className="text-sm">{inv.client ? `${inv.client.firstName} ${inv.client.lastName}` : '—'}</TableCell><TableCell className="hidden md:table-cell text-sm font-medium">{fmtMoney(inv.amount, inv.currencyCode)}</TableCell><TableCell className="hidden sm:table-cell"><Badge variant="outline" className={cn('text-[10px]', STATUS_COLORS[inv.status])}>{STATUS_LABELS[inv.status] || inv.status}</Badge></TableCell><TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{fmtDate(inv.dueDate)}</TableCell><TableCell><div className="flex gap-1">{inv.status !== 'paye' && inv.status !== 'paid' && inv.status !== 'annule' && inv.status !== 'cancelled' && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => updateMut.mutate({ id: inv.id, status: (inv.status === 'partiel' || inv.status === 'partial') ? 'paye' : 'partiel', paidAmount: inv.amount })}>{(inv.status === 'partiel' || inv.status === 'partial') ? 'Soldée' : 'Partiel'}</Button>}{(inv.status === 'non_paye' || inv.status === 'unpaid') && <Button variant="ghost" size="icon" className="size-7" onClick={() => window.open(`/api/invoices/${inv.id}/print`, '_blank')}><Download className="size-3.5" /></Button>}</div></TableCell></TableRow>))}</TableBody></Table></div></CardContent></Card>}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-w-md rounded-xl"><DialogHeader><DialogTitle>Nouvelle facture</DialogTitle></DialogHeader><div className="space-y-3"><div><Label>Client *</Label><Select value={form.clientId} onValueChange={v => setForm(f => ({ ...f, clientId: v }))}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent>{(clients || []).map(c => <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>)}</SelectContent></Select></div><div><Label>Dossier</Label><Select value={form.caseId} onValueChange={v => setForm(f => ({ ...f, caseId: v }))}><SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger><SelectContent>{(cases || []).map(c => <SelectItem key={c.id} value={c.id}>{c.reference} — {c.title}</SelectItem>)}</SelectContent></Select></div><div className="grid grid-cols-2 gap-3"><div><Label>Montant *</Label><Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div><div><Label>Échéance</Label><Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} /></div></div><div className="grid grid-cols-2 gap-3"><div><Label>Devise</Label><Select value={form.currencyCode} onValueChange={v => setForm(f => ({ ...f, currencyCode: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="XAF">XAF (FCFA)</SelectItem><SelectItem value="EUR">EUR (€)</SelectItem><SelectItem value="GBP">GBP (£)</SelectItem><SelectItem value="USD">USD ($)</SelectItem></SelectContent></Select></div><div><Label>Mode de paiement</Label><Select value={form.paymentMethod} onValueChange={v => setForm(f => ({ ...f, paymentMethod: v }))}><SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger><SelectContent><SelectItem value="especes">Espèces</SelectItem><SelectItem value="virement">Virement</SelectItem><SelectItem value="mobile_money">Mobile Money</SelectItem><SelectItem value="carte">Carte</SelectItem></SelectContent></Select></div></div><div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div></div><DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button><Button onClick={() => { if (!form.clientId || !form.amount) return; createMut.mutate({ ...form, amount: parseFloat(form.amount), tenantId: user?.tenantId }) }} className="bg-[#1E5A8A] hover:bg-[#144570]" disabled={!form.clientId || !form.amount}>Créer</Button></DialogFooter></DialogContent></Dialog>
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

  const { data: contacts } = useQuery({ queryKey: ['users-contacts', user?.tenantId], queryFn: () => fetch(`/api/users?tenantId=${user?.tenantId}`).then(r => r.json()) })
  const { data: messages } = useQuery({ queryKey: ['messages', user?.id, selectedContact], queryFn: () => { const p = new URLSearchParams(); if (user?.tenantId) p.set('tenantId', user.tenantId); if (user?.id) p.set('userId', user.id); if (selectedContact) p.set('contactId', selectedContact); return fetch(`/api/messages?${p}`).then(r => r.json()) }, refetchInterval: 5000 })

  const sendMut = useMutation({ mutationFn: (content: string) => fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, tenantId: user?.tenantId, senderId: user?.id, receiverId: selectedContact }) }).then(r => r.json()), onSuccess: () => { qc.invalidateQueries({ queryKey: ['messages'] }); setNewMessage('') }, onError: () => toast.error("Erreur d'envoi") })

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  const contactList = (contacts || []).filter((c: UserItem) => c.id !== user?.id)
  const chatMessages = selectedContact ? (messages || []) as Message[] : []
  const handleSend = () => { if (!newMessage.trim() || !selectedContact) return; sendMut.mutate(newMessage.trim()) }

  return (
    <div className="p-6 space-y-6 view-enter">
      <div><h2 className="text-xl font-bold text-foreground">Messages</h2><p className="text-sm text-muted-foreground">Communiquez avec votre équipe</p></div>
      <Card className="border-border rounded-xl shadow-sm overflow-hidden"><div className="flex h-[500px]">
        <div className="w-64 border-r border-border flex-shrink-0 overflow-y-auto hidden sm:block">
          {contactList.length === 0 ? <p className="text-xs text-muted-foreground p-4 text-center">Aucun contact</p> :
            contactList.map((c: UserItem) => (
              <button key={c.id} className={cn('w-full flex items-center gap-2.5 p-3 hover:bg-muted text-left transition-colors', selectedContact === c.id && 'bg-[#E8F1F8]')} onClick={() => setSelectedContact(c.id)}>
                <Avatar className="size-8"><AvatarFallback className="text-[10px] bg-muted">{initials(c.name)}</AvatarFallback></Avatar>
                <div className="min-w-0"><p className="text-sm font-medium truncate">{c.name}</p><p className="text-[10px] text-muted-foreground">{ROLE_LABELS[c.role] || c.role}</p></div>
              </button>
            ))}
        </div>
        <div className="flex-1 flex flex-col">
          {!selectedContact ? <div className="flex-1 flex items-center justify-center"><EmptyState icon={MessageSquare} title="Sélectionnez une conversation" /></div> : (
            <>
              <div className="p-3 border-b border-border"><p className="text-sm font-semibold">{(contacts || []).find((c: UserItem) => c.id === selectedContact)?.name || ''}</p></div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Aucun message</p>}
                {chatMessages.map((m: Message) => {
                  const isMine = m.senderId === user?.id
                  return (<div key={m.id} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}><div className={cn('max-w-[75%] rounded-xl px-3 py-2', isMine ? 'bg-[#1E5A8A] text-white' : 'bg-muted')}><p className="text-sm">{m.content}</p><p className={cn('text-[10px] mt-1', isMine ? 'text-blue-200' : 'text-muted-foreground')}>{fmtDateTime(m.createdAt)}</p></div></div>)
                  })}
                <div ref={messagesEndRef} />
              </div>
              <div className="p-3 border-t border-border flex gap-2"><Input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Écrire un message..." className="text-sm" onKeyDown={e => e.key === 'Enter' && handleSend()} /><Button size="icon" onClick={handleSend} disabled={!newMessage.trim() || sendMut.isPending} className="bg-[#1E5A8A] hover:bg-[#144570]"><Send className="size-4" /></Button></div>
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
  const { data: invoices } = useQuery({ queryKey: ['invoices-report', user?.tenantId], queryFn: () => fetch(`/api/invoices?tenantId=${user?.tenantId}`).then(r => r.json()) })

  const stats = useMemo(() => {
    const all = (invoices || []) as Invoice[]
    const paid = all.filter(i => i.status === 'paid' || i.status === 'paye')
    const unpaid = all.filter(i => i.status === 'unpaid' || i.status === 'non_paye' || i.status === 'overdue')
    const partial = all.filter(i => i.status === 'partial' || i.status === 'partiel')
    const totalRevenue = paid.reduce((s, i) => s + i.amount, 0)
    const totalPending = unpaid.reduce((s, i) => s + i.amount, 0) + partial.reduce((s, i) => s + (i.amount - (i.paidAmount || 0)), 0)
    return { totalRevenue, totalPending, paidCount: paid.length, unpaidCount: unpaid.length + partial.length, totalInvoices: all.length }
  }, [invoices])

  const monthlyData = useMemo(() => {
    const all = (invoices || []) as Invoice[]
    const months: Record<string, { month: string; revenue: number }> = {}
    for (const inv of all) { const isPaid = inv.status === 'paid' || inv.status === 'paye'; if (!isPaid || !inv.paidDate) continue; const m = format(parseISO(inv.paidDate), 'MMM yy', { locale: getDateLocale() }); if (!months[m]) months[m] = { month: m, revenue: 0 }; months[m].revenue += inv.amount }
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month)).slice(-12)
  }, [invoices])

  const topClients = useMemo(() => {
    const all = (invoices || []) as Invoice[]
    const map: Record<string, { name: string; total: number }> = {}
    for (const inv of all) { const isPaid = inv.status === 'paid' || inv.status === 'paye'; if (!isPaid) continue; const name = inv.client ? `${inv.client.firstName} ${inv.client.lastName}` : 'Inconnu'; if (!map[inv.clientId]) map[inv.clientId] = { name, total: 0 }; map[inv.clientId].total += inv.amount }
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5)
  }, [invoices])

  return (
    <div className="p-6 space-y-6 view-enter">
      <div><h2 className="text-xl font-bold text-foreground">Rapports</h2><p className="text-sm text-muted-foreground">Analyse de vos performances</p></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Revenus totaux', value: fmtMoney(stats.totalRevenue), color: 'text-emerald-600' },
          { label: 'En attente', value: fmtMoney(stats.totalPending), color: 'text-orange-600' },
          { label: 'Factures payées', value: String(stats.paidCount), color: 'text-foreground' },
          { label: 'Total factures', value: String(stats.totalInvoices), color: 'text-foreground' },
        ].map(k => (<Card key={k.label} className="border-border rounded-xl shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{k.label}</p><p className={cn("text-xl font-bold mt-1", k.color)}>{k.value}</p></CardContent></Card>))}
      </div>
      {monthlyData.length > 0 && <Card className="border-border rounded-xl shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Revenus mensuels</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={200}><AreaChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} /><YAxis hide /><Area type="monotone" dataKey="revenue" stroke="#1E5A8A" fill="#E8F1F8" strokeWidth={2} /><RTooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '12px' }} /></AreaChart></ResponsiveContainer></CardContent></Card>}
      {topClients.length > 0 && <Card className="border-border rounded-xl shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Top clients</CardTitle></CardHeader><CardContent><div className="space-y-3">{topClients.map((c, i) => (<div key={i} className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="size-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold">{i + 1}</span><span className="text-sm font-medium">{c.name}</span></div><span className="text-sm font-semibold">{fmtMoney(c.total)}</span></div>))}</div></CardContent></Card>}
    </div>
  )
}

// ==================== AUDIT LOGS VIEW ====================
function AuditLogsView() {
  const { user } = useAppStore()
  const [resourceType, setResourceType] = useState('all')
  const isAdmin = user?.role === 'root_admin' || user?.role === 'firm_admin' || user?.role === 'associate'
  const { data: logs, isLoading } = useQuery({ queryKey: ['audit-logs', user?.tenantId, resourceType], queryFn: () => { const p = new URLSearchParams(); if (user?.tenantId) p.set('tenantId', user.tenantId); if (resourceType !== 'all') p.set('resourceType', resourceType); return fetch(`/api/audit-logs?${p}`).then(r => r.json()) }, enabled: isAdmin })
  if (!isAdmin) return <div className="p-6"><EmptyState icon={Shield} title="Accès restreint" description="Réservé aux administrateurs" /></div>
  return (
    <div className="p-6 space-y-6 view-enter">
      <div><h2 className="text-xl font-bold text-foreground">Journal d'audit</h2><p className="text-sm text-muted-foreground">Historique des actions</p></div>
      <Select value={resourceType} onValueChange={setResourceType}><SelectTrigger className="w-[180px] h-9 text-sm"><SelectValue placeholder="Type de ressource" /></SelectTrigger><SelectContent><SelectItem value="all">Tous</SelectItem><SelectItem value="Case">Dossier</SelectItem><SelectItem value="Client">Client</SelectItem><SelectItem value="User">Utilisateur</SelectItem><SelectItem value="Invoice">Facture</SelectItem><SelectItem value="Document">Document</SelectItem><SelectItem value="Task">Tâche</SelectItem></SelectContent></Select>
      {isLoading ? <div className="flex justify-center py-12"><Skeleton className="h-6 w-48" /></div> :
        (logs || []).length === 0 ? <EmptyState icon={Shield} title="Aucune entrée" /> :
        <Card className="border-border rounded-xl shadow-sm"><CardContent className="p-0"><div className="max-h-[500px] overflow-y-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Utilisateur</TableHead><TableHead>Action</TableHead><TableHead className="hidden md:table-cell">Ressource</TableHead><TableHead className="hidden lg:table-cell">IP</TableHead></TableRow></TableHeader><TableBody>{(logs || []).map((log: AuditLogItem) => (<TableRow key={log.id}><TableCell className="text-xs text-muted-foreground">{fmtDateTime(log.createdAt)}</TableCell><TableCell className="text-sm">{log.user?.name || 'Système'}</TableCell><TableCell className="text-sm font-medium">{log.action}</TableCell><TableCell className="hidden md:table-cell"><Badge variant="outline" className="text-[10px]">{log.resourceType || '—'}</Badge></TableCell><TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{log.ipAddress || '—'}</TableCell></TableRow>))}</TableBody></Table></div></CardContent></Card>}
    </div>
  )
}

// ==================== SETTINGS VIEW ====================
function SettingsView() {
  const { user, logout } = useAppStore()
  const qc = useQueryClient()
  const isAdmin = user?.role === 'root_admin' || user?.role === 'firm_admin' || user?.role === 'associate'
  const [profileForm, setProfileForm] = useState({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '' })
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'lawyer', password: '' })
  const [newCurrency, setNewCurrency] = useState({ code: '', name: '', symbol: '' })
  const [showNewUser, setShowNewUser] = useState(false)
  const [showNewCurrency, setShowNewCurrency] = useState(false)

  const { data: tenantData } = useQuery({ queryKey: ['tenant', user?.tenantId], queryFn: () => fetch(`/api/tenants/${user?.tenantId}`).then(r => r.json()), enabled: !!user?.tenantId })
  const { data: usersList } = useQuery({ queryKey: ['settings-users', user?.tenantId], queryFn: () => fetch(`/api/users?tenantId=${user?.tenantId}`).then(r => r.json()), enabled: isAdmin })
  const { data: currencies } = useQuery({ queryKey: ['currencies'], queryFn: () => fetch('/api/currencies').then(r => r.json()), enabled: isAdmin })
  const tenantInfo: TenantItem | null = tenantData || null

  const updateProfile = useMutation({ mutationFn: (body: Record<string, unknown>) => fetch(`/api/users/${user?.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()), onSuccess: () => { toast.success('Profil mis à jour'); qc.invalidateQueries({ queryKey: ['tenant'] }) }, onError: () => toast.error('Erreur') })
  const createUserMut = useMutation({ mutationFn: (body: Record<string, unknown>) => fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()), onSuccess: () => { toast.success('Utilisateur créé'); qc.invalidateQueries({ queryKey: ['settings-users'] }); setShowNewUser(false); setNewUser({ name: '', email: '', role: 'lawyer', password: '' }) }, onError: () => toast.error('Erreur') })
  const createCurrencyMut = useMutation({ mutationFn: (body: Record<string, unknown>) => fetch('/api/currencies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()), onSuccess: () => { toast.success('Devise ajoutée'); qc.invalidateQueries({ queryKey: ['currencies'] }); setShowNewCurrency(false); setNewCurrency({ code: '', name: '', symbol: '' }) }, onError: () => toast.error('Erreur') })

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div><h2 className="text-xl font-bold text-foreground">Paramètres</h2><p className="text-sm text-muted-foreground">Configuration de votre compte</p></div>
      <Card className="border-border rounded-xl shadow-sm"><CardHeader><CardTitle className="text-base font-semibold">Mon profil</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid grid-cols-2 gap-3"><div><Label>Nom</Label><Input value={profileForm.name} onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))} /></div><div><Label>Email</Label><Input value={profileForm.email} onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))} /></div></div><div><Label>Téléphone</Label><Input value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} /></div><Button size="sm" onClick={() => updateProfile.mutate(profileForm)} disabled={updateProfile.isPending} className="bg-[#1E5A8A] hover:bg-[#144570]">Enregistrer</Button></CardContent></Card>
      {tenantInfo && <Card className="border-border rounded-xl shadow-sm"><CardHeader><CardTitle className="text-base font-semibold">Informations du cabinet</CardTitle></CardHeader><CardContent><div className="grid grid-cols-2 gap-3 text-sm"><div><span className="text-muted-foreground">Nom :</span> <span className="font-medium">{tenantInfo.name}</span></div><div><span className="text-muted-foreground">Plan :</span> <Badge variant="outline" className="text-[10px]">{tenantInfo.plan}</Badge></div><div><span className="text-muted-foreground">Email :</span> <span className="font-medium">{tenantInfo.email || '—'}</span></div><div><span className="text-muted-foreground">Téléphone :</span> <span className="font-medium">{tenantInfo.phone || '—'}</span></div></div></CardContent></Card>}
      {isAdmin && <Card className="border-border rounded-xl shadow-sm"><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base font-semibold">Utilisateurs</CardTitle><Button size="sm" variant="outline" onClick={() => setShowNewUser(true)}><Plus className="size-3.5 mr-1" />Ajouter</Button></CardHeader><CardContent>
        {showNewUser && <div className="border border-border rounded-lg p-3 mb-3 space-y-2"><div className="grid grid-cols-2 gap-2"><div><Label>Nom</Label><Input value={newUser.name} onChange={e => setNewUser(u => ({ ...u, name: e.target.value }))} /></div><div><Label>Email</Label><Input type="email" value={newUser.email} onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))} /></div><div><Label>Rôle</Label><Select value={newUser.role} onValueChange={v => setNewUser(u => ({ ...u, role: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="lawyer">Avocat</SelectItem><SelectItem value="jurist">Juriste</SelectItem><SelectItem value="assistant">Assistant</SelectItem><SelectItem value="accountant">Comptable</SelectItem></SelectContent></Select></div><div><Label>Mot de passe</Label><Input type="password" value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} /></div></div><div className="flex gap-2"><Button size="sm" onClick={() => createUserMut.mutate({ ...newUser, tenantId: user?.tenantId })} disabled={!newUser.name || !newUser.email} className="bg-[#1E5A8A] hover:bg-[#144570]">Créer</Button><Button size="sm" variant="outline" onClick={() => setShowNewUser(false)}>Annuler</Button></div></div>}
        <div className="max-h-64 overflow-y-auto"><Table><TableHeader><TableRow><TableHead>Nom</TableHead><TableHead>Email</TableHead><TableHead>Rôle</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader><TableBody>{(usersList || []).map((u: UserItem) => (<TableRow key={u.id}><TableCell className="text-sm font-medium">{u.name}</TableCell><TableCell className="text-sm text-muted-foreground">{u.email}</TableCell><TableCell><Badge variant="outline" className={cn('text-[10px]', ROLE_COLORS[u.role] || '')}>{ROLE_LABELS[u.role] || u.role}</Badge></TableCell><TableCell><Badge variant={u.isActive ? 'default' : 'secondary'} className="text-[10px]">{u.isActive ? 'Actif' : 'Inactif'}</Badge></TableCell></TableRow>))}</TableBody></Table></div>
      </CardContent></Card>}
      {isAdmin && <Card className="border-border rounded-xl shadow-sm"><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base font-semibold">Devises</CardTitle><Button size="sm" variant="outline" onClick={() => setShowNewCurrency(true)}><Plus className="size-3.5 mr-1" />Ajouter</Button></CardHeader><CardContent>
        {showNewCurrency && <div className="border border-border rounded-lg p-3 mb-3 space-y-2"><div className="grid grid-cols-3 gap-2"><div><Label>Code</Label><Input value={newCurrency.code} onChange={e => setNewCurrency(c => ({ ...c, code: e.target.value }))} placeholder="XAF" /></div><div><Label>Nom</Label><Input value={newCurrency.name} onChange={e => setNewCurrency(c => ({ ...c, name: e.target.value }))} placeholder="Franc CFA" /></div><div><Label>Symbole</Label><Input value={newCurrency.symbol} onChange={e => setNewCurrency(c => ({ ...c, symbol: e.target.value }))} placeholder="FCFA" /></div></div><div className="flex gap-2"><Button size="sm" onClick={() => createCurrencyMut.mutate(newCurrency)} disabled={!newCurrency.code || !newCurrency.name} className="bg-[#1E5A8A] hover:bg-[#144570]">Ajouter</Button><Button size="sm" variant="outline" onClick={() => setShowNewCurrency(false)}>Annuler</Button></div></div>}
        <div className="flex flex-wrap gap-2">{(currencies || []).map((c: CurrencyItem) => <Badge key={c.id} variant="outline" className="text-xs py-1 px-2">{c.code} — {c.symbol} ({c.name})</Badge>)}</div>
      </CardContent></Card>}
      <Button variant="outline" className="text-rose-600 hover:text-rose-700" onClick={logout}><LogOut className="size-4 mr-2" />Se déconnecter</Button>
    </div>
  )
}

// ==================== ARCHIVES VIEW ====================
function ArchivesView() {
  const { user } = useAppStore()
  const { data: cases, isLoading } = useQuery({ queryKey: ['archived-cases', user?.tenantId], queryFn: () => fetch(`/api/cases?tenantId=${user?.tenantId}&status=archive`).then(r => r.json()) })
  return (
    <div className="p-6 space-y-6 view-enter">
      <div><h2 className="text-xl font-bold text-foreground">Archives</h2><p className="text-sm text-muted-foreground">Dossiers clôturés et archivés</p></div>
      {isLoading ? <div className="flex justify-center py-12"><Skeleton className="h-6 w-48" /></div> :
        (cases || []).length === 0 ? <EmptyState icon={Inbox} title="Aucun dossier archivé" /> :
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto">{(cases || []).map((c: CaseItem) => (
          <Card key={c.id} className="border-border rounded-xl shadow-sm opacity-80"><CardHeader className="pb-2"><div className="flex items-start justify-between"><CardTitle className="text-sm font-semibold">{c.reference}</CardTitle><Badge variant="outline" className={cn('text-[10px]', STATUS_COLORS.archive)}>{STATUS_LABELS.archive}</Badge></div><CardDescription className="text-xs mt-1 line-clamp-2">{c.title}</CardDescription></CardHeader><CardContent className="p-4 pt-0 space-y-1"><p className="text-xs text-muted-foreground">{c.client ? `${c.client.firstName} ${c.client.lastName}` : '—'}</p><p className="text-xs text-muted-foreground">Type : {TYPE_LABELS[c.type] || c.type}</p>{c.closingDate && <p className="text-xs text-muted-foreground">Clôture : {fmtDate(c.closingDate)}</p>}</CardContent></Card>
        ))}</div>}
    </div>
  )
}

// ==================== FOOTER ====================
function Footer() {
  return (<footer className="mt-auto border-t border-border px-6 py-3 flex items-center justify-between text-xs text-muted-foreground bg-card"><span className="flex items-center gap-1.5"><Scale className="size-3.5" />JurisLink</span><span>v2.2.0</span></footer>)
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

// ==================== MAIN APP (client-only) ====================
export default function AppClient() {
  const { isAuthenticated } = useAppStore()
  const { locale } = useLocale()
  return (
    <ThemeProvider attribute='class' defaultTheme='light' enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <div className='min-h-screen flex flex-col bg-[#F9FAFB] dark:bg-background' dir={RTL_LOCALES.has(locale) ? 'rtl' : 'ltr'}>
            <div className='flex-1 flex flex-col'>
              {!isAuthenticated ? <LoginPage /> : <>
                <Sidebar />
                <div className='lg:pl-[260px] rtl:lg:pl-0 rtl:lg:pr-[260px] flex-1 flex flex-col'>
                  <Header />
                  <main className='flex-1'><DashboardRouter /></main>
                  <Footer />
                </div>
              </>}
            </div>
          </div>
        </TooltipProvider>
        <Toaster richColors position='top-right' />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
