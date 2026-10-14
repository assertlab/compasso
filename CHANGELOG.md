# Changelog

Formato inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões seguem o [SemVer](https://semver.org/lang/pt-BR/). Enquanto a versão principal for 0, mudanças de funcionalidade sobem o número do meio. A versão 1.0.0 marca a abertura do produto ao público.

## [Não lançado]

## [0.3.1] - 2026-10-14

Correções da revisão de fechamento da 0.3.0, na exclusão de conta.

### Segurança
- Na exclusão de conta, os dados de acesso (sessões, vínculos do login) agora são apagados antes das marcas nos workspaces: antes, uma requisição da mesma pessoa durante a exclusão podia reativar um vínculo recém-removido. A limpeza de códigos de e-mail deixou de tratar `%`, `_` e `\` do endereço como curingas e passou a apagar também os contadores de limite de taxa ligados ao e-mail (um hash sem sal, que daria para adivinhar). Se dois pedidos de código chegarem juntos, vale o mais recente. A mensagem de falha da exclusão passou a dizer o que fazer.
## [0.3.0] - 2026-10-14

A pessoa passa a controlar os próprios dados: baixar uma cópia e excluir a conta, na nova página Minha conta.

### Conta e dados
- Nova página **Minha conta** (`/conta`), acessível pelo menu da conta, com **Exportar meus dados**: baixa em JSON os registros de horas da própria pessoa em todos os workspaces (inclusive os removidos e o cronômetro em andamento), os nomes de clientes, projetos, tarefas e tags que eles usam e os dados da conta, sem dados de outras pessoas. Usa o mesmo limite de exportações dos relatórios.
  As tags de cada registro saem sempre na mesma ordem (a do catálogo), para dois downloads dos mesmos dados darem o mesmo arquivo.
- **Excluir minha conta**, na mesma página, em uma "zona de perigo": a exclusão é imediata e irreversível e exige duas provas, um código de 6 dígitos enviado ao e-mail da conta (vale 10 minutos, 3 tentativas, no máximo 3 pedidos por hora) e a palavra EXCLUIR digitada. Nome, e-mail e acessos são apagados; as horas registradas ficam nos workspaces como "Usuário removido" e workspaces em que a pessoa era a única são arquivados. Quem é a única pessoa administradora de um workspace com outros membros não consegue excluir: a tela lista esses workspaces. Depois da exclusão, o login mostra um aviso de conta excluída.

## [0.2.1] - 2026-10-14

Correções de segurança: o desafio anti-bot do login por código, que estava desligado em produção, passa a valer e a política de conteúdo (CSP) passa a ser aplicada.

### Segurança
- O desafio do Cloudflare Turnstile no envio do código de login estava desligado em produção, porque as variáveis `TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY` nunca tinham sido criadas. Foi ativado e verificado em produção: sem o token do desafio, o envio do código é recusado.
- O deploy de produção na Vercel agora falha no build se essas duas variáveis não estiverem definidas, para a falta não passar despercebida de novo. Preview e desenvolvimento seguem com o desafio opcional.
- A política de segurança de conteúdo (CSP) completa passa a ser aplicada, não só reportada: só carrega scripts, quadros e conexões do próprio site e do desafio do Turnstile. Verificada em produção no login por código, no login com GitHub, nas telas do app e no PWA offline. Limite conhecido: `script-src` mantém `'unsafe-inline'`, então não barra um script inline injetado.

## [0.2.0] - 2026-10-13

Primeira versão etiquetada. Reúne tudo o que foi construído desde a estrutura inicial: registro de tempo, relatórios e exportação, acesso por papéis, login próprio e a rodada de endurecimento de segurança.

### Registro de tempo
- Cronômetro (um ativo por pessoa), lançamento manual com data de término explícita e marcador "+1", edição, duplicação, "iniciar novamente" e remoção com desfazer.
- Histórico agrupado por semana e dia, com totais e agrupamento de atividades repetidas; sugestões de descrição a partir dos próprios registros.
- Calendário semanal: lançar arrastando em espaço vazio, mover e redimensionar blocos.
- Marcação de faturável por registro.

### Relatórios e exportação
- Relatório por período, cliente, projeto, tarefa e pessoa, agrupado por descrição ou tarefa, com visão por dia ou semana.
- Exportação em XLSX, CSV e PDF, com valores de tempo numéricos. Limite de 10 exportações por minuto e 60 por hora por pessoa.
- Painel com destaques do período e gráficos de horas por dia, projeto, descrição e pessoa, com os mesmos filtros do relatório.

### Cadastros e acesso
- Clientes, projetos (cor, arquivamento e participantes), tarefas e tags.
- Papéis proprietário, administrador e membro: o membro lança horas só nos projetos liberados e vê só os próprios registros; o administrador corrige registros de membros com trilha de auditoria.
- Gestão de membros e convites por e-mail; convites pendentes visíveis só a administradores.
- Remoção lógica e anonimização de conta (LGPD).

### Autenticação
- Login por código de 6 dígitos no e-mail, Google e GitHub, sobre o Better Auth (substitui o Clerk); verificação anti-bot (Cloudflare Turnstile) no envio do código.
- Limites de pedido de código por e-mail e por IP; código armazenado como hash; rotas de redefinição de senha por código desligadas.

### Segurança (auditoria de outubro de 2026, ADR-036)
- Cabeçalhos de segurança em todas as rotas e CSP completa em modo Report-Only (ainda não aplicada).
- Login social só com e-mail verificado, limites de abuso em convites, logs sem dados pessoais, saída voluntária do workspace.
- Dependabot, ações do CI fixadas por SHA, regra de lint contra acesso direto ao banco fora de `src/server`.

### Interface e plataforma
- Navegação lateral (Analisar e Gerenciar) e menu no celular, modo escuro, acessibilidade revisada com o Lighthouse.
- PWA instalável com página offline.
- Versão visível na interface e rodapé.

### Documentação
- [Guia de uso](./docs/guia-de-uso/README.md) com capturas de tela.

### Banco de dados
- Migrações 0000 a 0006. A 0006 remove as colunas legadas do Clerk e já foi aplicada em produção.

## [0.1.0] - 2026-10-06

Estrutura inicial: Next.js, esquema Drizzle, base da PWA, design system e integração contínua.

[0.3.1]: https://github.com/assertlab/compasso/releases/tag/v0.3.1
[0.3.0]: https://github.com/assertlab/compasso/releases/tag/v0.3.0
[0.2.1]: https://github.com/assertlab/compasso/releases/tag/v0.2.1
[0.2.0]: https://github.com/assertlab/compasso/releases/tag/v0.2.0
