export interface Credentials {
  apiUrl: string;
  idInstance: string;
  apiTokenInstance: string;
}

export type MessageStatus = 'sending' | 'sent' | 'failed';

export interface Message {
  id: string;
  chatId: string;
  text: string;
  direction: 'in' | 'out';
  timestamp: number;
  status: MessageStatus;
  error?: string;
}

export interface Chat {
  id: string;
  title: string;
  phone?: string;
  lastActivity: number;
  unread: number;
}
