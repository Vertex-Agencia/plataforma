import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const hoje = new Date().toISOString().split('T')[0]

    const { data: contratos, error: fetchError } = await supabase
      .from('manutencao_recorrente')
      .select('id, user_id, cliente_id, valor_mensal_acordado, data_vencimento_atual, duracao_meses, data_inicio_contrato')
      .eq('status', 'ativo')
      .lte('data_vencimento_atual', hoje)

    if (fetchError) throw fetchError
    if (!contratos || contratos.length === 0) {
      return new Response(JSON.stringify({ processados: 0 }), { status: 200 })
    }

    let processados = 0

    for (const contrato of contratos) {
      const vencimentoAtual = new Date(contrato.data_vencimento_atual)
      const proximoVencimento = new Date(vencimentoAtual)
      proximoVencimento.setMonth(proximoVencimento.getMonth() + 1)
      const proximaData = proximoVencimento.toISOString().split('T')[0]

      if (contrato.duracao_meses) {
        const inicio = new Date(contrato.data_inicio_contrato)
        const mesesDecorridos =
          (vencimentoAtual.getFullYear() - inicio.getFullYear()) * 12 +
          (vencimentoAtual.getMonth() - inicio.getMonth())
        if (mesesDecorridos >= contrato.duracao_meses) {
          await supabase
            .from('manutencao_recorrente')
            .update({ status: 'encerrado', updated_at: new Date().toISOString() })
            .eq('id', contrato.id)
          continue
        }
      }

      const { error: insertError } = await supabase
        .from('parcelas')
        .insert({
          user_id: contrato.user_id,
          cliente_id: contrato.cliente_id,
          manutencao_recorrente_id: contrato.id,
          origem: 'manutencao',
          numero_parcela: 1,
          total_parcelas: 1,
          valor_parcela: contrato.valor_mensal_acordado,
          data_vencimento: contrato.data_vencimento_atual,
          status: 'pendente',
        })

      if (insertError) continue

      await supabase
        .from('manutencao_recorrente')
        .update({
          data_vencimento_atual: proximaData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', contrato.id)

      processados++
    }

    return new Response(
      JSON.stringify({ processados, total: contratos.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Erro:', err instanceof Error ? err.message : 'unknown')
    return new Response(
      JSON.stringify({ error: 'Erro interno.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})