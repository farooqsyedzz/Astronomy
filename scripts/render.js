const { createClient } = require('@supabase/supabase-js');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const config = require('./cinematic.config');

// Helper to parse arguments
const args = process.argv.slice(2);
const topicIdIndex = args.indexOf('--topicId');
if (topicIdIndex === -1 || !args[topicIdIndex + 1]) {
  console.error("Usage: node render.js --topicId <id>");
  process.exit(1);
}
const topicId = args[topicIdIndex + 1];

const subtitlesIndex = args.indexOf('--subtitles');
const disableSubtitles = subtitlesIndex !== -1 && args[subtitlesIndex + 1] === 'false';
// Override config if explicitly passed
if (disableSubtitles) {
  config.subtitles.enabled = false;
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in environment");
  process.exit(1);
}

// Bypass RLS if using the service role key
const supabase = createClient(supabaseUrl, supabaseKey);

// ── Helpers ──────────────────────────────────────────────────────────

async function downloadFile(url, outputPath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.writeFile(outputPath, buffer);
}

function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration);
    });
  });
}

function formatSrtTime(seconds) {
  const date = new Date(seconds * 1000);
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss},${ms}`;
}

function escapeFfmpegPath(p) {
  let safe = p.replace(/\\/g, '/');
  if (safe.includes(':')) {
    safe = safe.replace(':', '\\\\:');
  }
  return safe;
}

// ── Zoompan Filter Builder ───────────────────────────────────────────

function buildZoompanFilter(movement, duration, zoomIntensity) {
  const fps = config.camera.fps || 25;
  const totalFrames = Math.ceil(duration * fps);
  const maxZoom = 1 + zoomIntensity;
  const zoomStep = zoomIntensity / totalFrames;

  switch (movement) {
    case 'zoom_in_center':
      return `scale=8000:-1,zoompan=z='min(zoom+${zoomStep.toFixed(6)},${maxZoom})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=1920x1080:fps=${fps}`;
    
    case 'zoom_out_center':
      return `scale=8000:-1,zoompan=z='if(eq(on,1),${maxZoom},max(zoom-${zoomStep.toFixed(6)},1.0))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=1920x1080:fps=${fps}`;
    
    case 'pan_left':
      return `scale=8000:-1,zoompan=z='1.1':x='iw*0.1*(1-on/${totalFrames})':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=1920x1080:fps=${fps}`;
    
    case 'pan_right':
      return `scale=8000:-1,zoompan=z='1.1':x='iw*0.1*on/${totalFrames}':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=1920x1080:fps=${fps}`;
    
    case 'pan_up':
      return `scale=8000:-1,zoompan=z='1.1':x='iw/2-(iw/zoom/2)':y='ih*0.1*(1-on/${totalFrames})':d=${totalFrames}:s=1920x1080:fps=${fps}`;
    
    case 'ken_burns_tl_br':
      // Start top-left, drift to bottom-right with slow zoom
      return `scale=8000:-1,zoompan=z='min(zoom+${(zoomStep * 0.7).toFixed(6)},${1 + zoomIntensity * 0.7})':x='iw*0.05*on/${totalFrames}':y='ih*0.05*on/${totalFrames}':d=${totalFrames}:s=1920x1080:fps=${fps}`;
    
    case 'ken_burns_br_tl':
      // Start bottom-right, drift to top-left with slow zoom
      return `scale=8000:-1,zoompan=z='min(zoom+${(zoomStep * 0.7).toFixed(6)},${1 + zoomIntensity * 0.7})':x='iw*0.05*(1-on/${totalFrames})':y='ih*0.05*(1-on/${totalFrames})':d=${totalFrames}:s=1920x1080:fps=${fps}`;
    
    default: // 'static'
      return `scale=1920:1080`;
  }
}

// ── SRT Generator ────────────────────────────────────────────────────

async function generateSrt(narration, duration, srtPath) {
  const words = narration.split(' ');
  const wordsPerChunk = config.subtitles.wordsPerChunk || 5;
  const chunks = [];

  for (let j = 0; j < words.length; j += wordsPerChunk) {
    chunks.push(words.slice(j, j + wordsPerChunk).join(' '));
  }

  // Calculate total characters (excluding spaces between chunks, though keeping it simple is fine)
  const totalChars = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const timePerChar = duration / totalChars;
  
  let srtContent = '';
  let currentTime = 0;

  for (let j = 0; j < chunks.length; j++) {
    const chunk = chunks[j];
    const chunkDuration = chunk.length * timePerChar;
    const startTime = currentTime;
    const endTime = currentTime + chunkDuration;
    
    srtContent += `${j + 1}\n`;
    srtContent += `${formatSrtTime(startTime)} --> ${formatSrtTime(endTime)}\n`;
    srtContent += `${chunk}\n\n`;
    
    currentTime = endTime;
  }

  await fs.writeFile(srtPath, srtContent);
}

