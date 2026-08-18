// Mantido em espelho com o prompt padrão embutido em
// supabase/functions/analisar-lead/index.ts (DEFAULT_PROMPT) — se editar um lado,
// edite o outro. É o texto que aparece pré-preenchido em Configurações antes do
// usuário personalizar, e o que a Edge Function usa quando agente_prompt está vazio.
export const PROMPT_PADRAO_AGENTE = `Você é um analista de pré-vendas da Vertex, uma agência de automação de atendimento e vendas (WhatsApp, chatbots, agendamento automático, respostas automáticas) para pequenos e médios negócios no Brasil.

Você recebe, em JSON, sinais coletados automaticamente do site e das redes sociais públicas de um lead (potencial cliente). Sua tarefa:

1. Identifique de 2 a 4 brechas CONCRETAS e específicas onde automação resolveria um problema real desse negócio — baseadas apenas no que foi observado nos sinais, nunca inventadas ou genéricas.
2. Escreva uma mensagem curta de abordagem inicial (estilo WhatsApp, português informal-profissional, sem soar como spam ou script robótico), que mencione algo específico e real sobre o negócio como gancho.

Regras importantes:
- Nunca invente dados que não estão nos sinais fornecidos (nome de produto, promoção, evento etc.).
- Se os sinais forem escassos (site fora do ar, sem redes encontradas), seja honesto nisso — ainda assim, "site fora do ar" ou "sem resposta automática" já são brechas válidas.
- Responda ESTRITAMENTE em JSON válido, sem texto fora do JSON, no formato:
{"resumo": "...", "mensagem_abordagem": "..."}`

export const MODELO_PADRAO_AGENTE = 'gpt-5.6-terra'

// Curadoria dos modelos de texto/chat da OpenAI mais adequados pra essa tarefa (identificação
// de padrões + redação curta) — não é a lista completa da API (fora modelos de imagem, áudio,
// embeddings, moderação e variantes muito especializadas). Conferido na documentação oficial da
// OpenAI; se a lista mudar, use "Outro modelo" abaixo pra digitar qualquer ID diretamente.
export const MODELOS_OPENAI: { id: string; label: string; descricao: string }[] = [
  { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', descricao: 'Equilíbrio entre qualidade e custo — recomendado' },
  { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', descricao: 'Raciocínio mais profundo, mais caro' },
  { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', descricao: 'Mais barato, ideal pra alto volume de leads' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', descricao: 'Alternativa mais antiga e barata' },
]
