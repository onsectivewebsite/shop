import { randomBytes } from 'node:crypto';
import { S3Client, type ObjectCannedACL } from '@aws-sdk/client-s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME)[number];

export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
const URL_TTL_SECONDS = 60 * 5;

const EXT_BY_MIME: Record<AllowedImageMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

function s3Client(): S3Client {
  return new S3Client({
    region: process.env.AWS_REGION ?? 'us-east-1',
  });
}

function bucket(): string {
  const b = process.env.S3_BUCKET_PRODUCTS;
  if (!b) throw new Error('S3_BUCKET_PRODUCTS env var is not set.');
  return b;
}

function publicUrlFor(key: string): string {
  const base = process.env.S3_PUBLIC_URL_BASE;
  if (base) return `${base.replace(/\/$/, '')}/${key}`;
  // Default to virtual-hosted-style URL (works without CloudFront in dev).
  const region = process.env.AWS_REGION ?? 'us-east-1';
  return `https://${bucket()}.s3.${region}.amazonaws.com/${key}`;
}

export async function createProductImageUploadUrl(args: {
  sellerId: string;
  contentType: AllowedImageMime;
  sizeBytes: number;
}): Promise<{ url: string; key: string; publicUrl: string; expiresAt: Date }> {
  if (args.sizeBytes > MAX_PRODUCT_IMAGE_BYTES) {
    throw new Error(`Image must be ≤ ${MAX_PRODUCT_IMAGE_BYTES} bytes.`);
  }
  if (!ALLOWED_IMAGE_MIME.includes(args.contentType)) {
    throw new Error('Unsupported image type.');
  }

  const ext = EXT_BY_MIME[args.contentType];
  const id = randomBytes(12).toString('hex');
  const key = `sellers/${args.sellerId}/products/${id}.${ext}`;

  // Note: bucket must have a CORS rule allowing PUT from the browser origin.
  // Object lands public-read so the public URL works without CloudFront in dev.
  // In prod, switch the bucket policy to private + serve via CloudFront OAC.
  const cmd = new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    ContentType: args.contentType,
    ACL: 'public-read' as ObjectCannedACL,
  });

  const url = await getSignedUrl(s3Client(), cmd, {
    expiresIn: URL_TTL_SECONDS,
  });

  return {
    url,
    key,
    publicUrl: publicUrlFor(key),
    expiresAt: new Date(Date.now() + URL_TTL_SECONDS * 1000),
  };
}
