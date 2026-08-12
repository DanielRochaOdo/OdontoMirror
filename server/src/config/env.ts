import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  WHATSAPP_SESSION_PATH: z.string().default('./sessions'),
  WHATSAPP_HISTORY_LIMIT: z.coerce.number().int().min(1).max(500).default(100),
  PUPPETEER_EXECUTABLE_PATH: z.string().optional(),
});

export const env = schema.parse(process.env);
