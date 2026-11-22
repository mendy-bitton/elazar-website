/* Shared environment facts and small helpers */
export const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

export const $ = (s, c = document) => c.querySelector(s);
export const $$ = (s, c = document) => [...c.querySelectorAll(s)];
export const rand = (a, b) => a + Math.random() * (b - a);

// one shared beat for the stage lights and the microphone
export const BPM = 118, BEAT = 60 / BPM;
export const beat = (t, every, offset) => {
  const p = ((t / BEAT - offset) % every + every) % every;
  return Math.exp(-p * BEAT * 5.2);           // quick rise, smooth fall
};

export const WA = 'https://wa.me/972528108100?text=' + encodeURIComponent('שלום אלעזר, אשמח לקבל הצעת מחיר לאירוע.\nתאריך: \nמקום: ');
