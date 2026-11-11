import { describe, expect, it } from 'vitest'
import { brandStyle, onBrandColor } from './brand'

describe('brand color', () => {
  it('uses white text on dark brands and ink on light brands', () => {
    expect(onBrandColor('#2f44ff')).toBe('#ffffff')
    expect(onBrandColor('#0f7a62')).toBe('#ffffff')
    expect(onBrandColor('#f3c86d')).toBe('#11131d')
    expect(onBrandColor('#fff')).toBe('#11131d')
  })

  it('falls back to the default brand for invalid colors', () => {
    expect(brandStyle('nope')).toMatchObject({ '--amber': '#2f44ff', '--on-brand': '#ffffff' })
    expect(brandStyle(null)).toMatchObject({ '--amber': '#2f44ff' })
  })
})
