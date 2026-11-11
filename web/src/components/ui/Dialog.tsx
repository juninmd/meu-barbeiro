import * as Primitive from '@radix-ui/react-dialog'
import { cn } from '../../lib/cn'

export const Dialog = Primitive.Root
export const DialogTitle = Primitive.Title
export const DialogDescription = Primitive.Description

export function DialogContent({ className, children, ...props }: React.ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-5 max-sm:place-items-end max-sm:p-0">
        <Primitive.Content
          className={cn(
            'pointer-events-auto max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-[1.75rem] border border-line bg-surface p-6 shadow-lg sm:p-8 max-sm:max-w-none max-sm:rounded-b-none max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))] max-sm:data-[state=open]:slide-in-from-bottom-1/2 max-sm:before:mx-auto max-sm:before:mb-4 max-sm:before:block max-sm:before:h-1.5 max-sm:before:w-10 max-sm:before:rounded-full max-sm:before:bg-line',
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
