module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/shipments/register',
      handler: 'shipment.register',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/shipments/match-sjb',
      handler: 'shipment.matchSjb',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/shipments/lots',
      handler: 'shipment.getShipmentLots',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/shipments/export/excel',
      handler: 'shipment.exportExcel',
      config: { policies: [] },
    },
    {
      method: 'PUT',
      path: '/shipments/finish/:no_do',
      handler: 'shipment.finishByNoDo',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/shipments/overview-rom',
      handler: 'shipment.overviewRom',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/shipments/overview-sdj',
      handler: 'shipment.overviewSdj',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/summaries/analytics-rom',
      handler: 'shipment.analyticsRom',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/summaries/analytics-sdj',
      handler: 'shipment.analyticsSdj',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/shipments/all-rom',
      handler: 'shipment.getAllRom',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/shipments/all-sdj',
      handler: 'shipment.getAllSdj',
      config: { policies: [] },
    }
  ]
};
