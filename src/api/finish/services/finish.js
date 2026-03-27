'use strict';

/**
 * finish service
 */

const { createCoreService } = require('@strapi/strapi').factories;
const { getShiftDetails } = require('../../../utils/shift');

module.exports = createCoreService('api::finish.finish', ({ strapi }) => ({

  // ─────────────────────────────────────────────
  // ARRIVE (Step 3: DT sampai di lokasi tujuan)
  // ─────────────────────────────────────────────
  async arrive(shipmentId, data) {
    if (!shipmentId) throw new Error('shipment ID wajib diisi');

    const shipment = await strapi.entityService.findOne(
      'api::shipment.shipment', shipmentId, { populate: ['finish'] }
    );
    if (!shipment) throw new Error('Shipment not found');
    if (!shipment.finish) throw new Error('Finish record not found untuk shipment ini');

    if (shipment.finish.status !== 'IN_TRANSIT') {
      throw new Error(`Shipment tidak bisa di-arrive. Status saat ini: "${shipment.finish.status}"`);
    }

    // Opsional: validasi seal_no cocok
    if (data.seal_no && shipment.seal_no && data.seal_no !== shipment.seal_no) {
      throw new Error(`seal_no tidak cocok. Diharapkan: "${shipment.seal_no}", diterima: "${data.seal_no}".`);
    }

    const now = new Date();
    const sf = getShiftDetails(now);

    const diffMs = now.getTime() - new Date(shipment.createdAt).getTime();
    const duration = Math.max(0, Math.floor(diffMs / 60000));

    const finishData = {
      status:     'FINISH',
      date:       sf.date,
      time:       sf.time,
      shift:      sf.shift,
      date_shift: sf.date_shift,
      duration,
    };

    const response = await strapi.entityService.update('api::finish.finish', shipment.finish.id, {
      data: finishData,
      populate: '*',
    });

    // Update summary
    if (shipment.coal_type) {
      await strapi.service('api::summary.summary').updateSummary(
        shipment.date_shift, shipment.shift, shipment.coal_type
      );
    }

    return {
      id: shipment.id,
      no_do: shipment.no_do,
      hull_no: shipment.hull_no,
      finish: response,
    };
  },

  async customUpdate(id, data, editReason, user) {
    if (!data) throw new Error('Missing data payload');

    const existing = await strapi.entityService.findOne('api::finish.finish', id, { populate: ['shipment', 'shipment.user'] });
    if (!existing) throw new Error('Finish not found');

    if (user && existing.shipment?.user) {
      const userWithRole = await strapi.entityService.findOne('plugin::users-permissions.user', user.id, { populate: ['role'] });
      const isAdmin = userWithRole?.role?.name?.toLowerCase() === 'admin';

      if (String(existing.shipment.user.id) !== String(user.id) && !isAdmin) {
         throw new Error('Forbidden: Anda tidak memiliki hak akses (bukan Admin atau Pembuat) untuk mengubah data ini.');
      }
    }

    const updateData = { ...data };

    // If time and date are modified, recalculate duration
    const newDate = data.date || existing.date;
    const newTime = data.time || existing.time;

    if (existing.shipment && newDate && newTime && (data.date || data.time)) {
      let timePart = newTime;
      if (timePart.length === 5) timePart += ':00'; // if HH:mm
      let isoStr = `${newDate}T${timePart}`;
      if (!isoStr.includes('+') && !isoStr.includes('Z')) {
        isoStr += '+07:00';
      }
      const finishDt = new Date(isoStr);
      const startDt = new Date(existing.shipment.createdAt);

      const diffMs = finishDt.getTime() - startDt.getTime();
      updateData.duration = Math.max(0, Math.floor(diffMs / 60000));
      
      const sf = getShiftDetails(finishDt);
      updateData.shift = sf.shift;
      updateData.date_shift = sf.date_shift;
    }

    // Determine what changed
    let changes = {};
    for (const key in updateData) {
      if (existing[key] !== undefined && existing[key] !== updateData[key]) {
        changes[key] = { from: existing[key], to: updateData[key] };
      }
    }

    const response = await strapi.entityService.update('api::finish.finish', id, { data: updateData, populate: '*' });

    // Save Edit History
    if (Object.keys(changes).length > 0) {
      const shipmentId = existing.shipment ? existing.shipment.id : null;
      await strapi.entityService.create('api::edit-history.edit-history', {
        data: {
          action: 'UPDATE',
          reason: editReason || 'Pembaruan data Finish',
          changes: { finish_table: changes },
          shipment_id: shipmentId ? String(shipmentId) : null,
          shipment: shipmentId,
          user: user ? user.id : null
        }
      });
    }

    if (existing.shipment?.date_shift && existing.shipment?.shift) {
      if (existing.shipment.coal_type) {
        await strapi.service('api::summary.summary').updateSummary(existing.shipment.date_shift, existing.shipment.shift, existing.shipment.coal_type);
      }
    }

    return response;
  },

  async customDelete(id, editReason, user) {
    const existing = await strapi.entityService.findOne('api::finish.finish', id, { populate: ['shipment', 'shipment.user'] });
    if (!existing) throw new Error('Finish not found');

    if (user && existing.shipment?.user) {
      const userWithRole = await strapi.entityService.findOne('plugin::users-permissions.user', user.id, { populate: ['role'] });
      const isAdmin = userWithRole?.role?.name?.toLowerCase() === 'admin';

      if (String(existing.shipment.user.id) !== String(user.id) && !isAdmin) {
         throw new Error('Forbidden: Anda tidak memiliki hak akses (bukan Admin atau Pembuat) untuk menghapus data ini.');
      }
    }

    const response = await strapi.entityService.delete('api::finish.finish', id);

    const shipmentId = existing.shipment ? existing.shipment.id : null;

    // Save Edit History for Deletion
    await strapi.entityService.create('api::edit-history.edit-history', {
      data: {
        action: 'DELETE',
        reason: editReason || 'Penghapusan data Finish',
        changes: { deleted_finish: { date: existing.date, time: existing.time, duration: existing.duration } },
        shipment_id: shipmentId ? String(shipmentId) : null,
        shipment: shipmentId,
        user: user ? user.id : null
      }
    });

    if (existing.shipment?.date_shift && existing.shipment?.shift) {
      if (existing.shipment.coal_type) {
        await strapi.service('api::summary.summary').updateSummary(existing.shipment.date_shift, existing.shipment.shift, existing.shipment.coal_type);
      }
    }

    return response;
  }
}));
