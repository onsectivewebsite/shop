'use client';

import { useState, useTransition } from 'react';
import { Button, Card, CardContent, Input, Label } from '@onsective/ui';
import {
  createCampaignAction,
  previewAudienceAction,
} from './actions';

type AudienceMode =
  | 'all'
  | 'country'
  | 'joinedWithinDays'
  | 'joinedBeforeDays'
  | 'placedOrderInLastDays'
  | 'noOrderInLastDays'
  | 'isPrime';

const MODE_LABELS: Record<AudienceMode, string> = {
  all: 'Everyone opted in',
  country: 'Specific country',
  joinedWithinDays: 'Joined within last N days',
  joinedBeforeDays: 'Joined more than N days ago',
  placedOrderInLastDays: 'Ordered in last N days',
  noOrderInLastDays: 'No order in last N days',
  isPrime: 'Active Prime members',
};

export function NewCampaignForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [previewSize, setPreviewSize] = useState<number | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [templateKey, setTemplateKey] = useState<'announcement' | 'winback'>('announcement');
  const [mode, setMode] = useState<AudienceMode>('all');
  const [param, setParam] = useState<string>('');
  const [scheduleNow, setScheduleNow] = useState(true);
  const [scheduledFor, setScheduledFor] = useState<string>('');

  function buildAudience(): Record<string, unknown> {
    if (mode === 'all') return { all: true };
    if (mode === 'isPrime') return { isPrime: true };
    if (mode === 'country') return { country: param.toUpperCase() };
    const n = Number(param);
    if (!Number.isFinite(n) || n <= 0) return {};
    return { [mode]: Math.floor(n) };
  }

  async function preview() {
    setError(null);
    setPreviewBusy(true);
    try {
      const result = await previewAudienceAction(buildAudience());
      setPreviewSize(result.size);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
      setPreviewSize(null);
    } finally {
      setPreviewBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <h2 className="text-lg font-semibold">New campaign</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ec-name">Internal name</Label>
            <Input
              id="ec-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="May winback push"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ec-template">Template</Label>
            <select
              id="ec-template"
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value as 'announcement' | 'winback')}
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="announcement">Announcement</option>
              <option value="winback">Winback</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ec-subject">Subject line</Label>
          <Input
            id="ec-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={180}
            placeholder="Something new on Onsective"
          />
        </div>

        <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
          <legend className="px-1 text-sm font-medium text-slate-900">
            Audience
          </legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {(Object.keys(MODE_LABELS) as AudienceMode[]).map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="audience-mode"
                  value={m}
                  checked={mode === m}
                  onChange={() => {
                    setMode(m);
                    setParam('');
                    setPreviewSize(null);
                  }}
                />
                {MODE_LABELS[m]}
              </label>
            ))}
          </div>
          {mode === 'country' && (
            <Input
              value={param}
              onChange={(e) => {
                setParam(e.target.value);
                setPreviewSize(null);
              }}
              maxLength={2}
              placeholder="US"
              className="uppercase"
            />
          )}
          {(mode === 'joinedWithinDays' ||
            mode === 'joinedBeforeDays' ||
            mode === 'placedOrderInLastDays' ||
            mode === 'noOrderInLastDays') && (
            <Input
              type="number"
              min={1}
              value={param}
              onChange={(e) => {
                setParam(e.target.value);
                setPreviewSize(null);
              }}
              placeholder="30"
            />
          )}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={preview}
              disabled={previewBusy}
              size="sm"
            >
              {previewBusy ? 'Counting…' : 'Preview audience size'}
            </Button>
            {previewSize !== null && (
              <p className="text-sm text-slate-700">
                <strong>{previewSize.toLocaleString()}</strong> opted-in users match
              </p>
            )}
          </div>
        </fieldset>

        <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
          <legend className="px-1 text-sm font-medium text-slate-900">When</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={scheduleNow}
              onChange={() => setScheduleNow(true)}
            />
            Send as soon as ops cron picks it up (≤ 1 min)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={!scheduleNow}
              onChange={() => setScheduleNow(false)}
            />
            Schedule for a later time
          </label>
          {!scheduleNow && (
            <Input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
            />
          )}
        </fieldset>

        {error && <p className="text-sm text-error-600">{error}</p>}

        <div className="flex gap-3">
          <Button
            type="button"
            disabled={
              pending ||
              name.trim().length < 1 ||
              subject.trim().length < 1 ||
              (mode !== 'all' && mode !== 'isPrime' && param.trim().length === 0) ||
              (!scheduleNow && !scheduledFor)
            }
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  await createCampaignAction({
                    name: name.trim(),
                    subject: subject.trim(),
                    templateKey,
                    audience: buildAudience(),
                    scheduledFor: scheduleNow
                      ? new Date()
                      : new Date(scheduledFor),
                  });
                  setName('');
                  setSubject('');
                  setParam('');
                  setScheduledFor('');
                  setPreviewSize(null);
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Could not save');
                }
              });
            }}
          >
            {pending ? 'Saving…' : scheduleNow ? 'Schedule send' : 'Schedule for later'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
