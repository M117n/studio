'use server';
/**
 * @fileOverview Extracts item names and quantities from an image using an AI service.
 *
 * - extractInventoryFromImage - A function that handles the inventory extraction process.
 * - ExtractInventoryFromImageInput - The input type for the extractInventoryFromImage function.
 * - ExtractInventoryFromImageOutput - The return type for the extractInventoryFromImage function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import {analyzeImage, ImageItem} from '@/services/image-analysis';

const ExtractInventoryFromImageInputSchema = z.object({
  imageBase64: z.string().describe('The base64 encoded image data.'),
});
export type ExtractInventoryFromImageInput = z.infer<typeof ExtractInventoryFromImageInputSchema>;

const ExtractInventoryFromImageOutputSchema = z.array(z.object({
  name: z.string().describe('The name of the item.'),
  quantity: z.number().describe('The quantity of the item.'),
}));
export type ExtractInventoryFromImageOutput = z.infer<typeof ExtractInventoryFromImageOutputSchema>;

export async function extractInventoryFromImage(input: ExtractInventoryFromImageInput): Promise<ExtractInventoryFromImageOutput> {
  return extractInventoryFromImageFlow(input);
}

const extractInventoryFromImageFlow = ai.defineFlow<
  typeof ExtractInventoryFromImageInputSchema,
  typeof ExtractInventoryFromImageOutputSchema
>(
  {
    name: 'extractInventoryFromImageFlow',
    inputSchema: ExtractInventoryFromImageInputSchema,
    outputSchema: ExtractInventoryFromImageOutputSchema,
  },
  async input => {
    const imageItems: ImageItem[] = await analyzeImage(input.imageBase64);
    return imageItems;
  }
);
