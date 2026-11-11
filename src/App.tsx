import { MotionConfig } from 'motion/react'
import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/app/AppShell'
import ClickSpark from '@/components/reactbits/ClickSpark'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { OverviewPage } from '@/features/overview/OverviewPage'
import { applyTheme } from '@/lib/applyTheme'
import { useThemeColors } from '@/store/selectors'
import { useAppStore } from '@/store/useAppStore'

// só a Visão geral vem no pacote inicial; cada outra tela é baixada quando o usuário a abre
const TransactionsPage = lazy(() => import('@/features/transactions/TransactionsPage').then((m) => ({ default: m.TransactionsPage })))
const MarketPage = lazy(() => import('@/features/market/MarketPage').then((m) => ({ default: m.MarketPage })))
const BudgetsPage = lazy(() => import('@/features/budgets/BudgetsPage').then((m) => ({ default: m.BudgetsPage })))
const MembersPage = lazy(() => import('@/features/members/MembersPage').then((m) => ({ default: m.MembersPage })))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const VaultPage = lazy(() => import('@/features/vault/VaultPage'))

const later = (page: React.ReactNode) => <Suspense fallback={<Loading />}>{page}</Suspense>

// Dentro de uma página incorporada (sem controle da barra de endereço) as rotas ficam em memória.
const Router = import.meta.env.VITE_ROUTER === 'memory' ? MemoryRouter : BrowserRouter

function Loading() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center text-sm text-muted-foreground" role="status">
      Carregando…
    </div>
  )
}

export default function App() {
  const status = useAppStore((s) => s.status)
  const hydrate = useAppStore((s) => s.hydrate)

  const settings = useAppStore((s) => s.data.settings)
  const theme = useThemeColors()

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    if (status === 'ready') applyTheme(settings)
  }, [status, settings])

  if (status === 'loading') return <Loading />

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={200}>
        <ClickSpark sparkColor={theme.primary} sparkSize={7} sparkRadius={16} sparkCount={6} duration={380}>
          <Router>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<OverviewPage />} />
                <Route path="gastos" element={later(<TransactionsPage />)} />
                <Route path="mercado" element={later(<MarketPage />)} />
                <Route path="orcamentos" element={later(<BudgetsPage />)} />
                <Route path="moradores" element={later(<MembersPage />)} />
                <Route path="assinaturas/:noteId?" element={later(<VaultPage />)} />
                <Route path="ajustes" element={later(<SettingsPage />)} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Router>
        </ClickSpark>
        {/* no celular os avisos sobem para não cobrir a barra inferior nem o botão flutuante */}
        <Toaster position="bottom-right" theme={theme.dark ? 'dark' : 'light'} mobileOffset={{ bottom: '9.5rem' }} />
      </TooltipProvider>
    </MotionConfig>
  )
}
