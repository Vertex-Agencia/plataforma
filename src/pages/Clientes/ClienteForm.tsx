import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { createCliente, updateCliente } from '../../services/clientes'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input, Textarea, Select } from '../../components/ui/Input'
import type { Cliente } from '../../types/database'

interface Props {
  open: boolean
  onClose: () => void
  /** Presente = modo edição (dados cadastrais do cliente); ausente = criar cliente novo. */
  cliente?: Cliente | null
}

const FORM_VAZIO = {
  nome_razao_social: '',
  email_contato: '',
  telefone_contato: '',
  tipo_servico: 'implementacao' as 'implementacao' | 'manutencao',
  status: 'aguardando' as 'ativo' | 'inativo' | 'aguardando',
  forma_pagamento: 'pix' as 'pix' | 'boleto' | 'cartao' | 'transferencia',
  valor_total_acordado: '',
  observacao: '',
  quantidade_parcelas: '1',
  data_inicio_parcelas: new Date().toISOString().split('T')[0],
}

export function ClienteForm({ open, onClose, cliente }: Props) {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const editando = !!cliente
  const [form, setForm] = useState(FORM_VAZIO)

  // Sempre que o modal abre (criar ou editar um cliente diferente), preenche o formulário.
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      if (cliente) {
        setForm({
          nome_razao_social: cliente.nome_razao_social,
          email_contato: cliente.email_contato ?? '',
          telefone_contato: cliente.telefone_contato ?? '',
          tipo_servico: cliente.tipo_servico,
          status: cliente.status,
          forma_pagamento: cliente.forma_pagamento,
          valor_total_acordado: '',
          observacao: cliente.observacao ?? '',
          quantidade_parcelas: '1',
          data_inicio_parcelas: new Date().toISOString().split('T')[0],
        })
      } else {
        setForm(FORM_VAZIO)
      }
    }, 0)
    return () => clearTimeout(t)
  }, [open, cliente])

  const criarMutation = useMutation({
    mutationFn: () =>
      createCliente(
        {
          user_id: user!.id,
          nome_razao_social: form.nome_razao_social,
          email_contato: form.email_contato || null,
          telefone_contato: form.telefone_contato || null,
          tipo_servico: form.tipo_servico,
          status: form.status,
          forma_pagamento: form.forma_pagamento,
          valor_total_acordado: Number(form.valor_total_acordado),
          observacao: form.observacao || null,
          contrato_url: null,
        },
        { quantidade: Number(form.quantidade_parcelas), dataInicio: form.data_inicio_parcelas }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] })
      onClose()
    },
  })

  const editarMutation = useMutation({
    mutationFn: () =>
      updateCliente(cliente!.id, {
        nome_razao_social: form.nome_razao_social,
        email_contato: form.email_contato || null,
        telefone_contato: form.telefone_contato || null,
        tipo_servico: form.tipo_servico,
        status: form.status,
        forma_pagamento: form.forma_pagamento,
        observacao: form.observacao || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
      queryClient.invalidateQueries({ queryKey: ['cliente', user?.id, cliente?.id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] })
      onClose()
    },
  })

  const mutation = editando ? editarMutation : criarMutation

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    mutation.mutate()
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? 'Editar Cliente' : 'Novo Cliente'}
      size="lg"
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="accent" loading={mutation.isPending} onClick={handleSubmit as unknown as () => void}>
            {editando ? 'Salvar alterações' : 'Salvar Cliente'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Input label="Nome / Razão Social *" value={form.nome_razao_social} onChange={set('nome_razao_social')} required />
        </div>
        <Input label="Email" type="email" value={form.email_contato} onChange={set('email_contato')} />
        <Input label="Telefone" value={form.telefone_contato} onChange={set('telefone_contato')} />
        <Select label="Tipo de Serviço *" value={form.tipo_servico} onChange={set('tipo_servico')}>
          <option value="implementacao">Implementação</option>
          <option value="manutencao">Manutenção</option>
        </Select>
        <Select label="Status *" value={form.status} onChange={set('status')}>
          <option value="aguardando">Aguardando</option>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </Select>
        <Select label="Forma de Pagamento *" value={form.forma_pagamento} onChange={set('forma_pagamento')}>
          <option value="pix">PIX</option>
          <option value="boleto">Boleto</option>
          <option value="cartao">Cartão</option>
          <option value="transferencia">Transferência</option>
        </Select>
        {!editando && (
          <>
            <Input label="Valor Total (R$) *" type="number" step="0.01" min="0" value={form.valor_total_acordado} onChange={set('valor_total_acordado')} required />
            <Input label="Quantidade de Parcelas *" type="number" min="1" max="60" value={form.quantidade_parcelas} onChange={set('quantidade_parcelas')} required />
            <Input label="Data da 1ª Parcela *" type="date" value={form.data_inicio_parcelas} onChange={set('data_inicio_parcelas')} required />
          </>
        )}
        <div className="col-span-2">
          <Textarea label="Observações" value={form.observacao} onChange={set('observacao')} rows={3} />
        </div>
        {editando && (
          <p className="col-span-2 text-xs text-[#71717a]">
            Valor total e parcelas são gerenciados na seção "Parcelamento" do perfil do cliente.
          </p>
        )}
        {mutation.isError && (
          <div className="col-span-2 text-sm text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-[8px] px-3 py-2">
            Erro ao salvar cliente. Tente novamente.
          </div>
        )}
      </form>
    </Modal>
  )
}
