import { z } from 'zod';

/**
 * Valid CSV schema using Zod for runtime validation
 */
export const appointmentSchema = z.object({
  app_name: z.string().min(1, 'Appointment name cannot be empty'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  visitdurationMinutes: z.union([
    z.number().int().positive('Visit duration must be positive'),
    z.string().refine(
      (val) => {
        const num = parseInt(val, 10);
        return !isNaN(num) && num > 0;
      },
      { message: 'Visit duration must be a positive number' }
    ),
  ]),
  startTime: z.string().refine(
    (val) => {
      // Accept "flexible" or HH:MM format
      if (val.toLowerCase() === 'flexible') return true;
      const timeRegex = /^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;
      return timeRegex.test(val);
    },
    { message: 'Start time must be HH:MM format or "flexible"' }
  ),
  date: z.string().refine(
    (val) => {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(val)) return false;
      const date = new Date(val);
      return !isNaN(date.getTime());
    },
    { message: 'Date must be in YYYY-MM-DD format' }
  ),
  flexibility: z.enum(['flexible', 'inflexible'], {
    errorMap: () => ({ message: 'Flexibility must be "flexible" or "inflexible"' }),
  }),
});

export type AppointmentRow = z.infer<typeof appointmentSchema>;
