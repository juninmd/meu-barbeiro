import * as Primitive from '@radix-ui/react-tooltip'
import { cn } from '../../lib/cn'

export const TooltipProvider = Primitive.Provider

export function Tooltip({ label, children, className }: { label: string; children: React.ReactElement; className?: string }) {
  return (
    <Primitive.Root delayDuration={250}>
      <Primitive.Trigger asChild>{children}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          sideOffset={8}
          className={cn('z-50 rounded-lg bg-ink px-2.5 py-1.5 text-xs font-semibold text-paper shadow-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95', className)}
        >
          {label}
          <Primitive.Arrow className="fill-ink" />
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  )
}
