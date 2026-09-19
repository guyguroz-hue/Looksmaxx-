/* The measurement catalogue: what each number means, what counts as a good
   value, how strong the evidence behind that target is, and — critically —
   whether a person can actually change it without surgery.
 *
 * `mod` (modifiability) drives the honest "potential" score:
 *   'fixed' → skeletal / genetic. Excluded from any promised gain.
 *   'soft'  → shifts with body-fat, muscle, oedema and age. Partial credit.
 *   'live'  → lifestyle-driven. Full credit.
 *
 * `ev` (evidence grade):
 *   'A' → RCTs / clinical guidelines   'B' → cohort & controlled studies
 *   'C' → small studies, expert consensus, or aesthetic convention
 */

/** Target bands that depend on the subject's build. */
const bySex = (m, f) => ({ __bySex: true, m, f, x: [(m[0] + f[0]) / 2, (m[1] + f[1]) / 2] });

export const DOMAINS = {
  harmony:   { id: 'harmony',   label: 'הרמוניה ופרופורציה', short: 'הרמוניה', weight: 1.0 },
  symmetry:  { id: 'symmetry',  label: 'סימטריה',            short: 'סימטריה', weight: 0.8 },
  definition:{ id: 'definition',label: 'הגדרה וחדות',        short: 'הגדרה',   weight: 1.1 },
  skin:      { id: 'skin',      label: 'איכות עור',          short: 'עור',     weight: 1.25 },
  body:      { id: 'body',      label: 'הרכב גוף',           short: 'גוף',     weight: 1.15 },
  posture:   { id: 'posture',   label: 'יציבה',              short: 'יציבה',   weight: 0.9 },
};

