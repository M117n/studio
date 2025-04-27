'use server';
/**
 * @fileOverview Extracts item names and quantities from an image using OpenAI GPT-4o.
 *
 * - extractInventoryFromImage - A function that handles the inventory extraction process.
 * - ExtractInventoryFromImageInput - The input type for the extractInventoryFromImage function.
 * - ExtractInventoryFromImageOutput - The return type for the extractInventoryFromImage function.
 */

import { z } from 'zod';

// Input schema: base64-encoded image data.
const ExtractInventoryFromImageInputSchema = z.object({
  imageBase64: z.string().describe('The base64 encoded image data.'),
});
export type ExtractInventoryFromImageInput = z.infer<typeof ExtractInventoryFromImageInputSchema>;

// Output schema: array of inventory items.
const ExtractInventoryFromImageOutputSchema = z.array(
  z.object({
    name: z.string().describe('The name of the item.'),
    quantity: z.number().describe('The quantity of the item.'),
    unit: z.string().describe('The unit of the item.'),
  })
);
export type ExtractInventoryFromImageOutput = z.infer<typeof ExtractInventoryFromImageOutputSchema>;

/**
 * Calls OpenAI's Chat Completion API (GPT-4o) to extract inventory items from an image.
 */
export async function extractInventoryFromImage(
  input: ExtractInventoryFromImageInput
): Promise<ExtractInventoryFromImageOutput> {
  // Validate input
  ExtractInventoryFromImageInputSchema.parse(input);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY environment variable');
  }

  // Prepare prompt
  const systemMessage = `Eres Invoice-to-JSON-Extractor, un modelo de lenguaje especializado en leer imágenes de órdenes de compra / facturas de inventario (p. ej. FreshPoint, Sysco, US Foods, etc.) y convertir la tabla de productos en un arreglo JSON.
  INSTRUCCIONES GENERALES
  1. Siempre responde ÚNICAMENTE con un arreglo JSON válido (sin texto adicional, sin comentarios, sin nuevas líneas fuera del JSON).
  2. Cada elemento del arreglo debe tener exactamente estas tres claves, en este orden:
     "name"     → cadena con la descripción del producto tal como aparece (recorta espacios iniciales/finales).  
     "quantity" → número entero con la cantidad enviada (usa “Quantity Shipped”; si no existe, usa “Quantity Ordered”).  
     "unit"     → unidad de medida que aparezca en la columna de pack size (puede ser “11#”, “24 CT”, “CASE”, etc.).  
  3. Si la imagen NO contiene una tabla de ítems de inventario claramente reconocible, responde -> [].
  4. Si un valor está ilegible o falta, omite ese ítem por completo (no inventes datos).
  5. Mantén el orden de los productos tal como aparecen en la factura.
  6. No incluyas claves extra ni modifiques el _casing_ de los textos.

  FORMATO JSON EJEMPLO
  [
    {"name": "PEPPER BELL GREEN CHOICE UBU 25#", "quantity": 1, "unit": "BUSHEL"},
    {"name": "PEPPER BELL RED #1",              "quantity": 1, "unit": "11#"},
    {"name": "BROCCOLINI BCT",                 "quantity": 1, "unit": "CASE"},
    {"name": "ASPARAGUS STANDARD",             "quantity": 1, "unit": "11#"},
    {"name": "BROCCOLI FLORET 4/3#",           "quantity": 1, "unit": "4/3#"},
    {"name": "DRIED DATE MEDJOOL",             "quantity": 1, "unit": "11#"},
    {"name": "EGGPLANT FANCY",                 "quantity": 1, "unit": "1/2D 18/24CT"},
    {"name": "ONION RED JUMBO",                "quantity": 1, "unit": "25#"},
    {"name": "RADISH WATERMELON",              "quantity": 1, "unit": "10LB"},
    {"name": "CELERY 24CT",                    "quantity": 1, "unit": "24CT"},
    {"name": "PROC CAULIFLOWER FLORETTES",     "quantity": 1, "unit": "2/3LB"},
    {"name": "CHARD SWISS BRIGHT LIGHT",       "quantity": 2, "unit": "12CT"}
  ]
    CRITERIOS PARA RECHAZAR 
    • Imágenes de recibos de restaurante, tickets de caja, listados de precios sin cantidades de inventario, fotografías borrosas o cualquier documento que no sea una orden/factura de artículos para inventario → responde [].

Recuerda: la respuesta debe ser solo un arreglo JSON, nada más.


`;

  // Call OpenAI API
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: input.imageBase64 },
      ],
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('No content returned from OpenAI API');
  }
  // Clean up possible markdown code fences
  let jsonString = content.trim();
  // Remove triple-backticks and any language identifiers
  jsonString = jsonString.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '').trim();
  // Parse and validate output
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    throw new Error('Failed to parse JSON from OpenAI response: ' + e);
  }

  const output = ExtractInventoryFromImageOutputSchema.parse(parsed);
  return output;
}