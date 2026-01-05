import contentAPIRoutes from './content-api';

const routes = {
  'content-api': {
    type: 'content-api',
    routes: contentAPIRoutes,
  },
  'cm-subnav-stacker': {
    type: 'admin',
    routes: [
      {
        method: 'GET',
        path: '/config',
        handler: 'controller.getConfig',
        config: {
          auth: false,
          policies: [],
          middlewares: [],
        },
      },
    ],
  },
};

export default routes;
