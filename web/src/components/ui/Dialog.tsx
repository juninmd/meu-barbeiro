import * as Primitive from '@radix-ui/react-dialog'
import { cn } from '../../lib/cn'

export const Dialog = Primitive.Root
export const DialogTitle = Primitive.Title
export const DialogDescription = Primitive.Description

export function DialogContent({ className, children, ...props }: React.ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-5">
        <Primitive.Content
          className={cn(
            'pointer-events-auto w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-lg sm:p-8',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            className,
          )}
          {...props}
        >
          {children}
        </Primitive.Content>
      </div>
    </Primitive.Portal>
  )
}
