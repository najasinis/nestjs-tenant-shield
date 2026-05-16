import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from './student.entity';
import { Cacheable, RequireTenant } from '../../../../src';

/**
 * ─────────────────────────────────────────────────────────────
 * StudentsService — 라이브러리 사용 패턴의 정석.
 *
 * 주목할 점:
 *  - tenantId 파라미터가 메서드에 0번 등장합니다.
 *  - WHERE에 tenant_id를 손으로 적는 일도 0번입니다.
 *  - 모든 격리는 클래스 위의 @RequireTenant() 한 줄이 책임집니다.
 *
 * 만약 어떤 메서드를 빼먹어 보호가 안 됐다면, 그 메서드를 호출하는 순간
 * Subscriber의 afterLoad가 cross-tenant 데이터를 잡아 CrossTenantAccessError를
 * 던집니다 — 다층 방어의 마지막 안전망.
 * ─────────────────────────────────────────────────────────────
 */
@Injectable()
@RequireTenant()
export class StudentsService {
  constructor(
    @InjectRepository(Student)
    private readonly repo: Repository<Student>,
  ) {}

  /**
   * 현재 tenant의 학생 목록 조회.
   * find()에 where를 안 줘도 Subscriber가 자동으로 tenant_id 조건을 붙입니다.
   */
  async findAll(): Promise<Student[]> {
    return this.repo.find();
  }

  /**
   * 단건 조회. id만 받지만, 같은 id가 다른 tenant에 있어도 절대 반환되지 않음.
   */
  async findOne(id: number): Promise<Student | null> {
    return this.repo.findOne({ where: { id } });
  }

  /**
   * 학생 생성. 호출자가 tenantId를 명시할 필요 없음 — Subscriber의 beforeInsert가
   * 현재 컨텍스트의 tenantId를 자동으로 entity에 박아 넣습니다.
   */
  async create(dto: { name: string; grade: number }): Promise<Student> {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  /**
   * 통계 — 자주 호출되는 read 메서드라 캐싱.
   * tenantScoped: true 덕분에 학원 A와 학원 B의 통계가 절대 섞이지 않음.
   *
   * 캐시 키 예: 'academy-A:StudentsService.getStatistics:[]'
   *             'academy-B:StudentsService.getStatistics:[]'
   */
  @Cacheable({ ttl: 300, tenantScoped: true })
  async getStatistics(): Promise<{ total: number; averageGrade: number }> {
    const all = await this.repo.find();
    return {
      total: all.length,
      averageGrade:
        all.reduce((sum, s) => sum + s.grade, 0) / Math.max(all.length, 1),
    };
  }
}
