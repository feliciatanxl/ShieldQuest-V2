// Educator area of the Scenario Portal (lazy-loaded): Library, Editor and the Moment Cards queue.

import { useCallback, useEffect, useState } from 'react';
import { api, PortalError } from './api';
import { Editor } from './Editor';
import { Library } from './Library';
import type { CustomMissionSummary } from './model';
import { Moderation } from './Moderation';

export interface CustomList {
  missions: CustomMissionSummary[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Custom missions with their server-side lint results. */
export function useCustomMissions(): CustomList {
  const [missions, setMissions] = useState<CustomMissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<{ missions: CustomMissionSummary[] }>('/api/missions/custom', { auth: true });
      setMissions(r.missions);
      setError(null);
    } catch (e) {
      setError(e instanceof PortalError ? e.message : 'Could not load custom missions.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { missions, loading, error, reload };
}

export default function EducatorArea({ tab, params }: { tab: 'library' | 'editor' | 'moderation'; params: URLSearchParams }) {
  const custom = useCustomMissions();
  if (tab === 'editor') {
    return <Editor custom={custom} openId={params.get('id')} template={params.get('template')} />;
  }
  if (tab === 'moderation') return <Moderation />;
  return <Library custom={custom} />;
}
