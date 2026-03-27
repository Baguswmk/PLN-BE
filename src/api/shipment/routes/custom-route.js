module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/shipments/register',
      handler: 'shipment.register',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/shipments/match-sjb',
      handler: 'shipment.matchSjb',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/shipments/lots',
      handler: 'shipment.getShipmentLots',
      config: {
        auth: false, 
      },
    },
    {
      method: 'GET',
      path: '/shipments/export/excel',
      handler: 'shipment.exportExcel',
      config: {
        auth: false, 
      },
    },
    {
      method: 'PUT',
      path: '/shipments/finish/:no_do',
      handler: 'shipment.finishByNoDo',
      config: {
        auth: false, 
      },
    },
    {
      method: 'GET',
      path: '/shipments/overview-rom',
      handler: 'shipment.overviewRom',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/shipments/overview-sdj',
      handler: 'shipment.overviewSdj',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/summaries/analytics-rom',
      handler: 'shipment.analyticsRom',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/summaries/analytics-sdj',
      handler: 'shipment.analyticsSdj',
      config: { auth: false },
    }
  ]
};
