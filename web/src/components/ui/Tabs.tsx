import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '../../lib/cn'

export const Tabs = TabsPrimitive.Root

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn('grid auto-cols-fr grid-flow-col gap-1 rounded-[13px] bg-paper-deep p-1', className)} {...props} />
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn('min-h-11 rounded-[10px] text-sm font-bold text-muted transition data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-sm focus-visible:outline-3 focus-visible:outline-brand', className)}
      {...props}
    />
  )
}

export const TabsContent = TabsPrimitive.Content
