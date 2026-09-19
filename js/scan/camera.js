/* Camera plumbing: permission, stream lifecycle, and grabbing a still.
 * Kept separate from the detectors so a permission failure has one clear place
 * to be handled and explained. */

export class Camera {
  constructor(video) { this.video = video; this.stream = null; }

  async start({ facing = 'user', width = 1280, height = 1706 } = {}) {
    this.stop();
    const constraints = {
      audio: false,
      video: {
        facingMode: facing,
        width: { ideal: width }, height: { ideal: height },
        frameRate: { ideal: 30 },
      },
    };
    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      // Retry once without the size hints — some devices reject ideal sizes.
      if (err.name === 'OverconstrainedError') {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: facing } });
      } else throw err;
    }
    this.video.srcObject = this.stream;
    this.video.setAttribute('playsinline', '');
    this.video.muted = true;
    await this.video.play();
    await new Promise(r => {
      if (this.video.readyState >= 2) return r();
      this.video.addEventListener('loadeddata', r, { once: true });
    });
    return this;
  }

  stop() {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
  }

  get size() { return { w: this.video.videoWidth, h: this.video.videoHeight }; }

  /** Grab the current frame into a canvas. `mirror` un-mirrors the selfie preview
   *  so pixel sampling and landmarks agree on which side is which. */
  grab({ mirror = false } = {}) {
    const { w, h } = this.size;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (mirror) { ctx.translate(w, 0); ctx.scale(-1, 1); }
    ctx.drawImage(this.video, 0, 0, w, h);
    return { canvas: c, ctx, imageData: ctx.getImageData(0, 0, w, h), w, h };
  }
}

export async function cameraAvailable() {
  if (!navigator.mediaDevices?.getUserMedia) return false;
  try {
    const devs = await navigator.mediaDevices.enumerateDevices();
    return devs.some(d => d.kind === 'videoinput');
  } catch { return false; }
}

/** Human-readable reason a camera request failed — shown verbatim to the user. */
export function explainCameraError(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'הגישה למצלמה נחסמה. יש לאשר את ההרשאה בהגדרות הדפדפן ולנסות שוב.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'לא נמצאה מצלמה במכשיר.';
    case 'NotReadableError':
      return 'המצלמה תפוסה על ידי אפליקציה אחרת. סגרו אותה ונסו שוב.';
    case 'OverconstrainedError':
      return 'המצלמה אינה תומכת ברזולוציה הנדרשת.';
    default:
      return 'לא הצלחנו לפתוח את המצלמה. נסו לרענן את הדף.';
  }
}
