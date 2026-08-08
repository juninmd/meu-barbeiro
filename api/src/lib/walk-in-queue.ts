interface FitNowOptions {
  now: Date
  duration: number
  endOfDay: Date
  currentServiceEndsAt?: Date | null
  isAvailable: (startsAt: Date, duration: number) => boolean
}

interface QueueEntry {
  id: string
  arrivedAt: Date
  duration: number
  barberId: string | null
}

interface ScheduleQueueOptions {
  now: Date
  endOfDay: Date
  barberIds: string[]
  entries: QueueEntry[]
  isAvailable: (barberId: string, startsAt: Date, duration: number) => boolean
}

interface ScheduledQueueEntry extends QueueEntry {
  position: number
  estimatedMinutes: number | null
  startsAt: Date | null
  assignedBarberId: string | null
}

const minute = 60_000

export function fitNow({ now, duration, endOfDay, currentServiceEndsAt, isAvailable }: FitNowOptions) {
  const currentServiceMinutesLeft = currentServiceEndsAt && currentServiceEndsAt > now
    ? Math.ceil((currentServiceEndsAt.getTime() - now.getTime()) / minute)
    : 0
  const fitsNow = currentServiceMinutesLeft === 0 && isAvailable(now, duration)
  if (fitsNow) return { fitsNow, nextAvailableAt: now, currentServiceMinutesLeft }

  const firstCandidate = currentServiceEndsAt && currentServiceEndsAt > now ? currentServiceEndsAt : now
  for (let timestamp = firstCandidate.getTime(); timestamp + duration * minute <= endOfDay.getTime(); timestamp += minute) {
    const startsAt = new Date(timestamp)
    if (isAvailable(startsAt, duration)) {
      return { fitsNow: false, nextAvailableAt: startsAt, currentServiceMinutesLeft }
    }
  }

  return { fitsNow: false, nextAvailableAt: null, currentServiceMinutesLeft }
}

export function scheduleWalkInQueue({ now, endOfDay, barberIds, entries, isAvailable }: ScheduleQueueOptions): ScheduledQueueEntry[] {
  const allocations = new Map<string, Array<{ startsAt: Date; duration: number }>>()
  const nextQueueAt = new Map<string, number>()
  const ordered = [...entries].sort((left, right) => (
    left.arrivedAt.getTime() - right.arrivedAt.getTime() || left.id.localeCompare(right.id)
  ))

  return ordered.map((entry, index) => {
    const eligibleBarbers = entry.barberId ? barberIds.filter((id) => id === entry.barberId) : barberIds
    let selected: { barberId: string; startsAt: Date } | null = null

    for (const barberId of eligibleBarbers) {
      const barberAllocations = allocations.get(barberId) ?? []
      const firstTimestamp = Math.max(now.getTime(), nextQueueAt.get(barberId) ?? now.getTime())
      for (let timestamp = firstTimestamp; timestamp + entry.duration * minute <= endOfDay.getTime(); timestamp += minute) {
        const startsAt = new Date(timestamp)
        const overlapsQueue = barberAllocations.some((allocation) => (
          startsAt.getTime() < allocation.startsAt.getTime() + allocation.duration * minute
          && allocation.startsAt.getTime() < startsAt.getTime() + entry.duration * minute
        ))
        if (overlapsQueue || !isAvailable(barberId, startsAt, entry.duration)) continue
        if (!selected || startsAt < selected.startsAt) selected = { barberId, startsAt }
        break
      }
    }

    if (selected) {
      const barberAllocations = allocations.get(selected.barberId) ?? []
      barberAllocations.push({ startsAt: selected.startsAt, duration: entry.duration })
      allocations.set(selected.barberId, barberAllocations)
      nextQueueAt.set(selected.barberId, selected.startsAt.getTime() + entry.duration * minute)
    }

    return {
      ...entry,
      position: index + 1,
      estimatedMinutes: selected ? Math.max(0, Math.ceil((selected.startsAt.getTime() - now.getTime()) / minute)) : null,
      startsAt: selected?.startsAt ?? null,
      assignedBarberId: selected?.barberId ?? null,
    }
  })
}
