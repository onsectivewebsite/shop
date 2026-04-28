import Link from 'next/link';
import { prisma } from '@onsective/db';
import { Card, CardContent, Badge } from '@onsective/ui';

export const metadata = { title: 'Users · Console' };

export default async function ConsoleUsers({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = searchParams.q ?? '';
  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { fullName: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      email: true,
      fullName: true,
      countryCode: true,
      roles: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900">Users</h1>

      <form className="mt-4 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by email or name…"
          className="h-10 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm"
        />
        <button className="h-10 rounded-md bg-brand-600 px-4 text-sm font-medium text-white">
          Search
        </button>
      </form>

      {users.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-12 text-center text-sm text-slate-500">
            No users found.
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">Roles</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.fullName ?? '—'}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">{u.countryCode}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <Badge key={r}>{r}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {u.lastLoginAt ? u.lastLoginAt.toLocaleString() : 'never'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/dashboard/users/${u.id}`} className="text-brand-600 hover:underline">
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
