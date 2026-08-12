import { NestFactory, Reflector } from '@nestjs/core';
import { BadRequestException, ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
      exceptionFactory: (errors) => {
        const fields: Record<string, string[]> = {};
        for (const error of errors) {
          fields[error.property] = Object.values(error.constraints ?? {});
        }
        return new BadRequestException({
          statusCode: 400,
          error: 'Validation Failed',
          message: 'Validation failed',
          fields,
        });
      },
    }),
  );

  const reflector = app.get(Reflector);

  // ResponseInterceptor is outermost — it wraps after ClassSerializer has excluded fields
  app.useGlobalInterceptors(
    new ResponseInterceptor(reflector),
    new ClassSerializerInterceptor(reflector),
  );

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:4200',
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Spice Wallet API')
    .setDescription(
      'Multi-tenant cardamom processing & trade SaaS — vendor, stock, drying, grading, and sales management',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Spice Wallet API  → http://localhost:${port}/api/v1`);
  console.log(`Swagger UI        → http://localhost:${port}/api/docs`);
}
bootstrap();
