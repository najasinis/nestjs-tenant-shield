import { Injectable } from '@nestjs/common';
import { RequireTenant, Cacheable, getCurrentTenantId } from 'nestjs-tenant-shield';

const STUDENTS = [
  { id: 1, tenantId: 'academy-A', name: '김민수', grade: 90 },
  { id: 2, tenantId: 'academy-A', name: '이지연', grade: 85 },
  { id: 3, tenantId: 'academy-B', name: '박철수', grade: 88 },
];

@Injectable()
@RequireTenant()
export class StudentsService {
  @Cacheable({ ttl: 30, tenantScoped: true })
  async findAll() {
    const tenantId = getCurrentTenantId();
    console.log(`[cache miss] loading students for tenant: ${tenantId}`);
    return STUDENTS.filter((s) => s.tenantId === tenantId);
  }
}
