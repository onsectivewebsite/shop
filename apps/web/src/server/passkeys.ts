import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/types';
import { prisma } from './db';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function rpId(): string {
  return process.env.WEBAUTHN_RP_ID ?? 'localhost';
}

function rpName(): string {
  return process.env.WEBAUTHN_RP_NAME ?? 'Onsective';
}

function expectedOrigins(): string[] {
  const raw = process.env.WEBAUTHN_ORIGIN ?? 'http://localhost:3000';
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

/**
 * Issue registration options for the currently-signed-in user. The challenge
 * is stored in WebAuthnChallenge for verification on the second leg.
 */
export async function startRegistration(args: {
  userId: string;
  userEmail: string;
  userDisplayName: string | null;
}) {
  const existing = await prisma.passkey.findMany({
    where: { userId: args.userId },
    select: { credentialId: true, transports: true },
  });

  const options = await generateRegistrationOptions({
    rpName: rpName(),
    rpID: rpId(),
    userName: args.userEmail,
    userDisplayName: args.userDisplayName ?? args.userEmail,
    userID: new TextEncoder().encode(args.userId),
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: c.transports as AuthenticatorTransportFuture[],
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  await prisma.webAuthnChallenge.create({
    data: {
      userId: args.userId,
      type: 'REGISTER',
      challenge: options.challenge,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  });

  return options;
}

export async function finishRegistration(args: {
  userId: string;
  response: RegistrationResponseJSON;
  name?: string;
}) {
  const challenge = await prisma.webAuthnChallenge.findFirst({
    where: { userId: args.userId, type: 'REGISTER', expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!challenge) throw new Error('No active registration challenge — restart from settings.');

  const verification = await verifyRegistrationResponse({
    response: args.response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: expectedOrigins(),
    expectedRPID: rpId(),
    requireUserVerification: false,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Registration could not be verified.');
  }

  const info = verification.registrationInfo;
  const credential = info.credential;

  await prisma.$transaction([
    prisma.passkey.create({
      data: {
        userId: args.userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: BigInt(credential.counter),
        transports: credential.transports ?? [],
        deviceType: info.credentialDeviceType,
        backedUp: info.credentialBackedUp,
        name: args.name?.slice(0, 80) ?? null,
      },
    }),
    prisma.webAuthnChallenge.delete({ where: { id: challenge.id } }),
  ]);

  return { credentialId: credential.id };
}

/**
 * Issue authentication options. If `email` is supplied we narrow allowCredentials
 * to that user's keys; otherwise we issue a discoverable-credential challenge.
 */
export async function startAuthentication(args: { email?: string }) {
  let allowCredentials: Array<{
    id: string;
    type: 'public-key';
    transports?: AuthenticatorTransportFuture[];
  }> = [];
  let userId: string | null = null;

  if (args.email) {
    const user = await prisma.user.findUnique({
      where: { email: args.email },
      include: { passkeys: { select: { credentialId: true, transports: true } } },
    });
    if (user) {
      userId = user.id;
      allowCredentials = user.passkeys.map((p) => ({
        id: p.credentialId,
        type: 'public-key' as const,
        transports: p.transports as AuthenticatorTransportFuture[],
      }));
    }
  }

  const options = await generateAuthenticationOptions({
    rpID: rpId(),
    allowCredentials,
    userVerification: 'preferred',
  });

  await prisma.webAuthnChallenge.create({
    data: {
      userId,
      email: args.email ?? null,
      type: 'AUTHENTICATE',
      challenge: options.challenge,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  });

  return options;
}

export async function finishAuthentication(args: {
  email?: string;
  response: AuthenticationResponseJSON;
}): Promise<{ userId: string }> {
  const passkey = await prisma.passkey.findUnique({
    where: { credentialId: args.response.id },
    include: { user: true },
  });
  if (!passkey) throw new Error('Unknown credential.');

  const challenge = await prisma.webAuthnChallenge.findFirst({
    where: {
      type: 'AUTHENTICATE',
      expiresAt: { gt: new Date() },
      OR: [
        { userId: passkey.userId },
        ...(args.email ? [{ email: args.email }] : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!challenge) throw new Error('No active authentication challenge.');

  const verification = await verifyAuthenticationResponse({
    response: args.response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: expectedOrigins(),
    expectedRPID: rpId(),
    credential: {
      id: passkey.credentialId,
      publicKey: new Uint8Array(passkey.publicKey),
      counter: Number(passkey.counter),
      transports: passkey.transports as AuthenticatorTransportFuture[],
    },
    requireUserVerification: false,
  });

  if (!verification.verified) {
    throw new Error('Authentication could not be verified.');
  }

  await prisma.$transaction([
    prisma.passkey.update({
      where: { id: passkey.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: new Date(),
      },
    }),
    prisma.webAuthnChallenge.delete({ where: { id: challenge.id } }),
  ]);

  return { userId: passkey.userId };
}
