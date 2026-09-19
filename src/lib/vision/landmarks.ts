/* MediaPipe Face Landmarker index constants (478-point model: 468 mesh + 10 iris).
   Indices are the canonical ones published with the FaceMesh topology. */

export const FACE_OVAL: readonly number[] = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

/* Vertical landmarks. NOTE on `TRICHION`: FaceMesh has no hairline point — 10 is
   the top of the detected oval (upper forehead). Every metric that uses it is
   flagged `approx` in the catalogue and reported as such in the UI. */
export const TRICHION = 10;
export const NASION   = 168;  // bridge, between the eyes
export const GLABELLA = 9;    // between brows
export const SUBNASALE = 2;   // base of the columella
export const NOSE_TIP = 1;
export const MENTON   = 152;  // chin bottom
export const STOMION  = 13;   // upper-lip inner edge (mouth line)

/* Eyes — "R"/"L" are the *subject's* right/left. */
export const R_EYE_OUT = 33,  R_EYE_IN = 133;
export const L_EYE_OUT = 263, L_EYE_IN = 362;
export const R_EYE_UP  = 159, R_EYE_DN = 145;
export const L_EYE_UP  = 386, L_EYE_DN = 374;

/* Iris rings: [centre, right, top, left, bottom] */
export const L_IRIS = [468, 469, 470, 471, 472] as const;
export const R_IRIS = [473, 474, 475, 476, 477] as const;

/* Brows */
export const R_BROW_PEAK = 105, L_BROW_PEAK = 334;
export const R_BROW_IN   = 107, L_BROW_IN   = 336;

/* Nose */
export const ALA_R = 98, ALA_L = 327;      // nostril corners → alar width

/* Mouth / lips */
export const MOUTH_R = 61, MOUTH_L = 291;
export const LIP_UP_TOP = 0, LIP_UP_BOT = 13;
export const LIP_DN_TOP = 14, LIP_DN_BOT = 17;

/* Cheeks & jaw */
export const CHEEK_R = 205, CHEEK_L = 425;
export const ZYG_R = 234, ZYG_L = 454;     // widest oval points (bizygomatic ≈)
export const GONION_R = 172, GONION_L = 397;
export const RAMUS_R = 58,  RAMUS_L = 288; // one step up the jaw from the gonion

/* Pairs mirrored across the facial midline — the symmetry metric walks these. */
export const MIRROR_PAIRS: readonly (readonly [number, number])[] = [
  [33, 263], [133, 362], [159, 386], [145, 374],
  [105, 334], [107, 336], [70, 300], [63, 293],
  [98, 327], [129, 358], [64, 294],
  [61, 291], [40, 270], [91, 321], [84, 314],
  [234, 454], [172, 397], [58, 288], [205, 425],
  [116, 345], [123, 352], [147, 376], [136, 365], [150, 379], [149, 378],
  [93, 323], [132, 361], [215, 435], [138, 367],
];

/* Landmarks on the midline — used to fit the symmetry axis. */
export const MIDLINE: readonly number[] = [10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 164, 0, 13, 14, 17, 18, 200, 199, 175, 152];

/* MediaPipe Pose (33 landmarks) */
export const POSE = {
  NOSE: 0, L_EYE: 2, R_EYE: 5, L_EAR: 7, R_EAR: 8,
  L_SHOULDER: 11, R_SHOULDER: 12, L_ELBOW: 13, R_ELBOW: 14,
  L_WRIST: 15, R_WRIST: 16, L_HIP: 23, R_HIP: 24,
  L_KNEE: 25, R_KNEE: 26, L_ANKLE: 27, R_ANKLE: 28,
} as const;

/* The mean adult horizontal iris diameter — 11.7 mm, with remarkably little
   variation across age, sex and ethnicity (±0.5 mm). This is what lets the app
   convert pixels to millimetres without asking the user to hold up a ruler. */
export const IRIS_DIAMETER_MM = 11.7;
