/* The intake questionnaire UI.
 *
 * Design rules it follows, because a long form is where products die:
 *  · one step per screen, with visible progress
 *  · optional steps say so and can be skipped in one tap
 *  · every question can explain *why* it is being asked — trust costs nothing
 *    to give and is impossible to win back
 *  · nothing validates until the user leaves the field
 */

import { STEPS, visibleQuestions, missingRequired, validate } from '../content/questionnaire.js';

export function mountQuiz(root, { answers = {}, onDone, onExit } = {}) {
  let step = 0;
  const state = { ...answers };

  const render = () => {
    const s = STEPS[step];
    const qs = visibleQuestions(s, state);

    root.innerHTML = `
      <div class="quiz">
        <div class="quiz__bar" aria-hidden="true">
          ${STEPS.map((_, i) => `<i class="${i < step ? 'is-done' : i === step ? 'is-now' : ''}"></i>`).join('')}
        </div>

        <header class="quiz__head">
          <div class="eyebrow">שלב ${step + 1} מתוך ${STEPS.length}${s.required ? '' : ' · אופציונלי'}</div>
          <h1>${s.title}</h1>
          <p class="lede">${s.lede}</p>
        </header>

        <div class="quiz__fields">
          ${qs.map(q => field(q, state[q.id])).join('')}
        </div>

        <div class="quiz__actions">
          <button class="btn btn--primary btn--block btn--lg" data-next>${step === STEPS.length - 1 ? 'לסריקה' : 'המשך'}</button>
          ${!s.required ? '<button class="btn btn--quiet btn--block" data-skip>לדלג על השלב</button>' : ''}
          ${step > 0 ? '<button class="btn btn--quiet btn--block" data-back>חזרה</button>' : ''}
        </div>
      </div>`;

    wire(qs);
    refreshNext(s);
  };

  const field = (q, value) => `
    <div class="qfield" data-q="${q.id}">
      <div class="qfield__head">
        <label class="qfield__label" for="q-${q.id}">
          ${q.label}${q.required ? '' : ' <span class="muted xs">(אופציונלי)</span>'}
        </label>
        ${q.help ? `<button class="qfield__why" type="button" data-why="${q.id}" aria-expanded="false" aria-label="למה שואלים את זה">למה?</button>` : ''}
      </div>
      ${q.help ? `<p class="qfield__help" id="why-${q.id}" hidden>${q.help}</p>` : ''}
      ${control(q, value)}
      <p class="qfield__err" role="alert"></p>
    </div>`;

  const control = (q, value) => {
    if (q.type === 'number') return `
      <div class="qnum">
        <input id="q-${q.id}" type="number" inputmode="numeric" class="qnum__input"
               value="${value ?? ''}" placeholder="${q.placeholder ?? ''}"
               min="${q.min}" max="${q.max}" step="any">
        <span class="qnum__unit">${q.unit ?? ''}</span>
      </div>`;

    if (q.type === 'choice') return `
      <div class="qchoices" role="radiogroup" aria-labelledby="q-${q.id}">
        ${q.options.map(o => `
          <button type="button" class="qchoice" role="radio" data-val="${o.value}"
                  aria-checked="${String(value) === String(o.value)}">
            <span class="qchoice__label">${o.label}</span>
            ${o.note ? `<span class="qchoice__note">${o.note}</span>` : ''}
          </button>`).join('')}
      </div>`;

    if (q.type === 'multi') {
      const sel = Array.isArray(value) ? value : [];
      return `
        <div class="qchoices qchoices--multi" role="group">
          ${q.options.map(o => `
            <button type="button" class="qchoice" data-val="${o.value}"
                    aria-pressed="${sel.includes(o.value)}">
              <span class="qchoice__label">${o.label}</span>
            </button>`).join('')}
        </div>
        <p class="xs" style="margin-top:8px">עד ${q.max} בחירות</p>`;
    }
    return '';
  };

  const setErr = (id, msg) => {
    const el = root.querySelector(`[data-q="${id}"] .qfield__err`);
    if (el) el.textContent = msg ?? '';
  };

  function wire(qs) {
    root.querySelectorAll('[data-why]').forEach(b => b.addEventListener('click', () => {
      const p = root.querySelector('#why-' + b.dataset.why);
      const open = !p.hidden;
      p.hidden = open;
      b.setAttribute('aria-expanded', String(!open));
    }));

    for (const q of qs) {
      const wrap = root.querySelector(`[data-q="${q.id}"]`);
      if (!wrap) continue;

      if (q.type === 'number') {
        const input = wrap.querySelector('input');
        input.addEventListener('input', () => {
          state[q.id] = input.value === '' ? null : Number(input.value);
          setErr(q.id, null);
          refreshNext(STEPS[step]);
        });
        input.addEventListener('blur', () => setErr(q.id, validate(q, input.value)));
      }

      if (q.type === 'choice') {
        wrap.querySelectorAll('.qchoice').forEach(b => b.addEventListener('click', () => {
          const raw = b.dataset.val;
          state[q.id] = /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
          wrap.querySelectorAll('.qchoice').forEach(x => x.setAttribute('aria-checked', String(x === b)));
          setErr(q.id, null);
          // A conditional question may appear or vanish once this is answered.
          if (STEPS[step].questions.some(x => x.showIf)) render();
          else refreshNext(STEPS[step]);
        }));
      }

      if (q.type === 'multi') {
        wrap.querySelectorAll('.qchoice').forEach(b => b.addEventListener('click', () => {
          const cur = Array.isArray(state[q.id]) ? [...state[q.id]] : [];
          const v = b.dataset.val;
          const i = cur.indexOf(v);
          if (i >= 0) cur.splice(i, 1);
          else if (cur.length < (q.max ?? 99)) cur.push(v);
          else return setErr(q.id, `אפשר לבחור עד ${q.max}`);
          state[q.id] = cur;
          b.setAttribute('aria-pressed', String(cur.includes(v)));
          setErr(q.id, null);
        }));
      }
    }

    root.querySelector('[data-next]')?.addEventListener('click', next);
    root.querySelector('[data-skip]')?.addEventListener('click', () => advance());
    root.querySelector('[data-back]')?.addEventListener('click', () => {
      if (step > 0) { step--; render(); } else onExit?.();
    });
  }

  function refreshNext(s) {
    const btn = root.querySelector('[data-next]');
    if (btn) btn.disabled = missingRequired(s, state).length > 0;
  }

  function next() {
    const s = STEPS[step];
    const missing = missingRequired(s, state);
    if (missing.length) { missing.forEach(id => setErr(id, 'שדה חובה')); return; }
    // Range errors block too — a 250 cm height is a typo, not a person.
    for (const q of visibleQuestions(s, state)) {
      const err = validate(q, state[q.id]);
      if (err) { setErr(q.id, err); return; }
    }
    advance();
  }

  function advance() {
    if (step < STEPS.length - 1) { step++; render(); window.scrollTo({ top: 0 }); }
    else onDone?.(state);
  }

  render();
  return { answers: () => state };
}