// ── Main Render Function ─────────────────────────────────────────────

async function renderVideo() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'render-'));
  const isCinematic = config.cinematicMode;

  console.log(`Starting render for Topic ID: ${topicId}`);
  console.log(`Mode: ${isCinematic ? '🎬 CINEMATIC' : '⚡ FAST'}`);

  try {
    // 1. Fetch Assets from DB (now including storyboard)
    const { data: topic, error: topicError } = await supabase
      .from('topics')
      .select('*, scripts(id, scenes(id, order_index, narration, storyboard, assets(*))), thumbnails(*)')
      .eq('id', topicId)
      .single();

    if (topicError || !topic || !topic.scripts || topic.scripts.length === 0) {
      throw new Error('Could not find data for this topic');
    }

    const validScript = topic.scripts.find(s => s.scenes && s.scenes.length > 0);
    if (!validScript) throw new Error("No scenes found in any script");

    const scenes = validScript.scenes.sort((a, b) => a.order_index - b.order_index);
    if (!scenes || scenes.length === 0) throw new Error("No scenes found");

    console.log(`Found ${scenes.length} scenes.`);

    // Determine the dominant BGM mood from storyboard data
    let dominantMood = config.bgm.defaultMood;
    if (isCinematic && config.bgm.enabled) {
      const moodCounts = {};
      for (const scene of scenes) {
        const mood = scene.storyboard?.bgm_mood || config.bgm.defaultMood;
        moodCounts[mood] = (moodCounts[mood] || 0) + 1;
      }
      dominantMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || config.bgm.defaultMood;
      console.log(`Dominant BGM mood: ${dominantMood}`);
    }

    const sceneVideos = [];

    // 2. Render each scene
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const imageAsset = scene.assets.find(a => a.type === 'image');
      const voiceAsset = scene.assets.find(a => a.type === 'voice');

      if (!imageAsset || !voiceAsset) {
        console.warn(`Missing assets for scene ${scene.id}, skipping...`);
        continue;
      }

      console.log(`Processing Scene ${i + 1}/${scenes.length}...`);
      const imgPath = path.join(tempDir, `scene_${i}.jpg`);
      const audioPath = path.join(tempDir, `scene_${i}.mp3`);
      const outPath = path.join(tempDir, `scene_${i}.mp4`);
      const srtPath = path.join(tempDir, `scene_${i}.srt`);

      await downloadFile(imageAsset.file_url, imgPath);
      await downloadFile(voiceAsset.file_url, audioPath);

      const duration = await getAudioDuration(audioPath);
      await generateSrt(scene.narration, duration, srtPath);
      const safeSrtPath = escapeFfmpegPath(srtPath);

      const storyboard = scene.storyboard || null;
      const useCinematic = isCinematic && storyboard;

      if (useCinematic && config.camera.enabled) {
        // ── Cinematic Rendering ──
        const movement = storyboard.camera_movement || 'zoom_in_center';
        const zoomIntensity = storyboard.zoom_intensity || config.camera.zoomIntensity;
        
        // Add slight random variation to zoom
        const variation = (Math.random() * 2 - 1) * config.camera.zoomVariation;
        const finalZoom = Math.max(0.05, zoomIntensity + variation);

        const zoompanFilter = buildZoompanFilter(movement, duration, finalZoom);

        // Build the video filter chain
        let vfChain = zoompanFilter;

        // Add fade transitions
        if (config.transitions.enabled) {
          const fadeDur = config.transitions.fadeDuration;
          vfChain += `,fade=t=in:st=0:d=${fadeDur}`;
          if (duration > fadeDur * 2) {
            vfChain += `,fade=t=out:st=${(duration - fadeDur).toFixed(2)}:d=${fadeDur}`;
          }
        }

        // Add subtitles
        if (config.subtitles.enabled) {
          const fontSize = config.subtitles.fontSize;
          const marginV = config.subtitles.marginV;
          const outline = config.subtitles.outline;
          const borderStyle = config.subtitles.borderStyle || 1;
          vfChain += `,subtitles='${safeSrtPath}':force_style='FontSize=${fontSize},PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H00000000,BorderStyle=${borderStyle},Outline=${outline},Shadow=1,MarginV=${marginV}'`;
        }

        console.log(`  🎬 Camera: ${movement} | Zoom: ${finalZoom.toFixed(3)}`);

        await new Promise((resolve, reject) => {
          ffmpeg()
            .input(imgPath)
            .loop()
            .input(audioPath)
            .videoCodec('libx264')
            .outputOptions([
              '-pix_fmt yuv420p',
              `-vf ${vfChain}`,
              '-shortest',
              '-preset fast',
            ])
            .audioCodec('aac')
            .audioBitrate('128k')
            .save(outPath)
            .on('end', () => resolve())
            .on('error', (err) => reject(err));
        });

      } else {
        // ── Fast / Basic Rendering ──
        console.log(`  ⚡ Fast mode (no storyboard data)`);

        let vf = 'scale=1920:1080';
        if (config.subtitles.enabled) {
          const fontSize = config.subtitles.fontSize;
          const marginV = config.subtitles.marginV;
          const outline = config.subtitles.outline;
          const borderStyle = config.subtitles.borderStyle || 1;
          vf += `,subtitles='${safeSrtPath}':force_style='FontSize=${fontSize},PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H00000000,BorderStyle=${borderStyle},Outline=${outline},Shadow=1,MarginV=${marginV}'`;
        }

        await new Promise((resolve, reject) => {
          ffmpeg()
            .input(imgPath)
            .loop()
            .input(audioPath)
            .videoCodec('libx264')
            .outputOptions([
              '-tune stillimage',
              '-pix_fmt yuv420p',
              `-vf ${vf}`,
              '-shortest',
            ])
            .audioCodec('aac')
            .audioBitrate('128k')
            .save(outPath)
            .on('end', () => resolve())
            .on('error', (err) => reject(err));
        });
      }

      sceneVideos.push(outPath);
    }

    if (sceneVideos.length === 0) throw new Error("No scenes could be rendered");

    // 3. Concatenate scenes
    const concatFile = path.join(tempDir, 'concat.txt');
    const concatContent = sceneVideos.map(vid => `file '${vid}'`).join('\n') + '\n';
    await fs.writeFile(concatFile, concatContent);

    const concatenatedPath = path.join(tempDir, 'concatenated.mp4');
    console.log("Concatenating scenes...");

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(concatFile)
        .inputOptions(['-f concat', '-safe 0'])
        .outputOptions('-c copy')
        .save(concatenatedPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });

    // 4. Mix Background Music (if cinematic mode)
    let finalOutput = concatenatedPath;

    if (isCinematic && config.bgm.enabled) {
      const bgmFilename = config.bgm.moods[dominantMood] || config.bgm.moods[config.bgm.defaultMood];
      const bgmPath = path.resolve(__dirname, '..', config.bgm.tracksDir, bgmFilename);

      if (fsSync.existsSync(bgmPath)) {
        console.log(`Mixing BGM: ${bgmFilename} (mood: ${dominantMood})...`);
        const mixedPath = path.join(tempDir, 'final_with_bgm.mp4');

        await new Promise((resolve, reject) => {
          ffmpeg()
            .input(concatenatedPath)
            .input(bgmPath)
            .inputOptions(['-stream_loop -1']) // Loop BGM
            .outputOptions([
              '-c:v copy', // Don't re-encode video
              `-filter_complex [0:a]volume=1.0[narration];[1:a]volume=${config.bgm.volume}[bgm];[narration][bgm]amix=inputs=2:duration=first[aout]`,
              '-map 0:v',
              '-map [aout]',
              '-shortest',
            ])
            .save(mixedPath)
            .on('end', () => resolve())
            .on('error', (err) => reject(err));
        });

        finalOutput = mixedPath;
      } else {
        console.warn(`BGM track not found at ${bgmPath}, skipping BGM mixing.`);
      }
    }

    // 5. Add Particle Overlay (if cinematic mode)
    if (isCinematic && config.particles.enabled) {
      const overlayPath = path.resolve(__dirname, '..', config.particles.overlayPath);

      if (fsSync.existsSync(overlayPath)) {
        console.log('Applying particle overlay...');
        const withParticlesPath = path.join(tempDir, 'final_with_particles.mp4');

        await new Promise((resolve, reject) => {
          ffmpeg()
            .input(finalOutput)
            .input(overlayPath)
            .inputOptions(['-stream_loop -1']) // Loop overlay
            .outputOptions([
              `-filter_complex [1:v]format=yuva420p,colorchannelmixer=aa=${config.particles.opacity}[particles];[0:v][particles]overlay=0:0:shortest=1[vout]`,
              '-map [vout]',
              '-map 0:a',
              '-c:v libx264',
              '-preset fast',
              '-c:a copy',
              '-shortest',
            ])
            .save(withParticlesPath)
            .on('end', () => resolve())
            .on('error', (err) => reject(err));
        });

        finalOutput = withParticlesPath;
      } else {
        console.warn(`Particle overlay not found at ${overlayPath}, skipping.`);
      }
    }

    // 6. Embed Thumbnail (if selected)
    const selectedThumb = topic.thumbnails?.find(t => t.is_selected && t.file_url);
    if (selectedThumb) {
      console.log('Embedding selected thumbnail as video cover art...');
      const thumbPath = path.join(tempDir, 'thumbnail.webp');
      await downloadFile(selectedThumb.file_url, thumbPath);
      
      const withThumbnailPath = path.join(tempDir, 'final_with_thumbnail.mp4');
      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(finalOutput)
          .input(thumbPath)
          .outputOptions([
            '-map 0',
            '-map 1',
            '-c copy',
            '-c:v:1 mjpeg',
            '-disposition:v:1 attached_pic'
          ])
          .save(withThumbnailPath)
          .on('end', () => resolve())
          .on('error', (err) => reject(err));
      });
      finalOutput = withThumbnailPath;
    }

    console.log("Post-processing complete. Uploading to Supabase...");

    // 6. Upload to Supabase Storage
    const videoBuffer = await fs.readFile(finalOutput);
    const storagePath = `${topicId}/final_video.mp4`;

    const { error: uploadError } = await supabase.storage
      .from('assets')
      .upload(storagePath, videoBuffer, {
        contentType: 'video/mp4',
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from('assets').getPublicUrl(storagePath);
    
    // 7. Update DB (upsert video record)
    let videoData;
    const { data: existingVideo } = await supabase
      .from('videos')
      .select('id')
      .eq('topic_id', topicId)
      .maybeSingle();

    if (existingVideo) {
      const { data, error: videoError } = await supabase
        .from('videos')
        .update({
          final_video_url: `${urlData.publicUrl}?v=${Date.now()}`,
          status: 'ready'
        })
        .eq('id', existingVideo.id)
        .select()
        .single();
      if (videoError) throw videoError;
      videoData = data;
    } else {
      const { data, error: videoError } = await supabase
        .from('videos')
        .insert({
          topic_id: topicId,
          final_video_url: `${urlData.publicUrl}?v=${Date.now()}`,
          status: 'ready'
        })
        .select()
        .single();
      if (videoError) throw videoError;
      videoData = data;
    }

    const { error: topicUpdateError } = await supabase
      .from('topics')
      .update({ status: 'render_complete' })
      .eq('id', topicId);
    if (topicUpdateError) throw topicUpdateError;

    console.log(`Render complete! URL: ${urlData.publicUrl}`);
    console.log("Triggering automatic QA Pipeline...");

    // Determine the base URL of the Next.js app to trigger the API route
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    // Auto-trigger QA Pipeline
    try {
      const formData = new URLSearchParams();
      formData.append('topicId', topicId);
      if (videoData && videoData.id) {
         formData.append('videoId', videoData.id);
      }
      
      const qaResponse = await fetch(`${appUrl}/api/qa/trigger`, {
        method: 'POST',
        body: formData,
      });
      console.log(`QA Pipeline triggered. Status: ${qaResponse.status}`);
    } catch (qaErr) {
      if (qaErr.cause && qaErr.cause.code === 'ECONNREFUSED') {
        console.log("QA Pipeline trigger skipped: localhost server not running in CI environment (expected behavior).");
      } else {
        console.error("Failed to trigger automatic QA pipeline:", qaErr.message || qaErr);
      }
    }

  } catch (error) {
    console.error("Render failed:", error);
    process.exit(1);
  } finally {
    // Clean up temp dir
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      console.error("Failed to clean up temp dir:", e);
    }
  }
}

renderVideo();
