import type { AppData, AppSettings, ID } from '@/domain/types'
import type { Collection, Repository } from './repository'
import { parseAppData } from './schema'

const KEY = 'casa-em-dia:v1'

export class LocalRepository implements Repository {
  private cache: AppData | null = null

  async load(): Promise<AppData | null> {
    let raw: string | null
    try {
      raw = localStorage.getItem(KEY)
    } catch {
      return null // armazenamento bloqueado (aba privada, por exemplo)
    }
    if (!raw) return null
    try {
      const parsed = parseAppData(JSON.parse(raw))
      if (!parsed.ok) {
        // preserva o conteúdo ilegível para recuperação manual, em vez de sobrescrever
        localStorage.setItem(`${KEY}:corrompido`, raw)
        return null
      }
      this.cache = parsed.data
      return parsed.data
    } catch {
      return null
    }
  }

  async replaceAll(data: AppData): Promise<void> {
    this.cache = data
    this.write()
  }

  async upsert<C extends Collection>(collection: C, item: AppData[C][number]): Promise<void> {
    if (!this.cache) return
    const list = this.cache[collection] as { id: ID }[]
    const index = list.findIndex((x) => x.id === item.id)
    const next = index === -1 ? [...list, item] : list.map((x, i) => (i === index ? item : x))
    this.cache = { ...this.cache, [collection]: next }
    this.write()
  }

  async remove(collection: Collection, id: ID): Promise<void> {
    if (!this.cache) return
    const list = this.cache[collection] as { id: ID }[]
    this.cache = { ...this.cache, [collection]: list.filter((x) => x.id !== id) }
    this.write()
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    if (!this.cache) return
    this.cache = { ...this.cache, settings }
    this.write()
  }

  async clear(): Promise<void> {
    this.cache = null
    localStorage.removeItem(KEY)
  }

  private write() {
    localStorage.setItem(KEY, JSON.stringify(this.cache))
  }
}
