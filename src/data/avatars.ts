import type { SeedCreator } from "./india";

/**
 * Profile photo for a demo creator. These are licensed Pexels stock photos of models
 * (see public/creators/CREDITS.md), not the fictional people named in the data.
 */
export const creatorAvatar = (c: Pick<SeedCreator, "id">) => `/creators/${c.id}.jpg`;
