'use strict';
/*
 * Desktop Buddies — Spider-Man (placeholder: behaves like the armored hero until the real one lands).
 */
const { Hero } = require('../ironman');

class SpiderHero extends Hero {}

SpiderHero.ID = 'spiderman';
SpiderHero.NAME = 'Spider-Man';
SpiderHero.BODY = 0.95;
SpiderHero.SIZE_KEY = 'spiderSize';
SpiderHero.LOOK_KEY = 'spiderSuit';
SpiderHero.DEFAULTS = { spiderSize: 'small' };
SpiderHero.ALLIES = null;

module.exports = SpiderHero;
