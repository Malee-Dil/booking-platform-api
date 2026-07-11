import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { Booking } from './entities/booking.entity';
import { Service } from '../services/entities/service.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { FindBookingsQueryDto } from './dto/find-bookings-query.dto';
import { BookingStatus } from './enums/booking-status.enum';
import { PaginatedResult } from '../common/dto/paginated-result.dto';


@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    @InjectRepository(Service)
    private readonly servicesRepository: Repository<Service>,
  ) {}

  async create(dto: CreateBookingDto): Promise<Booking> {
    // Rule 1: booking must belong to an existing service.
    // The DB foreign key would catch this too, but checking here first
    // lets us return a clear 404 instead of a raw DB constraint error.
    const service = await this.servicesRepository.findOne({
      where: { id: dto.serviceId },
    });
    if (!service) {
      throw new NotFoundException(
        `Service with id ${dto.serviceId} not found`,
      );
    }

    // Rule 2: booking date cannot be in the past.
    this.assertNotInThePast(dto.bookingDate, dto.bookingTime);

    // Bonus: prevent double-booking the same service at the same date/time.
    await this.assertNoDuplicateBooking(
      dto.serviceId,
      dto.bookingDate,
      dto.bookingTime,
    );

    const booking = this.bookingsRepository.create(dto);
    return this.bookingsRepository.save(booking);
  }

  async findAll(query: FindBookingsQueryDto): Promise<PaginatedResult<Booking>> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;

  const qb = this.bookingsRepository
    .createQueryBuilder('booking')
    .leftJoinAndSelect('booking.service', 'service')
    .orderBy('booking.createdAt', 'DESC');

  if (query.status) {
    qb.andWhere('booking.status = :status', { status: query.status });
  }

  if (query.serviceId) {
    qb.andWhere('booking.serviceId = :serviceId', {
      serviceId: query.serviceId,
    });
  }

  if (query.customerName) {
    qb.andWhere('booking.customerName ILIKE :customerName', {
      customerName: `%${query.customerName}%`,
    });
  }

  if (query.customerEmail) {
    qb.andWhere('booking.customerEmail ILIKE :customerEmail', {
      customerEmail: `%${query.customerEmail}%`,
    });
  }

  if (query.dateFrom) {
    qb.andWhere('booking.bookingDate >= :dateFrom', {
      dateFrom: query.dateFrom,
    });
  }

  if (query.dateTo) {
    qb.andWhere('booking.bookingDate <= :dateTo', { dateTo: query.dateTo });
  }

  const [data, total] = await qb
    .skip((page - 1) * limit)
    .take(limit)
    .getManyAndCount();

  return {
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

  async findOne(id: string): Promise<Booking> {
    const booking = await this.bookingsRepository.findOne({
      where: { id },
      relations: { service: true },
    });
    if (!booking) {
      throw new NotFoundException(`Booking with id ${id} not found`);
    }
    return booking;
  }

  async updateStatus(
    id: string,
    dto: UpdateBookingStatusDto,
  ): Promise<Booking> {
    const booking = await this.findOne(id);

    // Rule 3: cancelled bookings cannot become completed (or anything else).
    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot change status of a cancelled booking',
      );
    }

    booking.status = dto.status;
    return this.bookingsRepository.save(booking);
  }

  async cancel(id: string): Promise<Booking> {
    const booking = await this.findOne(id);

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Booking is already cancelled');
    }
    if (booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed booking');
    }

    booking.status = BookingStatus.CANCELLED;
    return this.bookingsRepository.save(booking);
  }

   private async assertNoDuplicateBooking(
    serviceId: string,
    bookingDate: string,
    bookingTime: string,
  ): Promise<void> {
    const existing = await this.bookingsRepository.findOne({
      where: {
        serviceId,
        bookingDate,
        bookingTime,
        status: Not(BookingStatus.CANCELLED),
      },
    });

    if (existing) {
      throw new ConflictException(
        'This service is already booked for the selected date and time',
      );
    }
  }

  private assertNotInThePast(bookingDate: string, bookingTime: string): void {
    const bookingDateTime = new Date(`${bookingDate}T${bookingTime}`);
    if (bookingDateTime.getTime() < Date.now()) {
      throw new BadRequestException('Booking date/time cannot be in the past');
    }
  }
}