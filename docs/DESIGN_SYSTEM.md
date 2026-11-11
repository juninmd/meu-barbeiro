# Navalha 2.0 — design system do Meu Barbeiro

Vitrine viva: abra **/design-system** (no modo demonstração `pnpm dev`, ou logado como administrador) para ver cores,
tipografia, botões, campos, feedback, superfícies e calendário renderizados com os componentes reais.

## Princípios
1. **A marca é da barbearia.** Porcelana fria e grafite como base; a cor escolhida pela barbearia (`--amber`, cobalto por padrão)
   tinge botões, gráficos e a página pública. O vermelho do poste de barbeiro (`pole`) marca só o "agora" e detalhes de identidade.
2. **Um toque por decisão.** Agendamento em duas telas, "Repetir último", deslize para concluir, botão flutuante de encaixe,
   paleta ⌘K que executa ações.
3. **Movimento explica.** Pressão (3% ao toque), chegada (fade-up em cascata), folha (mola), conquista (pop, check desenhado),
   viva (pulso do agora). Tudo some com `prefers-reduced-motion`.
4. **Toque primeiro.** Alvo mínimo de 44px, calendário com células grandes, barra de ação fixa no celular, campos a 16px (sem zoom no iOS).
5. **Acessível por construção.** Radix para diálogo, menu, abas e dica (foco preso, Esc, teclado, ARIA); rótulo sempre visível;
   erro ligado ao campo por `aria-describedby`; respeita `prefers-reduced-motion`.
6. **Uma fonte de verdade.** Tokens em `web/src/index.css`; nada de cor solta em componente novo.

## Fundamentos (tokens)
| Grupo | Tokens | Uso |
|---|---|---|
| Neutros "porcelana" | `porcelain-50…900` | superfícies (`surface`, `paper`), bordas (`line`), texto (`ink`, `muted`) |
| Marca padrão "cobalto" | `cobalt-50…800` | vitrine; na interface use `brand*`, que segue `--amber` e **muda por barbearia** em runtime. `on-brand` (branco ou grafite) é calculado pelo contraste em `lib/brand.ts` |
| Poste | `pole`, `pole-ink` | linha do "agora", ponto ao vivo, faixa diagonal (`.barber-pole`); `pole-ink` para texto |
| Estados | `success`, `danger`, `info` (`-50`/`-600`) | badges, erros, confirmações |
| Raio | `rounded-xl` (controles) · `rounded-2xl` (cartões) · `rounded-3xl` (diálogos) | |
| Sombra | `shadow-xs/sm/md/lg/glow` | elevação em camadas |
| Tipografia | `font-serif` (Bricolage Grotesque, condensada e pesada) · `font-sans` (Geist) · `font-mono` (Geist Mono) | títulos · interface · horários, preços e rótulos |
| Movimento | `--ease-out-quint`, `--ease-spring`, `animate-fade-up`, `animate-pop`, `.live-dot`, `tw-animate-css` | entradas, conquistas e estado ao vivo. Cartões com barra fixa dentro usam só opacidade (transform criaria bloco de contenção) |

## Componentes (`web/src/components/ui`)
| Componente | Base | Notas |
|---|---|---|
| `Button` | cva | `primary` · `dark` · `ghost` · `danger`; `sm/md/lg`; `loading` |
| `SwipeAction`, `ProgressRing` | — | deslize para confirmar (Enter/leitor de tela ativam direto) · anel animado de meta |
| `Field`, `Input`, `Textarea` | — | rótulo, dica, erro; ícone e ação à direita no `Input` |
| `Tabs` | Radix Tabs | |
| `Dialog` (+ `ConfirmDialog`) | Radix Dialog | foco preso, Esc, retorno do foco, rolagem travada |
| `DropdownMenu` | Radix Dropdown | menu da conta |
| `Tooltip` | Radix Tooltip | |
| `Calendar` | react-day-picker (pt-BR) | dias fechados riscados |
| `Badge`, `Avatar`, `Card`, `PageHeader`, `Skeleton` | cva / Tailwind | |
| Avisos | sonner | `toast.success` / `toast.error` |

Bibliotecas de apoio: `class-variance-authority` (variantes), `clsx` + `tailwind-merge` (`cn()`), `react-hook-form` + `zod`
(formulários), TanStack Query (dados), `motion` (entrada de página, só opacidade), `@formkit/auto-animate` (listas).

## Tema claro e escuro
Tokens semânticos (`--ink`, `--paper`, `--surface`, `--surface-2/3`, `--tint`, `--line`, `--muted`, `--field`, `--control`, estados `*-soft`/`*-ink`)
mudam por tema; `--chrome`/`--chrome-ink` ficam fixos para áreas sempre escuras (topo, destaque, login).
O tema segue o sistema (`prefers-color-scheme`) e pode ser forçado em **Menu da conta → Aparência** (Claro/Escuro/Automático);
a escolha fica no navegador (`lib/theme.ts`) e é aplicada antes da primeira pintura (sem "flash").
Em componentes novos use sempre tokens (`bg-surface`, `text-muted`, `border-line`…), nunca hex.

## Qualidade verificada
- **Acessibilidade automatizada:** `web/tests/e2e/accessibility.spec.ts` roda o axe (WCAG 2.1 A/AA) em login, cliente, barbeiro (todas as seções), admin
  e na vitrine, em **tema claro e escuro**, mais agendamento/agenda/ajustes no **celular (390px)**. Zero violações é requisito do CI de e2e.
- **Sem rolagem horizontal** nas telas principais (auditado em 390px e 1440px, dois temas).
- CSS legado na camada `components`: utilitários Tailwind sempre vencem.

## Convenções
- Todas as telas usam o kit de `web/src/components/ui`: `Button`, `Card`, `Badge`, `Field/Input/Select/Textarea`, `Notice`, `SectionHeading`, `StatTile`,
  `EmptyState`/`CountBadge`, `ChoiceCard`/`StepFieldset`/`Stepper`/`ActionBar` (fluxo de agendamento) e `FormParts` (`Group`, `Toggle`, `InsetForm`, `FormRow`).
  Também `IconButton`/`TextButton`, `PageWrap`/`PageHeading`. **Nenhuma tela usa CSS escrito à mão**: `index.css` (~8 KB) só tem tokens, temas e o reset global
  (foco, campos de formulário). Ao criar telas, use utilitários Tailwind + componentes de `ui/`.
- **Paleta de comandos** (`CommandPalette`, `cmdk` + Radix Dialog): `Ctrl/⌘ + K` ou botão "Buscar" na barra superior; navegação, tema e sessão pelo teclado.
  **Celebração** (`lib/celebrate.ts`, `canvas-confetti` carregado sob demanda) ao confirmar uma reserva; desligada com `prefers-reduced-motion`.
- Nos testes e2e, clique no texto do `ChoiceCard` (o input é transparente e cobre o cartão); não use classes CSS como seletor, prefira papéis/rótulos.
- Animação de página só com **opacidade**: `transform` num ancestral quebraria elementos `position: fixed` (barra de ação mobile).
- Não use `porcelain-*`/`cobalt-*` para superfícies e texto de interface (não mudam no escuro): são para a vitrine e acentos.
- Cor de marca por barbearia: use `brand*`/`var(--amber)`, nunca o hex.
