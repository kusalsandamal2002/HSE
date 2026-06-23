import { z } from "zod";

export const nullableId = z.preprocess(
  (value) => value === "" ? null : value,
  z.string().uuid().nullable().optional()
);

export const nullableText = z.preprocess(
  (value) => value === "" ? null : value,
  z.string().nullable().optional()
);

export const optionalText = z.preprocess(
  (value) => value === "" ? undefined : value,
  z.string().optional()
);
