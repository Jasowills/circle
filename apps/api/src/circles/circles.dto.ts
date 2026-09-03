import { IsEmail, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

// Decimal(18,2) columns hold at most 9999999999999999.99 — reject anything
// bigger at the boundary with a 400 instead of a 500 from Postgres.
// NOTE: no @Type(() => Number) here on purpose: implicit coercion turned
// JSON `true` into amount 1. The API only accepts real JSON numbers.

export class CreateCircleDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsNumber()
  @IsPositive()
  @Max(9999999999999999.99)
  goalAmount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;
}

export class InviteDto {
  @IsEmail()
  email!: string;
}

export class ContributeDto {
  @IsNumber()
  @Min(0.01)
  @Max(9999999999999999.99)
  amount!: number;

  /** Client-generated UUID; retries with the same key never double-write. */
  @IsUUID()
  idempotencyKey!: string;
}
