import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Domínios/caminhos que aparecem em qualquer site (botão de compartilhar, plugin, política de
// privacidade) mas não são o perfil de verdade do negócio — filtrados pra não confundir a análise.
const IGNORAR_TRECHOS_URL = [
  'facebook.com/sharer', 'facebook.com/share', 'facebook.com/plugins', 'facebook.com/tr',
  'facebook.com/policy', 'facebook.com/privacy', 'facebook.com/dialog',
  'instagram.com/accounts', 'instagram.com/explore', 'instagram.com/p/', 'instagram.com/reel/',
  'instagram.com/legal',
]

const SISTEMAS_CHAT = ['tawk.to', 'intercom', 'crisp.chat', 'zendesk', 'drift.com', 'tidio', 'chatwoot', 'jivosite', 'zopim']
const SISTEMAS_AGENDAMENTO = ['calendly', 'simplybook', 'agendor', 'setmore', 'booksy', 'acuityscheduling', 'agenda.digital']

const MODELO_PADRAO = 'gpt-5.6-terra'

// Espelho de PROMPT_PADRAO_AGENTE em src/constants/agenteIA.ts — se editar um lado, edite o
// outro. Usado só quando o usuário nunca personalizou o prompt em Configurações (agente_prompt
// null no banco).
const PROMPT_PADRAO = `Você é um analista de pré-vendas da Vertex, uma agência de automação de atendimento e vendas (WhatsApp, chatbots, agendamento automático, respostas automáticas) para pequenos e médios negócios no Brasil.

Você recebe, em JSON, sinais coletados automaticamente do site e das redes sociais públicas de um lead (potencial cliente). Sua tarefa:

1. Identifique de 2 a 4 brechas CONCRETAS e específicas onde automação resolveria um problema real desse negócio — baseadas apenas no que foi observado nos sinais, nunca inventadas ou genéricas.
2. Escreva uma mensagem curta de abordagem inicial (estilo WhatsApp, português informal-profissional, sem soar como spam ou script robótico), que mencione algo específico e real sobre o negócio como gancho.

Regras importantes:
- Nunca invente dados que não estão nos sinais fornecidos (nome de produto, promoção, evento etc.).
- Se os sinais forem escassos (site fora do ar, sem redes encontradas), seja honesto nisso — ainda assim, "site fora do ar" ou "sem resposta automática" já são brechas válidas.
- Responda ESTRITAMENTE em JSON válido, sem texto fora do JSON, no formato:
{"resumo": "...", "mensagem_abordagem": "..."}`

interface Sinais {
  site_acessivel: boolean
  site_texto_resumo: string | null
  site_tem_whatsapp: boolean
  site_tem_chat: boolean
  site_tem_agendamento_online: boolean
  instagram: Record<string, unknown> | null
  facebook: Record<string, unknown> | null
  apify_configurado: boolean
}

function extrairTexto(html: string): string {
  const semScriptEstilo = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
  const semTags = semScriptEstilo.replace(/<[^>]+>/g, ' ')
  return semTags.replace(/\s+/g, ' ').trim().slice(0, 6000)
}

function extrairLinkRedeSocial(html: string, dominio: 'instagram.com' | 'facebook.com'): string | null {
  const regex = new RegExp(`href=["']([^"']*${dominio.replace('.', '\\.')}\\/[^"'\\s]+)`, 'i')
  const matches = html.match(new RegExp(regex.source, 'gi')) ?? []
  for (const m of matches) {
    const urlMatch = m.match(regex)
    const url = urlMatch?.[1]
    if (!url) continue
    if (IGNORAR_TRECHOS_URL.some((trecho) => url.includes(trecho))) continue
    return url.startsWith('http') ? url : `https://${url}`
  }
  return null
}

function contemAlgum(html: string, termos: string[]): boolean {
  const lower = html.toLowerCase()
  return termos.some((t) => lower.includes(t))
}

function extrairHandleInstagram(url: string): string | null {
  const m = url.match(/instagram\.com\/([^/?#]+)/i)
  return m?.[1] ?? null
}

async function chamarApifyActor(actorId: string, input: unknown, apiToken: string): Promise<unknown[] | null> {
  try {
    const resp = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apiToken}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }
    )
    if (!resp.ok) return null
    const items = await resp.json()
    return Array.isArray(items) ? items : null
  } catch (err) {
    console.error(`[analisar-lead] Apify ${actorId} falhou:`, err)
    return null
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  let leadId: number | null = null

  try {
    const body = await req.json()
    // Aceita tanto invocação manual ({ lead_id }) quanto o payload padrão de
    // Database Webhook do Supabase ({ type: 'INSERT', table: 'leads', record: {...} }).
    leadId = body.lead_id ?? body.record?.id ?? null

    if (!leadId) {
      return new Response(JSON.stringify({ error: 'lead_id ausente.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, user_id, site, instagram_url, facebook_url')
      .eq('id', leadId)
      .single()
    if (leadError) throw leadError

    if (!lead.site) {
      await supabase.from('leads').update({ analise_status: 'sem_site', analisado_em: new Date().toISOString() }).eq('id', leadId)
      return new Response(JSON.stringify({ sucesso: true, status: 'sem_site' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await supabase.from('leads').update({ analise_status: 'pendente' }).eq('id', leadId)

    const { data: config } = await supabase
      .from('configuracoes')
      .select('apify_api_token, openai_api_key, agente_modelo, agente_prompt')
      .eq('user_id', lead.user_id)
      .maybeSingle()

    if (!config?.openai_api_key) {
      throw new Error('Configure sua chave da OpenAI em Configurações antes de analisar leads.')
    }

    // 1) Site
    const siteUrl = lead.site.startsWith('http') ? lead.site : `https://${lead.site}`
    let html = ''
    let siteAcessivel = true
    try {
      const resp = await fetch(siteUrl, { signal: AbortSignal.timeout(15000) })
      if (!resp.ok) siteAcessivel = false
      else html = await resp.text()
    } catch {
      siteAcessivel = false
    }

    const instagramUrl = lead.instagram_url ?? (html ? extrairLinkRedeSocial(html, 'instagram.com') : null)
    const facebookUrl = lead.facebook_url ?? (html ? extrairLinkRedeSocial(html, 'facebook.com') : null)

    // 2) Instagram / Facebook — só roda se achou link no site E há token da Apify configurado.
    let instagramDados: Record<string, unknown> | null = null
    let facebookDados: Record<string, unknown> | null = null

    if (config.apify_api_token) {
      if (instagramUrl) {
        const handle = extrairHandleInstagram(instagramUrl)
        if (handle) {
          const items = await chamarApifyActor(
            'apify~instagram-profile-scraper',
            { usernames: [handle] },
            config.apify_api_token
          )
          if (items?.[0]) instagramDados = items[0] as Record<string, unknown>
        }
      }
      if (facebookUrl) {
        const items = await chamarApifyActor(
          'apify~facebook-pages-scraper',
          { startUrls: [{ url: facebookUrl }] },
          config.apify_api_token
        )
        if (items?.[0]) facebookDados = items[0] as Record<string, unknown>
      }
    }

    const sinais: Sinais = {
      site_acessivel: siteAcessivel,
      site_texto_resumo: html ? extrairTexto(html) : null,
      site_tem_whatsapp: siteAcessivel && contemAlgum(html, ['wa.me/', 'api.whatsapp.com', 'whatsapp.com/send']),
      site_tem_chat: siteAcessivel && contemAlgum(html, SISTEMAS_CHAT),
      site_tem_agendamento_online: siteAcessivel && contemAlgum(html, SISTEMAS_AGENDAMENTO),
      instagram: instagramDados,
      facebook: facebookDados,
      apify_configurado: !!config.apify_api_token,
    }

    // 3) Análise com IA (OpenAI — modelo e prompt vêm de Configurações, com fallback padrão)
    const modelo = config.agente_modelo || MODELO_PADRAO
    const promptSistema = config.agente_prompt || PROMPT_PADRAO

    const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openai_api_key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: modelo,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: promptSistema },
          { role: 'user', content: JSON.stringify(sinais) },
        ],
      }),
    })

    if (!aiResp.ok) {
      throw new Error(`Erro na API da OpenAI (${aiResp.status}): ${await aiResp.text()}`)
    }

    const aiData = await aiResp.json()
    const textoResposta: string = aiData.choices?.[0]?.message?.content ?? ''

    let resumo = textoResposta
    let mensagemAbordagem = ''
    try {
      const parsed = JSON.parse(textoResposta)
      resumo = parsed.resumo ?? textoResposta
      mensagemAbordagem = parsed.mensagem_abordagem ?? ''
    } catch {
      // Modelo não devolveu JSON estrito — usa o texto puro como resumo mesmo assim.
    }

    await supabase
      .from('leads')
      .update({
        instagram_url: instagramUrl,
        facebook_url: facebookUrl,
        analise_status: 'concluida',
        analise_resumo: resumo,
        analise_mensagem: mensagemAbordagem,
        analise_sinais: sinais,
        analise_erro: null,
        analisado_em: new Date().toISOString(),
      })
      .eq('id', leadId)

    return new Response(JSON.stringify({ sucesso: true, status: 'concluida' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const mensagem = err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
      ? (err as { message: string }).message
      : 'Erro desconhecido.'
    console.error('[analisar-lead] Erro:', mensagem)

    if (leadId) {
      await supabase.from('leads').update({ analise_status: 'erro', analise_erro: mensagem, analisado_em: new Date().toISOString() }).eq('id', leadId)
    }

    return new Response(JSON.stringify({ error: 'Erro ao analisar lead.', detalhe: mensagem }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
