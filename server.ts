import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const ALLOWED_UNITS = new Set(['Pcs', 'g', 'Kg', 'ml', 'tbsp', 'tsp']);

interface NutritionInputItem {
  foodItem: string;
  quantity: number;
  measurement: string;
}

interface NutritionOutputItem {
  foodItem: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
}

function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatGeminiErrorMessage(rawMessage: string): {
  status: number;
  message: string;
} {
  if (rawMessage.includes('GEMINI_API_KEY')) {
    return {
      status: 503,
      message: 'Gemini API key is not configured. Please check Settings > Secrets.',
    };
  }
  if (rawMessage.includes('429') || rawMessage.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'Gemini API rate limit reached. Please wait a moment and try again.',
    };
  }
  if (rawMessage.includes('503') || rawMessage.includes('UNAVAILABLE')) {
    return {
      status: 503,
      message: 'The AI nutrition service is temporarily busy. Please try again in a moment.',
    };
  }
  if (rawMessage.includes('403') || rawMessage.includes('PERMISSION_DENIED')) {
    return {
      status: 403,
      message: 'Gemini API access was denied. Please check your API key in Settings > Secrets.',
    };
  }
  try {
    const parsed = JSON.parse(rawMessage) as { error?: { message?: string; code?: number } };
    if (parsed?.error?.message) {
      return {
        status: parsed.error.code && parsed.error.code >= 400 ? parsed.error.code : 500,
        message: parsed.error.message,
      };
    }
  } catch {
    // Keep raw message
  }
  return { status: 500, message: rawMessage };
}

async function callModelForNutrition(
  ai: GoogleGenAI,
  model: string,
  items: NutritionInputItem[],
  prompt: string
): Promise<NutritionOutputItem[]> {
  const useLowThinking = model === 'gemini-4-hydrogen';
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction:
        'You are a precision clinical nutritionist and food composition database expert covering international foods, packaged snacks, and Sri Lankan / South Asian cuisine. ' +
        'You have deep knowledge of Sri Lankan dishes and ingredients including: boiled legumes such as Vigna / cowpea (kawupi), green gram (mung), chickpeas (kadala); shredded/grated coconut (pol), pol sambol, seeni sambol; dhal/parippu curry; kiri kos curry (jackfruit cooked in coconut milk), polos curry, ambul thiyal, Sri Lankan fish/chicken curries; gotukola mallum, mukunuwenna mallum, and other leafy mallums; cooked Sri Lankan red/white rice, string hoppers (idiyappam), hoppers (appa), kiribath, pol roti, pittu, kottu; and South Asian sweets/snacks like boondi, watalappan, kavum, kokis, as well as global packaged snacks (e.g., Snickers, Pringles). ' +
        'Unless a food explicitly says raw, dry, or uncooked, treat rice, noodles, pasta, legumes (such as Vigna, cowpea, dhal), and curries as cooked/prepared ready-to-eat dishes. ' +
        'For each numbered food item in the user prompt, calculate the total Calories (kcal), Protein (g), Carbohydrates (g), Fat (g), and Total Sugars (g) for the EXACT quantity and measurement unit given (Pcs, g, Kg, ml, tbsp, tsp). ' +
        'Return a JSON array with the exact same number of objects in the exact same order as the input items. ' +
        'Calories should be rounded to whole numbers, and protein/carbs/fat/sugar to 1 decimal place. Total sugars includes both naturally occurring and added sugars, and cannot exceed carbohydrates when applicable. All numeric values must be >= 0.',
      ...(useLowThinking ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            foodItem: {
              type: Type.STRING,
              description: 'Clean display name of the food item matching the input.',
            },
            calories: {
              type: Type.NUMBER,
              description: 'Total energy in kilocalories (kcal) for the specified quantity and unit.',
            },
            protein: {
              type: Type.NUMBER,
              description: 'Total protein in grams (g) for the specified quantity and unit.',
            },
            carbs: {
              type: Type.NUMBER,
              description: 'Total carbohydrates in grams (g) for the specified quantity and unit.',
            },
            fat: {
              type: Type.NUMBER,
              description: 'Total fat in grams (g) for the specified quantity and unit.',
            },
            sugar: {
              type: Type.NUMBER,
              description: 'Total sugars (natural + added) in grams (g) for the specified quantity and unit.',
            },
          },
          required: ['foodItem', 'calories', 'protein', 'carbs', 'fat', 'sugar'],
        },
      },
    },
  });

  const rawText = (response.text ?? '').trim();
  if (!rawText) {
    throw new Error('Gemini returned an empty nutrition response.');
  }

  const parsed = JSON.parse(rawText) as unknown;
  if (!Array.isArray(parsed) || parsed.length !== items.length) {
    throw new Error(
      `Expected ${items.length} nutrition item(s), got ${Array.isArray(parsed) ? parsed.length : 'invalid format'}.`
    );
  }

  return parsed.map((entry, idx) => {
    const obj = entry as Partial<NutritionOutputItem>;
    return {
      foodItem: items[idx].foodItem,
      calories: Math.max(0, Math.round(Number(obj.calories) || 0)),
      protein: Math.max(0, Math.round((Number(obj.protein) || 0) * 10) / 10),
      carbs: Math.max(0, Math.round((Number(obj.carbs) || 0) * 10) / 10),
      fat: Math.max(0, Math.round((Number(obj.fat) || 0) * 10) / 10),
      sugar: Math.max(0, Math.round((Number(obj.sugar) || 0) * 10) / 10),
    };
  });
}

