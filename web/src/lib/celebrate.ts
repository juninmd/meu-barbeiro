/** Confete discreto nas cores da marca; não roda para quem pede menos movimento. */
export async function celebrate() {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const { default: confetti } = await import('canvas-confetti')
  const colors = ['#d99b32', '#f0c772', '#9d6d20', '#f8f3ea']
  const shot = (originX: number, angle: number) => confetti({ particleCount: 55, spread: 70, startVelocity: 48, angle, origin: { x: originX, y: 0.75 }, colors, disableForReducedMotion: true, ticks: 160, scalar: 0.9 })
  shot(0.1, 60)
  shot(0.9, 120)
}
