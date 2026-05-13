import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * ─────────────────────────────────────────────────────────────
 * 학생 entity — discriminator 패턴의 가장 기본 형태.
 *
 * 핵심 포인트는 두 가지:
 *  1) tenantId 컬럼이 반드시 존재해야 함 (라이브러리가 자동 WHERE 주입할 대상)
 *  2) tenantId 컬럼에 인덱스를 걸어야 쿼리가 빠름
 *     (모든 SELECT에 WHERE tenant_id가 붙으므로 인덱스 없으면 성능 폭망)
 * ─────────────────────────────────────────────────────────────
 */
@Entity('students')
// tenantId 단독 인덱스. tenant 내부 검색이 잦다면 (tenantId, name) 같은 복합 인덱스도 추가.
@Index(['tenantId'])
export class Student {
  // 자동 증가 PK. 라이브러리는 PK 형태에 의존하지 않음 (UUID도 OK).
  @PrimaryGeneratedColumn()
  id: number;

  // ⭐ 멀티테넌시의 핵심 컬럼.
  //    nullable: false — 절대 NULL이면 안 됨. NULL이면 어느 tenant 것인지 모르게 됨.
  @Column({ nullable: false })
  tenantId: string;

  @Column()
  name: string;

  @Column({ type: 'int', default: 0 })
  grade: number;
}
