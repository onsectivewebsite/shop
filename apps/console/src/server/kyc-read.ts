import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const READ_TTL_SECONDS = 5 * 60;

function s3(): S3Client {
  return new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' });
}

function bucket(): string {
  const b = process.env.S3_BUCKET_KYC;
  if (!b) throw new Error('S3_BUCKET_KYC env var is not set.');
  return b;
}

/**
 * Issue a short-lived presigned GET URL for an admin to review a KYC document.
 * The URL embeds the bucket + path + expiry signature, so anyone with the URL
 * can read the file for the next 5 minutes — keep it out of logs and don't
 * paste it anywhere persistent.
 *
 * The route handler that calls this MUST gate on getConsoleSession (privileged
 * role) and verify the key belongs to a real KycDocument before issuing.
 */
export async function createKycReadUrl(key: string): Promise<{ url: string; expiresAt: Date }> {
  if (!key.startsWith('kyc/') || key.length > 512) {
    throw new Error('Invalid KYC key.');
  }
  const cmd = new GetObjectCommand({ Bucket: bucket(), Key: key });
  const url = await getSignedUrl(s3(), cmd, { expiresIn: READ_TTL_SECONDS });
  return {
    url,
    expiresAt: new Date(Date.now() + READ_TTL_SECONDS * 1000),
  };
}
