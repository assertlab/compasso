# Changelog

Formato inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões seguem o [SemVer](https://semver.org/lang/pt-BR/). Enquanto a versão principal for 0, mudanças de funcionalidade sobem o número do meio. A versão 1.0.0 marca a abertura do produto ao público.

## [Não lançado]

### Identidade visual
- O ícone do app instalado (PWA) e o ícone de tela de início do iOS passam a ter fundo azul-petróleo, em vez de branco: no ícone "any" os cantos são arredondados e transparentes; no do iOS o fundo é opaco (o sistema arredonda). Combinam com a tela de abertura e com o ícone adaptável do Android. Quem já instalou o app vê o novo ícone depois que o navegador atualizar o cache (service worker v4).

## [0.4.1] - 2026-10-16

Nova identidade visual: o logo passa a ser um relógio, em versão vetorial, e os ícones do app foram refeitos. Não há mudança de funcionalidade.

### Identidade visual
- Novo logo "relógio" (ADR-040). O cabeçalho, o menu lateral, as telas de entrada e as páginas legais passam a usar a marca vetorial, com fundo transparente, nítida nos temas claro e escuro (antes era uma imagem de fundo branco).
- Ícone do app instalado, ícone de tela de início do iOS e favicon refeitos. O ícone adaptável do Android (maskable) ganhou arte própria dentro da área segura e o favicon tem uma versão simplificada para 16 px. Quem já instalou o app pode ver o ícone novo só depois que o navegador atualizar o cache (service worker v3).
- O banner do relatório em PDF usa a marca vetorial, sem o quadrado branco do ícone anterior.
- Os arquivos do logo e o script que os gera ficam em `brand/relogio`; um teste confere que o componente do site e o do PDF continuam iguais ao SVG de origem.

### Documentação
- Guia de uso: nova subseção **Termos, privacidade e contato** (seção 8) e capturas da entrada, do código, da conta excluída e do acesso restrito refeitas na 0.4.0 (com o aviso de aceite e os links do rodapé; o e-mail da tela de código segue desfocado).

## [0.4.0] - 2026-10-14

Beta fechado: o acesso a contas novas passa a depender de uma lista de e-mails liberados, e o serviço ganha Termos de Uso e Política de Privacidade.

### Legal
- Novas páginas públicas **Termos de Uso** (`/termos`) e **Política de Privacidade** (`/privacidade`), em linguagem simples, abertas a quem ainda não entrou. A política diz quais dados são guardados, para quê, quais fornecedores os tratam (Neon, Vercel, Resend, Cloudflare e, se a pessoa escolher, Google ou GitHub), que há transferência para fora do Brasil, o que acontece com os dados ao excluir a conta e como exercer os direitos da LGPD. Responsável: ASSERT Lab; contato: `contato@assertlab.com`. Os textos ainda não passaram por revisão jurídica (isso fica para antes de qualquer abertura pública).
- A tela de entrada mostra o aviso de que, ao continuar, a pessoa concorda com os dois textos (com a data da versão) e que é preciso ter 18 anos ou mais; o rodapé de todas as telas ganhou os links. O aceite não é gravado no banco (ADR-039).

### Acesso
- **Beta fechado** (`ACCESS_MODE=closed`): só cria conta quem está na lista de e-mails liberados, tem um convite pendente para um workspace ou já tem conta. Quem tenta sem acesso não recebe código e cai na página **Acesso restrito**, que explica como pedir. A lista é gerida pelo script `scripts/access.ts` (listar, adicionar, remover); o login por Google e GitHub passa pela mesma regra na criação da conta. Em produção da Vercel a variável é obrigatória (o build falha sem ela). Nova tabela `allowed_emails` (migração 0007).

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

[0.4.1]: https://github.com/assertlab/compasso/releases/tag/v0.4.1
[0.4.0]: https://github.com/assertlab/compasso/releases/tag/v0.4.0
[0.3.1]: https://github.com/assertlab/compasso/releases/tag/v0.3.1
[0.3.0]: https://github.com/assertlab/compasso/releases/tag/v0.3.0
[0.2.1]: https://github.com/assertlab/compasso/releases/tag/v0.2.1
[0.2.0]: https://github.com/assertlab/compasso/releases/tag/v0.2.0
