import { forwardRef } from 'react'
import { Button as SonidoButton, type ButtonProps as SonidoButtonProps } from '@juninmd/sonido'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'dark' | 'ghost' | 'danger'
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'icon'

/**
 * Adaptador fino sobre o `Button` do Sonido: mantém as variantes e tamanhos que
 * o app já usava e garante o alvo de toque de 44px da Navalha. O visual, o
 * gradiente da marca, o estado de carregamento e o foco vêm do design system.
 */
const sonidoVariant: Record<Variant, SonidoButtonProps['variant']> = {
  primary: 'primary',
  dark: 'secondary',
  ghost: 'ghost',
  danger: 'danger',
}

const sizeClass: Record<Size, string> = {
  xs: 'min-h-8 px-2.5 text-xs',
  sm: 'min-h-11 px-3 text-xs',
  md: 'min-h-12 px-5 text-sm',
  lg: 'min-h-14 px-6 text-base',
  icon: '',
}

interface StyleOptions {
  variant?: Variant | null
  size?: Size | null
  block?: boolean | null
}

/** Classes do Sonido para links e botões nativos que não usam o componente React. */
export const buttonStyles = ({ variant = 'primary', size = 'md', block }: StyleOptions = {}) =>
  cn('sn-button', `sn-button--${sonidoVariant[variant ?? 'primary']}`, `sn-button--${size ?? 'md'}`, sizeClass[size ?? 'md'], block && 'w-full')

type ButtonProps = Omit<SonidoButtonProps, 'variant' | 'size'> & StyleOptions

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', block, type = 'button', children, ...props },
  ref,
) {
  return (
    <SonidoButton
      {...props}
      ref={ref as React.Ref<HTMLButtonElement | HTMLAnchorElement>}
      type={type}
      variant={sonidoVariant[variant ?? 'primary']}
      size={size ?? 'md'}
      className={cn(sizeClass[size ?? 'md'], block && 'w-full', className)}
    >
      {children}
    </SonidoButton>
  )
})
