import { Ellipsis, Gauge, House, Plus, ReceiptText, Settings2, ShoppingBasket, UsersRound, Waypoints, type LucideIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AvatarStack } from '@/components/common/MemberAvatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useAppStore, useData } from '@/store/useAppStore'
import { useUi } from '@/store/useUi'

// o formulário de gasto só é baixado quando alguém vai registrar um
const loadDialog = () => import('@/features/transactions/TransactionDialog').then((m) => ({ default: m.TransactionDialog }))
const TransactionDialog = lazy(loadDialog)

interface NavItem {
  to: string
  label: string
  /** Rótulo curto, para a barra inferior e a barra estreita do tablet. */
  short: string
  hint: string
  icon: LucideIcon
  end: boolean
}

const NAV: NavItem[] = [
  { to: '/', label: 'Visão geral', short: 'Visão', hint: 'O mês em um olhar', icon: House, end: true },
  { to: '/gastos', label: 'Gastos', short: 'Gastos', hint: 'Tudo o que a casa pagou', icon: ReceiptText, end: false },
  { to: '/mercado', label: 'Mercado', short: 'Mercado', hint: 'Lista de compras', icon: ShoppingBasket, end: false },
  { to: '/assinaturas', label: 'Assinaturas', short: 'Assinat.', hint: 'Cartões, notas e grafo', icon: Waypoints, end: false },
  { to: '/orcamentos', label: 'Orçamentos', short: 'Orçam.', hint: 'Limite mensal por categoria', icon: Gauge, end: false },
  { to: '/moradores', label: 'Moradores', short: 'Casa', hint: 'Quem deve a quem', icon: UsersRound, end: false },
  { to: '/ajustes', label: 'Ajustes', short: 'Ajustes', hint: 'Cores, backup e dados', icon: Settings2, end: false },
]
// no celular, quatro destinos ficam na barra e o resto atrás de "Mais"
const TABS = NAV.slice(0, 4)
const MORE = NAV.slice(4)
// na barra lateral a ordem segue o uso: dia a dia primeiro, configuração por último
const SIDEBAR = [NAV[0], NAV[1], NAV[2], NAV[4], NAV[5], NAV[3], NAV[6]]

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="var(--lime)" />
        <path d="M7 15.5 16 8l9 7.5V24a1 1 0 0 1-1 1h-5v-6h-6v6H8a1 1 0 0 1-1-1z" fill="var(--lime-ink)" />
      </svg>
      <span className={cn('text-base font-semibold tracking-[-0.01em]', compact && 'md:hidden xl:inline')}>Casa em Dia</span>
    </span>
  )
}

