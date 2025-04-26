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
  const systemMessage = `You are an AI assistant designed to extract inventory items from images.
Given an image encoded in base64, identify each item's name, quantity, and unit of measure.
Return ONLY a JSON array of objects like:
[
  {"name": "item name", "quantity": number, "unit": "unit of measure"},
  ...
]`;

  // Call OpenAI API
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
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
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('No content returned from OpenAI API');
  }

  // Parse and validate output
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error('Failed to parse JSON from OpenAI response: ' + e);
  }

  const output = ExtractInventoryFromImageOutputSchema.parse(parsed);
  return output;
}