import * as ts_module from "typescript/lib/tsserverlibrary";

export = function init({}: { typescript: typeof ts_module }) {
  return {
    create(info: ts.server.PluginCreateInfo) {
      info.project.projectService.logger.info(
        "[abracadabra] Hello from Abracadabra ts-server-plugin 👋"
      );

      // Set up decorator object
      const proxy: ts.LanguageService = Object.create(null);
      for (let k of Object.keys(info.languageService) as Array<
        keyof ts.LanguageService
      >) {
        const x = info.languageService[k]!;
        // @ts-expect-error - JS runtime trickery which is tricky to type tersely
        proxy[k] = (...args: Array<{}>) => x.apply(info.languageService, args);
      }

      // Remove specified entries from completion list
      proxy.getCompletionsAtPosition = (fileName, position, options) => {
        const prior = info.languageService.getCompletionsAtPosition(
          fileName,
          position,
          options
        );
        if (!prior) return;
        info.project.projectService.logger.info(
          `[abracadabra] I read your completion entries: ${prior.entries
            .map((e) => e.name)
            .join(", ")}`
        );

        prior.entries = prior.entries.map((e) => ({
          ...e,
          name: `MAGIC ✨ ${e.name}`
        }));

        return prior;
      };

      return proxy;
    },
    onConfigurationChanged(_config: any) {
      // Receive configuration changes sent from VS Code
    }
  };
};
