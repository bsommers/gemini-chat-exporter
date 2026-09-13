export interface ImageAsset {
  id: string;
  src: string;
  alt: string;
  base64: string | null;
  ext: string;
}

export interface Turn {
  role: 'user' | 'model';
  html: string;
  text: string;
}

export interface ChatData {
  title: string;
  turns: Turn[];
  images: ImageAsset[];
  error?: string;
}
