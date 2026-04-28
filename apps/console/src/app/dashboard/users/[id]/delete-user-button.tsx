'use client';

import { Button } from '@onsective/ui';
import { deleteUserAction } from './actions';

export function DeleteUserButton({ userId }: { userId: string }) {
  return (
    <form
      action={deleteUserAction.bind(null, userId)}
      onSubmit={(e) => {
        if (!confirm('Delete this user? This is reversible only via DB restore.')) {
          e.preventDefault();
        }
      }}
    >
      <Button variant="destructive" size="sm" type="submit">
        Delete user
      </Button>
    </form>
  );
}