async function generateWithRetry(
  ai: GoogleGenAI,
  items: NutritionInputItem[]
): Promise<NutritionOutputItem[]> {
  const itemLines = items
    .map(
      (item, idx) =>
        `${idx + 1}. "${item.foodItem}" — Quantity: ${item.quantity} ${item.measurement}`
    )
    .join('\n');

  const prompt = `Calculate accurate nutritional values for each of the following ${items.length} food item(s) at the exact specified quantity and measurement unit:\n${itemLines}`;

  const modelsToTry = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
  let lastError: unknown;

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await callModelForNutrition(ai, model, items, prompt);
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        const isTransient =
          msg.includes('429') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('503') ||
          msg.includes('500') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('ECONNRESET') ||
          msg.includes('fetch failed');
        if (!isTransient) {
          throw err;
        }
        if (attempt === 0) {
          const backoffMs = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') ? 1200 : 350;
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }
  }
  throw lastError;
}

const MODEL_BATCH_SIZE = 12;

async function calculateNutritionBatched(
  ai: GoogleGenAI,
  items: NutritionInputItem[]
): Promise<NutritionOutputItem[]> {
  if (items.length <= MODEL_BATCH_SIZE) {
    return generateWithRetry(ai, items);
  }

  const results: NutritionOutputItem[] = [];
  for (let i = 0; i < items.length; i += MODEL_BATCH_SIZE) {
    const chunk = items.slice(i, i + MODEL_BATCH_SIZE);
    const chunkResult = await generateWithRetry(ai, chunk);
    results.push(...chunkResult);
  }
  return results;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post('/api/nutrition/calculate', async (req: Request, res: Response) => {
    try {
      const body = req.body as { items?: unknown };
      if (!body || !Array.isArray(body.items) || body.items.length === 0) {
        res.status(400).json({ error: 'Please provide at least one food item to calculate.' });
        return;
      }
      if (body.items.length > 30) {
        res.status(400).json({ error: 'Maximum 30 items per meal submission.' });
        return;
      }

      const validated: NutritionInputItem[] = [];
      for (let i = 0; i < body.items.length; i++) {
        const raw = body.items[i] as Partial<NutritionInputItem>;
        const foodItem = typeof raw.foodItem === 'string' ? raw.foodItem.trim() : '';
        const quantity = Number(raw.quantity);
        const measurement = typeof raw.measurement === 'string' ? raw.measurement : '';

        if (!foodItem || foodItem.length > 160) {
          res.status(400).json({ error: `Invalid food item name at row ${i + 1}.` });
          return;
        }
        if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) {
          res.status(400).json({ error: `Invalid quantity for "${foodItem}".` });
          return;
        }
        if (!ALLOWED_UNITS.has(measurement)) {
          res.status(400).json({ error: `Invalid measurement unit for "${foodItem}".` });
          return;
        }

        validated.push({ foodItem, quantity, measurement });
      }

      const ai = createGeminiClient();
      const results = await calculateNutritionBatched(ai, validated);
      res.json({ items: results });
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : 'Failed to calculate nutrition.';
      console.error('Gemini nutrition calculation error:', rawMessage);
      const formatted = formatGeminiErrorMessage(rawMessage);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'API route not found' });
        return;
      }
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NutriLog server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
