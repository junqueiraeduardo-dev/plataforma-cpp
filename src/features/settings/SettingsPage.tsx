import { Download, Eraser, RotateCcw, Upload } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { AppearanceSection } from './AppearanceSection'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { parseAppData } from '@/data/schema'
import { today } from '@/domain/dates'
import { useAppStore, useData } from '@/store/useAppStore'

const MAX_IMPORT_BYTES = 5 * 1024 * 1024
const EMBEDDED = import.meta.env.VITE_ROUTER === 'memory'

export function SettingsPage() {
  const data = useData()
  const renameHousehold = useAppStore((s) => s.renameHousehold)
  const importData = useAppStore((s) => s.importData)
  const resetDemo = useAppStore((s) => s.resetDemo)
  const clearAll = useAppStore((s) => s.clearAll)
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(data.household.name)
  const [importError, setImportError] = useState<string | null>(null)

  const saveName = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    renameHousehold(name)
    toast.success('Nome da casa atualizado')
  }

  const exportBackup = async () => {
    const json = JSON.stringify(data, null, 2)
    if (EMBEDDED) {
      // páginas incorporadas não podem iniciar downloads: o backup vai para a área de transferência
      try {
        await navigator.clipboard.writeText(json)
        toast.success('Backup copiado', { description: 'Cole o texto em um arquivo .json para guardar.' })
      } catch {
        toast.error('Não foi possível copiar o backup', { description: 'O navegador recusou o acesso à área de transferência.' })
      }
      return
    }
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `casa-em-dia-${today()}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Backup exportado', { description: a.download })
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setImportError(null)
    if (file.size > MAX_IMPORT_BYTES) {
      setImportError('O arquivo passa de 5 MB e não parece ser um backup do Casa em Dia.')
      return
    }
    try {
      const parsed = parseAppData(JSON.parse(await file.text()))
      if (!parsed.ok) {
        setImportError(`O arquivo não é um backup válido (${parsed.error}). Nada foi alterado.`)
        return
      }
      importData(parsed.data)
      setName(parsed.data.household.name)
      toast.success('Backup importado', {
        description: `${parsed.data.transactions.length} gastos e ${parsed.data.notes.length} notas restaurados.`,
      })
    } catch {
      setImportError('Não foi possível ler o arquivo. Ele precisa ser um JSON exportado por este aplicativo. Nada foi alterado.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <>
      <PageHeader title="Ajustes" description="Nome da casa, cores, backup e dados de exemplo." />

      <div className="grid max-w-3xl gap-4 lg:gap-5">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold">Casa</h2>
          <form onSubmit={saveName} className="mt-3 flex flex-wrap items-end gap-2">
            <div className="flex min-w-56 flex-1 flex-col gap-1.5">
              <Label htmlFor="house-name">Nome</Label>
              <Input id="house-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
            <Button type="submit" variant="secondary" disabled={!name.trim() || name.trim() === data.household.name}>
              Salvar
            </Button>
          </form>
        </section>

        <AppearanceSection />

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold">Backup</h2>
          <p className="mt-1 max-w-[60ch] text-sm text-muted-foreground">
            Os dados ficam apenas neste navegador. Exporte um arquivo para guardar uma cópia ou levar tudo para outro
            aparelho. Importar substitui o que está aqui.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => void exportBackup()} className="press gap-2">
              <Download className="size-4" /> {EMBEDDED ? 'Copiar backup' : 'Exportar backup'}
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()} className="press gap-2">
              <Upload className="size-4" /> Importar backup
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="Arquivo de backup"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </div>
          {importError && (
            <p role="alert" className="mt-3 rounded-lg border border-critical/50 bg-critical/10 px-3 py-2 text-sm">
              {importError}
            </p>
          )}
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm sm:grid-cols-4">
            {(
              [
                ['Moradores', data.members.length],
                ['Gastos', data.transactions.length],
                ['Notas', data.notes.length],
                ['Itens no mercado', data.shopping.length],
              ] as const
            ).map(([label, count]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="num mt-0.5 text-lg font-semibold">{count}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold">Recomeçar</h2>
          <p className="mt-1 max-w-[60ch] text-sm text-muted-foreground">
            As duas ações abaixo substituem tudo o que está salvo. Exporte um backup antes, se quiser voltar atrás.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Confirm
              trigger={
                <Button variant="secondary" className="gap-2">
                  <RotateCcw className="size-4" /> Restaurar dados de exemplo
                </Button>
              }
              title="Restaurar os dados de exemplo?"
              description="Os gastos, moradores, orçamentos e notas atuais serão substituídos pela casa de demonstração."
              confirm="Restaurar exemplo"
              onConfirm={() => {
                resetDemo()
                setName(useAppStore.getState().data.household.name)
                toast.success('Dados de exemplo restaurados')
              }}
            />
            <Confirm
              trigger={
                <Button variant="destructive" className="gap-2">
                  <Eraser className="size-4" /> Apagar tudo
                </Button>
              }
              title="Apagar todos os dados?"
              description="A casa fica vazia: sem moradores, gastos, orçamentos ou notas. Esta ação não pode ser desfeita."
              confirm="Apagar tudo"
              onConfirm={() => {
                clearAll()
                toast('Todos os dados foram apagados')
              }}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold">Onde os dados moram</h2>
          <p className="mt-1 max-w-[60ch] text-sm text-muted-foreground">
            Hoje, no armazenamento local do navegador: nada sai deste aparelho e não há login. A aplicação já lê e grava
            por uma camada única de dados, pronta para ser trocada por um banco na nuvem quando a casa quiser sincronizar
            entre aparelhos.
          </p>
        </section>
      </div>
    </>
  )
}

function Confirm({
  trigger,
  title,
  description,
  confirm,
  onConfirm,
}: {
  trigger: React.ReactNode
  title: string
  description: string
  confirm: string
  onConfirm: () => void
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirm}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
