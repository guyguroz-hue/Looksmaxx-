/* MediaPipe Tasks Vision loader.
 *
 * Everything here is free and runs on-device: the WASM runtime comes from a
 * public CDN and the models from Google's public model store. There is no API
 * key, no quota and no per-request cost — and no frame ever leaves the browser.
 */

const VERSION = '0.10.21';

/* Where the runtime and models come from. Overridable via setSources() so the
   whole thing can be self-hosted — useful offline, behind a strict CSP, or if
   you would simply rather not depend on a CDN. Defaults are public and free. */
const SRC = {
  module: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/vision_bundle.mjs`,
  wasm:   `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`,
  face:   'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  pose:   'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
};

export function setSources(overrides = {}) { Object.assign(SRC, overrides); }
export const sources = () => ({ ...SRC });

let vision = null;
const cache = {};

async function tasks() {
  if (!vision) {
    const mod = await import(/* @vite-ignore */ SRC.module);
    vision = { mod, fileset: await mod.FilesetResolver.forVisionTasks(SRC.wasm) };
  }
  return vision;
}

/** 478-point face mesh, including the iris refinement we calibrate millimetres with. */
export async function faceLandmarker() {
  if (cache.face) return cache.face;
  const { mod, fileset } = await tasks();
  cache.face = await mod.FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: SRC.face, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  return cache.face;
}

/** 33-point pose + the segmentation mask that gives us real silhouette widths. */
export async function poseLandmarker() {
  if (cache.pose) return cache.pose;
  const { mod, fileset } = await tasks();
  cache.pose = await mod.PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: SRC.pose, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numPoses: 1,
    outputSegmentationMasks: true,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  return cache.pose;
}

export function disposeAll() {
  for (const k of Object.keys(cache)) { try { cache[k].close(); } catch {} delete cache[k]; }
}

/** Preload in the background so the first scan does not stall on a download. */
export function warmUp() {
  tasks().catch(() => {});
}
