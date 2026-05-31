import { Injectable, Inject } from '@nestjs/common';
import { RequireTenant } from 'nestjs-tenant-shield';

@Injectable()
@RequireTenant()
export class StudentsService {
  constructor(@Inject('PRISMA') private readonly prisma: any) {}

  async findAll() {
    return this.prisma.student.findMany();
  }

  async findOne(id: number) {
    return this.prisma.student.findUnique({ where: { id } });
  }

  async create(data: { name: string; grade: number }) {
    return this.prisma.student.create({ data });
  }
}
