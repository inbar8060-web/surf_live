import { z } from 'zod'

/**
 * Every mutation validates its input here before it reaches the database.
 * The database constraints in supabase/migrations are the backstop; these
 * schemas exist to give people a readable error instead of a 500.
 */

export const uuid = z.string().uuid('Not a valid id')
const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max)

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{6,14}$/, 'Use international format, e.g. +972501234567')

export const emailSchema = z.string().trim().toLowerCase().email('Not a valid email').max(254)

/**
 * Password policy: length is the control that matters, so the floor is high
 * and the ceiling is generous enough for passphrases.
 */
export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(128, 'Password is too long')
  .refine((v) => !/^\s|\s$/.test(v), 'Password cannot start or end with a space')

export const roleSchema = z.enum(['admin', 'instructor', 'client'])
export const skillLevelSchema = z.enum(['beginner', 'intermediate', 'advanced', 'pro'])
export const priceCents = z.coerce.number().int().min(0).max(100_000_000)

/* ------------------------------------------------------------------ auth */

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(128),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password').max(128),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'The two passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: 'Choose a password you have not used here before',
    path: ['newPassword'],
  })

export const acceptInviteSchema = z
  .object({
    token: z.string().min(20).max(200),
    fullName: trimmed(2, 120),
    email: emailSchema,
    phone: phoneSchema.optional().or(z.literal('')),
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptedTerms: z.literal(true, { errorMap: () => ({ message: 'Please accept the terms' }) }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'The two passwords do not match',
    path: ['confirmPassword'],
  })

/* --------------------------------------------------------- admin: people */

export const createInviteSchema = z.object({
  role: roleSchema,
  email: emailSchema.optional().or(z.literal('')),
  phone: phoneSchema.optional().or(z.literal('')),
  fullName: trimmed(2, 120).optional().or(z.literal('')),
  note: z.string().trim().max(500).optional().or(z.literal('')),
  expiresInHours: z.coerce.number().int().min(1).max(720).default(72),
})

export const createUserSchema = z.object({
  role: roleSchema,
  fullName: trimmed(2, 120),
  email: emailSchema,
  phone: phoneSchema.optional().or(z.literal('')),
  password: passwordSchema,
  level: skillLevelSchema.default('beginner'),
})

export const updateProfileSchema = z.object({
  profileId: uuid,
  fullName: trimmed(2, 120),
  email: emailSchema.optional().or(z.literal('')),
  phone: phoneSchema.optional().or(z.literal('')),
  isActive: z.coerce.boolean(),
  role: roleSchema,
})

export const updateClientSchema = z.object({
  profileId: uuid,
  level: skillLevelSchema,
  birthDate: z.string().date().optional().or(z.literal('')),
  emergencyContactName: z.string().trim().max(120).optional().or(z.literal('')),
  emergencyContactPhone: phoneSchema.optional().or(z.literal('')),
  medicalNotes: z.string().trim().max(2000).optional().or(z.literal('')),
  adminNotes: z.string().trim().max(4000).optional().or(z.literal('')),
  waiverSigned: z.coerce.boolean().default(false),
})

export const updateInstructorSchema = z.object({
  profileId: uuid,
  bio: z.string().trim().max(2000).optional().or(z.literal('')),
  specialties: z.string().trim().max(400).optional().or(z.literal('')),
  languages: z.string().trim().max(200).optional().or(z.literal('')),
  whatsappPhone: phoneSchema.optional().or(z.literal('')),
  calendarColour: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #0ea5e9')
    .default('#0ea5e9'),
})

/* -------------------------------------------------------- admin: catalog */

export const categorySchema = z.object({
  id: uuid.optional(),
  name: trimmed(2, 80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Lower case words separated by hyphens'),
  kind: z.enum(['lesson', 'rental', 'service']),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.coerce.boolean().default(true),
})

export const serviceSchema = z.object({
  id: uuid.optional(),
  categoryId: uuid,
  name: trimmed(2, 120),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  durationMinutes: z.coerce.number().int().min(15).max(600),
  defaultCapacity: z.coerce.number().int().min(1).max(100),
  priceCents: priceCents,
  minLevel: skillLevelSchema.optional().or(z.literal('')),
  isActive: z.coerce.boolean().default(true),
})

export const priceChangeSchema = z.object({
  entityType: z.enum(['service', 'inventory_type', 'package_template', 'time_slot']),
  entityId: uuid,
  priceCents: priceCents,
})

/* ------------------------------------------------------ admin: schedule */

export const timeSlotSchema = z
  .object({
    id: uuid.optional(),
    serviceId: uuid,
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    capacity: z.coerce.number().int().min(1).max(100),
    location: z.string().trim().max(200).optional().or(z.literal('')),
    priceCentsOverride: z.coerce.number().int().min(0).max(100_000_000).optional().nullable(),
    whatsappGroupUrl: z
      .string()
      .regex(/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{10,40}$/, 'Paste a WhatsApp group invite link')
      .optional()
      .or(z.literal('')),
    notes: z.string().trim().max(1000).optional().or(z.literal('')),
    instructorIds: z.array(uuid).max(5).default([]),
  })
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), {
    message: 'The session must end after it starts',
    path: ['endsAt'],
  })

