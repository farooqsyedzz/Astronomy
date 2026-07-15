const { createClient } = require('@supabase/supabase-js');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const os = require('os');

// Helper to parse arguments
const args = process.argv.slice(2);
const topicIdIndex = args.indexOf('--topicId');
if (topicIdIndex === -1 || !args[topicIdIndex + 1]) {
  console.error("Usage: node render.js --topicId <id>");
  process.exit(1);
}
const topicId = args[topicIdIndex + 1];

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in environment");
  process.exit(1);
}

// Bypass RLS if using the service role key
const supabase = createClient(supabaseUrl, supabaseKey);

async function downloadFile(url, outputPath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.writeFile(outputPath, buffer);
}

async function renderVideo() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'render-'));
  
  try {
    console.log(`Starting render for Topic ID: ${topicId}`);
    
    // 1. Fetch Assets from DB
    const { data: topic, error: topicError } = await supabase
      .from('topics')
      .select('*, scripts(id, scenes(id, order_index, narration, assets(*)))')
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

    const sceneVideos = [];

    // 2. Download assets & create individual scene videos
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const imageAsset = scene.assets.find(a => a.type === 'image');
      const voiceAsset = scene.assets.find(a => a.type === 'voice');

      if (!imageAsset || !voiceAsset) {
        console.warn(`Missing assets for scene ${scene.id}, skipping...`);
        continue;
      }

      console.log(`Downloading assets for Scene ${i + 1}...`);
      const imgPath = path.join(tempDir, `scene_${i}.jpg`);
      const audioPath = path.join(tempDir, `scene_${i}.mp3`);
      const outPath = path.join(tempDir, `scene_${i}.mp4`);
      const txtPath = path.join(tempDir, `scene_${i}.txt`);

      await downloadFile(imageAsset.file_url, imgPath);
      await downloadFile(voiceAsset.file_url, audioPath);

      // Word wrap the narration for subtitles (approx 60 chars per line)
      const words = scene.narration.split(' ');
      let lines = [];
      let currentLine = '';
      for (let word of words) {
        if ((currentLine + word).length > 60) {
          lines.push(currentLine.trim());
          currentLine = word + ' ';
        } else {
          currentLine += word + ' ';
        }
      }
      if (currentLine) lines.push(currentLine.trim());
      await fs.writeFile(txtPath, lines.join('\n'));
      
      // FFmpeg requires forward slashes for filter paths even on Windows
      const safeTxtPath = txtPath.replace(/\\/g, '/');

      console.log(`Rendering Scene ${i + 1}...`);
      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(imgPath)
          .loop() // Loop the static image
          .input(audioPath)
          // Video codec, frame rate, pixel format
          .videoCodec('libx264')
          .outputOptions([
            '-tune stillimage',
            '-pix_fmt yuv420p',
            // Scale and add subtitles
            `-vf scale=1920:1080,drawtext=textfile='${safeTxtPath}':fontcolor=white:fontsize=48:box=1:boxcolor=black@0.6:boxborderw=20:x=(w-text_w)/2:y=h-text_h-100:line_spacing=10`,
            '-shortest' // Finish encoding when the shortest stream (audio) ends
          ])
          // Audio codec
          .audioCodec('aac')
          .audioBitrate('128k')
          .save(outPath)
          .on('end', () => resolve())
          .on('error', (err) => reject(err));
      });

      sceneVideos.push(outPath);
    }

    if (sceneVideos.length === 0) throw new Error("No scenes could be rendered");

    // 3. Concatenate scenes
    const concatFile = path.join(tempDir, 'concat.txt');
    const concatContent = sceneVideos.map(vid => `file '${vid}'`).join('\n');
    await fs.writeFile(concatFile, concatContent);

    const finalOutput = path.join(tempDir, 'final_output.mp4');
    console.log("Concatenating scenes...");

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(concatFile)
        .inputOptions(['-f concat', '-safe 0'])
        .outputOptions('-c copy')
        .save(finalOutput)
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });

    console.log("Concatenation complete. Uploading to Supabase...");

    // 4. Upload to Supabase Storage
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
    
    // 5. Update DB
    const { error: videoError } = await supabase.from('videos').insert({
      topic_id: topicId,
      final_video_url: urlData.publicUrl,
      status: 'ready'
    });
    if (videoError) throw videoError;

    const { error: topicUpdateError } = await supabase
      .from('topics')
      .update({ status: 'render_complete' })
      .eq('id', topicId);
    if (topicUpdateError) throw topicUpdateError;

    console.log(`Render complete! URL: ${urlData.publicUrl}`);

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
