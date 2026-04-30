import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { prisma } from '../db';
import { sendDataExportEmail } from '../notifications';

/**
 * GDPR Article 20 data export.
 *
 * Bundles the user's owned records into a JSON document, uploads it to the
 * private data-exports bucket, presigns a 24-hour download URL, and emails
 * the link to the address recorded on the job (NOT the user's current email,
 * to keep the request bound to the identity that asked for it).
 *
 * Data scope: profile, addresses, sessions metadata, OTP/recovery audit
 * (no plaintext codes — only timing info), passkey metadata, orders + items
 * + shipments + returns, reviews, wishlist, organization memberships. We
 * deliberately omit: cart contents (transient), other users' data, anything
 * we don't own.
 */

const DOWNLOAD_TTL_HOURS = 24;
const DOWNLOAD_TTL_SECONDS = DOWNLOAD_TTL_HOURS * 60 * 60;

function s3() {
  return new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' });
}

function bucket(): string {
  const b = process.env.S3_BUCKET_DATA_EXPORTS;
  if (!b) throw new Error('S3_BUCKET_DATA_EXPORTS env var is not set.');
  return b;
}

export type DataExportPayload = {
  jobId: string;
};

export async function runDataExport(payload: DataExportPayload): Promise<{ s3Key: string; bytes: number }> {
  const job = await prisma.dataExportJob.update({
    where: { id: payload.jobId },
    data: { status: 'RUNNING', startedAt: new Date() },
  });

  try {
    const userId = job.userId;
    const [
      user,
      addresses,
      sessions,
      otps,
      recoveryCodes,
      passkeys,
      orders,
      reviews,
      wishlistItems,
      orgMemberships,
      returns,
    ] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          emailVerified: true,
          phone: true,
          phoneVerified: true,
          fullName: true,
          locale: true,
          countryCode: true,
          roles: true,
          status: true,
          twoFactorEmail: true,
          twoFactorSms: true,
          lastLoginAt: true,
          lastLoginIp: true,
          lastLoginUserAgent: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.address.findMany({ where: { userId } }),
      prisma.session.findMany({
        where: { userId },
        select: {
          id: true,
          userAgent: true,
          ipAddress: true,
          expiresAt: true,
          createdAt: true,
        },
      }),
      prisma.otp.findMany({
        where: { userId },
        select: {
          id: true,
          channel: true,
          purpose: true,
          destination: true,
          attempts: true,
          expiresAt: true,
          consumedAt: true,
          createdAt: true,
        },
      }),
      prisma.recoveryCode.findMany({
        where: { userId },
        select: { id: true, consumedAt: true, createdAt: true },
      }),
      prisma.passkey.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          deviceType: true,
          backedUp: true,
          createdAt: true,
          lastUsedAt: true,
        },
      }),
      prisma.order.findMany({
        where: { buyerId: userId },
        include: {
          items: true,
          shipments: true,
          events: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.review.findMany({ where: { buyerId: userId } }),
      prisma.wishlistItem.findMany({ where: { userId } }),
      prisma.organizationMember.findMany({ where: { userId } }),
      prisma.return.findMany({ where: { buyerId: userId } }),
    ]);

    const payloadJson = {
      generatedAt: new Date().toISOString(),
      schemaVersion: 1,
      user,
      addresses,
      sessions,
      otps,
      recoveryCodes,
      passkeys,
      orders,
      reviews,
      wishlistItems,
      orgMemberships,
      returns,
    };

    // BigInt fields (passkey.counter etc.) aren't JSON-serializable by
    // default; coerce to string so the export round-trips cleanly.
    const body = Buffer.from(
      JSON.stringify(payloadJson, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
      'utf8',
    );

    const client = s3();
    const key = `exports/${userId}/${job.id}.json`;
    await client.send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: key,
        Body: body,
        ContentType: 'application/json',
        // Defense in depth — server-side encrypted, no public access.
        ServerSideEncryption: 'AES256',
      }),
    );

    const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket(), Key: key }), {
      expiresIn: DOWNLOAD_TTL_SECONDS,
    });
    const expiresAt = new Date(Date.now() + DOWNLOAD_TTL_SECONDS * 1000);

    await prisma.dataExportJob.update({
      where: { id: job.id },
      data: {
        status: 'READY',
        s3Key: key,
        bytes: body.byteLength,
        expiresAt,
        completedAt: new Date(),
      },
    });

    await sendDataExportEmail(job.emailedTo, { url, expiresAt, bytes: body.byteLength });

    return { s3Key: key, bytes: body.byteLength };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.dataExportJob.update({
      where: { id: job.id },
      data: { status: 'FAILED', error: message.slice(0, 500), completedAt: new Date() },
    });
    throw err;
  }
}