export const blockSlotSchema = z.object({
  slotId: uuid,
  blocked: z.coerce.boolean(),
  reason: z.string().trim().max(500).optional().or(z.literal('')),
})

/* --------------------------------------------------------- reservations */

export const createReservationSchema = z.object({
  slotId: uuid,
  participants: z.coerce.number().int().min(1).max(20).default(1),
  clientPackageId: uuid.optional().or(z.literal('')),
  clientNote: z.string().trim().max(1000).optional().or(z.literal('')),
})

export const amendReservationSchema = z.object({
  reservationId: uuid,
  participants: z.coerce.number().int().min(1).max(20),
  clientNote: z.string().trim().max(1000).optional().or(z.literal('')),
})

export const decideReservationSchema = z.object({
  reservationId: uuid,
  decision: z.enum(['approved', 'rejected', 'completed', 'no_show', 'cancelled']),
  reason: z.string().trim().max(500).optional().or(z.literal('')),
})

/* ------------------------------------------------------------- packages */

export const packageTemplateSchema = z.object({
  id: uuid.optional(),
  categoryId: uuid.optional().or(z.literal('')),
  name: trimmed(2, 120),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  lessonsCount: z.coerce.number().int().min(1).max(200),
  priceCents: priceCents,
  validityDays: z.coerce.number().int().min(1).max(1095),
  isActive: z.coerce.boolean().default(true),
})

export const grantPackageSchema = z.object({
  clientId: uuid,
  templateId: uuid,
  note: z.string().trim().max(500).optional().or(z.literal('')),
})

export const extendPackageSchema = z
  .object({
    packageId: uuid,
    extraLessons: z.coerce.number().int().min(0).max(200).default(0),
    extraDays: z.coerce.number().int().min(0).max(1095).default(0),
    note: z.string().trim().max(500).optional().or(z.literal('')),
  })
  .refine((v) => v.extraLessons > 0 || v.extraDays > 0, {
    message: 'Add lessons, days, or both',
    path: ['extraLessons'],
  })

export const cancelPackageSchema = z.object({
  packageId: uuid,
  reason: trimmed(3, 500),
})

/* ------------------------------------------------- inventory and rentals */

export const inventoryTypeSchema = z.object({
  id: uuid.optional(),
  categoryId: uuid.optional().or(z.literal('')),
  name: trimmed(2, 120),
  kind: z.enum(['board', 'wetsuit', 'leash', 'fins', 'sup', 'kayak', 'other']),
  brand: z.string().trim().max(80).optional().or(z.literal('')),
  sizeLabel: z.string().trim().max(40).optional().or(z.literal('')),
  dailyPriceCents: priceCents,
  isActive: z.coerce.boolean().default(true),
})

export const setQuantitySchema = z.object({
  typeId: uuid,
  quantity: z.coerce.number().int().min(0).max(1000),
})

export const itemStatusSchema = z.object({
  itemId: uuid,
  status: z.enum(['available', 'maintenance', 'retired']),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
})

export const createRentalSchema = z
  .object({
    clientId: uuid,
    itemId: uuid,
    startDate: z.string().date(),
    endDate: z.string().date(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: 'The return date cannot be before the pick-up date',
    path: ['endDate'],
  })

export const returnRentalSchema = z.object({
  rentalId: uuid,
  conditionIn: z.enum(['new', 'good', 'fair', 'poor']),
  damageNote: z.string().trim().max(1000).optional().or(z.literal('')),
})

export const rentalStatusSchema = z.object({
  rentalId: uuid,
  status: z.enum(['reserved', 'out', 'overdue', 'lost']),
})

/* -------------------------------------------------------------- reviews */

export const instructorReviewSchema = z.object({
  instructorId: uuid,
  reservationId: uuid.optional().or(z.literal('')),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().max(4000).optional().or(z.literal('')),
})

export const sessionReviewSchema = z.object({
  slotId: uuid,
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional().or(z.literal('')),
  body: z.string().trim().max(4000).optional().or(z.literal('')),
})

export const moderateReviewSchema = z.object({
  reviewId: uuid,
  isPublished: z.coerce.boolean(),
  hiddenReason: z.string().trim().max(500).optional().or(z.literal('')),
})

/* ----------------------------------------------------------------- tips */

export const tipSchema = z.object({
  instructorId: uuid,
  reservationId: uuid.optional().or(z.literal('')),
  // 5.00 minimum, 1000.00 maximum: keeps typos from becoming a support ticket
  amountCents: z.coerce.number().int().min(500).max(100_000),
  message: z.string().trim().max(300).optional().or(z.literal('')),
})

/* -------------------------------------------------------------- settings */

export const clubSettingsSchema = z.object({
  clubName: trimmed(2, 120),
  timezone: trimmed(3, 64),
  currency: z.string().trim().length(3).toUpperCase(),
  spotName: trimmed(2, 120),
  spotLatitude: z.coerce.number().min(-90).max(90),
  spotLongitude: z.coerce.number().min(-180).max(180),
  contactPhone: phoneSchema.optional().or(z.literal('')),
  cancellationWindowHours: z.coerce.number().int().min(0).max(168),
  tipsEnabled: z.coerce.boolean().default(true),
})
