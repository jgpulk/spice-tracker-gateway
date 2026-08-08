import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './entities/client.entity';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  findAll() {
    return this.clientRepo.find();
  }

  async findOne(id: number) {
    const client = await this.clientRepo.findOneBy({ id_client: id });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  create(data: Partial<Client>) {
    return this.clientRepo.save(this.clientRepo.create(data));
  }

  async update(id: number, data: Partial<Client>) {
    await this.findOne(id);
    await this.clientRepo.update(id, data);
    return this.findOne(id);
  }
}
