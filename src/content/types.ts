export interface ImageAsset {
  id: string;
  src: string;
  alt: string;
  base64: string | null;
  ext: string;
}

export interface Thought {
  text: string;
  html: string;
  duration: string | null;
}

export interface Citation {
  index: string | null;
  title: string;
  url: string;
  snippet: string;
}

export interface Attachment {
  name: string;
  type: string;
}

export interface Turn {
  role: 'user' | 'model';
  html: string;
  text: string;
  thought?: Thought;
  citations?: Citation[];
  attachments?: Attachment[];
}

export interface ChatData {
  title: string;
  turns: Turn[];
  images: ImageAsset[];
  error?: string;
}
