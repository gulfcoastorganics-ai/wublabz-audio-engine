export type SceneQuantize = 'immediate' | 'nextBeat' | 'nextBar' | 'nextPhrase';

export const SUPPORTED_SCENES = [
  'INTRO', 'BUILD', 'FAKEOUT', 'DROP_A', 'DROP_B',
  'BREAKDOWN', 'RISER', 'IMPACT', 'BASS_FILL', 'RELOAD', 'OUTRO'
];

export class SceneScheduler {
  private currentScene: string = '';
  private queuedScene: string = '';

  validateScene(sceneId: string): boolean {
    return SUPPORTED_SCENES.includes(sceneId);
  }

  queueScene(sceneId: string, quantize: SceneQuantize = 'nextBar') {
    if (!this.validateScene(sceneId)) {
      return { success: false, reason: 'Unsupported scene' };
    }
    this.queuedScene = sceneId;
    
    // If immediate, apply it right away
    if (quantize === 'immediate') {
      this.currentScene = sceneId;
      this.queuedScene = '';
    }
    
    return { success: true, queuedScene: this.queuedScene, currentScene: this.currentScene };
  }

  applyQueuedSceneIfBoundary(transportState: string) {
    // Basic boundary check simulation
    if (this.queuedScene && transportState === 'playing') {
      this.currentScene = this.queuedScene;
      this.queuedScene = '';
    }
  }

  clearQueuedScene() {
    this.queuedScene = '';
  }

  getQueuedScene() {
    return this.queuedScene;
  }

  getCurrentScene() {
    return this.currentScene;
  }

  emergencyStopScenes() {
    this.currentScene = '';
    this.queuedScene = '';
  }
}
