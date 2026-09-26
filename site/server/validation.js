import { z } from "zod";
export const id = z.uuid();
export const service = z.enum(["vermont", "montreal", "virtual"]);
const short = z.string().trim().min(1).max(200);
export const birthDate = z.iso
  .date()
  .refine(
    (x) => x <= new Date().toISOString().slice(0, 10),
    "Birth date cannot be in the future.",
  );
export const childInput = z.object({ name: short, birthDate }).strict();
export const flowInput = z.object({ service, childId: id.nullable() }).strict();
const optional = z.string().trim().max(4000).optional().default("");
export const intakeInput = z
  .object({
    clientName: short,
    birthDate,
    guardianName: short,
    referredBy: optional,
    address: short,
    city: short,
    province: short,
    postalCode: short,
    email: z.email(),
    occupation: optional,
    homePhone: optional,
    cellPhone: optional,
    workPhone: optional,
    preferredPhone: z.enum(["home", "cell", "work"]),
    diagnosis: optional,
    reason: z.string().trim().min(1).max(4000),
    otherTreatments: optional,
    hasTubes: z.enum(["yes", "no"]),
    tubesDetail: optional,
    tubesSinceAge: optional,
    supportDevices: optional,
    surgicalHistory: optional,
    eatSleep: optional,
    medications: optional,
    additionalInfo: optional,
    consent: z.literal("on"),
    signature: short,
    signDate: z.iso.date(),
  })
  .strict();
export const bookingInput = z
  .object({
    start: z.iso
      .datetime({ offset: true })
      .transform((value) => new Date(value).toISOString()),
    timeZone: z
      .string()
      .max(100)
      .refine((x) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: x });
          return true;
        } catch {
          return false;
        }
      }, "Invalid time zone"),
    name: short,
  })
  .strict();
