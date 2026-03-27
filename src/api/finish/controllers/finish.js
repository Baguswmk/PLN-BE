'use strict';

/**
 * finish controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::finish.finish', ({ strapi }) => ({

  // ─────────────────────────────────────────────
  // ARRIVE (Step 3: DT sampai di lokasi tujuan)
  // ─────────────────────────────────────────────
  async arrive(ctx) {
    try {
      const { id } = ctx.params; // shipment ID
      const body = ctx.request.body;

      let data;
      if (body.data) {
        data = typeof body.data === 'string' ? JSON.parse(body.data) : body.data;
      } else {
        data = { seal_no: body.seal_no };
      }

      const response = await strapi.service('api::finish.finish').arrive(parseInt(id), data);

      // Handle foto upload
      const files = ctx.request.files;
      if (files && files['files.foto_seal_finish'] && response.finish) {
        await strapi.entityService.update('api::finish.finish', response.finish.id, {
          data: {},
          files: { 'foto_seal_finish': files['files.foto_seal_finish'] },
        });
      }

      return { data: response };
    } catch (err) {
      if (err.message === 'Shipment not found') return ctx.notFound(err.message);
      if (err.message.includes('tidak bisa di-arrive')) return ctx.conflict(err.message);
      if (err.message.includes('tidak cocok')) return ctx.conflict(err.message);
      return ctx.badRequest(err.message);
    }
  },

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
