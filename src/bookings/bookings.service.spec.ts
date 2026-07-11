import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { BookingsService } from './bookings.service';
import { Booking } from './entities/booking.entity';
import { Service } from '../services/entities/service.entity';
import { BookingStatus } from './enums/booking-status.enum';
import { CreateBookingDto } from './dto/create-booking.dto';

describe('BookingsService', () => {
  let service: BookingsService;
  let bookingsRepo: jest.Mocked<Repository<Booking>>;
  let servicesRepo: jest.Mocked<Repository<Service>>;

  const mockService: Service = {
    id: 'service-1',
    title: 'Haircut',
    description: 'A haircut',
    duration: 30,
    price: 25,
    isActive: true,
    bookings: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const baseDto: CreateBookingDto = {
    customerName: 'Jane Doe',
    customerEmail: 'jane@example.com',
    customerPhone: '+94711234567',
    serviceId: 'service-1',
    bookingDate: '2099-01-01', // far future, always valid for "not in the past"
    bookingTime: '10:00',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: getRepositoryToken(Booking),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Service),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    bookingsRepo = module.get(getRepositoryToken(Booking));
    servicesRepo = module.get(getRepositoryToken(Service));
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('throws NotFoundException if the service does not exist', async () => {
      servicesRepo.findOne.mockResolvedValue(null);

      await expect(service.create(baseDto)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if the booking date/time is in the past', async () => {
      servicesRepo.findOne.mockResolvedValue(mockService);

      const pastDto = { ...baseDto, bookingDate: '2020-01-01' };

      await expect(service.create(pastDto)).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException if the same service/date/time is already booked', async () => {
      servicesRepo.findOne.mockResolvedValue(mockService);
      bookingsRepo.findOne.mockResolvedValue({ id: 'existing' } as Booking);

      await expect(service.create(baseDto)).rejects.toThrow(ConflictException);
    });

    it('creates a booking when service exists, date is valid, and no duplicate', async () => {
      servicesRepo.findOne.mockResolvedValue(mockService);
      bookingsRepo.findOne.mockResolvedValue(null); // no duplicate
      const created = { ...baseDto, id: 'new-id', status: BookingStatus.PENDING };
      bookingsRepo.create.mockReturnValue(created as any);
      bookingsRepo.save.mockResolvedValue(created as any);

      const result = await service.create(baseDto);

      expect(bookingsRepo.create).toHaveBeenCalledWith(baseDto);
      expect(bookingsRepo.save).toHaveBeenCalledWith(created);
      expect(result).toEqual(created);
    });
  });

  describe('updateStatus', () => {
    it('throws BadRequestException when trying to change a cancelled booking', async () => {
      const cancelledBooking = {
        id: 'b1',
        status: BookingStatus.CANCELLED,
      } as Booking;
      bookingsRepo.findOne.mockResolvedValue(cancelledBooking);

      await expect(
        service.updateStatus('b1', { status: BookingStatus.COMPLETED }),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates status when the booking is not cancelled', async () => {
      const pendingBooking = { id: 'b1', status: BookingStatus.PENDING } as Booking;
      bookingsRepo.findOne.mockResolvedValue(pendingBooking);
      bookingsRepo.save.mockImplementation(async (b) => b as Booking);

      const result = await service.updateStatus('b1', {
        status: BookingStatus.CONFIRMED,
      });

      expect(result.status).toBe(BookingStatus.CONFIRMED);
    });

    it('throws NotFoundException if the booking does not exist', async () => {
      bookingsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus('missing', { status: BookingStatus.CONFIRMED }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('throws BadRequestException if already cancelled', async () => {
      const booking = { id: 'b1', status: BookingStatus.CANCELLED } as Booking;
      bookingsRepo.findOne.mockResolvedValue(booking);

      await expect(service.cancel('b1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if trying to cancel a completed booking', async () => {
      const booking = { id: 'b1', status: BookingStatus.COMPLETED } as Booking;
      bookingsRepo.findOne.mockResolvedValue(booking);

      await expect(service.cancel('b1')).rejects.toThrow(BadRequestException);
    });

    it('cancels a pending booking successfully', async () => {
      const booking = { id: 'b1', status: BookingStatus.PENDING } as Booking;
      bookingsRepo.findOne.mockResolvedValue(booking);
      bookingsRepo.save.mockImplementation(async (b) => b as Booking);

      const result = await service.cancel('b1');

      expect(result.status).toBe(BookingStatus.CANCELLED);
    });
  });
});