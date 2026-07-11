import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ServicesService } from './services.service';
import { Service } from './entities/service.entity';

describe('ServicesService', () => {
  let service: ServicesService;
  let repo: jest.Mocked<Repository<Service>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        {
          provide: getRepositoryToken(Service),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ServicesService>(ServicesService);
    repo = module.get(getRepositoryToken(Service));
  });

  afterEach(() => jest.clearAllMocks());

  it('findOne throws NotFoundException when the service does not exist', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException);
  });

  it('findOne returns the service when it exists', async () => {
    const mockService = { id: '1', title: 'Haircut' } as Service;
    repo.findOne.mockResolvedValue(mockService);

    const result = await service.findOne('1');

    expect(result).toEqual(mockService);
  });

  it('findAll returns paginated results with correct meta', async () => {
    const mockServices = [{ id: '1' }, { id: '2' }] as Service[];
    repo.findAndCount.mockResolvedValue([mockServices, 2]);

    const result = await service.findAll({ page: 1, limit: 10 });

    expect(result.data).toEqual(mockServices);
    expect(result.meta).toEqual({ total: 2, page: 1, limit: 10, totalPages: 1 });
  });

  it('remove throws NotFoundException when the service does not exist', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.remove('missing-id')).rejects.toThrow(NotFoundException);
  });
});