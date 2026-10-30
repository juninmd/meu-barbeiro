# Navalha — design system do Meu Barbeiro

Vitrine viva: abra **/design-system** (no modo demonstração `pnpm dev`, ou logado como administrador) para ver cores,
tipografia, botões, campos, feedback, superfícies e calendário renderizados com os componentes reais.

## Princípios
1. **Calor de barbearia, precisão de produto.** Papel e grafite quentes, âmbar como único acento, serifa para o que é humano
   (títulos) e sans para o que é operacional (dados, formulários).
2. **Toque primeiro.** Alvo mínimo de 44px, calendário com células grandes, barra de ação fixa no celular, campos a 16px (sem zoom no iOS).
3. **Acessível por construção.** Radix para diálogo, menu, abas e dica (foco preso, Esc, teclado, ARIA); rótulo sempre visível;
   erro ligado ao campo por `aria-describedby`; respeita `prefers-reduced-motion`.
4. **Uma fonte de verdade.** Tokens em `web/src/index.css`; nada de cor solta em componente novo.

## Fundamentos (tokens)
| Grupo | Tokens | Uso |
|---|---|---|
| Neutros "osso" | `bone-50…900` | superfícies (`surface`, `paper`), bordas (`line`), texto (`ink`, `muted`) |
| Marca "âmbar" | `amber-50…800` | ação primária, destaques; `brand` segue `--amber`, que **muda por barbearia** em runtime |
| Estados | `success`, `danger`, `info` (`-50`/`-600`) | badges, erros, confirmações |
| Raio | `rounded-xl` (controles) · `rounded-2xl` (cartões) · `rounded-3xl` (diálogos) | |
| Sombra | `shadow-xs/sm/md/lg/glow` | elevação em camadas |
| Tipografia | `font-serif` (Fraunces Variable) · `font-sans` (Inter Variable) | títulos · interface |
| Movimento | `--ease-out-quint`, `animate-fade-up`, `tw-animate-css` | entradas suaves |

## Componentes (`web/src/components/ui`)
| Componente | Base | Notas |
|---|---|---|
| `Button` | cva | `primary` · `dark` · `ghost` · `danger`; `sm/md/lg`; `loading` |
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
- Todas as telas usam `Button`/`buttonStyles`, `Card`/`cardStyles` e `Badge` (via `StatusBadge`) do kit; as classes `.button`, `.panel` e `.status`
  foram removidas do CSS. O que resta em `index.css` são layouts específicos de tela (agenda, calendário do barbeiro, linha do tempo…)
  já ligados aos tokens; ao tocar numa tela, prefira utilitários Tailwind + componentes de `ui/`.
- Animação de página só com **opacidade**: `transform` num ancestral quebraria elementos `position: fixed` (barra de ação mobile).
- Não use `bone-*`/`amber-*` para superfícies e texto de interface (não mudam no escuro): são para a vitrine e acentos.
- Cor de marca por barbearia: use `brand*`/`var(--amber)`, nunca o hex.
