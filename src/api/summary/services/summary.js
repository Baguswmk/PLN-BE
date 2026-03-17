'use strict';

/**
 * summary service
 * 
 * Menyimpan 1 record per kombinasi (date_shift, shift, coal_type).
 * Tidak ada bucket "ALL" — jika FE perlu total lintas shift/coal, jumlahkan sendiri.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::summary.summary', ({ strapi }) => ({
  async updateSummary(date_shift, shift, coal_type) {
    if (!date_shift || !shift || !coal_type) return;

    // ── Ambil semua shipment yang cocok ────────────
    const whereClause = { date_shift, shift };
    if (coal_type !== 'ALL') {
      whereClause.coal_type = coal_type;
    }

    const shipments = await strapi.entityService.findMany('api::shipment.shipment', {
      filters: whereClause,
      populate: ['finish'],
    });

    let total_shipment   = shipments.length;
    let total_net_weight = 0;
    let total_intransit  = 0;
    let total_finish     = 0;
    let total_duration   = 0;
    let finished_count   = 0;

    for (const s of shipments) {
      total_net_weight += (s.net_weight || 0);
      if (s.finish?.status === 'FINISH') {
        total_finish++;
        if (s.finish.duration) {
          total_duration += s.finish.duration;
          finished_count++;
        }
      } else {
        // IN_TRANSIT atau belum ada finish record
        total_intransit++;
      }
    }

    const avg_duration = finished_count > 0 ? (total_duration / finished_count) : 0;
    const dx    = new Date(date_shift);
    const month = dx.getMonth() + 1;
    const year  = dx.getFullYear();

    // ── Cari record summary yang sudah ada ─────────
    const existingList = await strapi.entityService.findMany('api::summary.summary', {
      filters: { date: date_shift, shift, coal_type },
    });

    const summaryData = {
      date:             date_shift,
      month,
      year,
      shift,
      coal_type,
      total_shipment,
      total_net_weight,
      total_intransit,
      total_finish,
      avg_duration,
      last_updated:     new Date().toISOString(),
      publishedAt:      new Date().toISOString(),
    };

    if (existingList.length > 0) {
      await strapi.entityService.update('api::summary.summary', existingList[0].id, {
        data: summaryData,
      });
    } else {
      await strapi.entityService.create('api::summary.summary', {
        data: summaryData,
      });
    }
  },
}));
