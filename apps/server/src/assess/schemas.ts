// zod schemas for the Calibration API (GDD §11.29). They check structure only; the shared
// cleanAnswers() then checks every answer against the person's own form.

import { z } from 'zod';

const itemId = z.string().min(1).max(40).regex(/^[A-Za-z0-9_.:-]+$/);
const optionId = z.string().min(1).max(24).regex(/^[a-z0-9-]+$/);
const bandId = z.enum(['junior', 'teen', 'young-adult']);

const Answer = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('twin'),
    pick: z.enum(['a', 'b', 'both', 'neither']),
    confidence: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  }),
  z.object({ type: z.literal('flags'), picked: z.array(optionId).max(20) }),
  z.object({ type: z.literal('choice'), option: optionId }),
  z.object({ type: z.literal('likert'), value: z.number().int().min(1).max(5) }),
  z.object({ type: z.literal('poll'), option: optionId }),
  z.object({ type: z.literal('chips'), chips: z.array(optionId).max(12) }),
  z.object({ type: z.literal('jammed'), option: optionId.optional(), tell: z.array(optionId).max(8) }),
]);

export const SubmissionBody = z.object({
  code: z.string().min(5).max(20),
  kind: z.enum(['pre', 'post', 'return']),
  band: bandId,
  sessionCode: z.string().max(20).optional(),
  answers: z.record(itemId, Answer).refine((a) => Object.keys(a).length <= 80, 'Too many answers'),
});

export const SummaryQuery = z.object({
  sessionCode: z.string().max(20).optional(),
  band: bandId.optional(),
});
