import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsPhoneNumber,
  IsUUID,
  IsDateString,
  IsOptional,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  customerEmail: string;

  @ApiProperty({ example: '+94711234567' })
  @IsPhoneNumber()
  customerPhone: string;

  @ApiProperty({ example: 'b3f1c1e2-1234-4a1b-9c1d-abcdef123456' })
  @IsUUID()
  serviceId: string;

  @ApiProperty({ example: '2026-08-15' })
  @IsDateString()
  bookingDate: string;

  @ApiProperty({ example: '14:30' })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, {
    message: 'bookingTime must be in HH:MM or HH:MM:SS format',
  })
  bookingTime: string;

  @ApiPropertyOptional({ example: 'First time customer' })
  @IsOptional()
  @IsString()
  notes?: string;
}