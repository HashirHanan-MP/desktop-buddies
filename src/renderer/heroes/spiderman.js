/*
 * Desktop Buddies — SPIDER-MAN art (placeholder: draws the armored hero until the real art lands).
 */
(function (root) {
  'use strict';
  const I = root.HeroArts.ironman;
  root.HeroArts.spiderman = Object.assign({}, I, { name: 'SPIDER-MAN', theme: 'spider', lookKey: 'spiderSuit', allyLabel: null, brief: null, menuName: null, cardTitle: () => 'SPIDER-MAN' });
})(typeof window !== 'undefined' ? window : globalThis);
