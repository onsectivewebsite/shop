import { randomBytes } from 'node:crypto';
import { S3Client, type ObjectCannedACL, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME)[number];

export const ALLOWED_KYC_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;
export type AllowedKycMime = (typeof ALLOWED_KYC_MIME)[number];

export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_KYC_DOC_BYTES = 10 * 1024 * 1024; // KYC scans are larger than product images
const URL_TTL_SECONDS = 60 * 5;

const EXT_BY_MIME: Record<AllowedImageMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

function s3Client(): S3Client {
  return new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' });
}

function bucket(): string {
  const b = process.env.S3_BUCKET_PRODUCTS;
  if (!b) throw new Error('S3_BUCKET_PRODUCTS env var is not set.');
  return b;
}

function publicUrlFor(key: string): string {
  const base = process.env.S3_PUBLIC_URL_BASE;
  if (base) return `${base.replace(/\/$/, '')}/${key}`;
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

  const cmd = new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    ContentType: args.contentType,
    ACL: 'public-read' as ObjectCannedACL,
  });

  const url = await getSignedUrl(s3Client(), cmd, { expiresIn: URL_TTL_SECONDS });
  return {
    url,
    key,
    publicUrl: publicUrlFor(key),
    expiresAt: new Date(Date.now() + URL_TTL_SECONDS * 1000),
  };
}

const KYC_EXT_BY_MIME: Record<AllowedKycMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

function kycBucket(): string {
  const b = process.env.S3_BUCKET_KYC;
  if (!b) throw new Error('S3_BUCKET_KYC env var is not set.');
  return b;
}

/**
 * KYC documents are private. Bucket should NOT have public-read ACL — admin
 * reviews docs via short-lived presigned GET URLs from the console.
 */
export async function createKycUploadUrl(args: {
  sellerId: string;
  docType: string;
  contentType: AllowedKycMime;
  sizeBytes: number;
}): Promise<{ url: string; key: string; expiresAt: Date }> {
  if (args.sizeBytes > MAX_KYC_DOC_BYTES) {
    throw new Error(`File must be ≤ ${MAX_KYC_DOC_BYTES} bytes.`);
  }
  if (!ALLOWED_KYC_MIME.includes(args.contentType)) {
    throw new Error('Unsupported document type. Use JPEG, PNG, WebP, or PDF.');
  }

  const ext = KYC_EXT_BY_MIME[args.contentType];
  const id = randomBytes(12).toString('hex');
  const key = `kyc/${args.sellerId}/${args.docType.toLowerCase()}/${id}.${ext}`;

  const cmd = new PutObjectCommand({
    Bucket: kycBucket(),
    Key: key,
    ContentType: args.contentType,
    // No ACL: bucket policy keeps these private. Admin reads via signed GET.
  });

  const url = await getSignedUrl(s3Client(), cmd, { expiresIn: URL_TTL_SECONDS });
  return {
    url,
    key,
    expiresAt: new Date(Date.now() + URL_TTL_SECONDS * 1000),
  };
}
