import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DateRangeDto } from './date-range.dto';

describe('DateRangeDto', () => {
  it('accepte des bornes ISO 8601 valides', async () => {
    const dto = plainToInstance(DateRangeDto, {
      from: '2026-01-01',
      to: '2026-12-31',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it("accepte l'absence totale de bornes (filtre optionnel)", async () => {
    const dto = plainToInstance(DateRangeDto, {});

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('accepte une seule borne', async () => {
    const dto = plainToInstance(DateRangeDto, { from: '2026-07-01' });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejette une date non ISO (format français)', async () => {
    const dto = plainToInstance(DateRangeDto, { from: '01/07/2026' });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('from');
  });

  it('rejette une valeur fantaisiste', async () => {
    const dto = plainToInstance(DateRangeDto, { to: 'demain' });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('to');
  });
});
