/** Confete discreto nas cores da marca; não roda para quem pede menos movimento. */
export async function celebrate() {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const { default: confetti } = await import('canvas-confetti')
  const brand = getComputedStyle(document.documentElement).getPropertyValue('--amber').trim() || '#2f44ff'
  const colors = [brand, '#f0442f', '#ffffff', '#11131d']
  const shot = (originX: number, angle: number) => confetti({ particleCount: 55, spread: 70, startVelocity: 48, angle, origin: { x: originX, y: 0.75 }, colors, disableForReducedMotion: true, ticks: 160, scalar: 0.9 })
  shot(0.1, 60)
  shot(0.9, 120)
}
