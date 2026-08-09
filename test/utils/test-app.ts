import { BadRequestException, ClassSerializerInterceptor, INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';

// Mirrors src/main.ts's bootstrap() exactly (minus CORS/Swagger/listen, which
// don't matter for in-process testing) so e2e tests see the same envelope,
// filters, and validation behavior as the real deployed app.
export async function createTestApp(): Promise<{ app: INestApplication; moduleFixture: TestingModule }> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();

  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
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
  app.useGlobalInterceptors(new ResponseInterceptor(reflector), new ClassSerializerInterceptor(reflector));

  await app.init();
  return { app, moduleFixture };
}
