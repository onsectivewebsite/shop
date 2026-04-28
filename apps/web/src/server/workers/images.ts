import sharp from 'sharp';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { ImageVariantsJob } from '../queue';

/**
 * Generate web-resolution variants for a product image. Original is left in
 * place; variants are written next to it under a `_variants/` suffix:
 *
 *   sellers/<id>/products/<id>.jpg                       (original)
 *   sellers/<id>/products/<id>_variants/200.webp         (long edge 200)
 *   sellers/<id>/products/<id>_variants/400.webp
 *   sellers/<id>/products/<id>_variants/800.webp
 *   sellers/<id>/products/<id>_variants/1200.webp
 *
 * webp is used for variants regardless of source format — smallest payload
 * with universal browser support post-2020.
 */

const VARIANT_WIDTHS = [200, 400, 800, 1200] as const;

function s3() {
  return new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' });
}

function bucket(): string {
  const b = process.env.S3_BUCKET_PRODUCTS;
  if (!b) throw new Error('S3_BUCKET_PRODUCTS env var is not set.');
  return b;
}

function variantKey(sourceKey: string, width: number): string {
  // Strip extension, append /_variants/{width}.webp
  const dot = sourceKey.lastIndexOf('.');
  const stem = dot === -1 ? sourceKey : sourceKey.slice(0, dot);
  return `${stem}_variants/${width}.webp`;
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks);
}

export async function processImageVariants(job: ImageVariantsJob): Promise<{
  generated: string[];
}> {
  const client = s3();

  const obj = await client.send(
    new GetObjectCommand({ Bucket: bucket(), Key: job.sourceKey }),
  );
  if (!obj.Body) throw new Error(`Object ${job.sourceKey} has no body`);
  const original = await streamToBuffer(obj.Body as NodeJS.ReadableStream);

  const generated: string[] = [];

  for (const width of VARIANT_WIDTHS) {
    const buf = await sharp(original)
      .rotate() // honour EXIF orientation
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    const key = variantKey(job.sourceKey, width);
    await client.send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: key,
        Body: buf,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
        ACL: 'public-read',
      }),
    );
    generated.push(key);
  }

  return { generated };
}
