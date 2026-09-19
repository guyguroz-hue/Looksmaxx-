/* The intake questionnaire.
 *
 * Every question here has to earn its place by changing something downstream —
 * a target band, a metric the camera cannot see, a protocol that gets filtered
 * in or out, or the ranking. `affects` documents which, and the tests assert it
 * is never empty. A question that only produces a nice-looking profile field is
 * a question that costs conversion for nothing.
 */

export const STEPS = [
  {
    id: 'basics',
    title: 'הבסיס',
    lede: 'ארבע שאלות שקובעות מול אילו טווחים נמדדים המדדים שלך.',
    required: true,
    questions: [
      {
        id: 'age', type: 'number', label: 'גיל', unit: 'שנים',
        min: 13, max: 99, placeholder: '28', required: true,
        affects: ['skin bands', 'protocol relevance'],
        help: 'אחידות גוון העור יורדת באופן טבעי עם הגיל. בלי גיל, הטווח לא הוגן.',
      },
      {
        id: 'sex', type: 'choice', label: 'מגדר', required: true,
        affects: ['body bands', 'protocol filtering'],
        help: 'קובע את טווחי היעד ליחסי הגוף ואת אילו פרוטוקולים רלוונטיים.',
        options: [
          { value: 'm', label: 'גבר' },
          { value: 'f', label: 'אישה' },
          { value: 'x', label: 'מעדיף/ה לא לציין', note: 'ישתמש בטווח ממוצע' },
        ],
      },
      {
        id: 'height', type: 'number', label: 'גובה', unit: 'ס״מ',
        min: 120, max: 230, placeholder: '175', required: true,
        affects: ['BMI'],
      },
      {
        id: 'weight', type: 'number', label: 'משקל', unit: 'ק״ג',
        min: 30, max: 250, placeholder: '72', required: true,
        affects: ['BMI', 'facial-fullness interpretation'],
        help: 'גובה ומשקל יחד מחליפים את רוב מה שסריקת גוף הייתה נותנת — ובלי לצלם את עצמך במראה.',
      },
    ],
  },

  {
    id: 'body',
    title: 'מידות',
    lede: 'אופציונלי. שתי מדידות עם סרט מדידה נותנות יחס מותן-ירך מדויק יותר מכל תמונה.',
    required: false,
    questions: [
      {
        id: 'waist', type: 'number', label: 'היקף מותן', unit: 'ס״מ',
        min: 40, max: 200, placeholder: '82',
        affects: ['waist-to-hip metric'],
        help: 'למדוד בנקודה הצרה ביותר, בסוף נשיפה רגילה — לא לשאוף פנימה.',
      },
      {
        id: 'hip', type: 'number', label: 'היקף ירכיים', unit: 'ס״מ',
        min: 50, max: 200, placeholder: '96',
        affects: ['waist-to-hip metric'],
        help: 'בנקודה הרחבה ביותר.',
      },
      {
        id: 'activity', type: 'choice', label: 'פעילות גופנית שבועית',
        affects: ['protocol calibration'],
        help: 'קובע אם ההמלצה תהיה "להתחיל" או "להעלות עומס".',
        options: [
          { value: 'none',     label: 'כמעט ולא' },
          { value: 'light',    label: 'פעם-פעמיים בשבוע' },
          { value: 'moderate', label: '3–4 פעמים בשבוע' },
          { value: 'high',     label: '5 ומעלה' },
        ],
      },
    ],
  },

  {
    id: 'skin',
    title: 'עור',
    lede: 'זה משפר את דיוק ניתוח הפיקסלים עצמו, לא רק את ההמלצות.',
    required: true,
    questions: [
      {
        id: 'fitzpatrick', type: 'choice', label: 'גוון העור שלך', required: true,
        affects: ['skin metric calibration', 'SPF advice'],
        help: 'מדד האדמומיות מושווה לבסיס עור ניטרלי. בסיס אחד לכל גווני העור הוא פשוט שגוי — זו השאלה שמתקנת את זה.',
        options: [
          { value: 1, label: 'בהיר מאוד', note: 'נשרף תמיד, כמעט לא משתזף' },
          { value: 2, label: 'בהיר',      note: 'נשרף בקלות, משתזף מעט' },
          { value: 3, label: 'בהיר-בינוני', note: 'נשרף לפעמים, משתזף בהדרגה' },
          { value: 4, label: 'זית / בינוני', note: 'נשרף מעט, משתזף בקלות' },
          { value: 5, label: 'חום',       note: 'נדיר שנשרף, משתזף מאוד' },
          { value: 6, label: 'חום כהה / שחור', note: 'כמעט אף פעם לא נשרף' },
        ],
      },
      {
        id: 'skinType', type: 'choice', label: 'סוג העור',
        affects: ['product selection'],
        options: [
          { value: 'dry',   label: 'יבש' },
          { value: 'oily',  label: 'שמן' },
          { value: 'combo', label: 'מעורב' },
          { value: 'normal', label: 'רגיל' },
          { value: 'sensitive', label: 'רגיש' },
        ],
      },
      {
        id: 'spf', type: 'choice', label: 'קרם הגנה', required: true,
        affects: ['protocol filtering', 'skin causality'],
        help: 'אם אחידות הגוון נמוכה ואינך משתמש — זה המנוף. אם אתה כבר משתמש יומית, הסיבה היא במקום אחר.',
        options: [
          { value: 'never',     label: 'כמעט אף פעם' },
          { value: 'sometimes', label: 'רק בשמש חזקה' },
          { value: 'daily',     label: 'כל יום' },
        ],
      },
      {
        id: 'smoking', type: 'choice', label: 'עישון',
        affects: ['skin causality', 'protocol'],
        options: [
          { value: 'no',   label: 'לא' },
          { value: 'yes',  label: 'כן' },
          { value: 'quit', label: 'הפסקתי' },
        ],
      },
    ],
  },

  {
    id: 'life',
    title: 'אורח חיים ומיקוד',
    lede: 'השאלות שקובעות למה הפנים שלך נראות כפי שהן — ומה הכי חשוב לך.',
    required: true,
    questions: [
      {
        id: 'sleep', type: 'choice', label: 'שעות שינה בלילה ממוצע', required: true,
        affects: ['under-eye causality', 'protocol ranking'],
        help: 'אם העיגולים בולטים ואתה ישן 5 שעות — הסיבה ידועה. אם אתה ישן 8, נפנה אותך לכיוון אחר לגמרי.',
        options: [
          { value: 5,   label: 'פחות מ-5' },
          { value: 5.5, label: '5–6' },
          { value: 6.5, label: '6–7' },
          { value: 7.5, label: '7–8' },
          { value: 8.5, label: '8 ומעלה' },
        ],
      },
      {
        id: 'alcohol', type: 'choice', label: 'אלכוהול',
        affects: ['puffiness causality'],
        options: [
          { value: 'never',   label: 'לא שותה' },
          { value: 'rare',    label: 'לעיתים רחוקות' },
          { value: 'weekly',  label: 'שבועי' },
          { value: 'often',   label: 'כמה פעמים בשבוע' },
        ],
      },
      {
        id: 'concerns', type: 'multi', label: 'מה הכי מפריע לך?', max: 3,
        affects: ['ranking weights'],
        help: 'עד שלוש. זה מזיז את סדר העדיפויות בתוכנית — לא את הציון.',
        options: [
          { value: 'skin',     label: 'מרקם וגוון עור' },
          { value: 'undereye', label: 'עיגולים ונפיחות' },
          { value: 'jawline',  label: 'קו לסת וחדות' },
          { value: 'body',     label: 'הרכב גוף' },
          { value: 'posture',  label: 'יציבה' },
          { value: 'hair',     label: 'שיער' },
          { value: 'teeth',    label: 'שיניים וחיוך' },
        ],
      },
      {
        id: 'pregnant', type: 'choice', label: 'הריון או הנקה',
        showIf: (a) => a.sex === 'f',
        affects: ['safety filtering'],
        help: 'רטינואידים אסורים בהריון. אם תסמן/י כן — הם לא יופיעו בתוכנית כלל.',
        options: [
          { value: 'no',  label: 'לא' },
          { value: 'yes', label: 'כן' },
        ],
      },
    ],
  },
];

export const ALL_QUESTIONS = STEPS.flatMap(s => s.questions);
export const QUESTION_BY_ID = Object.fromEntries(ALL_QUESTIONS.map(q => [q.id, q]));

/** Questions visible given the answers so far (handles conditional questions). */
export function visibleQuestions(step, answers) {
  return step.questions.filter(q => !q.showIf || q.showIf(answers));
}

/** Which required answers are still missing — drives the Continue button. */
export function missingRequired(step, answers) {
  return visibleQuestions(step, answers)
    .filter(q => q.required && (answers[q.id] == null || answers[q.id] === ''))
    .map(q => q.id);
}

/** A number answer that is outside its declared range is rejected at entry. */
export function validate(q, value) {
  if (value == null || value === '') return q.required ? 'שדה חובה' : null;
  if (q.type === 'number') {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'יש להזין מספר';
    if (n < q.min || n > q.max) return `הערך צריך להיות בין ${q.min} ל-${q.max}`;
  }
  return null;
}

export const isComplete = (answers) =>
  STEPS.filter(s => s.required).every(s => missingRequired(s, answers).length === 0);
