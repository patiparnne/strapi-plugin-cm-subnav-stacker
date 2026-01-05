import type { Core } from '@strapi/strapi';
import { get } from 'http';

const service = ({ strapi }: { strapi: Core.Strapi }) => ({
  getWelcomeMessage() {
    return 'Welcome to Strapi 🚀';
  },
  getConfig() {
    const delimiter = strapi.plugin('cm-subnav-stacker').config('delimiter');
    const template = strapi.plugin('cm-subnav-stacker').config('template');
    return { delimiter, template };
  },
});

export default service;
