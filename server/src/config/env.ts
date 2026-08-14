import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { z } from 'zod';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../');
config({ path: resolve(repoRoot, '.env') });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  ROTAS_SUPABASE_URL: z.string().url().optional(),
  ROTAS_SUPABASE_ANON_KEY: z.string().min(20).optional(),
  ROTAS_SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  ROTAS_SYNC_INTERVAL_SECONDS: z.coerce.number().int().min(60).max(86400).default(300),
  WHATSAPP_SESSION_PATH: z.string().default('./sessions'),
  WHATSAPP_HISTORY_LIMIT: z.coerce.number().int().min(1).max(500).default(100),
  PUPPETEER_EXECUTABLE_PATH: z.string().optional(),
}).superRefine((value, context) => {
  const rotasValues = [
    value.ROTAS_SUPABASE_URL,
    value.ROTAS_SUPABASE_ANON_KEY,
    value.ROTAS_SUPABASE_SERVICE_ROLE_KEY,
  ];
  const configuredCount = rotasValues.filter(Boolean).length;
  if (configuredCount > 0 && configuredCount !== rotasValues.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ROTAS_SUPABASE_URL'],
      message: 'ROTAS_SUPABASE_URL, ROTAS_SUPABASE_ANON_KEY e ROTAS_SUPABASE_SERVICE_ROLE_KEY devem ser configurados juntos.',
    });
  }
});

export const env = schema.parse(process.env);
