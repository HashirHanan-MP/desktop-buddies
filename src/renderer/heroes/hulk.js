/*
 * Desktop Buddies — HULK art (placeholder: draws the armored hero until the real art lands).
 */
(function (root) {
  'use strict';
  const I = root.HeroArts.ironman;
  root.HeroArts.hulk = Object.assign({}, I, { name: 'HULK', theme: 'gamma', lookKey: 'hulkSkin', allyLabel: null, brief: null, menuName: null, cardTitle: () => 'HULK' });
})(typeof window !== 'undefined' ? window : globalThis);
