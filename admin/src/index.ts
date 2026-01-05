import { getTranslation } from './utils/getTranslation';
import { PLUGIN_ID } from './pluginId';
import { Initializer } from './components/Initializer';
import { PluginIcon } from './components/PluginIcon';
import { buildNavigation } from './components/SubNavInjector';

/**
 * Check if the plugin is enabled by attempting to fetch its config endpoint.
 * If the server-side plugin is disabled, this endpoint won't exist (404).
 */
const isPluginEnabled = async (): Promise<boolean> => {
  try {
    const response = await fetch('/cm-subnav-stacker/config');
    // If we get a successful response, the plugin is enabled on the server
    return response.ok;
  } catch {
    // Network error or endpoint doesn't exist - plugin is disabled
    return false;
  }
};

export default {
  register(app: any) {

    console.log('🎯 Content Manager Subnavigation Stacker plugin - ADMIN REGISTER function called!');

    app.registerPlugin({
      id: PLUGIN_ID,
      initializer: Initializer,
      isReady: false,
      name: PLUGIN_ID,
    });

    // Check if plugin is enabled before injecting navigation
    isPluginEnabled().then((enabled) => {
      if (enabled) {
        console.log('✅ cm-subnav-stacker is enabled, building navigation...');
        buildNavigation();
      } else {
        console.log('⏸️ cm-subnav-stacker is disabled, skipping navigation injection.');
      }
    });
    
  },

  async registerTrads({ locales }: { locales: string[] }) {
    return Promise.all(
      locales.map(async (locale) => {
        try {
          const { default: data } = await import(`./translations/${locale}.json`);

          return { data, locale };
        } catch {
          return { data: {}, locale };
        }
      })
    );
  },
};
