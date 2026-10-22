'use strict';
/*
 * Desktop Buddies — every hero the hero world can run, by character id.
 * Each one is a Hero subclass (ironman.js) with its own movement, weapons,
 * texts and UI description.
 */
const { Hero } = require('../ironman');

const HEROES = {
  ironman: Hero,
  homelander: require('./homelander'),
  hulk: require('./hulk'),
  spiderman: require('./spiderman'),
};

module.exports = HEROES;
