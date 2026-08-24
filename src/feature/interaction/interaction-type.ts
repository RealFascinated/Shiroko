export const InteractionType = {
  "hugs": {
    // Should this be "global" or between two users
    globalStatistic: true
  }
}

export type InteractionType = keyof typeof InteractionType;