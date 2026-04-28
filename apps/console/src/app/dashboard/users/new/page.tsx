import Link from 'next/link';
import { createUserAction } from './actions';

export const metadata = { title: 'Create user · Console' };

export default function NewUserPage() {
  return (
    <div className="p-8">
      <Link href="/dashboard/users" className="text-sm text-slate-600 hover:text-slate-900">
        ← Back to users
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Create user</h1>
      <p className="mt-1 text-sm text-slate-500">
        Onboard a teammate (Support, Platform Manager, Admin) or create a buyer
        account on someone&rsquo;s behalf.
      </p>

      <form
        action={createUserAction}
        className="mt-8 max-w-xl space-y-5 rounded-lg border border-slate-200 bg-white p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Full name</label>
            <input
              name="fullName"
              required
              className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Country (ISO 2)</label>
            <input
              name="countryCode"
              defaultValue="US"
              maxLength={2}
              required
              className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm uppercase"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Email</label>
          <input
            name="email"
            type="email"
            required
            className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Temporary password</label>
          <input
            name="password"
            type="text"
            minLength={10}
            required
            className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-mono"
            placeholder="At least 10 characters"
          />
          <p className="mt-1 text-xs text-slate-500">
            Share with the user securely; they will be prompted to change it on first sign-in
            via password reset.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Roles</label>
          <select
            name="roles"
            multiple
            required
            defaultValue={['BUYER']}
            className="mt-1 h-44 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
          >
            <option value="BUYER">BUYER</option>
            <option value="SELLER">SELLER</option>
            <option value="SUPPORT_AGENT">SUPPORT_AGENT</option>
            <option value="PLATFORM_MANAGER">PLATFORM_MANAGER</option>
            <option value="CATALOG_MODERATOR">CATALOG_MODERATOR</option>
            <option value="FINANCE_OPS">FINANCE_OPS</option>
            <option value="ADMIN">ADMIN</option>
            <option value="OWNER">OWNER</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">Hold ⌘ / Ctrl to select multiple.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="h-10 rounded-md bg-brand-600 px-4 text-sm font-medium text-white"
          >
            Create user
          </button>
          <Link href="/dashboard/users" className="text-sm text-slate-600 hover:text-slate-900">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
