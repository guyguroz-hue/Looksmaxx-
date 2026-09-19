'use client';

/**
 * MediaPipe loader.
 *
 * Runs entirely on-device: the WASM runtime and model are fetched once and the
 * detection happens in the browser. No frame is ever sent anywhere, which is
 * what makes the privacy line on the welcome screen a fact rather than a claim.
 */

import type { FaceLandmarker } from '@mediapipe/tasks-vision';

const VERSION = '0.10.21';

const SOURCES = {
  wasm: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`,
  model:
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
};

let cached: Promise<FaceLandmarker> | null = null;

export function loadFaceLandmarker(): Promise<FaceLandmarker> {
  cached ??= (async () => {
    const vision = await import('@mediapipe/tasks-vision');
    const fileset = await vision.FilesetResolver.forVisionTasks(SOURCES.wasm);
    return vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: SOURCES.model, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  })();
  return cached;
}

/** Warm the download during onboarding so the camera screen never stalls. */
export function warmUp(): void {
  void loadFaceLandmarker().catch(() => {
    /* surfaced at capture time, where there is somewhere to show it */
  });
}

export function explainCameraError(err: unknown): string {
  const name = (err as { name?: string } | null)?.name;
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera access is blocked. Allow it in your browser settings, then try again.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera found on this device.';
    case 'NotReadableError':
      return 'Another app is using the camera. Close it and try again.';
    default:
      return "We couldn't start the camera. Refreshing the page usually fixes it.";
  }
}
