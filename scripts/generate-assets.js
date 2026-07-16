/**
 * BGM & Overlay Generator
 * 
 * Generates placeholder silent MP3 tracks for each mood and a particle overlay video.
 * Run once on the GitHub Actions runner; files are cached between runs.
 * 
 * In production, replace these with real royalty-free tracks.
 * Usage: node scripts/generate-assets.js
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const BGM_DIR = path.join(__dirname, '..', 'public', 'bgm');
const OVERLAYS_DIR = path.join(__dirname, '..', 'public', 'overlays');

const MOODS = ['mysterious', 'epic', 'suspense', 'emotional', 'discovery'];
const BGM_DURATION = 300; // 5 minutes

// Ensure directories exist
fs.mkdirSync(BGM_DIR, { recursive: true });
fs.mkdirSync(OVERLAYS_DIR, { recursive: true });

console.log('Generating BGM placeholder tracks...');

// Each mood gets a different ambient tone
const moodSettings = {
  mysterious: { freq: 220, freq2: 330 },
  epic:       { freq: 330, freq2: 440 },
  suspense:   { freq: 185, freq2: 277 },
  emotional:  { freq: 262, freq2: 392 },
  discovery:  { freq: 294, freq2: 440 },
};

for (const mood of MOODS) {
  const outPath = path.join(BGM_DIR, `${mood}.mp3`);
  if (fs.existsSync(outPath)) {
    console.log(`  ✓ ${mood}.mp3 already exists, skipping.`);
    continue;
  }

  const s = moodSettings[mood];

  try {
    // Generate a quiet two-tone ambient drone as placeholder BGM
    const cmd = `ffmpeg -f lavfi -i "sine=frequency=${s.freq}:duration=${BGM_DURATION}" -f lavfi -i "sine=frequency=${s.freq2}:duration=${BGM_DURATION}" -filter_complex "[0:a][1:a]amix=inputs=2,volume=0.03,lowpass=f=500" -b:a 64k -y "${outPath}"`;
    execSync(cmd, { stdio: 'inherit', timeout: 60000 });
    console.log(`  ✓ Generated ${mood}.mp3`);
  } catch (err) {
    console.error(`  ✗ Failed to generate ${mood}.mp3:`, err.message);
    // Create a 1-second silent file as absolute fallback
    try {
      execSync(`ffmpeg -f lavfi -i "anullsrc=r=44100:cl=mono" -t 1 -b:a 64k -y "${outPath}"`, { stdio: 'inherit', timeout: 10000 });
      console.log(`  ✓ Created silent fallback for ${mood}.mp3`);
    } catch (e2) {
      console.error(`  ✗ Even fallback failed for ${mood}.mp3`);
    }
  }
}

// Generate a particle overlay video (subtle white specks on black)
const overlayPath = path.join(OVERLAYS_DIR, 'dust_particles.mp4');

if (!fs.existsSync(overlayPath)) {
  console.log('Generating particle overlay video...');
  try {
    // Use a simpler approach: generate random noise at very low intensity
    // This creates subtle sparkle-like particles on a black background
    const cmd = `ffmpeg -f lavfi -i "color=c=black:s=1920x1080:d=30:r=25" -f lavfi -i "nullsrc=s=1920x1080:d=30:r=25,noise=alls=20:allf=t" -filter_complex "[1:v]colorchannelmixer=rr=0.03:gg=0.03:bb=0.03[noise];[0:v][noise]blend=all_mode=screen" -c:v libx264 -preset fast -crf 28 -pix_fmt yuv420p -y "${overlayPath}"`;
    execSync(cmd, { stdio: 'inherit', timeout: 120000 });
    console.log('  ✓ Generated dust_particles.mp4');
  } catch (err) {
    console.error('  ✗ Failed to generate particle overlay:', err.message);
    // Create a minimal black video as fallback (will be invisible when blended)
    try {
      execSync(`ffmpeg -f lavfi -i "color=c=black:s=1920x1080:d=5:r=25" -c:v libx264 -preset fast -pix_fmt yuv420p -y "${overlayPath}"`, { stdio: 'inherit', timeout: 30000 });
      console.log('  ✓ Created black fallback overlay');
    } catch (e2) {
      console.error('  ✗ Even fallback overlay failed');
    }
  }
} else {
  console.log('  ✓ dust_particles.mp4 already exists, skipping.');
}

// Verify all files exist
console.log('\n--- Verification ---');
for (const mood of MOODS) {
  const p = path.join(BGM_DIR, `${mood}.mp3`);
  console.log(`  ${fs.existsSync(p) ? '✓' : '✗'} ${mood}.mp3`);
}
const op = path.join(OVERLAYS_DIR, 'dust_particles.mp4');
console.log(`  ${fs.existsSync(op) ? '✓' : '✗'} dust_particles.mp4`);

console.log('\nDone!');
