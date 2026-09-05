import { IsEmail, IsInt, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

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

  @IsUUID()
  idempotencyKey!: string;
}
