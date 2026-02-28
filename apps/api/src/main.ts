import "./tracing";

import { NestFactory } from "@nestjs/core";
import { env } from "@sentinel/config";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.setGlobalPrefix("api");
  app.enableCors();
  app.useLogger(app.get(Logger));

  await app.listen(env.API_PORT);

  const logger = app.get(Logger);
  logger.log(`Sentinel API listening on port ${env.API_PORT}`);
}

bootstrap();
