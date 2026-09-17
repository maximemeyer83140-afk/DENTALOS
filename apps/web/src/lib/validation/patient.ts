import { z } from "zod";

/** Form inputs arrive as "" when left blank, not undefined — normalize before validating. */
function optionalText(max: number) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );
}

const optionalDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() !== "" ? new Date(value) : undefined),
  z.date().optional(),
);

const optionalEmail = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().email("Adresse email invalide").optional(),
);

export const createPatientSchema = z.object({
  title: optionalText(20),
  firstName: z.string().trim().min(1, "Le prénom est requis").max(100),
  lastName: z.string().trim().min(1, "Le nom est requis").max(100),
  dateOfBirth: optionalDate,
  sex: optionalText(20),
  phone: optionalText(30),
  mobile: optionalText(30),
  email: optionalEmail,
  addressLine1: optionalText(200),
  npa: optionalText(10),
  city: optionalText(100),
  canton: optionalText(10),
});

export type CreatePatientFormInput = z.infer<typeof createPatientSchema>;
