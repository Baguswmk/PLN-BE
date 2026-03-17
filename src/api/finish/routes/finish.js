'use strict';

/**
 * finish router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::finish.finish');
