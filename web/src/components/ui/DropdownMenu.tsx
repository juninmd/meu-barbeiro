import * as Primitive from '@radix-ui/react-dropdown-menu'
import { cn } from '../../lib/cn'

export const DropdownMenu = Primitive.Root
export const DropdownMenuTrigger = Primitive.Trigger

export function DropdownMenuContent({ className, sideOffset = 8, ...props }: React.ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-56 origin-(--radix-dropdown-menu-content-transform-origin) rounded-2xl border border-line bg-surface p-1.5 text-ink shadow-lg',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  )
}

export function DropdownMenuItem({ className, ...props }: React.ComponentProps<typeof Primitive.Item>) {
  return (
    <Primitive.Item
      className={cn('flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-semibold outline-none select-none data-[highlighted]:bg-paper-deep [&_svg]:size-4 [&_svg]:text-muted', className)}
      {...props}
    />
  )
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof Primitive.Label>) {
  return <Primitive.Label className={cn('px-3 py-2', className)} {...props} />
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof Primitive.Separator>) {
  return <Primitive.Separator className={cn('mx-1 my-1.5 h-px bg-line', className)} {...props} />
}

export const DropdownMenuRadioGroup = Primitive.RadioGroup

export function DropdownMenuRadioItem({ className, children, ...props }: React.ComponentProps<typeof Primitive.RadioItem>) {
  return (
    <Primitive.RadioItem
      className={cn('flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-semibold outline-none select-none data-[highlighted]:bg-paper-deep [&_svg]:size-4 [&_svg]:text-muted', className)}
      {...props}
    >
      {children}
      <Primitive.ItemIndicator className="ml-auto text-brand-deep"><span aria-hidden="true">●</span></Primitive.ItemIndicator>
    </Primitive.RadioItem>
  )
}
