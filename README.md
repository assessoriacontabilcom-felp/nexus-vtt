# Nexus VTT — Plataforma Multi-Sistema de RPG

Plataforma web modular para mesas virtuais de RPG, projetada para suportar múltiplos sistemas com regras automatizadas, fichas interativas e ferramentas completas para Mestres e Jogadores.

## Estado Atual (v0.1 — MVP Assimilação RPG)
- **Ficha Interativa (Frente e Verso):** Cálculo automático de Saúde por nível, Cabo de Guerra (Determinação x Assimilação), inventário e anotações com salvamento local.
- **Rolador Automatizado:** Pool de dados customizados (d6/d10/d12) com símbolos oficiais (Joaninha, Cervo, Coruja) e detecção automática de bônus de Características.
- **Catálogos em JSON:** Bancos de dados completos de Características, Assimilações e Itens.

## Roadmap (Próximas Etapas)
- [ ] **Sincronização em Tempo Real:** Salas multiplayer conectando Mestre e Jogadores (WebSockets / Supabase / Firebase).
- [ ] **Escudo do Mestre (Assimilação RPG):** Controle de Crises, Refúgio, Ameaças, turnos de Conflito e rolagens ocultas.
- [ ] **Expansão Multi-Sistema:** Módulos independentes para *Ordem Paranormal*, *Call of Cthulhu 7e* e *Sacramento*.
- [ ] **Contas & Assinaturas:** Autenticação de usuários, armazenamento em nuvem de campanhas e planos para Mestres.


-- Essas últimas duas ainda fora de cogitação para implementação, o plano primario é fazer com que cada sistema adicionado ao site, atenda 100% ou pelo menos tente abranger complamente as regras do livro.


## Como rodar localmente
1. Clone o repositório:
   ```bash
   git clone <https://github.com/thur28/nexus-vtt>

2. Abra a pasta no VS Code e inicie o index.html com a extensão Live Server.