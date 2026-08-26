import { env } from "./env";
import { buildApp } from "./app";

const app = buildApp();

app.listen({ port: env.PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
