/**
 * BGM & Overlay Generator
 * 
 * Generates placeholder silent MP3 tracks for each mood and a particle overlay video.
 * These are used during cinematic rendering.
 * 
 * In production, replace these with real royalty-free tracks (e.g., Kevin MacLeod).
 * 
 * Usage: node scripts/generate-assets.js
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const BGM_DIR = path.join(__dirname, '..', 'public', 'bgm');
const OVERLAYS_DIR = path.join(__dirname, '..', 'public', 'overlays');

const MOODS = ['mysterious', 'epic', 'suspense', 'emotional', 'discovery'];

// Duration of each BGM track in seconds (long enough to loop over most videos)
const BGM_DURATION = 300; // 5 minutes

console.log('Generating BGM placeholder tracks...');

for (const mood of MOODS) {
  const outPath = path.join(BGM_DIR, `${mood}.mp3`);
  if (fs.existsSync(outPath)) {
    console.log(`  ✓ ${mood}.mp3 already exists, skipping.`);
    continue;
  }

  // Generate a subtle ambient tone using FFmpeg's sine wave generator
  // Each mood gets a slightly different frequency to differentiate them
  const frequencies = {
    mysterious: 220,   // A3 - low, moody
    epic: 330,         // E4 - powerful
    suspense: 185,     // F#3 - tense
    emotional: 262,    // C4 - warm
    discovery: 294,    // D4 - bright
  };
  
  const freq = frequencies[mood] || 220;
  
  try {
    // Generate a very quiet ambient sine wave as a placeholder
    execSync(
      `ffmpeg -f lavfi -i "sine=frequency=${freq}:duration=${BGM_DURATION}" -af "volume=0.05,lowpass=f=400" -b:a 64k "${outPath}" -y`,
      { stdio: 'pipe' }
    );
    console.log(`  ✓ Generated ${mood}.mp3`);
  } catch (err) {
    console.error(`  ✗ Failed to generate ${mood}.mp3:`, err.message);
  }
}

// Generate a particle overlay video (white dots on black background)
const overlayPath = path.join(OVERLAYS_DIR, 'dust_particles.mp4');

if (!fs.existsSync(overlayPath)) {
  console.log('Generating particle overlay video...');
  try {
    // Create a 30-second looping particle effect using FFmpeg's noise generator
    // This creates subtle white specks on a black background that can be blended over video
    execSync(
      `ffmpeg -f lavfi -i "nullsrc=size=1920x1080:duration=30:rate=25" -vf "geq=random(1)*255*gt(random(2)\\,0.997):128:128,format=yuv420p" -c:v libx264 -preset fast -crf 23 "${overlayPath}" -y`,
      { stdio: 'pipe' }
    );
    console.log('  ✓ Generated dust_particles.mp4');
  } catch (err) {
    console.error('  ✗ Failed to generate particle overlay:', err.message);
  }
} else {
  console.log('  ✓ dust_particles.mp4 already exists, skipping.');
}

console.log('\nDone! BGM tracks and overlays are ready for cinematic rendering.');
