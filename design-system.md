# Compasso Design System (v0.1)

## 1. Filosofia

Interface sóbria, densa e legível, pensada para uso diário e longo. O Compasso é uma ferramenta de trabalho: o conteúdo (horas, projetos, descrições) vem antes da decoração. Tema claro e escuro desde o início, mobile-first nas telas de uso diário (PWA).

Princípios:
1. **Bordas, não sombras.** Hierarquia por borda fina e contraste de superfície; sombra só em elementos flutuantes (menus, diálogos).
2. **Vermelho é raro.** O vermelho da marca só aparece no cronômetro em andamento, em ações destrutivas e em alertas. Se tudo é vermelho, nada chama atenção.
3. **Números alinhados.** Toda duração, hora e total usa algarismos tabulares e fonte mono, para que colunas e cronômetro não "tremam".
4. **Densidade média.** Linhas de tabela de ~44 px, controles de 36 px (32 px no modo compacto), toque confortável no celular.
5. **Sem aparência genérica.** Nada de Inter/Geist, cinza-zinco padrão ou gradientes decorativos.

Stack de UI: Next.js (App Router), Tailwind CSS 4, componentes no padrão shadcn/ui (código no repositório, Radix UI por baixo), `lucide-react` para ícones, `next-themes` para o tema.

## 2. Tokens de cor

Definidos como variáveis CSS em `src/app/globals.css` e expostos ao Tailwind (`bg-background`, `text-muted-foreground`, `border-border` etc.). **Nunca use hex direto em componentes.**

| Token | Claro | Escuro | Uso |
| :-- | :-- | :-- | :-- |
| `background` | `#f7f9fb` | `#0a1b2a` | Fundo da página |
| `foreground` | `#0f2233` | `#e6eef5` | Texto principal |
| `card` / `popover` | `#ffffff` | `#0f2436` | Cartões, menus, diálogos |
| `primary` | `#1b6489` | `#479bbf` | Ação principal, links, foco de marca |
| `primary-foreground` | `#ffffff` | `#06182a` | Texto sobre `primary` |
| `secondary` | `#e8eef3` | `#16324a` | Ação secundária, badges |
| `muted` | `#eef2f6` | `#132b40` | Superfícies discretas, rodapés |
| `muted-foreground` | `#4a6074` | `#94a9bb` | Texto auxiliar |
| `accent` | `#e3edf4` | `#1a3a54` | Hover, item selecionado |
| `running` | `#d3212d` | `#e8434d` | Cronômetro em andamento |
| `destructive` | `#c81d28` | `#d43540` | Excluir, erros |
| `border` | `#d5dee6` | `#1f3a52` | Divisórias e bordas de cartão |
| `input` | `#7d93a5` | `#4d6a82` | Borda de campos (contraste de componente) |
| `ring` | `#479bbf` | `#479bbf` | Anel de foco |

Cores de marca (logo): azul-petróleo `#0e2e47`, azul-aço `#479bbf`, vermelho `#e6232f`, branco. O tema escuro do app é propositalmente **mais escuro e dessaturado** que o azul do logo, para descansar a vista; a cor exata do logo fica na identidade (cabeçalho e ícones).

Contraste medido (WCAG): texto principal ≥ 14:1; texto auxiliar ≥ 5,8:1; botão primário ≥ 5,5:1; borda de campo ≥ 3:1 no escuro e ~2,5:1 no claro (evoluir para 3:1 se necessário). Nunca use `#479bbf` como texto sobre branco (3,1:1).

## 3. Tipografia

- **Interface:** IBM Plex Sans (400, 500, 600, 700), self-hosted via `@fontsource` + `next/font/local`.
- **Valores, horas e código:** IBM Plex Mono (400, 500).
- **Relatórios em PDF (futuro):** títulos em Source Serif 4, corpo em Plex Sans.

| Elemento | Classes |
| :-- | :-- |
| Título de página | `text-3xl font-semibold tracking-tight` |
| Título de seção/cartão | `text-base font-semibold` (cartão), `text-lg font-semibold` (seção) |
| Rótulo de seção | `text-xs font-medium uppercase tracking-wide text-muted-foreground` |
| Texto auxiliar | `text-sm text-muted-foreground` |
| Valor de destaque | `font-mono text-3xl font-medium tabular-nums` |
| Cronômetro | `font-mono text-2xl font-medium tabular-nums` |

