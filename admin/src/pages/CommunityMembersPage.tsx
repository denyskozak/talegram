import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useTrpc } from '../api/trpcProvider.js';
import './CommunityMembersPage.css';

type CommunityMember = {
  id: number;
  telegramUserId: string;
  rank: number;
  fullName: string;
  createdAt: string;
  updatedAt: string;
};

type RequestState = 'idle' | 'loading' | 'error';

type FormState = 'idle' | 'submitting';

export function CommunityMembersPage(): JSX.Element {
  const { client } = useTrpc();
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [state, setState] = useState<RequestState>('idle');
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [telegramUserId, setTelegramUserId] = useState('');
  const [rank, setRank] = useState('1');
  const [formState, setFormState] = useState<FormState>('idle');
  const [formError, setFormError] = useState<string | null>(null);

  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editTelegramUserId, setEditTelegramUserId] = useState('');
  const [editRank, setEditRank] = useState('1');
  const [editState, setEditState] = useState<FormState>('idle');
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMembers() {
      setState('loading');
      setError(null);
      try {
        const response = await client.admin.listCommunityMembers.query();
        if (!cancelled) {
          setMembers(response);
          setState('idle');
        }
      } catch (err) {
        console.error('Failed to load community members', err);
        if (!cancelled) {
          setError('Failed to load community members. Please try again later.');
          setState('error');
        }
      }
    }

    loadMembers();

    return () => {
      cancelled = true;
    };
  }, [client]);

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      if (a.rank !== b.rank) {
        return a.rank - b.rank;
      }
      return a.fullName.localeCompare(b.fullName);
    });
  }, [members]);

  const isLoading = state === 'loading';

  const resetCreateForm = () => {
    setFullName('');
    setTelegramUserId('');
    setRank('1');
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const trimmedName = fullName.trim();
    const trimmedTelegram = telegramUserId.trim();
    const rankValue = Number.parseInt(rank, 10);

    if (!trimmedName || !trimmedTelegram || Number.isNaN(rankValue) || rankValue < 1) {
      setFormError('Please provide a full name, Telegram user ID, and a rank of 1 or higher.');
      return;
    }

    setFormState('submitting');
    try {
      const created = await client.admin.createCommunityMember.mutate({
        fullName: trimmedName,
        telegramUserId: trimmedTelegram,
        rank: rankValue,
      });
      setMembers((prev) => [...prev, created]);
      resetCreateForm();
    } catch (err) {
      console.error('Failed to create community member', err);
      setFormError('Failed to create community member. Please verify the data and try again.');
    } finally {
      setFormState('idle');
    }
  };

  const startEditing = (member: CommunityMember) => {
    setEditingMemberId(member.id);
    setEditFullName(member.fullName);
    setEditTelegramUserId(member.telegramUserId);
    setEditRank(String(member.rank));
    setEditError(null);
  };

  const cancelEditing = () => {
    setEditingMemberId(null);
    setEditFullName('');
    setEditTelegramUserId('');
    setEditRank('1');
    setEditError(null);
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingMemberId) {
      return;
    }

    setEditError(null);
    const trimmedName = editFullName.trim();
    const trimmedTelegram = editTelegramUserId.trim();
    const rankValue = Number.parseInt(editRank, 10);

    if (!trimmedName || !trimmedTelegram || Number.isNaN(rankValue) || rankValue < 1) {
      setEditError('Please fill in all fields with valid values.');
      return;
    }

    setEditState('submitting');
    try {
      const updated = await client.admin.updateCommunityMember.mutate({
        id: editingMemberId,
        patch: {
          fullName: trimmedName,
          telegramUserId: trimmedTelegram,
          rank: rankValue,
        },
      });

      setMembers((prev) => prev.map((member) => (member.id === updated.id ? updated : member)));
      cancelEditing();
    } catch (err) {
      console.error('Failed to update community member', err);
      setEditError('Failed to update community member. Please try again.');
    } finally {
      setEditState('idle');
    }
  };

  const handleDelete = async (member: CommunityMember) => {
    const confirmed = window.confirm(`Remove ${member.fullName} from the community?`);
    if (!confirmed) {
      return;
    }

    try {
      await client.admin.deleteCommunityMember.mutate({ id: member.id });
      setMembers((prev) => prev.filter((existing) => existing.id !== member.id));
      if (editingMemberId === member.id) {
        cancelEditing();
      }
    } catch (err) {
      console.error('Failed to delete community member', err);
      alert('Failed to delete community member. Please try again.');
    }
  };

  return (
    <div className="community-members">
      <header className="community-members__header">
        <div>
          <h1>Community members</h1>
          <p>Grant or revoke access to proposal review materials for trusted voters.</p>
        </div>
      </header>

      <section className="community-members__section">
        <h2>Add new member</h2>
        <form className="community-members__form" onSubmit={handleCreate}>
          <label className="community-members__field">
            <span>Full name</span>
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Jane Reviewer" />
          </label>
          <label className="community-members__field">
            <span>Telegram user ID</span>
            <input value={telegramUserId} onChange={(event) => setTelegramUserId(event.target.value)} placeholder="123456789" />
          </label>
          <label className="community-members__field">
            <span>Rank</span>
            <input type="number" min={1} value={rank} onChange={(event) => setRank(event.target.value)} />
          </label>
          {formError ? <div className="community-members__error">{formError}</div> : null}
          <button type="submit" disabled={formState === 'submitting'}>
            {formState === 'submitting' ? 'Saving…' : 'Add member'}
          </button>
        </form>
      </section>

      <section className="community-members__section">
        <h2>Current members</h2>
        {error ? <div className="community-members__error">{error}</div> : null}
        {isLoading ? (
          <div className="community-members__empty">Loading members…</div>
        ) : sortedMembers.length === 0 ? (
          <div className="community-members__empty">No community members yet.</div>
        ) : (
          <div className="community-members__table-wrapper">
            <table className="community-members__table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Telegram ID</th>
                  <th>Rank</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedMembers.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="community-members__name">{member.fullName}</div>
                      <div className="community-members__meta">ID: {member.id}</div>
                    </td>
                    <td>{member.telegramUserId}</td>
                    <td>{member.rank}</td>
                    <td>
                      <div className="community-members__actions">
                        <button type="button" onClick={() => startEditing(member)}>Edit</button>
                        <button type="button" onClick={() => handleDelete(member)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editingMemberId ? (
        <section className="community-members__edit-section">
          <h3>Edit member</h3>
          <form className="community-members__edit-form" onSubmit={handleUpdate}>
            <label className="community-members__field">
              <span>Full name</span>
              <input value={editFullName} onChange={(event) => setEditFullName(event.target.value)} />
            </label>
            <label className="community-members__field">
              <span>Telegram user ID</span>
              <input value={editTelegramUserId} onChange={(event) => setEditTelegramUserId(event.target.value)} />
            </label>
            <label className="community-members__field">
              <span>Rank</span>
              <input type="number" min={1} value={editRank} onChange={(event) => setEditRank(event.target.value)} />
            </label>
            {editError ? <div className="community-members__error">{editError}</div> : null}
            <div className="community-members__edit-controls">
              <button type="submit" disabled={editState === 'submitting'}>
                {editState === 'submitting' ? 'Saving…' : 'Save changes'}
              </button>
              <button type="button" onClick={cancelEditing} disabled={editState === 'submitting'}>
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
