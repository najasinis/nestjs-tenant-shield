import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { StudentsService } from './students.service';

/**
 * ─────────────────────────────────────────────────────────────
 * 컨트롤러는 멀티테넌시를 의식하지 않아도 됩니다.
 *
 * TenantContextMiddleware가 이미 요청 헤더에서 tenant ID를 꺼내
 * AsyncLocalStorage에 깔아둔 상태이므로, 핸들러는 깨끗한 비즈니스
 * 입력만 받고 서비스를 호출합니다.
 *
 * "tenant_id는 어디 갔지?" 같은 질문이 안 생기는 게 핵심 가치.
 * ─────────────────────────────────────────────────────────────
 */
@Controller('students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  // GET /students
  // 요청 헤더: x-tenant-id: academy-A
  // 응답: academy-A 학생만 들어 있는 배열
  @Get()
  async list() {
    return this.students.findAll();
  }

  // GET /students/stats  — @Cacheable 데모. 두 번째 호출부터 캐시 hit.
  @Get('stats')
  async stats() {
    return this.students.getStatistics();
  }

  // GET /students/:id
  // 다른 tenant의 같은 id는 절대 반환되지 않음.
  @Get(':id')
  async getOne(@Param('id', ParseIntPipe) id: number) {
    return this.students.findOne(id);
  }

  // POST /students  Body: { name, grade }
  // 컨트롤러/DTO에는 tenantId가 없음 — 라이브러리가 자동으로 채움.
  @Post()
  async create(@Body() dto: { name: string; grade: number }) {
    return this.students.create(dto);
  }
}
