export async function generateImageBuffer(prompt: string): Promise<Buffer> {
  try {
    // Pollinations.ai generates images based on the URL path.
    // We encode the prompt to ensure it's URL-safe.
    // Added a random seed to avoid caching identical prompts.
    const seed = Math.floor(Math.random() * 100000);
    const encodedPrompt = encodeURIComponent(prompt);
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&width=1920&height=1080&nologo=true`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Error generating image:', error);
    throw new Error('Failed to generate image');
  }
}
