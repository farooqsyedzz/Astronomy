/**
 * Cinematic Rendering Configuration
 * 
 * Toggle features on/off and tune parameters for the cinematic rendering pipeline.
 * When cinematic mode is disabled, the renderer falls back to the fast basic pipeline.
 */

module.exports = {
  // Master toggle — set to false for fast slideshow-style rendering
  cinematicMode: true,

  // ── Ken Burns / Camera Movement ──────────────────────────────────
  camera: {
    enabled: true,
    // Base zoom intensity (how much to zoom over the scene duration)
    // Range: 0.0 (no zoom) to 0.5 (dramatic zoom). 0.05 is barely noticeable/documentary.
    zoomIntensity: 0.05,
    // Random variation applied to zoom intensity per scene (±)
    zoomVariation: 0.02,
    // Available movements. The director picks one, or it's randomized.
    movements: ['zoom_in_center', 'zoom_out_center', 'pan_left', 'pan_right', 'pan_up', 'ken_burns_tl_br', 'ken_burns_br_tl'],
    // Frames per second for the zoompan filter (higher = smoother but slower render)
    fps: 25,
  },

  // ── Transitions ──────────────────────────────────────────────────
  transitions: {
    enabled: true,
    // Duration in seconds for fade in/out at clip boundaries
    fadeDuration: 1.0,
  },

  // ── Particle Overlays ────────────────────────────────────────────
  particles: {
    enabled: true,
    // Opacity of the particle overlay (0.0 = invisible, 1.0 = fully opaque)
    opacity: 0.08,
    // Path to the particle overlay video (relative to repo root)
    overlayPath: 'public/overlays/dust_particles.mp4',
  },

  // ── Background Music ─────────────────────────────────────────────
  bgm: {
    enabled: true,
    // Volume of BGM relative to narration (0.0 to 1.0). 0.08 = very subtle.
    volume: 0.08,
    // Directory containing mood-based tracks (relative to repo root)
    tracksDir: 'public/bgm',
    // Available moods and their track filenames
    moods: {
      mysterious: 'mysterious.mp3',
      epic: 'epic.mp3',
      suspense: 'suspense.mp3',
      emotional: 'emotional.mp3',
      discovery: 'discovery.mp3',
    },
    // Default mood if storyboard doesn't specify one
    defaultMood: 'mysterious',
  },

  // ── Subtitles ────────────────────────────────────────────────────
  subtitles: {
    enabled: true,
    // Words per subtitle chunk
    wordsPerChunk: 5,
    // Font size (smaller = less intrusive)
    fontSize: 22,
    // Bottom margin (pixels from bottom)
    marginV: 40,
    // Outline thickness
    outline: 2,
    // BorderStyle: 1 = outline + shadow (transparent bg), 3 = opaque box
    borderStyle: 1,
  },
};
