/** Cor padrão de marca quando a barbearia ainda não escolheu a sua. */
export const defaultBrandColor = '#2f44ff'

const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/** Luminância relativa (WCAG) de uma cor hexadecimal. */
export function luminance(color: string) {
  const match = hex.exec(color.trim())
  if (!match) return 0
  const raw = match[1]!.length === 3 ? [...match[1]!].map((c) => c + c).join('') : match[1]!
  const [r, g, b] = [0, 2, 4].map((index) => {
    const channel = parseInt(raw.slice(index, index + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

/** Texto legível sobre a cor da marca: branco em cores escuras, grafite em cores claras (âmbar, menta…). */
export function onBrandColor(color: string) {
  const l = luminance(color)
  const contrastWhite = 1.05 / (l + 0.05)
  const contrastInk = (l + 0.05) / 0.0575
  return contrastWhite >= contrastInk ? '#ffffff' : '#11131d'
}

/** Variáveis CSS que tingem a interface com a cor da barbearia. */
export function brandStyle(color?: string | null): React.CSSProperties {
  const brand = color && hex.test(color) ? color : defaultBrandColor
  return { '--amber': brand, '--on-brand': onBrandColor(brand) } as React.CSSProperties
}
