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

const ExtractInventoryFromImageInputSchema = z.object({
  imageBase64: z.string().describe('The base64 encoded image data.'),
});
export type ExtractInventoryFromImageInput = z.infer<typeof ExtractInventoryFromImageInputSchema>;

const ExtractInventoryFromImageOutputSchema = z.array(z.object({
  name: z.string().describe('The name of the item.'),
  quantity: z.number().describe('The quantity of the item.'),
  unit: z.string().describe('The unit of the item')
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
    const prompt = ai.definePrompt({
      name: 'extractInventoryPrompt',
      prompt: `You are an AI assistant designed to extract inventory items from images.
      Given an image of a receipt or inventory list, identify the items and their quantities.
      Return a JSON array of objects, where each object has the following structure:
      \`\`\`json
      [
        {
          "name": "item name",
          "quantity": number,
          "unit": "unit of measure"
        },
        ...
      ]
      \`\`\`
      Ensure that the quantity and unit are correctly identified.
      If the unit is not explicitly mentioned, use "units".
      
      Here is the image data: {{media url=imageBase64}}`,
      input: {
        schema: z.object({
          imageBase64: z.string().describe('The base64 encoded image data.'),
        }),
      },
      output: {
        schema: ExtractInventoryFromImageOutputSchema,
      },
    });

    const {output} = await prompt(input);
    return output!;
  }
);
