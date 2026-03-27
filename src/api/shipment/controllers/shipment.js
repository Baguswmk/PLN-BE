'use strict';

/**
 * shipment controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::shipment.shipment', ({ strapi }) => ({

  // ─────────────────────────────────────────────
  // CREATE (Flow Lama - backward compatible)
  // ─────────────────────────────────────────────
  async create(ctx) {
    try {
      const { data } = ctx.request.body;
      const user = ctx.state.user;
      
      const response = await strapi.service('api::shipment.shipment').customCreate(data, user);
      
      // Mengubah response data ke struktur attributes yang biasa diharapkan Strapi jika perlu
      const finalizedResponse = await this.sanitizeOutput(response, ctx);
      return this.transformResponse(finalizedResponse);
      
    } catch (err) {
      if (err.message.includes('terdaftar')) return ctx.conflict(err.message);
      return ctx.badRequest(err.message);
    }
  },

  // ─────────────────────────────────────────────
  // REGISTER (Step 1: hull_no + segel + foto)
  // ─────────────────────────────────────────────
  async register(ctx) {
    try {
      const body = ctx.request.body;

      // Multipart: data bisa di body langsung atau di body.data
      let data;
      if (body.data) {
        data = typeof body.data === 'string' ? JSON.parse(body.data) : body.data;
      } else {
        data = { hull_no: body.hull_no, seal_no: body.seal_no };
      }

      const user = ctx.state.user;

      // Handle foto upload
      const files = ctx.request.files;
      let fileData = {};
      if (files && files['files.foto_seal_start']) {
        fileData['foto_seal_start'] = files['files.foto_seal_start'];
      }

      const response = await strapi.service('api::shipment.shipment').registerShipment(data, user);

      // Upload foto jika ada
      if (Object.keys(fileData).length > 0 && response) {
        await strapi.entityService.update('api::shipment.shipment', response.id, {
          data: {},
          files: fileData,
        });
      }

      const finalizedResponse = await this.sanitizeOutput(response, ctx);
      return this.transformResponse(finalizedResponse);
    } catch (err) {
      if (err.message.includes('sudah terdaftar')) return ctx.conflict(err.message);
      return ctx.badRequest(err.message);
    }
  },

  // ─────────────────────────────────────────────
  // MATCH SJB (Step 2: scan SJB → match by hull_no)
  // ─────────────────────────────────────────────
  async matchSjb(ctx) {
    try {
      const { data } = ctx.request.body;
      const no_do = data?.no_do;
      const user = ctx.state.user;

      const response = await strapi.service('api::shipment.shipment').matchSjb(no_do, user);
      const finalizedResponse = await this.sanitizeOutput(response, ctx);
      return this.transformResponse(finalizedResponse);
    } catch (err) {
      if (err.message.includes('terdaftar')) return ctx.conflict(err.message);
      if (err.message.includes('Tidak ditemukan')) return ctx.notFound(err.message);
      return ctx.badRequest(err.message);
    }
  },

  // ─────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────
  async update(ctx) {
    try {
      const { id } = ctx.params;
      const { data } = ctx.request.body;
      const editReason = ctx.request.body.edit_reason || ctx.query.edit_reason;
      const user = ctx.state.user;

      const response = await strapi.service('api::shipment.shipment').customUpdate(id, data, editReason, user);
      const finalizedResponse = await this.sanitizeOutput(response, ctx);
      return this.transformResponse(finalizedResponse);
    } catch (err) {
      if (err.message === 'Shipment not found') return ctx.notFound(err.message);
      return ctx.badRequest(err.message);
    }
  },

  // ─────────────────────────────────────────────
  // FINISH BY NO_DO
  // ─────────────────────────────────────────────
  async finishByNoDo(ctx) {
    try {
      const { no_do } = ctx.params;
      const response = await strapi.service('api::shipment.shipment').finishByNoDo(no_do);
      return { data: response };
    } catch (err) {
      if (err.message.includes('tidak ditemukan')) return ctx.notFound(err.message);
      if (err.message.includes('sudah berstatus')) return ctx.conflict(err.message);
      return ctx.badRequest(err.message);
    }
  },

  // ─────────────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────────────
  async delete(ctx) {
    try {
      const { id } = ctx.params;
      const editReason = ctx.request.body?.edit_reason || ctx.query.edit_reason;
      const user = ctx.state.user;

      const response = await strapi.service('api::shipment.shipment').customDelete(id, editReason, user);
      const finalizedResponse = await this.sanitizeOutput(response, ctx);
      return this.transformResponse(finalizedResponse);
    } catch (err) {
      if (err.message === 'Shipment not found') return ctx.notFound(err.message);
      return ctx.badRequest(err.message);
    }
  },

  // ─────────────────────────────────────────────
  // GET SHIPMENT LOTS
  // ─────────────────────────────────────────────
  async getShipmentLots(ctx) {
    try {
      const { date_shift } = ctx.query;
      const data = await strapi.service('api::shipment.shipment').getShipmentLots(date_shift);
      return { data };
    } catch (err) {
      return ctx.badRequest(err.message);
    }
  },

  // ─────────────────────────────────────────────
  // EXPORT EXCEL
  // ─────────────────────────────────────────────
  async exportExcel(ctx) {
    try {
      const ExcelJS = require('exceljs');
      const { date_shift, lot } = ctx.query;

      const shipments = await strapi.service('api::shipment.shipment').getExportData(date_shift, lot);

      const workbook  = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Shipments');

      worksheet.columns = [
        { header: 'No DO',           key: 'no_do',       width: 20 },
        { header: 'Coal Type',       key: 'coal_type',   width: 15 },
        { header: 'Date',            key: 'date',        width: 15 },
        { header: 'Time',            key: 'time',        width: 15 },
        { header: 'Shift',           key: 'shift',       width: 10 },
        { header: 'Date Shift',      key: 'date_shift',  width: 15 },
        { header: 'Hull No',         key: 'hull_no',     width: 15 },
        { header: 'Lot',             key: 'lot',         width: 15 },
        { header: 'Loading',         key: 'loading',     width: 20 },
        { header: 'Dumping',         key: 'dumping',     width: 20 },
        { header: 'Net Weight (Ton)',key: 'net_weight',  width: 15 },
        { header: 'Status',          key: 'status',      width: 15 },
        { header: 'Finish Date',     key: 'finish_date', width: 15 },
        { header: 'Finish Time',     key: 'finish_time', width: 15 },
        { header: 'Duration (Mins)', key: 'duration',    width: 15 },
        { header: 'Created By',      key: 'user',        width: 20 },
      ];

      worksheet.getRow(1).font      = { bold: true };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      for (const shipment of shipments) {
        const finish = shipment.finish || {};
        worksheet.addRow({
          no_do:       shipment.no_do,
          coal_type:   shipment.coal_type,
          date:        shipment.date,
          time:        shipment.time,
          shift:       shipment.shift,
          date_shift:  shipment.date_shift,
          hull_no:     shipment.hull_no,
          lot:         shipment.lot,
          loading:     shipment.loading,
          dumping:     shipment.dumping,
          net_weight:  shipment.net_weight,
          status:      finish.status      ?? 'IN_TRANSIT',
          finish_date: finish.date        ?? '',
          finish_time: finish.time        ?? '',
          duration:    finish.duration    ?? '',
          user:        shipment.user?.username ?? '',
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      ctx.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      ctx.set('Content-Disposition', `attachment; filename=Shipment_Export_${date_shift || 'all'}.xlsx`);
      ctx.body = buffer;
    } catch (err) {
      return ctx.badRequest(err.message);
    }
  },

  // ─────────────────────────────────────────────
  // PENGELUARAN ROM: OVERVIEW & ANALYTICS
  // ─────────────────────────────────────────────
  async overviewRom(ctx) {
    try {
      const { startDate, endDate, shift } = ctx.query;
      const data = await strapi.service('api::shipment.shipment').overviewRom(startDate, endDate, shift);
      return data;
    } catch (err) {
      return ctx.badRequest(err.message);
    }
  },

  async analyticsRom(ctx) {
    try {
      const { startDate, endDate, shift, view } = ctx.query;
      const chartData = await strapi.service('api::shipment.shipment').analyticsRom(startDate, endDate, shift, view);
      return { chartData };
    } catch (err) {
      return ctx.badRequest(err.message);
    }
  },

  // ─────────────────────────────────────────────
  // PENERIMAAN SDJ: OVERVIEW & ANALYTICS
  // ─────────────────────────────────────────────
  async overviewSdj(ctx) {
    try {
      const { startDate, endDate, shift } = ctx.query;
      const data = await strapi.service('api::shipment.shipment').overviewSdj(startDate, endDate, shift);
      return data;
    } catch (err) {
      return ctx.badRequest(err.message);
    }
  },

  async analyticsSdj(ctx) {
    try {
      const { startDate, endDate, shift, view } = ctx.query;
      const chartData = await strapi.service('api::shipment.shipment').analyticsSdj(startDate, endDate, shift, view);
      return { chartData };
    } catch (err) {
      return ctx.badRequest(err.message);
    }
  }
}));