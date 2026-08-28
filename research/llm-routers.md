# LLM Router Research

Levantamento de projetos existentes antes de implementar o ModelRouter (Fase 4).

---

## Projetos encontrados

### 1. ypollak2/llm-router
**URL:** https://github.com/ypollak2/llm-router
**Foco:** Router para ferramentas de coding (Claude Code, Cursor, Codex, Gemini CLI)
**Stack:** Python
**Abordagem de classificação:**
- Regex heurístico (gratuito, ~70% dos casos resolvidos sem LLM)
- Fallback para Ollama local (gratuito) para casos ambíguos
- Fallback para Gemini Flash (barato) se Ollama não disponível
- Cache LRU com SHA-256 para classificações repetidas
- Cache semântico com embeddings Ollama + cosine similarity
**Regras de roteamento:**
- Prompts curtos com verbos git/deploy simples → haiku (mais barato)
- Bugs de lógica, integração → sonnet (balanceado)
- Race conditions, arquitetura → opus (melhor raciocínio)
- COORDINATION_MAX_LEN = 150 chars (prompts longos nunca são "simples")
**Economia declarada:** 70–85%

---

### 2. alexrudloff/llmrouter
**URL:** https://github.com/alexrudloff/llmrouter
**Foco:** Proxy LLM genérico com classificação local
**Stack:** não especificado
**Abordagem de classificação:**
- 5 tiers: super_easy → easy → medium → hard → super_hard
- Classificador roda via Ollama local (zero custo de API)
**Providers suportados:** Anthropic, OpenAI, Google Gemini, Ollama
**Diferencial:** classificação 100% local via modelo leve

---

### 3. NadirClaw
**URL:** https://github.com/NadirRouter/NadirClaw
**Foco:** Proxy OpenAI-compatible com fallback chain
**Stack:** não especificado
**Abordagem:** fallback cascata — tenta modelo mais barato, sobe se falhar
**Providers:** Gemini, OpenAI, Anthropic, Ollama (via LiteLLM)
**Economia declarada:** 40–70%
**Limitação:** precisa de API keys (não usa Claude CLI)

---

### 4. SmarterRouter
**URL:** https://github.com/peva3/SmarterRouter
**Foco:** Gateway para Ollama/llama.cpp local com VRAM awareness
**Stack:** não especificado
**Diferencial:** perfil de VRAM por modelo, cache semântico, failover automático

---

### 5. LiteLLM Auto Router v2
**URL:** https://docs.litellm.ai/blog/autorouter-v2
**Foco:** Router de propósito geral para qualquer provider
**Abordagem:** roteamento por complexidade + semântico + adaptativo
**Limitação:** precisa de API keys, não usa Claude CLI

---

## O que nos diferencia

| Característica | Projetos acima | Nossa POC |
|---|---|---|
| Auth | API keys | Claude CLI (OAuth, sem key) |
| Backend local | Ollama via API | Ollama via API |
| Proxy | OpenAI-compatible | CLI wrapper direto |
| Classificador | LLM ou regex | Local Ollama (3b-agent) |
| Custo de classificação | Grátis a $0.0001 | Grátis (local) |

---

## O que aproveitar

### Da lógica do ypollak2/llm-router:
1. **Regex heurístico primeiro** — resolve ~70% sem chamar LLM
2. **COORDINATION_MAX_LEN** — prompts > 150 chars nunca são "triviais"
3. **Verbos git/deploy** como sinal de tarefa simples de coordenação
4. **Cache de classificação** — mesmo prompt não classifica duas vezes

### Do alexrudloff/llmrouter:
1. **5 tiers de complexidade** — mais granular que 4 níveis
2. **Classificador via Ollama** — zero custo de API, já temos o 3b-agent

---

## Decisão de implementação

Classificador em **duas camadas**:

```
Prompt
  ↓
Camada 1: Regex heurístico (instantâneo, gratuito)
  → trivial?   → local
  → simples?   → haiku
  ↓ ambíguo
Camada 2: qwen2.5-coder:3b-agent classifica
  → responde: local | haiku | sonnet | opus
  ↓
Executa no modelo escolhido
```

Sem cache semântico na primeira versão — complexidade desnecessária agora.

---

## Análise: SmarterRouter para nosso caso (M2 8GB, uso pessoal)

### Cache semântico
- Mantém até 500 entradas com TTL de 1h + LRU eviction
- **Para uso pessoal:** hit rate baixo — raramente a mesma tarefa se repete
- **Útil no agent loop (Fase 11+):** o modelo pode chamar as mesmas ferramentas com os mesmos args várias vezes na mesma sessão
- **Decisão:** implementar na Fase 13 (context manager), não antes

### VRAM profiling
- Rastreia qual modelo está carregado, descarrega via LRU se precisar de memória
- **Para nosso caso:** irrelevante — Ollama já gerencia VRAM automaticamente no M2, uso pessoal, no máximo 2 modelos
- **Decisão:** não implementar

### Failover automático
- Se o modelo primário não responde, escala para o próximo
- **Para nosso caso:** útil se Ollama estiver offline → cai pro Haiku automaticamente
- **Decisão:** implementar junto com o ModelRouter (Fase 4), como fallback simples

### Resumo
| Feature | Ganho real | Quando |
|---|---|---|
| Cache semântico | Baixo agora, médio no agent loop | Fase 13 |
| VRAM profiling | Zero | Nunca |
| Failover automático | Médio | Fase 4 |

---

## Referências

- https://github.com/ypollak2/llm-router
- https://github.com/alexrudloff/llmrouter
- https://github.com/NadirRouter/NadirClaw
- https://github.com/peva3/SmarterRouter
- https://docs.litellm.ai/blog/autorouter-v2
- https://medium.com/@michael.hannecke/implementing-llm-model-routing-a-practical-guide-with-ollama-and-litellm-b62c1562f50f
