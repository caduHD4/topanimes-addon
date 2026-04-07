const { serveHTTP } = require("stremio-addon-sdk");
const { createAddonInterface } = require("./addonFactory");

async function bootstrap() {
  const addonInterface = await createAddonInterface();
  const port = Number(process.env.PORT || 7000);
  serveHTTP(addonInterface, { port });

  console.log(`TopAnimes addon ativo em http://127.0.0.1:${port}/manifest.json`);
}

bootstrap().catch((error) => {
  console.error("Falha ao iniciar TopAnimes addon", error);
  process.exit(1);
});