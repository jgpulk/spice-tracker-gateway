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

  async findOne(publicId: string) {
    const client = await this.clientRepo.findOneBy({ public_id: publicId });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  create(data: Partial<Client>) {
    return this.clientRepo.save(this.clientRepo.create(data));
  }

  async update(publicId: string, data: Partial<Client>) {
    const client = await this.findOne(publicId);
    await this.clientRepo.update(client.id_client, data);
    return this.findOne(publicId);
  }
}