Regra: **todo valor numérico de tempo** usa `tabular-nums` (classe `.tabular`, elemento `<time>` ou `data-numeric` em células).

## 4. Componentes (`src/components/ui`)

| Componente | Variantes / notas |
| :-- | :-- |
| `Button` | `default`, `secondary`, `outline`, `ghost`, `destructive`, `link`; tamanhos `sm`, `default`, `lg`, `icon`. O botão "Parar" do cronômetro usa `bg-running`. |
| `Input` | Altura 36 px; `aria-invalid` mostra borda `destructive`. Sempre com `Label` ou `aria-label`. |
| `Label` | Radix Label. |
| `Card` (+ `CardHeader/Title/Description/Content`) | `rounded-lg border bg-card`, sem sombra. |
| `Badge` | `secondary` (tags), `default`, `outline`, `destructive` (em andamento). |
| `Table` (+ partes) | Cabeçalho em caixa-alta pequena; colunas numéricas com `data-numeric` e alinhadas à direita. |
| `Dialog` | Radix Dialog; título e descrição obrigatórios (acessibilidade). |
| `Select` | Radix Select; largura do menu = largura do gatilho. |
| `ThemeToggle` | Alterna sistema → claro → escuro; usa `next-themes` (classe `dark`). |
| `Logo` | Ícone 28 px + nome "Compasso". |

Adicionar novos componentes: o `components.json` já está configurado. No seu computador, `npx shadcn@latest add <componente>` gera o arquivo em `src/components/ui`; depois ajuste para usar apenas tokens (sem cores fixas) e rode `npm run lint && npm run typecheck`.

## 5. Layout e responsividade

- Conteúdo centralizado, `max-w-5xl`, gutter de 16 px (`px-4`); seções com `gap-10` e itens com `gap-4`.
- Breakpoints do Tailwind: `sm` 640, `md` 768, `lg` 1024.
- **Tabelas viram listas no celular.** Abaixo de `sm`, cada linha vira um item com data, organização · projeto, descrição, tag e duração (ver `/design`). Não usar rolagem horizontal para tabelas de uso diário.
- Cabeçalho fixo (`sticky top-0`) com logo, navegação e alternador de tema.
- Telas de uso diário no mobile: cronômetro, lista do dia e lançamento rápido. O calendário de arrastar é prioritariamente desktop/tablet.

## 6. Estados e interações

- **Foco:** anel de 2 px na cor `ring` (`:focus-visible` global). Nunca remover o foco sem substituto.
- **Hover:** mudança de fundo (`hover:bg-accent`, `hover:bg-primary/90`), sem deslocamento.
- **Desabilitado:** `opacity-50` e `pointer-events-none`.
- **Erro:** borda `destructive` no campo, mensagem em `text-destructive` abaixo, `aria-invalid`.
- **Em andamento:** botão e indicador em `running`; o tempo atualiza com `<time>` e algarismos tabulares.
- **Movimento:** `prefers-reduced-motion` desliga animações e transições.
- **Carregamento e vazio:** esqueleto com `bg-muted`; estados vazios com texto curto e uma ação primária (a definir nas telas).

## 7. Acessibilidade

- Contraste mínimo AA em texto; componentes interativos com alvo de toque ≥ 36 px.
- Ícones decorativos com `aria-hidden`; botões só com ícone com `aria-label`.
- Diálogos com título/descrição; menus navegáveis por teclado (Radix).
- Cor nunca é a única pista (o cronômetro em andamento também muda o texto do botão para "Parar").

## 8. Convenções de código

- Componentes em `PascalCase`, arquivos em `kebab-case`; utilitários em `src/lib`.
- `cn()` (`clsx` + `tailwind-merge`) para compor classes.
- Server Components por padrão; `"use client"` só onde há estado, efeitos ou Radix interativo.
- Sem CSS customizado fora de `globals.css` (tokens e regras base).
- Ícones: `lucide-react`, tamanho padrão `size-4`.

## 9. Referência viva

A rota `/design` renderiza todos os tokens e componentes nos dois temas. Ela fica oculta (404) em produção na Vercel (`VERCEL_ENV=production`) e tem `noindex`.

## 10. Pendências

- Versão vetorial (SVG) do logo e ícones finais; versão do logo para tema claro.
- Tokens de gráficos (paleta categórica validada) na etapa de relatórios.
- Componentes de calendário (blocos de tempo) e de seleção de data/hora.
- Revisar borda de campo no tema claro para 3:1.
