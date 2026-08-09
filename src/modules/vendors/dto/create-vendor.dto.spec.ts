import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateVendorDto } from './create-vendor.dto';

const validBase = {
  name: 'Green Cardamom Shop',
  subdomain: 'green-cardamom',
  email: 'shop@greencardamom.com',
  phone: '+919876543210',
  address: '42, Market Street, Idukki',
  city: 'Idukki',
  state: 'Kerala',
  pincode: '685602',
  business_reg_no: '29ABCDE1234F1Z5',
  business_type: 'Sole Proprietorship',
  owner_name: 'Ravi Kumar',
  owner_email: 'ravi@greencardamom.com',
  owner_password: 'Secret@123',
};

function build(overrides: Record<string, unknown> = {}) {
  return plainToInstance(CreateVendorDto, { ...validBase, ...overrides });
}

async function errorsFor(dto: CreateVendorDto) {
  const errors = await validate(dto);
  return errors.reduce<Record<string, string[]>>((acc, e) => {
    acc[e.property] = Object.values(e.constraints ?? {});
    return acc;
  }, {});
}

describe('CreateVendorDto', () => {
  it('accepts a fully valid payload', async () => {
    const errors = await validate(build());
    expect(errors).toHaveLength(0);
  });

  // --- business_reg_no ---
  describe('business_reg_no', () => {
    it('is required', async () => {
      const { business_reg_no: _omit, ...rest } = validBase;
      const dto = plainToInstance(CreateVendorDto, rest);
      const errs = await errorsFor(dto);
      expect(errs.business_reg_no).toBeDefined();
    });

    it('rejects empty string', async () => {
      const errs = await errorsFor(build({ business_reg_no: '' }));
      expect(errs.business_reg_no).toBeDefined();
    });

    it('rejects value shorter than 3 chars', async () => {
      const errs = await errorsFor(build({ business_reg_no: 'AB' }));
      expect(errs.business_reg_no).toBeDefined();
    });

    it('rejects special characters outside allowed set', async () => {
      const errs = await errorsFor(build({ business_reg_no: 'GST@123!' }));
      expect(errs.business_reg_no).toBeDefined();
    });

    it('accepts alphanumeric with hyphens and slashes', async () => {
      const errs = await errorsFor(build({ business_reg_no: 'ABC-123/XY' }));
      expect(errs.business_reg_no).toBeUndefined();
    });

    it('upper-cases the value via @Transform', () => {
      const dto = build({ business_reg_no: '29abcde1234f1z5' });
      expect(dto.business_reg_no).toBe('29ABCDE1234F1Z5');
    });
  });

  // --- business_type ---
  describe('business_type', () => {
    it('is required', async () => {
      const { business_type: _omit, ...rest } = validBase;
      const dto = plainToInstance(CreateVendorDto, rest);
      const errs = await errorsFor(dto);
      expect(errs.business_type).toBeDefined();
    });

    it('rejects empty string', async () => {
      const errs = await errorsFor(build({ business_type: '' }));
      expect(errs.business_type).toBeDefined();
    });

    it('rejects value exceeding 255 chars', async () => {
      const errs = await errorsFor(build({ business_type: 'A'.repeat(256) }));
      expect(errs.business_type).toBeDefined();
    });

    it('accepts a normal business type string', async () => {
      const errs = await errorsFor(build({ business_type: 'Private Limited' }));
      expect(errs.business_type).toBeUndefined();
    });

    it('trims surrounding whitespace via @Transform', () => {
      const dto = build({ business_type: '  Partnership  ' });
      expect(dto.business_type).toBe('Partnership');
    });
  });

  // --- owner_name ---
  describe('owner_name', () => {
    it('is required', async () => {
      const { owner_name: _omit, ...rest } = validBase;
      const dto = plainToInstance(CreateVendorDto, rest);
      const errs = await errorsFor(dto);
      expect(errs.owner_name).toBeDefined();
    });

    it('rejects empty string', async () => {
      const errs = await errorsFor(build({ owner_name: '' }));
      expect(errs.owner_name).toBeDefined();
    });

    it('rejects single character', async () => {
      const errs = await errorsFor(build({ owner_name: 'R' }));
      expect(errs.owner_name).toBeDefined();
    });
  });

  // --- owner_email ---
  describe('owner_email', () => {
    it('is required', async () => {
      const { owner_email: _omit, ...rest } = validBase;
      const dto = plainToInstance(CreateVendorDto, rest);
      const errs = await errorsFor(dto);
      expect(errs.owner_email).toBeDefined();
    });

    it('rejects an invalid email format', async () => {
      const errs = await errorsFor(build({ owner_email: 'not-an-email' }));
      expect(errs.owner_email).toBeDefined();
    });

    it('lower-cases the value via @Transform', () => {
      const dto = build({ owner_email: 'Ravi@GreenCardamom.COM' });
      expect(dto.owner_email).toBe('ravi@greencardamom.com');
    });
  });

  // --- owner_password ---
  describe('owner_password', () => {
    it('is required', async () => {
      const { owner_password: _omit, ...rest } = validBase;
      const dto = plainToInstance(CreateVendorDto, rest);
      const errs = await errorsFor(dto);
      expect(errs.owner_password).toBeDefined();
    });

    it('rejects passwords shorter than 8 chars', async () => {
      const errs = await errorsFor(build({ owner_password: 'short' }));
      expect(errs.owner_password).toBeDefined();
    });

    it('accepts password of exactly 8 chars', async () => {
      const errs = await errorsFor(build({ owner_password: '12345678' }));
      expect(errs.owner_password).toBeUndefined();
    });
  });

  // --- subdomain ---
  describe('subdomain', () => {
    it('rejects uppercase letters', async () => {
      const errs = await errorsFor(build({ subdomain: 'Green-Cardamom' }));
      expect(errs.subdomain).toBeDefined();
    });

    it('rejects spaces', async () => {
      const errs = await errorsFor(build({ subdomain: 'green cardamom' }));
      expect(errs.subdomain).toBeDefined();
    });

    it('accepts lowercase-hyphenated slugs', async () => {
      const errs = await errorsFor(build({ subdomain: 'green-cardamom-123' }));
      expect(errs.subdomain).toBeUndefined();
    });
  });
});
