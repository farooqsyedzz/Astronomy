export interface StoryboardInstruction {
  camera_movement: CameraMovement;
  zoom_intensity: number; // 0.0 to 0.5
  transition_in: TransitionType;
  transition_out: TransitionType;
  visual_effects: VisualEffect[];
  bgm_mood: BgmMood;
}

export type CameraMovement =
  | 'zoom_in_center'
  | 'zoom_out_center'
  | 'pan_left'
  | 'pan_right'
  | 'pan_up'
  | 'ken_burns_tl_br'
  | 'ken_burns_br_tl'
  | 'static';

export type TransitionType = 'fade' | 'none';

export type VisualEffect = 'dust_particles' | 'none';

export type BgmMood = 'mysterious' | 'epic' | 'suspense' | 'emotional' | 'discovery';
