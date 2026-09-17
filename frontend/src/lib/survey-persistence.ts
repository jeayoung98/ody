export interface SurveyPersistenceContext {
  backendEnabled: boolean;
  hostname: string;
  localTestDatabase: boolean;
}

export function isLoopbackBackend(origin?: string): boolean {
  if (!origin) return false;
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname);
  } catch {
    return false;
  }
}

/** 로컬은 명시적으로 연결한 로컬 DB에만, 배포 환경은 운영 DB에 저장한다. */
export function shouldPersistSurvey(context: SurveyPersistenceContext): boolean {
  if (!context.backendEnabled) return false;
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(context.hostname);
  return local ? context.localTestDatabase : true;
}
