import type { SessionsGetResponse, SessionsListResponse } from '@littlething/sdk';

export type Session = SessionsListResponse['sessions'][number];
export type Message = SessionsGetResponse['session']['messages'][number];
export type SessionDetail = {
  meta: Session;
  messages: Message[];
};
