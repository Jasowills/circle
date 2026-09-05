import { IsEmail, IsInt, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

// Decimal(18,2) columns hold at most 9999999999999999.99. Reject anything
// bigger at the boundary with a 400 instead of a 500 from Postgres.
// NOTE: no @Type(() => Number) here on purpose: implicit coercion turned
// JSON `true` into amount 1. The API only accepts real JSON numbers.

const DECIMAL_MAX = 9999999999999999.99;

export class CreateCircleDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(DECIMAL_MAX)
  goalAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  /** Rotation (Ajo) params. Omit all three for a legacy goal-only circle. */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(DECIMAL_MAX)
  contributionAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(50)
  targetMembers?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  cycleLengthDays?: number;

  /** Times per week a member may contribute. Null = whenever. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  contributionsPerWeek?: number;
}

export class InviteDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;
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