export const METRICS = [
  /* ------------------------------ הרמוניה ------------------------------ */
  {
    id: 'thirdsBalance', domain: 'harmony', from: 'face.ratios.thirdsBalance',
    label: 'איזון שלישי הפנים', unit: '', dir: 'high',
    band: [0.86, 1.0], tol: 0.34, mod: 'fixed', ev: 'C', weight: 1.0, approx: true,
    what: 'הפנים מתחלקות לשלושה חלקים: קו השיער→בין הגבות, בין הגבות→בסיס האף, בסיס האף→סנטר. ככל שהם שווים יותר, הפנים נקראות הרמוניות יותר.',
    note: 'קו השיער אינו מזוהה על ידי המודל — נעשה שימוש בקצה המצח כקירוב, ולכן המדד מסומן כהערכה.',
    protocols: ['hair_style', 'brow_shape'],
  },
  {
    id: 'lowerThirdRatio', domain: 'harmony', from: 'face.ratios.lowerThirdRatio',
    label: 'חלוקת השליש התחתון', unit: '', dir: 'band',
    band: [0.42, 0.58], tol: 0.24, mod: 'fixed', ev: 'C', weight: 0.8,
    what: 'היחס בין בסיס האף→קו השפתיים לבין קו השפתיים→סנטר. הפרופורציה המקובלת היא בערך 1:2.',
    protocols: ['beard_shape'],
  },
  {
    id: 'fifthsBalance', domain: 'harmony', from: 'face.ratios.fifthsBalance',
    label: 'חמישיות הרוחב', unit: '', dir: 'band',
    band: [0.88, 1.12], tol: 0.3, mod: 'fixed', ev: 'C', weight: 0.7,
    what: 'רוחב הפנים אמור להתחלק לחמישה רוחבי-עין. ערך 1.0 = חלוקה מדויקת.',
    protocols: ['brow_shape'],
  },
  {
    id: 'eyeSpacing', domain: 'harmony', from: 'face.ratios.eyeSpacing',
    label: 'מרווח בין העיניים', unit: '', dir: 'band',
    band: [0.92, 1.10], tol: 0.34, mod: 'fixed', ev: 'C', weight: 0.7,
    what: 'המרחק בין זוויות העיניים הפנימיות חלקי רוחב עין. הקנון הניאו-קלאסי: רוחב עין אחת בדיוק.',
    protocols: ['brow_shape', 'makeup_eyes'],
  },
  {
    id: 'noseToInterocular', domain: 'harmony', from: 'face.ratios.noseToInterocular',
    label: 'רוחב אף ביחס לעיניים', unit: '', dir: 'band',
    band: [0.90, 1.12], tol: 0.34, mod: 'fixed', ev: 'C', weight: 0.6,
    what: 'רוחב בסיס האף אמור להיות דומה למרחק בין העיניים.',
    protocols: ['makeup_contour', 'photo_angle'],
  },
  {
    id: 'noseToMouth', domain: 'harmony', from: 'face.ratios.noseToMouth',
    label: 'אף ביחס לפה', unit: '', dir: 'band',
    band: [0.62, 0.78], tol: 0.24, mod: 'fixed', ev: 'C', weight: 0.6,
    what: 'רוחב האף ביחס לרוחב הפה. היחס המקובל הוא כ-0.7.',
    protocols: ['makeup_contour'],
  },
  {
    id: 'lipRatio', domain: 'harmony', from: 'face.ratios.lipRatio',
    label: 'יחס שפה עליונה/תחתונה', unit: '', dir: 'band',
    band: [0.52, 0.78], tol: 0.34, mod: 'soft', ev: 'C', weight: 0.6,
    what: 'השפה התחתונה מלאה יותר מהעליונה ביחס של בערך 1:1.6.',
    protocols: ['lip_care', 'makeup_lips'],
  },
  {
    id: 'canthalTilt', domain: 'harmony', from: 'face.ratios.canthalTilt',
    label: 'זווית קנתוס', unit: '°', dir: 'band',
    band: [2, 9], tol: 9, mod: 'fixed', ev: 'C', weight: 0.8,
    what: 'כמה זווית העין החיצונית גבוהה מהפנימית. נטייה חיובית קלה (2°–9°) נתפסת כערנית וצעירה.',
    protocols: ['brow_shape', 'makeup_eyes', 'sleep'],
  },

  /* ------------------------------ סימטריה ------------------------------ */
  {
    id: 'symMeanDev', domain: 'symmetry', from: 'face.mm.symMeanDev',
    label: 'סטיית סימטריה ממוצעת', unit: ' מ״מ', dir: 'low',
    band: [0, 1.7], tol: 3.4, mod: 'soft', ev: 'B', weight: 1.2,
    what: 'ההפרש הממוצע במילימטרים בין צד ימין לצד שמאל, נמדד על 29 זוגות נקודות. כל פנים אנושיות א-סימטריות במידה מסוימת — מתחת ל-2 מ״מ נחשב בלתי מורגש.',
    note: 'חלק מהא-סימטריה נובעת מיציבת ראש, לעיסה חד-צדדית ותנוחת שינה — ולכן ניתנת לשיפור חלקי.',
    protocols: ['posture_neck', 'sleep_position', 'chew_balance'],
  },
  {
    id: 'symWorstDev', domain: 'symmetry', from: 'face.mm.symWorstDev',
    label: 'הסטייה הגדולה ביותר', unit: ' מ״מ', dir: 'low',
    band: [0, 3.2], tol: 5.5, mod: 'soft', ev: 'B', weight: 0.6,
    what: 'זוג הנקודות הכי לא-סימטרי בפנים. מצביע על היכן ממוקדת הא-סימטריה.',
    protocols: ['posture_neck', 'sleep_position'],
  },

  /* ------------------------------ הגדרה ------------------------------ */
  {
    id: 'cheekToJaw', domain: 'definition', from: 'face.ratios.cheekToJaw',
    label: 'עצמות לחיים ביחס ללסת', unit: '', dir: 'band',
    band: [1.22, 1.42], tol: 0.34, mod: 'soft', ev: 'C', weight: 1.0,
    what: 'רוחב עצמות הלחיים חלקי רוחב הלסת. ערך גבוה מדי = פנים משולשות; נמוך מדי = קו לסת מטושטש.',
    protocols: ['bodyfat', 'sodium', 'facial_exercise'],
  },
  {
    id: 'gonialAngle', domain: 'definition', from: 'face.ratios.gonialAngle',
    label: 'זווית הלסת', unit: '°', dir: 'band',
    band: [116, 132], tol: 24, mod: 'fixed', ev: 'C', weight: 0.9,
    what: 'הזווית בפינת הלסת. 116°–132° נחשבת לקו לסת מוגדר. זווית פתוחה יותר נקראת רכה יותר.',
    protocols: ['bodyfat', 'facial_exercise', 'photo_angle'],
  },
  {
    id: 'facialRoundness', domain: 'definition', from: 'face.ratios.facialRoundness',
    label: 'מלאות הפנים', unit: '', dir: 'low',
    band: [0.58, 0.76], tol: 0.13, mod: 'soft', ev: 'B', weight: 1.1,
    what: 'מדד עגלגלות קו המתאר של הפנים. קשור ישירות לאחוז השומן — מחקרים מראים שניתן להעריך BMI ממבנה הפנים בדיוק גבוה.',
    note: 'זה המדד שמגיב הכי חזק לשינוי בהרכב הגוף, ולעיתים קרובות הראשון שמשתנה.',
    protocols: ['bodyfat', 'sodium', 'alcohol', 'sleep'],
  },
  {
    id: 'fwhr', domain: 'definition', from: 'face.ratios.fwhr',
    label: 'יחס רוחב-גובה (fWHR)', unit: '', dir: 'band',
    band: [1.72, 2.05], tol: 0.5, mod: 'soft', ev: 'B', weight: 0.6,
    what: 'רוחב הפנים חלקי גובה החלק העליון. מדד נחקר נרחבות בפסיכולוגיה חברתית, מושפע חלקית משומן פנים.',
    protocols: ['bodyfat'],
  },

  /* ------------------------------ עור ------------------------------ */
  {
    id: 'underEye', domain: 'skin', from: 'skin.underEye.index',
    label: 'עיגולים מתחת לעיניים', unit: '', dir: 'low',
    band: [0, 4.5], tol: 10, mod: 'live', ev: 'A', weight: 1.2,
    what: 'כמה האזור מתחת לעין כהה ואדום יותר מהלחי. מגיב מהר מאוד לשינה, נוזלים ואלרגיות.',
    note: 'ניסוי מבוקר הראה שאנשים לאחר לילה ללא שינה נתפסו כפחות בריאים ופחות אטרקטיביים — מאותו אדם עצמו לאחר שינה מלאה.',
    protocols: ['sleep', 'hydration', 'sodium', 'allergy', 'eye_care', 'makeup_conceal'],
  },
  {
    id: 'evenness', domain: 'skin', from: 'skin.evenness',
    label: 'אחידות גוון העור', unit: '', dir: 'low',
    band: [0, 6.5], tol: 9, mod: 'live', ev: 'A', weight: 1.15,
    what: 'פיזור הבהירות על פני העור — ככל שנמוך יותר, גוון העור אחיד יותר. מושפע מפיגמנטציה, נזקי שמש ומרקם.',
    note: 'שימוש יומיומי בקרם הגנה האט את הזדקנות העור ב-24% לעומת שימוש מזדמן (ניסוי מבוקר ארוך טווח).',
    protocols: ['spf', 'cleanse', 'moisturize', 'retinoid', 'vitc'],
  },
  {
    id: 'redness', domain: 'skin', from: 'skin.redness',
    label: 'אדמומיות', unit: '', dir: 'low',
    band: [0, 4], tol: 9, mod: 'live', ev: 'B', weight: 0.85,
    what: 'רמת האדמומיות בלחיים מעל בסיס עור ניטרלי. מדד לגירוי, דלקת או רגישות.',
    protocols: ['gentle_routine', 'alcohol', 'niacinamide', 'spf'],
  },

  /* ------------------------------ גוף ------------------------------ */
  {
    id: 'shoulderToWaist', domain: 'body', from: 'body.ratios.shoulderToWaist',
    label: 'יחס כתפיים-מותן', unit: '', dir: 'band',
    band: bySex([1.55, 1.85], [1.32, 1.55]), tol: 0.45, mod: 'live', ev: 'B', weight: 1.3,
    what: 'רוחב הכתפיים חלקי רוחב המותן — מדד ה"משולש ההפוך". אחד המנבאים החזקים ביותר למראה אתלטי אצל גברים.',
    note: 'נמדד מסילואט אמיתי, לא מנקודות שלד — ולכן משקף את הצורה בפועל.',
    protocols: ['strength', 'shoulders', 'bodyfat', 'cardio'],
  },
  {
    id: 'waistToHip', domain: 'body', from: 'body.ratios.waistToHip',
    label: 'יחס מותן-ירך', unit: '', dir: 'band',
    band: bySex([0.83, 0.93], [0.66, 0.78]), tol: 0.22, mod: 'live', ev: 'A', weight: 1.2,
    what: 'מדד בריאותי ואסתטי מבוסס מחקר. אצל נשים יחס סביב 0.7 נמצא כנתפס כאטרקטיבי ביותר במחקרים בין-תרבותיים.',
    note: 'זהו גם מדד בריאות מוכר: שומן בטני קשור לסיכון מטבולי, ללא תלות ב-BMI.',
    protocols: ['bodyfat', 'cardio', 'nutrition', 'core'],
  },
  {
    id: 'legToTorso', domain: 'body', from: 'body.ratios.legToTorso',
    label: 'יחס רגליים-פלג גוף עליון', unit: '', dir: 'band',
    band: [1.05, 1.40], tol: 0.45, mod: 'fixed', ev: 'C', weight: 0.5,
    what: 'פרופורציה שלדית שאינה ניתנת לשינוי — אך ניתנת להדגשה משמעותית דרך גזרת ביגוד וגובה קו המותן.',
    protocols: ['clothing_fit', 'clothing_proportion'],
  },

  /* ------------------------------ יציבה ------------------------------ */
  {
    id: 'shoulderTilt', domain: 'posture', from: 'body.posture.shoulderTilt',
    label: 'הטיית כתפיים', unit: '°', dir: 'low',
    band: [0, 2.5], tol: 7, mod: 'live', ev: 'B', weight: 1.0,
    what: 'סטיית קו הכתפיים מהאופק. הטיה קבועה מצביעה על חוסר איזון שרירי או נשיאת משקל חד-צדדית.',
    protocols: ['posture_program', 'unilateral_load', 'strength'],
  },
  {
    id: 'hipTilt', domain: 'posture', from: 'body.posture.hipTilt',
    label: 'הטיית אגן', unit: '°', dir: 'low',
    band: [0, 2.5], tol: 7, mod: 'live', ev: 'B', weight: 0.85,
    what: 'סטיית קו האגן מהאופק.',
    protocols: ['posture_program', 'core'],
  },
  {
    id: 'craniovertebral', domain: 'posture', from: 'body.posture.craniovertebral',
    label: 'זווית ראש-צוואר', unit: '°', dir: 'high',
    band: [50, 90], tol: 22, mod: 'live', ev: 'A', weight: 1.2, view: 'side',
    what: 'המדד הקליני המקובל ל"ראש קדמי". מתחת ל-50° מעיד על הסטת ראש קדימה — משפיע על קו הלסת והצוואר במראה חזיתי.',
    note: 'הצילום מהצד נדרש למדד הזה. שיפור ביציבה משנה את מראה קו הלסת מיידית, ללא כל שינוי במבנה.',
    protocols: ['posture_program', 'chin_tuck', 'desk_setup'],
  },
  {
    id: 'trunkLean', domain: 'posture', from: 'body.posture.trunkLean',
    label: 'נטיית גו', unit: '°', dir: 'low',
    band: [0, 4], tol: 12, mod: 'live', ev: 'B', weight: 0.7, view: 'side',
    what: 'סטיית פלג הגוף העליון מהאנך בעמידה טבעית.',
    protocols: ['posture_program', 'core'],
  },
];

export const METRIC_BY_ID = Object.fromEntries(METRICS.map(m => [m.id, m]));

/** Resolve a possibly sex-dependent band. */
export function resolveBand(metric, sex = 'x') {
  const b = metric.band;
  return b && b.__bySex ? (b[sex] ?? b.x) : b;
}

/** Read a dotted path out of the measurement bundle. */
export function readValue(bundle, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), bundle);
}
