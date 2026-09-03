import { IsEmail, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCircleDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
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
  @Type(() => Number)
  amount!: number;

  /** Client-generated UUID; retries with the same key never double-write. */
  @IsUUID()
  idempotencyKey!: string;
}
