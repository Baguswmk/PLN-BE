'use strict';

/**
 * shipment service
 */

const { createCoreService } = require('@strapi/strapi').factories;
const { getShiftDetails } = require('../../../utils/shift');
const { REVERSE_TRANSPORTIR_CODE, formatYmd, formatMd } = require('../../../utils/constants');

module.exports = createCoreService('api::shipment.shipment', ({ strapi }) => ({
  
  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────
  async customCreate(data, user) {
    if (!data) throw new Error('Missing data payload');

    // ── Validasi duplikat no_do ──────────────────
    if (data.no_do) {
      const existing = await strapi.entityService.findMany('api::shipment.shipment', {
        filters: { no_do: data.no_do },
        limit: 1,
      });
      if (existing && existing.length > 0) {
        throw new Error(`No DO "${data.no_do}" sudah terdaftar, tidak bisa dibuat duplikat.`);
      }
    }

    // ── Parse QR Code dari no_do (≥20 karakter) ──
    if (data.no_do) {
      const qr = data.no_do;

      const cType = qr.charAt(5);
      if (cType === 'C') data.coal_type = 'CRUSHED';
      else if (cType === 'U') data.coal_type = 'UNCRUSHED';

      const lType = qr.charAt(10);
      if (lType === 'W') data.loading = 'MTB - STOCK TS WESTHAM';
      else if (lType === 'E') data.loading = 'MTB - SP Giok Ext';
      else if (lType === 'L') data.loading = 'MTB - SP Lavender';

      const nwStr = qr.substring(11, 15);
      const netWeightParsed = parseInt(nwStr, 10);
      if (!isNaN(netWeightParsed)) {
        data.net_weight = netWeightParsed / 100;
      }

      const remainder = qr.substring(15);
      const match = remainder.match(/^([a-zA-Z]+)(.*)$/);
      if (match) {
        const codeChar = match[1].toUpperCase();
        const angkaAkhir = match[2].substring(0, 5).replace(/[^0-9]/g, '');
        const transportirPrefix = REVERSE_TRANSPORTIR_CODE[codeChar] || codeChar;
        data.hull_no = transportirPrefix + angkaAkhir;
      } else {
        const transportirCodeChar = qr.charAt(15);
        const angkaAkhir = qr.substring(16, 21);
        const transportirPrefix = REVERSE_TRANSPORTIR_CODE[transportirCodeChar] || transportirCodeChar;
        data.hull_no = transportirPrefix + angkaAkhir;
      }
    }

    // ── Isi shift & waktu otomatis ───────────────
    const now = new Date();
    const sf = getShiftDetails(now);

    data.time       = sf.time;
    data.date       = sf.date;
    data.shift      = sf.shift;
    data.date_shift = sf.date_shift;

    if (user) {
      data.user = user.id;
    }

    // Panggil fungsi create default
    const response = await strapi.entityService.create('api::shipment.shipment', { data, populate: '*' });

    if (response) {
      const shipmentId = response.id;

      // ── Buat Finish dengan status IN_TRANSIT ──
      await strapi.entityService.create('api::finish.finish', {
        data: {
          status:      'IN_TRANSIT',
          shipment:    shipmentId,
          publishedAt: now,
        },
      });

      // ── Update summary ────────────────────────
      await strapi.service('api::summary.summary').updateSummary(
        response.date_shift || sf.date_shift,
        response.shift      || sf.shift,
        response.coal_type  || data.coal_type,
      );
    }

    return response;
  },

  // ─────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────
  async customUpdate(id, data, editReason, user) {
    if (!data) throw new Error('Missing data payload');

    const existing = await strapi.entityService.findOne(
      'api::shipment.shipment', id, { populate: ['finish', 'user'] }
    );
    if (!existing) throw new Error('Shipment not found');

    if (user) {
      const userWithRole = await strapi.entityService.findOne('plugin::users-permissions.user', user.id, { populate: ['role'] });
      const isAdmin = userWithRole?.role?.name?.toLowerCase() === 'admin';
      
      if (existing.user && String(existing.user.id) !== String(user.id) && !isAdmin) {
         throw new Error('Forbidden: Anda tidak memiliki hak akses (bukan Admin atau Pembuat) untuk mengubah data ini.');
      }
    }

    // ── Handle update status Finish (opsional, bisa dikirim bareng edit) ──
    if (data.status) {
      let finishData = { status: data.status };

      if (data.status === 'FINISH' && existing.finish?.status === 'IN_TRANSIT') {
        const now = new Date();
        const sf  = getShiftDetails(now);
        finishData.date       = sf.date;
        finishData.time       = sf.time;
        finishData.shift      = sf.shift;
        finishData.date_shift = sf.date_shift;

        const diffMs          = now.getTime() - new Date(existing.createdAt).getTime();
        finishData.duration   = Math.max(0, Math.floor(diffMs / 60000));
      }

      // Override manual jika dikirim
      if (data.finish_date)       finishData.date       = data.finish_date;
      if (data.finish_time)       finishData.time       = data.finish_time;
      if (data.finish_shift)      finishData.shift      = data.finish_shift;
      if (data.finish_date_shift) finishData.date_shift = data.finish_date_shift;
      if (data.finish_duration)   finishData.duration   = data.finish_duration;

      if (existing.finish) {
        await strapi.entityService.update('api::finish.finish', existing.finish.id, { data: finishData });
      } else {
        finishData.shipment    = existing.id;
        finishData.publishedAt = new Date();
        await strapi.entityService.create('api::finish.finish', { data: finishData });
      }

      // Bersihkan field finish dari payload shipment
      delete data.status;
      delete data.finish_date;
      delete data.finish_time;
      delete data.finish_shift;
      delete data.finish_date_shift;
      delete data.finish_duration;
    }

    // ── Catat perubahan untuk edit history ───────
    const changes = {};
    for (const key in data) {
      if (existing[key] !== undefined && existing[key] !== data[key]) {
        changes[key] = { from: existing[key], to: data[key] };
      }
    }

    const response = await strapi.entityService.update('api::shipment.shipment', id, { data, populate: '*' });

    if (Object.keys(changes).length > 0) {
      await strapi.entityService.create('api::edit-history.edit-history', {
        data: {
          action:      'UPDATE',
          reason:      editReason || 'Pembaruan data Shipment',
          changes,
          shipment_id: String(id),
          shipment:    id,
          user:        user?.id ?? null,
        },
      });
    }

    // ── Update summary untuk date_shift yang terpengaruh ──
    const dsToUpdate = [existing.date_shift];
    if (data.date_shift && data.date_shift !== existing.date_shift) {
      dsToUpdate.push(data.date_shift);
    }

    for (const ds of dsToUpdate) {
      if (existing.coal_type) {
        await strapi.service('api::summary.summary').updateSummary(ds, existing.shift, existing.coal_type);
      }
      if (data.coal_type && data.coal_type !== existing.coal_type) {
        await strapi.service('api::summary.summary').updateSummary(ds, existing.shift, data.coal_type);
      }
    }

    return response;
  },

  // ─────────────────────────────────────────────
  // FINISH BY NO DO
  // ─────────────────────────────────────────────
  async finishByNoDo(no_do) {
    const shipments = await strapi.entityService.findMany('api::shipment.shipment', {
      filters: { no_do },
      populate: ['finish'],
      limit: 1,
    });

    if (!shipments || shipments.length === 0) {
      throw new Error(`Shipment dengan no_do "${no_do}" tidak ditemukan.`);
    }

    const existing = shipments[0];

    // Cek apakah sudah FINISH
    if (existing.finish?.status === 'FINISH') {
      throw new Error(`Shipment "${no_do}" sudah berstatus FINISH.`);
    }

    const now = new Date();
    const sf  = getShiftDetails(now);

    const diffMs   = now.getTime() - new Date(existing.createdAt).getTime();
    const duration = Math.max(0, Math.floor(diffMs / 60000));

    const finishData = {
      status:     'FINISH',
      date:       sf.date,
      time:       sf.time,
      shift:      sf.shift,
      date_shift: sf.date_shift,
      duration,
    };

    if (existing.finish) {
      await strapi.entityService.update('api::finish.finish', existing.finish.id, {
        data: finishData,
      });
    } else {
      await strapi.entityService.create('api::finish.finish', {
        data: {
          ...finishData,
          shipment:    existing.id,
          publishedAt: now,
        },
      });
    }

    if (existing.coal_type) {
      await strapi.service('api::summary.summary').updateSummary(
        existing.date_shift, existing.shift, existing.coal_type
      );
    }

    return {
      id:     existing.id,
      no_do:  existing.no_do,
      finish: finishData,
    };
  },

  // ─────────────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────────────
  async customDelete(id, editReason, user) {
    const existing = await strapi.entityService.findOne(
      'api::shipment.shipment', id, { populate: ['finish', 'user'] }
    );
    if (!existing) throw new Error('Shipment not found');

    if (user) {
      const userWithRole = await strapi.entityService.findOne('plugin::users-permissions.user', user.id, { populate: ['role'] });
      const isAdmin = userWithRole?.role?.name?.toLowerCase() === 'admin';
      
      if (existing.user && String(existing.user.id) !== String(user.id) && !isAdmin) {
         throw new Error('Forbidden: Anda tidak memiliki hak akses (bukan Admin atau Pembuat) untuk menghapus data ini.');
      }
    }

    const response = await strapi.entityService.delete('api::shipment.shipment', id);

    if (existing.finish) {
      await strapi.entityService.delete('api::finish.finish', existing.finish.id);
    }

    await strapi.entityService.create('api::edit-history.edit-history', {
      data: {
        action:      'DELETE',
        reason:      editReason || 'Penghapusan data Shipment',
        changes:     { deleted_data: { no_do: existing.no_do, lot: existing.lot, date_shift: existing.date_shift } },
        shipment_id: String(id),
        user:        user?.id ?? null,
      },
    });

    if (existing.date_shift && existing.shift) {
      await strapi.service('api::summary.summary').updateSummary(existing.date_shift, existing.shift, 'ALL');
      if (existing.coal_type) {
        await strapi.service('api::summary.summary').updateSummary(existing.date_shift, existing.shift, existing.coal_type);
      }
    }

    return response;
  },

  // ─────────────────────────────────────────────
  // GET SHIPMENT LOTS
  // ─────────────────────────────────────────────
  async getShipmentLots(date_shift) {
    const knex  = strapi.db.connection;
    const query = knex('shipments').distinct('lot');
    if (date_shift) query.where('date_shift', date_shift);

    const results = await query;
    return results.map(row => row.lot).filter(Boolean);
  },

  // ─────────────────────────────────────────────
  // EXPORT EXCEL
  // ─────────────────────────────────────────────
  async getExportData(date_shift, lot) {
    const whereClause = {};
    if (date_shift) whereClause.date_shift = date_shift;
    if (lot && lot.toUpperCase() !== 'ALL') whereClause.lot = lot;

    return await strapi.entityService.findMany('api::shipment.shipment', {
      filters: whereClause,
      populate: ['finish', 'user'],
    });
  },

  // ─────────────────────────────────────────────
  // PENGELUARAN ROM: OVERVIEW & ANALYTICS
  // ─────────────────────────────────────────────
  async overviewRom(startDate, endDate, shift) {
    if (startDate && typeof startDate !== 'string') throw new Error('Invalid startDate parameter');
    if (endDate && typeof endDate !== 'string') throw new Error('Invalid endDate parameter');
    if (shift && typeof shift !== 'string') throw new Error('Invalid shift parameter');

    const shipmentWhere = {};
    if (startDate) shipmentWhere.date = { $gte: startDate };
    if (endDate) shipmentWhere.date = { ...shipmentWhere.date, $lte: endDate };
    if (shift && shift !== 'all') shipmentWhere.shift = shift;

    const recentShipments = await strapi.entityService.findMany('api::shipment.shipment', {
      filters: shipmentWhere,
      sort: { createdAt: 'desc' },
      limit: 10,
      populate: ['finish', 'user']
    });

    const summaryWhere = {};
    if (startDate) summaryWhere.date = { $gte: startDate };
    if (endDate) summaryWhere.date = { ...summaryWhere.date, $lte: endDate };
    if (shift && shift !== 'all') summaryWhere.shift = shift;

    const summaries = await strapi.entityService.findMany('api::summary.summary', {
      filters: summaryWhere
    });

    let totalTonnage = 0;
    let totalRitase = 0;
    let totalCrushed = 0;
    let totalUncrushed = 0;

    summaries.forEach(s => {
      totalTonnage += (s.total_net_weight || 0);
      totalRitase += (s.total_shipment || 0);
      if (s.coal_type === 'CRUSHED') totalCrushed += (s.total_net_weight || 0);
      if (s.coal_type === 'UNCRUSHED') totalUncrushed += (s.total_net_weight || 0);
    });

    const formattedRecent = recentShipments.map(item => ({
      id: item.id,
      no_do: item.no_do,
      coal_type: item.coal_type,
      date_shift: item.date_shift,
      time: item.time,
      hull_no: item.hull_no,
      lot: item.lot,
      loading: item.loading,
      dumping: item.dumping,
      username: item.user?.username || null,
      net_weight: item.net_weight,
      finish: item.finish ? { status: item.finish.status } : null
    }));

    return {
      analytics: {
        totalTonnage: Math.round(totalTonnage * 100) / 100,
        totalRitase,
        totalCrushed: Math.round(totalCrushed * 100) / 100,
        totalUncrushed: Math.round(totalUncrushed * 100) / 100
      },
      recentShipments: formattedRecent
    };
  },

  async analyticsRom(startDate, endDate, shift, view) {
    if (startDate && typeof startDate !== 'string') throw new Error('Invalid startDate parameter');
    if (endDate && typeof endDate !== 'string') throw new Error('Invalid endDate parameter');
    if (shift && typeof shift !== 'string') throw new Error('Invalid shift parameter');
    
    const isHourly = view === 'hourly';
    const chartMap = {};

    if (isHourly) {
      const shipmentWhere = {};
      if (startDate) shipmentWhere.date = { $gte: startDate };
      if (endDate) shipmentWhere.date = { ...shipmentWhere.date, $lte: endDate };
      if (!startDate && !endDate) {
        const today = formatYmd(new Date());
        shipmentWhere.date = { $gte: today, $lte: today };
      }
      if (shift && shift !== 'all') shipmentWhere.shift = shift;

      const shipments = await strapi.entityService.findMany('api::shipment.shipment', {
        filters: shipmentWhere,
        fields: ['time', 'net_weight', 'coal_type']
      });

      shipments.forEach(s => {
        if (!s.time) return;
        const hourLabel = String(s.time).substring(0, 2) + ':00';
        if (!chartMap[hourLabel]) {
          chartMap[hourLabel] = { label: hourLabel, Tonase: 0, Ritase: 0, Crushed: 0, Uncrushed: 0 };
        }
        const tonase = (s.net_weight || 0);
        chartMap[hourLabel].Tonase += tonase;
        chartMap[hourLabel].Ritase += 1;
        if (s.coal_type === 'CRUSHED') chartMap[hourLabel].Crushed += tonase;
        if (s.coal_type === 'UNCRUSHED') chartMap[hourLabel].Uncrushed += tonase;
      });

    } else {
      const summaryWhere = {};
      if (startDate) summaryWhere.date = { $gte: startDate };
      if (endDate) summaryWhere.date = { ...summaryWhere.date, $lte: endDate };
      if (shift && shift !== 'all') summaryWhere.shift = shift;

      const summaries = await strapi.entityService.findMany('api::summary.summary', {
        filters: summaryWhere
      });

      summaries.forEach(s => {
        if (!s.date) return;
        const lbl = s.date; 
        if (!chartMap[lbl]) {
          chartMap[lbl] = { label: lbl, Tonase: 0, Ritase: 0, Crushed: 0, Uncrushed: 0 };
        }
        const tonase = (s.total_net_weight || 0);
        chartMap[lbl].Tonase += tonase;
        chartMap[lbl].Ritase += (s.total_shipment || 0);
        if (s.coal_type === 'CRUSHED') chartMap[lbl].Crushed += tonase;
        if (s.coal_type === 'UNCRUSHED') chartMap[lbl].Uncrushed += tonase;
      });
    }

    const sortedKeys = Object.keys(chartMap).sort();
    return sortedKeys.map(k => ({
      ...chartMap[k],
      Tonase: Math.round(chartMap[k].Tonase * 100) / 100,
      Crushed: Math.round((chartMap[k].Crushed || 0) * 100) / 100,
      Uncrushed: Math.round((chartMap[k].Uncrushed || 0) * 100) / 100,
    }));
  },

  // ─────────────────────────────────────────────
  // PENERIMAAN SDJ: OVERVIEW & ANALYTICS
  // ─────────────────────────────────────────────
  async overviewSdj(startDate, endDate, shift) {
    if (startDate && typeof startDate !== 'string') throw new Error('Invalid startDate parameter');
    if (endDate && typeof endDate !== 'string') throw new Error('Invalid endDate parameter');
    if (shift && typeof shift !== 'string') throw new Error('Invalid shift parameter');

    const shipmentWhere = {
      finish: { status: 'FINISH' }
    };
    if (startDate) shipmentWhere.finish.date = { $gte: startDate };
    if (endDate) shipmentWhere.finish.date = { ...(shipmentWhere.finish.date || {}), $lte: endDate };
    if (shift && shift !== 'all') shipmentWhere.shift = shift;

    const recentShipments = await strapi.entityService.findMany('api::shipment.shipment', {
      filters: shipmentWhere,
      sort: { createdAt: 'desc' },
      limit: 10,
      populate: ['finish', 'user']
    });

    const summaryWhere = {};
    if (startDate) summaryWhere.date = { $gte: startDate };
    if (endDate) summaryWhere.date = { ...summaryWhere.date, $lte: endDate };
    if (shift && shift !== 'all') summaryWhere.shift = shift;

    const summaries = await strapi.entityService.findMany('api::summary.summary', {
      filters: summaryWhere
    });

    let totalFinishRitase = 0;
    summaries.forEach(s => {
      totalFinishRitase += (s.total_finish || 0);
    });

    const sdjAggShipments = await strapi.entityService.findMany('api::shipment.shipment', {
      filters: shipmentWhere,
      fields: ['net_weight'],
      populate: ['finish']
    });
    let sdjTonase = 0;
    let totalDuration = 0;

    sdjAggShipments.forEach(s => {
      sdjTonase += (s.net_weight || 0);
      if (s.finish?.duration) totalDuration += s.finish.duration;
    });

    const avgDurationMins = totalFinishRitase > 0 ? (totalDuration / totalFinishRitase) : 0;

    const formattedRecent = recentShipments.map(item => ({
      id: item.id,
      no_do: item.no_do,
      coal_type: item.coal_type,
      date_shift: item.date_shift,
      time: item.finish?.time ? String(item.finish.time).substring(0, 5) : null,
      hull_no: item.hull_no,
      lot: item.lot,
      loading: item.loading,
      dumping: item.dumping,
      username: item.user?.username || null,
      net_weight: item.net_weight,
      duration: item.finish?.duration ?? 0,
      status: item.finish?.status || 'FINISH',
      finish: item.finish ? { status: item.finish.status, duration: item.finish.duration } : null
    }));

    return {
      analytics: {
        totalTonnage: Math.round(sdjTonase * 100) / 100,
        totalRitase: totalFinishRitase,
        avgDurationMins: Math.round(avgDurationMins * 10) / 10
      },
      recentShipments: formattedRecent
    };
  },

  async analyticsSdj(startDate, endDate, shift, view) {
    if (startDate && typeof startDate !== 'string') throw new Error('Invalid startDate parameter');
    if (endDate && typeof endDate !== 'string') throw new Error('Invalid endDate parameter');
    if (shift && typeof shift !== 'string') throw new Error('Invalid shift parameter');

    const isHourly = view === 'hourly';
    const chartMap = {};

    if (isHourly) {
      const shipmentWhere = {
        finish: { status: 'FINISH' }
      };
      if (shift && shift !== 'all') shipmentWhere.shift = shift;

      if (startDate || endDate) {
        if (startDate) shipmentWhere.finish.date = { $gte: startDate };
        if (endDate) shipmentWhere.finish.date = { ...(shipmentWhere.finish.date || {}), $lte: endDate };
      } else {
        const today = formatYmd(new Date());
        shipmentWhere.finish.date = { $gte: today, $lte: today };
      }

      const shipments = await strapi.entityService.findMany('api::shipment.shipment', {
        filters: shipmentWhere,
        fields: ['net_weight', 'coal_type'],
        populate: ['finish']
      });

      shipments.forEach(s => {
        if (!s.finish?.time) return;
        const lbl = String(s.finish.time).substring(0, 2) + ':00';
        if (!chartMap[lbl]) {
          chartMap[lbl] = { date: lbl, name: lbl, label: lbl, Tonase: 0, Ritase: 0, Crushed: 0, Uncrushed: 0 };
        }
        const tonase = (s.net_weight || 0);
        chartMap[lbl].Tonase += tonase;
        chartMap[lbl].Ritase += 1;
        if (s.coal_type === 'CRUSHED') chartMap[lbl].Crushed += tonase;
        if (s.coal_type === 'UNCRUSHED') chartMap[lbl].Uncrushed += tonase;
      });
    } else {
      const summaryWhere = {};
      if (startDate) summaryWhere.date = { $gte: startDate };
      if (endDate) summaryWhere.date = { ...summaryWhere.date, $lte: endDate };
      if (shift && shift !== 'all') summaryWhere.shift = shift;

      const summaries = await strapi.entityService.findMany('api::summary.summary', {
        filters: summaryWhere,
      });

      summaries.forEach(s => {
        if (!s.date) return;
        const lbl = s.date;
        if (!chartMap[lbl]) {
          chartMap[lbl] = { date: lbl, name: formatMd(lbl), label: lbl, Tonase: 0, Ritase: 0, Crushed: 0, Uncrushed: 0 };
        }
        chartMap[lbl].Ritase += (s.total_finish || 0);
      });

      const finishWhere = { finish: { status: 'FINISH' } };
      if (startDate) finishWhere.finish.date = { $gte: startDate };
      if (endDate) finishWhere.finish.date = { ...(finishWhere.finish.date || {}), $lte: endDate };
      if (shift && shift !== 'all') finishWhere.shift = shift;

      const finishShipments = await strapi.entityService.findMany('api::shipment.shipment', {
        filters: finishWhere,
        fields: ['net_weight', 'coal_type'],
        populate: ['finish'],
      });

      finishShipments.forEach(s => {
        const lbl = s.finish?.date;
        if (!lbl) return;
        if (!chartMap[lbl]) {
          chartMap[lbl] = { date: lbl, name: formatMd(lbl), label: lbl, Tonase: 0, Ritase: 0, Crushed: 0, Uncrushed: 0 };
        }
        const tonase = (s.net_weight || 0);
        chartMap[lbl].Tonase += tonase;
        if (s.coal_type === 'CRUSHED') chartMap[lbl].Crushed += tonase;
        if (s.coal_type === 'UNCRUSHED') chartMap[lbl].Uncrushed += tonase;
      });
    }

    const sortedKeys = Object.keys(chartMap).sort();
    return sortedKeys.map(k => ({
      ...chartMap[k],
      Tonase: Math.round(chartMap[k].Tonase * 100) / 100,
      Crushed: Math.round((chartMap[k].Crushed || 0) * 100) / 100,
      Uncrushed: Math.round((chartMap[k].Uncrushed || 0) * 100) / 100,
    }));
  }
}));
