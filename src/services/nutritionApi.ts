import type {
  CalculatedNutritionItem,
  ValidatedFoodRowInput,
} from '../types/nutrition';

export async function calculateNutritionWithGemini(
  items: ValidatedFoodRowInput[]
): Promise<CalculatedNutritionItem[]> {
  const response = await fetch('/api/nutrition/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });

  let data: { items?: CalculatedNutritionItem[]; error?: string } | null = null;
  try {
    data = (await response.json()) as {
      items?: CalculatedNutritionItem[];
      error?: string;
    };
  } catch {
    throw new Error(`Nutrition calculation failed (HTTP ${response.status}).`);
  }

  if (!response.ok || !Array.isArray(data?.items)) {
    throw new Error(
      data?.error || `Failed to calculate nutrition (HTTP ${response.status}).`
    );
  }

  return data.items;
}
