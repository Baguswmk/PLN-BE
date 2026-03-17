'use strict';

/**
 * finish controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::finish.finish', ({ strapi }) => ({
  async update(ctx) {
    try {
      const { id } = ctx.params;
      let { data } = ctx.request.body;
      const editReason = ctx.request.body.edit_reason || ctx.query.edit_reason;
      const user = ctx.state.user;

      const response = await strapi.service('api::finish.finish').customUpdate(id, data, editReason, user);
      const finalizedResponse = await this.sanitizeOutput(response, ctx);
      return this.transformResponse(finalizedResponse);
    } catch (err) {
      if (err.message === 'Finish not found') return ctx.notFound(err.message);
      return ctx.badRequest(err.message);
    }
  },

  async delete(ctx) {
    try {
      const { id } = ctx.params;
      const editReason = ctx.request.body?.edit_reason || ctx.query.edit_reason;
      const user = ctx.state.user;

      const response = await strapi.service('api::finish.finish').customDelete(id, editReason, user);
      const finalizedResponse = await this.sanitizeOutput(response, ctx);
      return this.transformResponse(finalizedResponse);
    } catch (err) {
      if (err.message === 'Finish not found') return ctx.notFound(err.message);
      return ctx.badRequest(err.message);
    }
  }
}));
