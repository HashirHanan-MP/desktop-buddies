'use strict';
/*
 * Desktop Buddies — Hulk (placeholder: behaves like the armored hero until the real one lands).
 */
const { Hero } = require('../ironman');

class HulkHero extends Hero {}

HulkHero.ID = 'hulk';
HulkHero.NAME = 'Hulk';
HulkHero.BODY = 1.35;
HulkHero.SIZE_KEY = 'hulkSize';
HulkHero.LOOK_KEY = 'hulkSkin';
HulkHero.DEFAULTS = { hulkSize: 'small' };
HulkHero.ALLIES = null;

module.exports = HulkHero;