export function AppShell() {
  const data = useData()
  const persistError = useAppStore((s) => s.persistError)
  const openNew = useUi((s) => s.openNewTransaction)
  const dialogOpen = useUi((s) => s.transactionDialog !== null)
  const location = useLocation()
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)
  const section = location.pathname.split('/')[1] ?? ''
  const hasMembers = data.members.length > 0
  const inMore = MORE.some((item) => location.pathname.startsWith(item.to))
  // no Mercado, o canto inferior é do campo de digitar a lista
  // e no grafo ele taparia as assinaturas do canto
  const inGraph = section === 'assinaturas' && new URLSearchParams(location.search).get('v') === 'grafo'
  const showFab = hasMembers && section !== 'mercado' && !inGraph && !dialogOpen && !moreOpen

  // adianta o download do formulário quando o navegador estiver ocioso, para o primeiro toque abrir na hora
  useEffect(() => {
    const id = window.setTimeout(() => void loadDialog(), 2500)
    return () => window.clearTimeout(id)
  }, [])

  // cada tela começa do topo
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [section])

  return (
    <div className="min-h-dvh md:pl-[4.75rem] xl:pl-60">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Pular para o conteúdo
      </a>

      {/* barra lateral: estreita (só ícones) no tablet, completa a partir de 1280 px */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[4.75rem] flex-col border-r border-border bg-sidebar px-2 py-5 md:flex xl:w-60 xl:px-3">
        <div className="flex justify-center xl:justify-start xl:px-2">
          <Logo compact />
        </div>
        <nav aria-label="Seções" className="mt-8 flex flex-col gap-1">
          {SIDEBAR.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              className={({ isActive }) =>
                cn(
                  'press relative flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring xl:flex-row xl:gap-3 xl:px-3 xl:py-2.5 xl:text-sm',
                  isActive ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-lg bg-sidebar-accent"
                      transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
                    />
                  )}
                  <item.icon className="relative size-5 xl:size-4" strokeWidth={isActive ? 2.2 : 1.8} />
                  <span className="relative xl:hidden">{item.short}</span>
                  <span className="relative hidden xl:inline">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col items-center gap-4 xl:items-stretch">
          <Button
            size="lg"
            className="press size-12 justify-center gap-2 px-0 xl:h-11 xl:w-full xl:px-4"
            onClick={() => openNew()}
            disabled={!hasMembers}
            aria-label="Novo gasto"
          >
            <Plus className="size-5 xl:size-4" /> <span className="hidden xl:inline">Novo gasto</span>
          </Button>
          <div className="hidden items-center justify-between gap-2 rounded-xl border border-border px-3 py-2.5 xl:flex">
            <div className="min-w-0">
              <p className="eyebrow">casa</p>
              <p className="truncate text-sm font-medium">{data.household.name}</p>
            </div>
            <AvatarStack members={data.members.slice(0, 4)} />
          </div>
        </div>
      </aside>

      {/* cabeçalho do celular: rola junto com a página, não cobre nada */}
      <header className="flex items-center justify-between gap-3 px-5 pt-4 md:hidden">
        <Logo />
        <AvatarStack members={data.members.slice(0, 3)} />
      </header>

      {persistError && (
        <div role="alert" className="mx-5 mt-4 rounded-xl border border-critical/50 bg-critical/10 px-4 py-3 text-sm md:mx-6 xl:mx-8">
          {persistError}
        </div>
      )}

      <main
        id="conteudo"
        className="mx-auto w-full max-w-[1360px] px-5 pt-5 pb-[calc(var(--nav-h)+env(safe-area-inset-bottom)+5.5rem)] md:px-6 md:pt-7 md:pb-12 xl:px-8 xl:pt-8"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={section}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* botão flutuante: registrar gasto ao alcance do polegar, em qualquer tela */}
      <AnimatePresence>
        {showFab && (
          <motion.button
            type="button"
            onClick={() => openNew()}
            aria-label="Novo gasto"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
            className="fixed right-5 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom)+1rem)] z-30 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_24px_-8px_rgb(0_0_0/0.55)] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] md:hidden"
          >
            <Plus className="size-6" strokeWidth={2.4} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* barra inferior do celular; fundo opaco para nada aparecer por trás */}
      <nav
        aria-label="Seções"
        className="fixed inset-x-0 bottom-0 z-30 grid h-[calc(var(--nav-h)+env(safe-area-inset-bottom))] grid-cols-5 border-t border-border bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {TABS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'press flex min-w-0 flex-col items-center justify-center gap-1 px-0.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                isActive ? 'font-semibold text-primary' : 'text-muted-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className="size-[1.375rem]" strokeWidth={isActive ? 2.2 : 1.8} />
                <span className="max-w-full truncate">{item.short}</span>
              </>
            )}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className={cn(
            'press flex min-w-0 flex-col items-center justify-center gap-1 px-0.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
            inMore ? 'font-semibold text-primary' : 'text-muted-foreground',
          )}
        >
          <Ellipsis className="size-[1.375rem]" strokeWidth={inMore ? 2.2 : 1.8} />
          Mais
        </button>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{data.household.name}</DialogTitle>
            <DialogDescription>Outras áreas da casa.</DialogDescription>
          </DialogHeader>
          <ul className="-mx-2 flex flex-col">
            {MORE.map((item) => {
              const active = location.pathname.startsWith(item.to)
              return (
                <li key={item.to}>
                  <button
                    type="button"
                    onClick={() => {
                      setMoreOpen(false)
                      navigate(item.to)
                    }}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'press flex min-h-15 w-full items-center gap-4 rounded-xl px-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active ? 'bg-accent' : 'hover:bg-foreground/5',
                    )}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                      <item.icon className="size-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base font-medium">{item.label}</span>
                      <span className="block text-sm text-muted-foreground">{item.hint}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </DialogContent>
      </Dialog>

      <Suspense fallback={null}>{dialogOpen && <TransactionDialog />}</Suspense>
    </div>
  )
}
