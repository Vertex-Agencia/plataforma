import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Preferência global de ocultar valores financeiros (Dashboard, Financeiro, Clientes) — um único
// interruptor compartilhado entre todas as telas, persistido no navegador. Útil pra compartilhar
// a tela com alguém sem expor números sensíveis.
interface ValoresOcultosState {
  ocultos: boolean
  alternar: () => void
}

export const useValoresOcultosStore = create<ValoresOcultosState>()(
  persist(
    (set) => ({
      ocultos: false,
      alternar: () => set((state) => ({ ocultos: !state.ocultos })),
    }),
    { name: 'vertex-valores-ocultos' }
  )
)
