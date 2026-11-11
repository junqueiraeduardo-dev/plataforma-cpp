import { LocalRepository } from './localRepository'
import type { Repository } from './repository'

// Ponto único de troca: substitua por `new SupabaseRepository(client)` para ir à nuvem.
export const repository: Repository = new LocalRepository()
