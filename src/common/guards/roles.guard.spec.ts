import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard.js';

describe('RolesGuard (STORY-006)', () => {
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);
  });

  const createMockContext = (user: any): ExecutionContext => {
    return {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow access if no roles are required on the route', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
    const context = createMockContext({ role: Role.PASSENGER });

    expect(rolesGuard.canActivate(context)).toBe(true);
  });

  it('should allow access if user has the required role (DRIVER)', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.DRIVER]);
    const context = createMockContext({ role: Role.DRIVER, name: 'Jashim' });

    expect(rolesGuard.canActivate(context)).toBe(true);
  });

  it('Scenario 3: should throw ForbiddenException when passenger tries to access driver endpoint (NFR-SEC-01)', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.DRIVER]);
    const context = createMockContext({ role: Role.PASSENGER, name: 'Nusrat' });

    expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => rolesGuard.canActivate(context)).toThrow('Insufficient permissions');
  });

  it('should throw ForbiddenException if user is not present in request', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.DRIVER]);
    const context = createMockContext(null);

    expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
  });
});
