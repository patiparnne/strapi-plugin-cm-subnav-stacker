import type { Core } from '@strapi/strapi';

const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  index(ctx) {
    ctx.body = strapi
      .plugin('cm-subnav-stacker')
      // the name of the service file & the method.
      .service('service')
      .getWelcomeMessage();
  },
  async getConfig(ctx) {
    ctx.body = strapi
      .plugin('cm-subnav-stacker')
      // the name of the service file & the method.
      .service('service')
      .getConfig();
  },
});

export default controller;
