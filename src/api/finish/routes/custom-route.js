module.exports = {
  routes: [
    {
      method: 'PUT',
      path: '/finishes/arrive/:id',
      handler: 'finish.arrive',
      config: {
        auth: false,
      },
    },
  ],
};
