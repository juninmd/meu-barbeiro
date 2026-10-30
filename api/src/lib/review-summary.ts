export interface ReviewSummary {
  average: number
  count: number
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
}

/** Média com uma casa decimal e distribuição por nota; sem avaliações a média é 0. */
export function summarizeReviews(ratings: number[]): ReviewSummary {
  const distribution: ReviewSummary['distribution'] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const rating of ratings) {
    if (rating >= 1 && rating <= 5) distribution[rating as 1 | 2 | 3 | 4 | 5] += 1
  }
  const count = Object.values(distribution).reduce((total, value) => total + value, 0)
  const sum = ([1, 2, 3, 4, 5] as const).reduce((total, star) => total + star * distribution[star], 0)
  return { average: count ? Math.round((sum / count) * 10) / 10 : 0, count, distribution }
}
