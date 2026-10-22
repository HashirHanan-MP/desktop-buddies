'use strict';
/*
 * Desktop Buddies — Homelander (placeholder: behaves like the armored hero until the real one lands).
 */
const { Hero } = require('../ironman');

class HomelanderHero extends Hero {}

HomelanderHero.ID = 'homelander';
HomelanderHero.NAME = 'Homelander';
HomelanderHero.BODY = 1.05;
HomelanderHero.SIZE_KEY = 'homelanderSize';
HomelanderHero.LOOK_KEY = null;
HomelanderHero.DEFAULTS = { homelanderSize: 'small' };
HomelanderHero.ALLIES = null;

module.exports = HomelanderHero;
