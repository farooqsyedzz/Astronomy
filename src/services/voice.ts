import { EdgeTTS } from 'node-edge-tts';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export async function generateVoiceAudio(text: string, voice = 'en-US-ChristopherNeural'): Promise<Buffer> {
  try {
    const tts = new EdgeTTS({
      voice: voice,
      lang: 'en-US',
      outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
    });
    
    // We need to write to a temp file then read it because node-edge-tts 
    // primarily works by saving to a file in some versions.
    const tempFilePath = path.join(os.tmpdir(), `tts_${Date.now()}_${Math.floor(Math.random() * 1000)}.mp3`);
    
    await tts.ttsPromise(text, tempFilePath);
    
    const buffer = await fs.readFile(tempFilePath);
    
    // Clean up
    await fs.unlink(tempFilePath).catch(console.error);
    
    return buffer;
  } catch (error) {
    console.error('Error generating voice audio:', error);
    throw new Error('Failed to generate TTS audio');
  }
}
