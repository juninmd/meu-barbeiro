import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker, type DayPickerProps } from 'react-day-picker'
import { ptBR } from 'react-day-picker/locale'
import { cn } from '../../lib/cn'

type CalendarProps = Extract<DayPickerProps, { mode?: 'single' }>

/** Calendário (react-day-picker) com o visual do sistema: células grandes para toque e dias fechados em destaque suave. */
export function Calendar({ className, classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      locale={ptBR}
      showOutsideDays={false}
      className={cn('w-full', className)}
      classNames={{
        root: 'w-full',
        months: 'relative w-full',
        month: 'grid gap-3',
        month_caption: 'flex h-11 items-center justify-center',
        caption_label: 'font-serif text-xl font-medium capitalize',
        nav: 'absolute inset-x-0 top-0 flex h-11 items-center justify-between',
        button_previous: 'grid size-11 place-items-center rounded-xl text-muted transition hover:bg-paper-deep hover:text-ink disabled:opacity-30',
        button_next: 'grid size-11 place-items-center rounded-xl text-muted transition hover:bg-paper-deep hover:text-ink disabled:opacity-30',
        month_grid: 'w-full border-separate border-spacing-1',
        weekday: 'pb-1 text-center text-[.68rem] font-extrabold tracking-wider text-muted uppercase',
        day: 'p-0 text-center',
        day_button: 'mx-auto grid size-11 w-full max-w-12 place-items-center rounded-xl text-sm font-bold transition hover:bg-brand/15 focus-visible:outline-3 focus-visible:outline-brand disabled:cursor-not-allowed disabled:text-muted/40 disabled:hover:bg-transparent',
        selected: '[&>button]:bg-linear-to-b [&>button]:from-brand-light [&>button]:to-brand [&>button]:text-[#1c1810] [&>button]:shadow-glow [&>button:hover]:bg-brand',
        today: '[&>button]:ring-2 [&>button]:ring-brand/60 [&>button]:ring-inset',
        disabled: 'opacity-100',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => orientation === 'left' ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />,
      }}
      {...props}
    />
  )
}
