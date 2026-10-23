/** Errors the data layer throws; each message is ready to show on screen. */
export class BudaeError extends Error {}

export class NameTakenError extends BudaeError {
  constructor() {
    super('방금 다른 사람이 이 이름으로 들어갔어요. 선생님께 말해 주세요.');
  }
}
export class NotOnRosterError extends BudaeError {
  constructor() {
    super('명단에 없는 이름이에요. 선생님께 말해 주세요.');
  }
}
export class InvalidPinError extends BudaeError {}
export class WrongPinError extends BudaeError {
  constructor() {
    super('암호가 맞지 않아요');
  }
}
export class TooManyTriesError extends BudaeError {
  constructor() {
    super('너무 많이 틀렸어요. 잠시 후 다시 해 보세요.');
  }
}
export class SessionExpiredError extends BudaeError {
  constructor(readonly reason: 'reset' | 'removed') {
    super(reason === 'reset'
      ? '선생님이 암호를 초기화했어요. 다시 들어와 주세요.'
      : '반 명단에서 빠졌어요. 선생님께 말해 주세요.');
  }
}
export class FireOffError extends BudaeError {
  constructor() {
    super('💤 불이 꺼져 있어서 쓸 수 없어요');
  }
}
export class TooFastError extends BudaeError {
  constructor() {
    super('조금 천천히 보내요');
  }
}
export class TooLongError extends BudaeError {
  constructor() {
    super('500자까지 쓸 수 있어요');
  }
}
export class BannedError extends BudaeError {
  constructor() {
    super('이 냄비에서 잠시 나와 있어요');
  }
}
export class RoomGoneError extends BudaeError {
  constructor() {
    super('이 냄비에는 들어갈 수 없어요');
  }
}
export class InvalidNameError extends BudaeError {}

export function errorCode(e: unknown): string {
  return typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';
}

export function isPermissionDenied(e: unknown): boolean {
  const code = errorCode(e);
  return code === 'permission-denied' || code === 'PERMISSION_DENIED';
}
