import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const port = process.env.API_PORT ?? 3500;
  await app.listen(port);

  // Placeholder: Pino logger setup will be added in Plan 03
  console.log(`Sentinel API listening on port ${port}`);
}

bootstrap();
