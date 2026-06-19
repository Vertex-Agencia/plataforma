export type TipoServico = 'implementacao' | 'manutencao'
export type StatusCliente = 'ativo' | 'inativo' | 'aguardando'
export type FormaPagamento = 'pix' | 'boleto' | 'cartao' | 'transferencia'
export type StatusParcela = 'pendente' | 'pago'
export type OrigemParcela = 'implementacao' | 'manutencao'
export type TipoTransacao = 'entrada' | 'saida'
export type PeriodicidadeDespesa = 'semanal' | 'mensal' | 'trimestral' | 'anual'
export type StatusProjeto = 'nao_iniciado' | 'em_andamento' | 'concluido' | 'pausado'
export type StatusEtapaProjeto = 'pendente' | 'concluido'
export type TipoProjeto = 'website' | 'aplicativo' | 'ecommerce' | 'sistema' | 'landing_page' | 'outro'
export type NivelComplexidade = 'baixo' | 'medio' | 'alto'
export type StatusReuniao = 'agendada' | 'realizada' | 'cancelada'
export type StatusLeitura = 'nao_lido' | 'lido'
export type StatusManutencaoRecorrente = 'ativo' | 'encerrado'

export interface Cliente {
  id: number
  user_id: string
  nome_razao_social: string
  email_contato: string | null
  telefone_contato: string | null
  tipo_servico: TipoServico
  status: StatusCliente
  forma_pagamento: FormaPagamento
  valor_total_acordado: number
  observacao: string | null
  contrato_url: string | null
  created_at: string
  updated_at: string
}

export interface ManutencaoRecorrente {
  id: number
  user_id: string
  cliente_id: number
  valor_mensal_acordado: number
  data_inicio_contrato: string
  duracao_meses: number | null
  data_vencimento_atual: string
  status: StatusManutencaoRecorrente
  created_at: string
  updated_at: string
}

export interface Parcela {
  id: number
  user_id: string
  cliente_id: number
  manutencao_recorrente_id: number | null
  origem: OrigemParcela
  numero_parcela: number
  total_parcelas: number
  valor_parcela: number
  data_vencimento: string
  status: StatusParcela
  data_pagamento: string | null
  created_at: string
  updated_at: string
}

export interface EntradaSaida {
  id: number
  user_id: string
  descricao: string
  valor: number
  tipo: TipoTransacao
  data_transacao: string
  emitido_nota_fiscal: boolean
  cliente_id: number | null
  created_at: string
  updated_at: string
}

export interface DespesaRecorrente {
  id: number
  user_id: string
  nome: string
  valor: number
  periodicidade: PeriodicidadeDespesa
  data_inicio: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface Projeto {
  id: number
  user_id: string
  nome: string
  cliente_id: number
  status: StatusProjeto
  tipo_projeto: TipoProjeto | null
  data_inicio: string | null
  data_limite: string | null
  nivel_complexidade: NivelComplexidade | null
  observacoes: string | null
  created_at: string
  updated_at: string
}

export interface EtapaProjeto {
  id: number
  user_id: string
  projeto_id: number
  nome: string
  status: StatusEtapaProjeto
  created_at: string
  updated_at: string
}

export interface Reuniao {
  id: number
  user_id: string
  titulo: string
  data_hora: string
  descricao_pauta: string | null
  status: StatusReuniao
  cliente_id: number | null
  created_at: string
  updated_at: string
}

export interface AreaEstudo {
  id: number
  user_id: string
  url_link: string
  titulo: string
  descricao: string | null
  categoria: string | null
  status_leitura: StatusLeitura
  created_at: string
  updated_at: string
}

export interface Insight {
  id: number
  user_id: string
  area_estudo_id: number
  nota_insight: string
  created_at: string
  updated_at: string
}

export interface Database {
  public: {
    Tables: {
      clientes: {
        Row: Cliente
        Insert: Omit<Cliente, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Cliente, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      manutencao_recorrente: {
        Row: ManutencaoRecorrente
        Insert: Omit<ManutencaoRecorrente, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ManutencaoRecorrente, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      parcelas: {
        Row: Parcela
        Insert: Omit<Parcela, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Parcela, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      entradas_saidas: {
        Row: EntradaSaida
        Insert: Omit<EntradaSaida, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<EntradaSaida, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      despesas_recorrentes: {
        Row: DespesaRecorrente
        Insert: Omit<DespesaRecorrente, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<DespesaRecorrente, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      projetos: {
        Row: Projeto
        Insert: Omit<Projeto, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Projeto, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      etapas_projeto: {
        Row: EtapaProjeto
        Insert: Omit<EtapaProjeto, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<EtapaProjeto, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      reunioes: {
        Row: Reuniao
        Insert: Omit<Reuniao, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Reuniao, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      area_estudo: {
        Row: AreaEstudo
        Insert: Omit<AreaEstudo, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<AreaEstudo, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      insights: {
        Row: Insight
        Insert: Omit<Insight, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Insight, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
