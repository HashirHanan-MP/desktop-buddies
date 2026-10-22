/*
 * Desktop Buddies — HOMELANDER art (placeholder: draws the armored hero until the real art lands).
 */
(function (root) {
  'use strict';
  const I = root.HeroArts.ironman;
  root.HeroArts.homelander = Object.assign({}, I, { name: 'HOMELANDER', theme: 'vought', lookKey: null, allyLabel: null, brief: null, menuName: null, cardTitle: () => 'HOMELANDER' });
})(typeof window !== 'undefined' ? window : globalThis);
